"""在真实 Spring Boot + MySQL 服务上执行新版 Vue 浏览器验收；不拦截或替换 API。

使用前启动本地服务并设置 ADMIN_USERNAME/ADMIN_PASSWORD；仅允许 localhost 地址。
失败时将现场记录为 FAILED，绝不把未运行当作通过。
"""
import argparse
import json
import os
import secrets
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]


def env_credentials():
    env = {}
    config = ROOT / '.env'
    if config.exists():
        for line in config.read_text(encoding='utf-8').splitlines():
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                env[key] = val
    return (os.getenv('ADMIN_USERNAME') or env.get('ADMIN_USERNAME'),
            os.getenv('ADMIN_PASSWORD') or env.get('ADMIN_PASSWORD'))


def login(page, username, password):
    page.locator('.header-login').click()
    dialog = page.locator('form.login-dialog')
    expect(dialog).to_be_visible()
    dialog.locator('#login-name').fill(username)
    dialog.locator('#login-password').fill(password)
    dialog.locator('button[type="submit"]').click()
    expect(dialog).to_have_count(0, timeout=15000)
    expect(page.locator('.account-pill')).to_be_visible()


def verify_cart_sku(page, browser, base, admin, password, checks):
    """合成商户与商品通过真实 HTTP 建立；页面操作不拦截 API。"""
    def call(client, method, route, body=None, code='0000'):
        csrf = client.get(base + '/api/v1/auth/csrf').json()['data']
        response = client.fetch(base + '/api/v1' + route, method=method, data=body,
                                headers={csrf['headerName']: csrf['token'], 'Idempotency-Key': uuid.uuid4().hex})
        data = response.json()
        assert response.status == 200 and data['code'] == code, (method, route, response.status, data.get('code'))
        return data.get('data')
    admin_context = browser.new_context()
    try:
        call(admin_context.request, 'POST', '/auth/login', {'username': admin, 'password': password})
        application = call(page.request, 'POST', '/merchant-applications', {
            'merchantName': '浏览器库存验收', 'category': 'stationery', 'contactName': '测试',
            'contactPhone': '10000000000', 'storeName': '验收门店', 'location': '校园'})
        merchant = call(admin_context.request, 'POST', '/admin/merchant-applications/' + application['applicationId'] + '/review', {'approved': True, 'reason': '隔离验收'})
        prefix = '/merchants/' + merchant['merchantId']
        product = call(page.request, 'POST', prefix + '/products', {
            'title': '库存验收专用笔', 'categoryCode': 'stationery', 'skus': [
                {'specKey': '黑色验收规格', 'priceCent': 100}, {'specKey': '蓝色验收规格', 'priceCent': 200}]})
        product_path = prefix + '/products/' + product['productId']
        black = next(sku for sku in product['skus'] if sku['specKey'] == '黑色验收规格')['skuId']
        blue = next(sku for sku in product['skus'] if sku['specKey'] == '蓝色验收规格')['skuId']
        call(page.request, 'POST', prefix + '/stocks/' + black + '/replenish', {'quantity': 3})
        call(page.request, 'POST', product_path + '/publish', {'published': True})
        call(page.request, 'PUT', '/cart', {'skuId': blue, 'quantity': 1}, code='I0001')
        call(page.request, 'PUT', '/cart', {'skuId': black, 'quantity': 2})
        call(page.request, 'PUT', '/cart', {'skuId': black, 'quantity': 4}, code='I0001')
        checks.append('真实 HTTP 拒绝零库存和超库存加购，原购物车数量保留')
        page.goto(base + '/#/merchant/products', wait_until='domcontentloaded')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        expect(page.get_by_role('button', name='规格售价', exact=True)).to_be_visible()
        page.get_by_role('button', name='规格售价', exact=True).click()
        page.get_by_role('button', name='停用蓝色验收规格', exact=True).click()
        expect(page.get_by_role('button', name='启用蓝色验收规格', exact=True)).to_be_visible()
        last_active = page.get_by_role('button', name='停用黑色验收规格', exact=True)
        expect(last_active).to_be_disabled()
        expect(last_active).to_have_attribute('title', '已上架商品须保留至少一个有效规格')
        current = call(page.request, 'GET', '/products/' + product['productId'])
        call(page.request, 'PUT', product_path + '/skus/' + black + '/status',
             {'active': False, 'expectedVersion': current['version']}, code='C0001')
        assert call(page.request, 'GET', '/products/' + product['productId'])['version'] == current['version']
        assert next(sku for sku in current['skus'] if sku['skuId'] == black)['status'] == 'ACTIVE'
        page.get_by_role('button', name='启用蓝色验收规格', exact=True).click()
        expect(page.get_by_role('button', name='停用蓝色验收规格', exact=True)).to_be_visible()
        checks.append('真实商户页面独立停用/启用 SKU，最后一个有效 SKU 不可停用')
        page.goto(base + '/#/', wait_until='domcontentloaded')
        page.get_by_role('button', name='库存验收专用笔', exact=True).click()
        page.get_by_role('button', name='黑色验收规格', exact=True).click()
        page.get_by_role('button', name='增加数量', exact=True).click()
        with page.expect_response(lambda r: r.url.endswith('/api/v1/cart') and r.request.method == 'POST') as rejected_add:
            page.get_by_role('button', name='加入购物车', exact=True).click()
        assert rejected_add.value.json()['code'] == 'I0001'
        expect(page.get_by_role('button', name='加入购物车', exact=True)).to_be_enabled()
        expect(page.get_by_role('dialog', name='库存验收专用笔')).to_be_visible()
        assert next(row for row in call(page.request, 'GET', '/cart') if row['skuId'] == black)['quantity'] == 2
        checks.append('首页按累计数量拒绝加购，库存 3 已有 2 再加 2 保持原数量')
        # 同一会话的两个真实标签页分别走首页与详情页；加购均提交增量，无 GET+PUT 累计。
        call(page.request, 'PUT', '/cart', {'skuId': black, 'quantity': 1})
        page.get_by_role('button', name='减少数量', exact=True).click()
        second = page.context.new_page()
        try:
            second.goto(base + '/#/product/' + product['productId'], wait_until='domcontentloaded')
            second.get_by_role('button', name='黑色验收规格', exact=True).click()
            with page.expect_response(lambda r: r.url.endswith('/api/v1/cart') and r.request.method == 'POST') as first_add:
                page.get_by_role('button', name='加入购物车', exact=True).click()
            assert first_add.value.json()['code'] == '0000'
            with second.expect_response(lambda r: r.url.endswith('/api/v1/cart') and r.request.method == 'POST') as second_add:
                second.get_by_role('button', name='加入购物车', exact=True).click()
            assert second_add.value.json()['code'] == '0000'
            assert next(row for row in call(page.request, 'GET', '/cart') if row['skuId'] == black)['quantity'] == 3
            checks.append('同会话首页和详情两个标签页提交 POST 增量，已有 1 各加 1 最终为 3')
        finally:
            second.close()
        call(admin_context.request, 'POST', '/admin/products/' + product['productId'] + '/unpublish', {})
        page.goto(base + '/#/cart', wait_until='domcontentloaded')
        expect(page.get_by_role('button', name='增加库存验收专用笔', exact=True)).to_be_disabled()
        page.get_by_role('button', name='减少库存验收专用笔', exact=True).click()
        expect(page.locator('.mini-qty span')).to_have_text('2')
        page.get_by_role('button', name='移除库存验收专用笔', exact=True).click()
        expect(page.get_by_text('购物车空空的', exact=True)).to_be_visible()
        checks.append('真实购物车失效商品禁止增加，仍可减少和直接移除')
        verify_frontend_remediation(page, browser, admin_context, base, prefix, merchant, call, checks)
    finally:
        admin_context.close()


def verify_frontend_remediation(page, browser, admin_context, base, prefix, merchant, call, checks):
    """仅使用真实 API 和浏览器事件，验证本次整改，不替换响应或访问数据库。"""
    requests = []
    record = lambda req: requests.append((req.method, urlsplit(req.url).path))
    page.on('request', record)
    try:
        page.goto(base + '/#/merchant/settings', wait_until='domcontentloaded')
        name = '联调门店' + uuid.uuid4().hex[:8]
        field = page.locator('.ops-settings input').first
        expect(field).to_be_visible()
        requests.clear()
        field.fill(name)
        with page.expect_response(lambda r: r.url.endswith(prefix + '/profile') and r.request.method == 'PUT') as saved:
            page.get_by_role('button', name='保存设置', exact=True).click()
        assert saved.value.json()['code'] == '0000'
        expect(page.locator('.toast')).to_contain_text('门店资料已保存')
        expect(field).to_have_value(name)
        assert not any(method == 'GET' and '/merchants/' in path for method, path in requests)
        assert call(page.request, 'GET', '/workspace')['merchants'][0]['name'] == name
        checks.append('真实资料 PUT 后表单及 MySQL 回显一致，无额外商户 GET')

        product = call(page.request, 'POST', prefix + '/products', {
            'title': '联调多规格' + uuid.uuid4().hex[:8], 'categoryCode': 'stationery',
            'skus': [{'specKey': '联调规格A', 'priceCent': 1500}, {'specKey': '联调规格B', 'priceCent': 800}]})
        for sku in product['skus']:
            quantity = 5 if sku['specKey'] == '联调规格A' else 2
            call(page.request, 'POST', prefix + '/stocks/' + sku['skuId'] + '/replenish', {'quantity': quantity})
        call(page.request, 'POST', prefix + '/products/' + product['productId'] + '/publish', {'published': True})
        page.goto(base + '/#/', wait_until='domcontentloaded')
        card = page.locator('.home-product').filter(has_text=product['title'])
        expect(card).to_contain_text('¥8 起')
        expect(card).to_contain_text('联调规格B')
        card.click()
        page.get_by_role('button', name='联调规格A', exact=True).click()
        for _ in range(4):
            page.get_by_role('button', name='增加数量', exact=True).click()
        expect(page.locator('.quantity-picker b')).to_have_text('5')
        page.get_by_role('button', name='联调规格B', exact=True).click()
        expect(page.locator('.quantity-picker b')).to_have_text('1')
        with page.expect_response(lambda r: r.url.endswith('/api/v1/cart') and r.request.method == 'POST') as added:
            page.get_by_role('button', name='加入购物车', exact=True).click()
        assert added.value.json()['code'] == '0000'
        cart = call(page.request, 'GET', '/cart')
        assert any(row['skuId'] == next(s['skuId'] for s in product['skus'] if s['specKey'] == '联调规格B') and row['quantity'] == 1 for row in cart)
        checks.append('真实多规格最低价与标签一致，数量5切低库存归1并按选定SKU加购')

        member_context = browser.new_context()
        try:
            username, password = 'member_' + uuid.uuid4().hex[:12], secrets.token_urlsafe(24)
            member = call(member_context.request, 'POST', '/auth/register', {'username': username, 'password': password, 'displayName': '联调店员'})
            call(member_context.request, 'POST', '/auth/login', {'username': username, 'password': password})
            invite = call(page.request, 'POST', prefix + '/invitations', {'username': username})
            call(member_context.request, 'POST', '/invitations/' + invite['id'] + '/accept', {})
            role = call(page.request, 'POST', prefix + '/rbac/roles', {'name': '联调待删除角色', 'permissions': ['product.read']})
            page.goto(base + '/#/merchant/team', wait_until='domcontentloaded')
            select = page.locator('.ops-list-line').filter(has_text=member['userId']).locator('select')
            expect(select).to_have_value('CLERK')
            call(page.request, 'DELETE', prefix + '/rbac/roles/' + role['code'])
            with page.expect_response(lambda r: '/rbac/members/' in r.url and r.request.method == 'PUT') as rejected:
                select.select_option(role['code'])
            assert rejected.value.json()['code'] != '0000'
            expect(select).to_have_value('CLERK')
            members = call(page.request, 'GET', prefix + '/members')
            assert next(m for m in members if m['userId'] == member['userId'])['role'] == 'CLERK'
            checks.append('真实角色删除竞态被服务端拒绝，下拉与持久化成员角色均保持原值')
        finally:
            member_context.close()

        page.goto(base + '/#/merchant/products', wait_until='domcontentloaded')
        expect(page.locator('.product-table tbody tr').first).to_be_visible()
        requests.clear()
        # 同一事件中输入后离页，确保发生在搜索防抖计时器之前。
        page.locator('input[placeholder]').first.evaluate("el => { el.value='离页搜索'; el.dispatchEvent(new Event('input',{bubbles:true})); location.hash='/cart'; }")
        expect(page.locator('.mobile-page-top b')).to_have_text('购物车')
        page.wait_for_timeout(400)
        assert not any(path.endswith('/products/page') for _, path in requests)
        checks.append('真实页面搜索后立即离开，无延迟商品列表请求，购物车不附带公共商品请求')

        admin_page = admin_context.new_page()
        try:
            errors = []
            admin_page.on('pageerror', lambda e: errors.append(str(e)))
            admin_page.goto(base + '/#/admin/products', wait_until='domcontentloaded')
            admin_page.get_by_placeholder('搜索商品 / 商户').fill(product['title'])
            row = admin_page.locator('tr').filter(has_text=product['title'])
            expect(row).to_have_count(1)
            dialogs = []
            def cancel(dialog):
                dialogs.append((dialog.type, dialog.message)); dialog.dismiss()
            admin_page.on('dialog', cancel)
            row.get_by_role('button', name='强制下架', exact=True).click()
            assert product['title'] in dialogs[-1][1]
            assert call(page.request, 'GET', '/products/' + product['productId'])['status'] == 'PUBLISHED'
            admin_page.remove_listener('dialog', cancel)
            def confirm(dialog): dialog.accept()
            admin_page.on('dialog', confirm)
            row.get_by_role('button', name='强制下架', exact=True).click()
            expect(row.get_by_role('button', name='强制下架', exact=True)).to_be_disabled()
            expect(row).to_contain_text('已下架')
            assert next(p for p in call(admin_context.request, 'GET', '/admin/products/page?q=' + product['title'])['items'] if p['productId'] == product['productId'])['status'] == 'UNPUBLISHED'
            checks.append('真实平台强制下架包含商品名称，取消不改状态，确认后持久化下架')

            admin_page.goto(base + '/#/admin/merchants', wait_until='domcontentloaded')
            admin_page.get_by_placeholder('搜索经营名称').fill(name)
            row = admin_page.locator('tr').filter(has_text=name)
            expect(row).to_have_count(1)
            admin_page.remove_listener('dialog', confirm)
            admin_page.on('dialog', cancel)
            row.get_by_role('button', name='停用', exact=True).click()
            assert dialogs[-1][0] == 'prompt' and name in dialogs[-1][1]
            assert call(page.request, 'GET', '/merchants/public/' + merchant['merchantId'])['status'] == 'ACTIVE'
            admin_page.remove_listener('dialog', cancel)
            def approve(dialog):
                dialogs.append((dialog.type, dialog.message))
                dialog.accept('联调停用原因' if dialog.type == 'prompt' else None)
            admin_page.on('dialog', approve)
            row.get_by_role('button', name='停用', exact=True).click()
            expect(row.get_by_role('button', name='恢复', exact=True)).to_be_visible()
            assert [entry[0] for entry in dialogs[-2:]] == ['prompt', 'confirm']
            checks.append('真实平台停用先填写原因再确认商户名，取消无变化，确认后显示暂停状态')
            assert not errors, errors
        finally:
            admin_page.close()
    finally:
        page.remove_listener('request', record)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8091')
    args = parser.parse_args()
    if urlsplit(args.base_url).hostname not in {'localhost', '127.0.0.1', '::1'}:
        raise ValueError('只能连接隔离本地服务')
    admin, password = env_credentials()
    if not admin or not password:
        raise ValueError('缺少 ADMIN_USERNAME/ADMIN_PASSWORD')

    directory = ROOT / 'docs/testing/evidence/frontend-live'
    directory.mkdir(parents=True, exist_ok=True)
    checks, errors, failure = [], [], None
    try:
        with sync_playwright() as p:
            launch = {'headless': True, 'args': ['--no-sandbox']}
            browser_path = os.getenv('CHROMIUM_PATH') or shutil.which('chromium')
            if browser_path:
                launch['executable_path'] = browser_path
            browser = p.chromium.launch(**launch)
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            context.on('page', lambda tab: tab.on('pageerror', lambda exception: errors.append(str(exception))))
            page = context.new_page()
            # 新会话直接打开后台 URL，登录后留在原目标，不能陷入仅有重试的错误页。
            for target, heading in [('/admin', '平台总览'), ('/admin/products', '商品监管')]:
                direct = browser.new_context()
                try:
                    tab = direct.new_page()
                    tab.on('pageerror', lambda exception: errors.append(str(exception)))
                    tab.goto(args.base_url + '/#' + target, wait_until='domcontentloaded')
                    expect(tab.get_by_role('heading', name='请先登录', exact=True)).to_be_visible()
                    expect(tab.locator('.merchant-shell')).to_have_count(0)
                    tab.get_by_role('button', name='登录', exact=True).click()
                    dialog = tab.locator('form.login-dialog')
                    dialog.locator('#login-name').fill(admin)
                    dialog.locator('#login-password').fill(password)
                    dialog.locator('button[type=submit]').click()
                    expect(tab.locator('.merchant-page-heading h1')).to_have_text(heading)
                    expect(tab.locator('.access-denied')).to_have_count(0)
                    assert urlsplit(tab.url).fragment == target
                    checks.append('匿名直达' + target + '可登录并保留原目标路由')
                finally:
                    direct.close()
            page.goto(args.base_url + '/#/', wait_until='domcontentloaded')
            expect(page.locator('.header-login')).to_be_visible()
            expect(page.locator('.consumer-shell')).to_be_visible()
            checks.append('新版 Vue 匿名消费者首页加载')

            # 在未携带登录 Cookie 的上下文中验证真实 SecurityFilterChain。
            for route in ('/api/v1/merchants/public', '/api/v1/merchants/public/page?page=1&size=10'):
                response = page.request.get(args.base_url + route)
                assert response.status == 200, (route, response.status)
                data = response.json()
                assert data['code'] == '0000', (route, data)
            public = page.request.get(args.base_url + '/api/v1/merchants/public/page?page=1&size=10').json()['data']
            if public['items']:
                merchant_id = public['items'][0]['merchantId']
                from urllib.parse import quote
                result = page.request.get(args.base_url + '/api/v1/merchants/public/' + quote(merchant_id, safe=''))
                assert result.status == 200 and result.json()['code'] == '0000'
            forbidden = page.request.get(args.base_url + '/api/v1/admin/merchants/page')
            assert forbidden.status == 401
            checks.append('匿名商户列表与详情放行；平台私有数据拒绝匿名访问')

            login(page, admin, password)
            page.goto(args.base_url + '/#/admin/applications', wait_until='domcontentloaded')
            expect(page.locator('.merchant-page-heading h1')).to_have_text('商户审核')
            expect(page.locator('.merchant-nav').get_by_role('button', name='商户审核')).to_be_visible()
            expect(page.locator('.access-denied')).to_have_count(0)
            page.screenshot(path=str(directory / 'admin-real.png'), full_page=True)
            checks.append('新版管理员 Session 登录并访问入驻审核')

            page.goto(args.base_url + '/#/', wait_until='domcontentloaded')
            expect(page.locator('.account-pill')).to_be_visible()
            page.locator('.account-pill').click()  # 消费者顶栏退出操作
            expect(page.locator('.header-login')).to_be_visible()
            assert page.request.get(args.base_url + '/api/v1/auth/me').status == 401
            checks.append('管理员退出后 Session 与私有数据失效')

            page.locator('.header-login').click()
            dialog = page.locator('form.login-dialog')
            dialog.locator('.login-switch').click()
            user = 'ui_' + uuid.uuid4().hex[:16]
            user_password = secrets.token_urlsafe(20)
            dialog.locator('#login-name').fill(user)
            dialog.locator('#login-password').fill(user_password)
            dialog.locator('#login-display').fill('真实浏览器验收账号')
            dialog.locator('button[type="submit"]').click()
            expect(dialog.locator('button[type="submit"]')).to_have_text('登录', timeout=15000)
            checks.append('注册真实数据库账号且注册后不自动登录')

            dialog.locator('#login-password').fill(user_password)
            dialog.locator('button[type="submit"]').click()
            expect(page.locator('.account-pill')).to_be_visible()
            page.goto(args.base_url + '/#/admin/applications', wait_until='domcontentloaded')
            expect(page.locator('.access-denied')).to_be_visible()
            checks.append('普通用户登录后仍无法访问管理员页面')

            page.goto(args.base_url + '/#/', wait_until='domcontentloaded')
            page.set_viewport_size({'width': 390, 'height': 844})
            expect(page.locator('.consumer-shell')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= 391'), '移动端出现横向溢出'
            page.screenshot(path=str(directory / 'consumer-real-mobile.png'), full_page=True)
            checks.append('移动端真实前端无横向溢出')
            verify_cart_sku(page, browser, args.base_url, admin, password, checks)
            assert not errors, errors
            checks.append('浏览器无未捕获 JS 异常')
            context.close()
            browser.close()
    except Exception as exc:
        failure = str(exc)
    finally:
        (directory / 'results.json').write_text(json.dumps({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'testType': 'REAL_BROWSER_REAL_JAVA_HTTP',
            'status': 'FAILED' if failure else 'PASS',
            'error': failure,
            'checks': checks,
            'browserErrors': errors,
            'apiMockUsed': False
        }, ensure_ascii=False, indent=2), encoding='utf-8')
    if failure:
        raise SystemExit(failure)
    print('真实服务浏览器检查通过：', len(checks))


if __name__ == '__main__':
    main()
