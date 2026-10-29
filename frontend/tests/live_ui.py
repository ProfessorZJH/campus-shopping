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
            page = browser.new_page(viewport={'width': 1440, 'height': 1000}, locale='zh-CN')
            page.on('pageerror', lambda exception: errors.append(str(exception)))
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
            assert not errors, errors
            checks.append('浏览器无未捕获 JS 异常')
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
