"""最终隔离后端浏览器矩阵：四角色、桌面/手机和关键异常场景。

脚本只允许连接本机隔离服务。所有请求都经过真实 Spring/MySQL/FastAPI，
不拦截 API 响应；SSE 断开只在已建立真实连接后由客户端主动中止，用于验证恢复读取。
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import secrets
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/testing/evidence/frontend-live-final'
TINY_PNG = (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
    '+A8AAQUBAScY42YAAAAASUVORK5CYII='
)


def credentials():
    return os.getenv('ADMIN_USERNAME', ''), os.getenv('ADMIN_PASSWORD', '')


def call(client, base, method, route, body=None, *, key=None, expected='0000'):
    csrf = client.get(base + '/api/v1/auth/csrf').json()['data']
    headers = {csrf['headerName']: csrf['token']}
    if key:
        headers['Idempotency-Key'] = key
    response = client.fetch(base + '/api/v1' + route, method=method, data=body, headers=headers)
    payload = response.json()
    assert response.status == 200, (method, route, response.status, payload)
    if expected is not None:
        assert payload.get('code') == expected, (method, route, payload)
    return payload


def data(client, base, method, route, body=None, **kwargs):
    return call(client, base, method, route, body, **kwargs).get('data')


def register_and_login(client, base, prefix, display='最终矩阵账号'):
    username = prefix + '_' + uuid.uuid4().hex[:12]
    password = secrets.token_urlsafe(20)
    data(client, base, 'POST', '/auth/register', {'username': username, 'password': password, 'displayName': display})
    data(client, base, 'POST', '/auth/login', {'username': username, 'password': password})
    me = data(client, base, 'GET', '/auth/me')
    return {'username': username, 'password': password, 'userId': me['userId']}


def expect_failure(client, base, method, route, body=None, *, key=None):
    payload = call(client, base, method, route, body, key=key, expected=None)
    assert payload.get('code') != '0000', (method, route, payload)
    return payload.get('code')


def application(admin, base, owner, suffix):
    request = {
        'merchantName': '最终矩阵商户 ' + suffix,
        'category': 'stationery',
        'contactName': '最终验收店主',
        'contactPhone': '10000000000',
        'storeName': '最终矩阵门店 ' + suffix,
        'location': '隔离校区测试点',
    }
    item = data(owner, base, 'POST', '/merchant-applications', request, key=uuid.uuid4().hex)
    return data(admin, base, 'POST', '/admin/merchant-applications/' + item['applicationId'] + '/review', {'approved': True, 'reason': '最终隔离矩阵'})


def create_product(owner, base, merchant_id, title, price=500, image_url='', image_urls=None):
    payload = {
        'title': title,
        'description': '最终隔离矩阵商品',
        'categoryCode': 'stationery',
        'imageUrl': image_url,
        'skus': [{'specKey': '标准装', 'priceCent': price}],
    }
    if image_urls is not None:
        payload['imageUrls'] = image_urls
    return data(owner, base, 'POST', '/merchants/' + merchant_id + '/products', payload)


def desktop_route_checks(page, base, routes, checks, label):
    for route in routes:
        page.goto(base + '/?final_matrix=' + uuid.uuid4().hex + '#' + route, wait_until='domcontentloaded')
        expect(page.locator('#app')).not_to_be_empty()
        expect(page.locator('.access-denied')).to_have_count(0)
        expect(page.locator('.inline-error')).to_have_count(0)
        checks.append(label + ' 桌面路由 ' + route)


def mobile_route_check(page, base, route, checks, label):
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(base + '/?final_mobile=' + uuid.uuid4().hex + '#' + route, wait_until='domcontentloaded')
    expect(page.locator('#app')).not_to_be_empty()
    assert page.evaluate('document.documentElement.scrollWidth <= 391'), label + ' mobile overflow'
    checks.append(label + ' 手机路由 ' + route + ' 无横向溢出')


def abort_real_stream(page, base, question):
    csrf = data(page.request, base, 'GET', '/auth/csrf')
    return page.evaluate(
        r"""
        async ({base, headerName, token, question}) => {
          const controller = new AbortController();
          const response = await fetch(base + '/api/v1/ai/chat/stream', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json', [headerName]: token},
            body: JSON.stringify({question, conversationId: null}),
            signal: controller.signal,
          });
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let text = '';
          for (let index = 0; index < 8 && !text.includes('conversationId'); index += 1) {
            const part = await reader.read();
            text += decoder.decode(part.value || new Uint8Array(), {stream: !part.done});
            if (part.done) break;
          }
          controller.abort();
          const match = text.match(/data:\s*(\{"conversationId".*?\})(?:\r?\n|$)/s);
          let conversationId = null;
          if (match) {
            try { conversationId = JSON.parse(match[1]).conversationId; } catch (_) {}
          }
          return {status: response.status, bytes: text.length, conversationId};
        }
        """,
        {'base': base, 'headerName': csrf['headerName'], 'token': csrf['token'], 'question': question},
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8091')
    args = parser.parse_args()
    if urlsplit(args.base_url).hostname not in {'localhost', '127.0.0.1', '::1'}:
        raise ValueError('只能连接隔离本地服务')
    admin_name, admin_password = credentials()
    if not admin_name or not admin_password:
        raise ValueError('缺少 ADMIN_USERNAME/ADMIN_PASSWORD')

    EVIDENCE.mkdir(parents=True, exist_ok=True)
    checks, errors, failure = [], [], None
    browser = None
    try:
        with sync_playwright() as playwright:
            launch = {'headless': True, 'args': ['--no-sandbox']}
            browser_path = os.getenv('CHROMIUM_PATH') or shutil.which('chromium')
            if browser_path:
                launch['executable_path'] = browser_path
            browser = playwright.chromium.launch(**launch)
            base = args.base_url
            suffix = uuid.uuid4().hex[:8]
            admin = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            owner_ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            second_owner_ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            buyer_ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            second_buyer_ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            contexts = [admin, owner_ctx, second_owner_ctx, buyer_ctx, second_buyer_ctx]
            for context in contexts:
                context.on('page', lambda tab: tab.on('pageerror', lambda exc: errors.append(str(exc))))
            admin_client = admin.request
            owner_client = owner_ctx.request
            second_owner_client = second_owner_ctx.request
            buyer_client = buyer_ctx.request
            second_buyer_client = second_buyer_ctx.request

            data(admin_client, base, 'POST', '/auth/login', {'username': admin_name, 'password': admin_password})
            owner = register_and_login(owner_client, base, 'finalowner', '最终矩阵店主')
            second_owner = register_and_login(second_owner_client, base, 'finalowner2', '第二矩阵店主')
            buyer = register_and_login(buyer_client, base, 'finalbuyer', '最终矩阵消费者')
            second_buyer = register_and_login(second_buyer_client, base, 'finalbuyer2', '第二矩阵消费者')
            merchant = application(admin_client, base, owner_client, suffix)
            second_merchant = application(admin_client, base, second_owner_client, suffix + 'B')
            mid = merchant['merchantId']
            second_mid = second_merchant['merchantId']
            prefix = '/merchants/' + mid
            second_prefix = '/merchants/' + second_mid

            image = data(owner_client, base, 'POST', prefix + '/images', {
                'filename': 'final-matrix.png', 'contentType': 'image/png', 'base64': TINY_PNG,
            })
            product = create_product(owner_client, base, mid, '最终矩阵商品 ' + suffix, image_url=image['url'], image_urls=[image['url']])
            sku = product['skus'][0]
            data(owner_client, base, 'POST', prefix + '/stocks/' + sku['skuId'] + '/replenish', {'quantity': 3}, key=uuid.uuid4().hex)
            data(owner_client, base, 'POST', prefix + '/products/' + product['productId'] + '/publish', {'published': True})
            checks.append('隔离商品关联本轮上传图片与商户归属')

            # 图片归属：第二商户不能把第一商户对象写进自己的商品。
            cross_product = create_product(second_owner_client, base, second_mid, '跨商户图片拒绝 ' + suffix)
            code = expect_failure(
                second_owner_client,
                base,
                'PUT',
                second_prefix + '/products/' + cross_product['productId'],
                {'title': cross_product['title'], 'description': '归属校验', 'categoryCode': 'stationery',
                 'imageUrl': image['url'], 'imageUrls': [image['url']], 'expectedVersion': cross_product['version']},
            )
            checks.append('跨商户图片归属写入被拒绝：' + str(code))

            buyer_page = buyer_ctx.new_page()
            owner_page = owner_ctx.new_page()
            admin_page = admin.new_page()
            clerk_invitation = data(owner_client, base, 'POST', prefix + '/invitations', {'username': second_buyer['username']})
            data(second_buyer_client, base, 'POST', '/invitations/' + clerk_invitation['id'] + '/accept', {})
            clerk_page = second_buyer_ctx.new_page()
            desktop_route_checks(buyer_page, base, ['/', '/product/' + product['productId'], '/cart', '/orders'], checks, '消费者')
            desktop_route_checks(owner_page, base, ['/merchant', '/merchant/products', '/merchant/inventory', '/merchant/orders', '/merchant/team'], checks, '商户')
            desktop_route_checks(admin_page, base, ['/admin', '/admin/products', '/admin/orders', '/admin/knowledge'], checks, '平台')
            clerk_page.goto(base + '/?final_clerk=' + uuid.uuid4().hex + '#/merchant/products', wait_until='domcontentloaded')
            expect(clerk_page.locator('.access-denied')).to_have_count(0)
            expect(clerk_page.get_by_role('button', name='新增商品', exact=True)).to_be_disabled()
            clerk_page.goto(base + '/?final_clerk_roles=' + uuid.uuid4().hex + '#/merchant/roles', wait_until='domcontentloaded')
            expect(clerk_page.locator('.access-denied')).to_be_visible()
            checks.append('店员真实会话可查看商品但不能新增商品或管理角色')
            mobile_route_check(buyer_page, base, '/product/' + product['productId'], checks, '消费者')
            mobile_route_check(owner_page, base, '/merchant/products', checks, '商户')
            mobile_route_check(admin_page, base, '/admin/products', checks, '平台')
            mobile_route_check(clerk_page, base, '/merchant/products', checks, '店员')

            # 同一个真实买家会话切换身份后，旧身份不能继续读取私有数据。
            data(buyer_client, base, 'POST', '/auth/logout', {})
            data(buyer_client, base, 'POST', '/auth/login', {'username': second_buyer['username'], 'password': second_buyer['password']})
            switched = data(buyer_client, base, 'GET', '/auth/me')
            assert switched['userId'] == second_buyer['userId'] and switched['userId'] != buyer['userId']
            checks.append('会话切换后当前身份与旧身份隔离')
            data(buyer_client, base, 'POST', '/auth/logout', {})
            data(buyer_client, base, 'POST', '/auth/login', {'username': buyer['username'], 'password': buyer['password']})

            # 重复提交：同一幂等键必须返回同一订单，且只占一份库存。
            data(buyer_client, base, 'POST', '/cart', {'skuId': sku['skuId'], 'quantity': 1})
            quote = data(buyer_client, base, 'GET', '/products/' + product['productId'])
            offer = next(item for item in quote['skus'] if item['skuId'] == sku['skuId'])
            order_body = {'merchantId': mid, 'items': [{'skuId': sku['skuId'], 'quantity': 1,
                'expectedPriceCent': offer['priceCent'], 'expectedVersion': quote['version']}]}
            key = uuid.uuid4().hex
            first = data(buyer_client, base, 'POST', '/orders', order_body, key=key)
            second = data(buyer_client, base, 'POST', '/orders', order_body, key=key)
            assert first['orderId'] == second['orderId']
            checks.append('重复下单幂等键返回同一订单')
            data(buyer_client, base, 'POST', '/orders/' + first['orderId'] + '/cancel', {})

            # 变价后旧报价必须在确认层被拒绝。
            data(buyer_client, base, 'POST', '/cart', {'skuId': sku['skuId'], 'quantity': 1})
            old_quote = data(buyer_client, base, 'GET', '/products/' + product['productId'])
            old_offer = next(item for item in old_quote['skus'] if item['skuId'] == sku['skuId'])
            data(owner_client, base, 'PUT', prefix + '/products/' + product['productId'] + '/skus/' + sku['skuId'] + '/price',
                 {'priceCent': old_offer['priceCent'] + 100, 'expectedVersion': old_quote['version']})
            stale = {'merchantId': mid, 'items': [{'skuId': sku['skuId'], 'quantity': 1,
                'expectedPriceCent': old_offer['priceCent'], 'expectedVersion': old_quote['version']}]}
            expect_failure(buyer_client, base, 'POST', '/orders', stale, key=uuid.uuid4().hex)
            checks.append('变价后的旧报价确认被拒绝')

            # 缺货：第二买家先占住最后库存，第一买家的旧报价不得建单。
            scarce = create_product(owner_client, base, mid, '最终矩阵限量商品 ' + suffix, price=900)
            scarce_sku = scarce['skus'][0]
            data(owner_client, base, 'POST', prefix + '/stocks/' + scarce_sku['skuId'] + '/replenish', {'quantity': 1}, key=uuid.uuid4().hex)
            data(owner_client, base, 'POST', prefix + '/products/' + scarce['productId'] + '/publish', {'published': True})
            scarce_quote = data(buyer_client, base, 'GET', '/products/' + scarce['productId'])
            scarce_offer = scarce_quote['skus'][0]
            data(buyer_client, base, 'POST', '/cart', {'skuId': scarce_sku['skuId'], 'quantity': 1})
            scarce_body = {'merchantId': mid, 'items': [{'skuId': scarce_sku['skuId'], 'quantity': 1,
                'expectedPriceCent': scarce_offer['priceCent'], 'expectedVersion': scarce_quote['version']}]}
            data(second_buyer_client, base, 'POST', '/orders', scarce_body, key=uuid.uuid4().hex)
            expect_failure(buyer_client, base, 'POST', '/orders', scarce_body, key=uuid.uuid4().hex)
            checks.append('最后库存被占用后旧确认被拒绝')

            # 真实 SSE：读取 started 后主动断开，轮询同一 turn 的服务端状态和历史。
            buyer_page.goto(base + '/#/ai', wait_until='domcontentloaded')
            stream = abort_real_stream(buyer_page, base, '最终隔离矩阵断线恢复')
            assert stream['status'] == 200 and stream['bytes'] > 0 and stream['conversationId']
            conversation_id = stream['conversationId']
            status = None
            for _ in range(30):
                status = data(buyer_client, base, 'GET', '/ai/conversations/' + conversation_id + '/turn/status')
                if status['status'] in ('IDLE', 'CANCEL_REQUESTED'):
                    break
                time.sleep(0.3)
            assert status and status['status'] in ('IDLE', 'CANCEL_REQUESTED')
            history = data(buyer_client, base, 'GET', '/ai/conversations/' + conversation_id + '/messages')
            assert any(message['role'] == 'user' and '断线恢复' in message['content'] for message in history)
            buyer_page.reload(wait_until='domcontentloaded')
            expect(buyer_page.locator('#app')).not_to_be_empty()
            checks.append('真实 SSE 断开后同一会话状态可恢复，历史消息未重复创建')

            assert not errors, errors
            checks.append('最终矩阵浏览器无未捕获 JS 异常')
            for index, page in enumerate((buyer_page, owner_page, admin_page)):
                page.screenshot(path=str(EVIDENCE / ('final-' + str(index) + '.png')), full_page=True)
            for context in contexts:
                context.close()
    except Exception as exc:  # noqa: BLE001 - evidence records first failure
        failure = str(exc)
    finally:
        result = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'testType': 'REAL_BROWSER_REAL_JAVA_MYSQL_FINAL_MATRIX',
            'status': 'FAILED' if failure else 'PASS',
            'error': failure,
            'checks': checks,
            'browserErrors': errors,
            'apiMockUsed': False,
            'externalModel': False,
            'streamMode': 'CONTROLLED_CLIENT_DISCONNECT_LOCAL_AI',
        }
        (EVIDENCE / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        if browser:
            browser.close()
    if failure:
        raise SystemExit(failure)
    print('最终隔离浏览器矩阵通过：', len(checks))


if __name__ == '__main__':
    main()
