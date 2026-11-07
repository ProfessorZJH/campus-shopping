"""真实 Spring/MySQL 浏览器验收 M2：下单、支付、备货、核销与未提货退款分支。

不拦截 API，不使用替身；仅连接本机隔离服务。运行前设置 ADMIN_USERNAME/ADMIN_PASSWORD。
"""
import argparse
import json
import os
import re
import secrets
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/testing/evidence/frontend-live-m2'


def credentials():
    return os.getenv('ADMIN_USERNAME', ''), os.getenv('ADMIN_PASSWORD', '')


def call(client, base, method, route, body=None, code='0000'):
    csrf = client.get(base + '/api/v1/auth/csrf').json()['data']
    response = client.fetch(
        base + '/api/v1' + route,
        method=method,
        data=body,
        headers={csrf['headerName']: csrf['token'], 'Idempotency-Key': uuid.uuid4().hex},
    )
    data = response.json()
    assert response.status == 200 and data['code'] == code, (
        method,
        route,
        response.status,
        data.get('code'),
        data.get('info'),
    )
    return data.get('data')


def register_and_login(client, base, prefix):
    username = prefix + '_' + uuid.uuid4().hex[:12]
    password = secrets.token_urlsafe(20)
    call(
        client,
        base,
        'POST',
        '/auth/register',
        {'username': username, 'password': password, 'displayName': 'M2 验收账号'},
    )
    call(client, base, 'POST', '/auth/login', {'username': username, 'password': password})
    return username, password


def open_product(page, base, title):
    page.goto(base + '/#/', wait_until='domcontentloaded')
    card = page.locator('.home-product').filter(has_text=title)
    expect(card).to_be_visible(timeout=15000)
    card.click()
    expect(page.get_by_role('button', name='加入购物车', exact=True)).to_be_visible()


def stock_of(client, base, mid, sku):
    rows = call(client, base, 'GET', '/merchants/' + mid + '/stocks?size=100')
    row = next(item for item in rows if item['skuId'] == sku)
    return row


def pay(page):
    page.get_by_role('button', name='模拟支付').click()
    expect(page.locator('.pickup-hero')).to_contain_text('已支付')


def checkout(page, base, title):
    open_product(page, base, title)
    page.get_by_role('button', name='加入购物车', exact=True).click()
    expect(page.locator('.toast')).to_contain_text('已加入购物车')
    page.goto(base + '/#/cart', wait_until='domcontentloaded')
    expect(page.locator('.cart-line')).to_contain_text(title)
    page.get_by_role('button', name='提交订单').click()
    dialog = page.get_by_role('dialog', name='确认订单')
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text('模拟支付')
    dialog.get_by_role('button', name='确认下单（模拟支付）').click()
    page.wait_for_url(re.compile(r'#/orders/[^/]+$'), timeout=15000)
    return urlsplit(page.url).fragment.rsplit('/', 1)[-1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8091')
    args = parser.parse_args()
    if urlsplit(args.base_url).hostname not in {'localhost', '127.0.0.1', '::1'}:
        raise ValueError('只能连接隔离本地服务')
    admin, admin_password = credentials()
    if not admin or not admin_password:
        raise ValueError('缺少 ADMIN_USERNAME/ADMIN_PASSWORD')

    EVIDENCE.mkdir(parents=True, exist_ok=True)
    checks, errors, failure = [], [], None
    browser = None
    try:
        with sync_playwright() as p:
            launch = {'headless': True, 'args': ['--no-sandbox']}
            browser_path = os.getenv('CHROMIUM_PATH') or shutil.which('chromium')
            if browser_path:
                launch['executable_path'] = browser_path
            browser = p.chromium.launch(**launch)
            owner_ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            buyer_ctx = browser.new_context(viewport={'width': 430, 'height': 932}, locale='zh-CN')
            admin_ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            for context in (owner_ctx, buyer_ctx, admin_ctx):
                context.on('page', lambda tab: tab.on('pageerror', lambda exc: errors.append(str(exc))))
            base = args.base_url
            suffix = uuid.uuid4().hex[:8]
            merchant_name = 'M2 履约验收商户 ' + suffix
            store_name = 'M2 验收门店 ' + suffix
            title = 'M2 履约验收商品 ' + suffix

            register_and_login(owner_ctx.request, base, 'm2owner')
            register_and_login(buyer_ctx.request, base, 'm2buyer')
            call(admin_ctx.request, base, 'POST', '/auth/login', {'username': admin, 'password': admin_password})
            application = call(
                owner_ctx.request,
                base,
                'POST',
                '/merchant-applications',
                {
                    'merchantName': merchant_name,
                    'category': 'stationery',
                    'contactName': '验收店主',
                    'contactPhone': '10000000000',
                    'storeName': store_name,
                    'location': 'M2 验收校区图书馆',
                },
            )
            merchant = call(
                admin_ctx.request,
                base,
                'POST',
                '/admin/merchant-applications/' + application['applicationId'] + '/review',
                {'approved': True, 'reason': '隔离验收'},
            )
            mid = merchant['merchantId']
            prefix = '/merchants/' + mid
            product = call(
                owner_ctx.request,
                base,
                'POST',
                prefix + '/products',
                {
                    'title': title,
                    'description': '真实浏览器与真实 HTTP 验收，不使用替身。',
                    'categoryCode': 'stationery',
                    'skus': [{'specKey': '标准装', 'priceCent': 1200}],
                },
            )
            sku = product['skus'][0]['skuId']
            call(owner_ctx.request, base, 'POST', prefix + '/stocks/' + sku + '/replenish', {'quantity': 10})
            call(owner_ctx.request, base, 'POST', prefix + '/products/' + product['productId'] + '/publish', {'published': True})

            page = buyer_ctx.new_page()
            page.goto(base + '/#/', wait_until='domcontentloaded')
            expect(page.locator('.consumer-shell')).to_be_visible()
            checks.append('真实买家 Session 加载消费者首页')

            first = checkout(page, base, title)
            pay(page)
            checks.append('真实购物车确认层创建订单并完成模拟支付：' + first)

            call(owner_ctx.request, base, 'POST', prefix + '/orders/' + first + '/prepare')
            call(owner_ctx.request, base, 'POST', prefix + '/orders/' + first + '/ready')
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('.pickup-hero')).to_contain_text('待自提')
            page.get_by_role('button', name='领取自提凭证').click()
            token = page.locator('.pickup-code code').inner_text()
            assert token and len(token) > 20
            call(owner_ctx.request, base, 'POST', prefix + '/orders/' + first + '/verify', {'token': token})
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('.pickup-hero')).to_contain_text('已完成')
            expect(page.locator('.order-timeline')).to_contain_text('已核销')
            stock = stock_of(owner_ctx.request, base, mid, sku)
            assert (stock['onHand'], stock['reserved'], stock['available']) == (9, 0, 9), stock
            checks.append('真实商户备货/备货完成、服务端凭证签发与核销，事件时间线显示已核销，库存出库后为 9/0/9')

            call(owner_ctx.request, base, 'POST', prefix + '/stocks/' + sku + '/replenish', {'quantity': 5})
            second = checkout(page, base, title)
            pay(page)
            page.get_by_role('button', name='申请退款').click()
            page.locator('#orders-field-1').fill('未提货，申请模拟退款')
            page.get_by_role('button', name='提交退款申请').click()
            expect(page.locator('.order-metadata')).to_contain_text('待商户审核')
            call(
                owner_ctx.request,
                base,
                'POST',
                prefix + '/orders/' + second + '/refund-decision',
                {'approved': False, 'reason': '请补充凭证'},
            )
            page.reload(wait_until='domcontentloaded')
            page.get_by_role('button', name='申请平台介入').click()
            expect(page.locator('.order-metadata')).to_contain_text('待平台裁决')
            call(
                admin_ctx.request,
                base,
                'POST',
                '/admin/orders/' + second + '/refund-decision',
                {'approved': True, 'reason': '平台核验通过'},
            )
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('.pickup-hero')).to_contain_text('已退款')
            expect(page.locator('.order-timeline')).to_contain_text('平台裁决同意退款')
            expect(page.locator('.order-timeline')).to_contain_text('模拟退款完成')
            stock = stock_of(owner_ctx.request, base, mid, sku)
            assert (stock['onHand'], stock['reserved'], stock['available']) == (14, 0, 14), stock
            checks.append('另一笔未提货订单完成退款申请、商户拒绝、平台介入与最终模拟退款，库存释放后为 14/0/14')
            assert not errors, errors
            checks.append('浏览器无未捕获 JS 异常')
            page.screenshot(path=str(EVIDENCE / 'm2-fulfillment.png'), full_page=True)
            for context in (owner_ctx, buyer_ctx, admin_ctx):
                context.close()
    except Exception as exc:  # noqa: BLE001 - evidence must record the first failure
        failure = str(exc)
    finally:
        (EVIDENCE / 'results.json').write_text(
            json.dumps(
                {
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'testType': 'REAL_BROWSER_REAL_JAVA_HTTP_M2',
                    'status': 'FAILED' if failure else 'PASS',
                    'error': failure,
                    'checks': checks,
                    'browserErrors': errors,
                    'apiMockUsed': False,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding='utf-8',
        )
    if failure:
        raise SystemExit(failure)
    print('M2 真实服务浏览器检查通过：', len(checks))


if __name__ == '__main__':
    main()
