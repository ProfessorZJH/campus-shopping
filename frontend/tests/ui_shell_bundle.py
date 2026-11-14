#!/usr/bin/env python3
"""M1 单运行时与离线/静态服务回归：真实 Chromium 加载生成产物。

在带 CSP 的同源静态服务下验证 index.html/offline.html 只加载一个 Vue 运行时，
不请求 vendor 全局副本，且页面能挂载。API 由路由拦截替身返回，不代表 Java/MySQL 端到端。
运行: python frontend/tests/ui_shell_bundle.py
"""
import json
import os
import shutil
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

from browser_transport import close_browser
from ui_design_system import main as check_design_system

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / 'frontend'
STATIC = ROOT / 'campus-shopping-app/src/main/resources/static'
ERRORS = []
CONSOLE = []


class StaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        # 与 SessionSecurityConfig.cspPolicy 保持一致；只允许同源脚本。
        self.send_header(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; object-src 'none'; "
            "base-uri 'self'; frame-ancestors 'none'",
        )
        super().end_headers()


def api_reply(path):
    if path == '/auth/me':
        return 401, {'code': 'A0004', 'info': '请先登录', 'data': None}
    if path == '/auth/csrf':
        return 200, {'code': '0000', 'info': '成功', 'data': {'headerName': 'X-CSRF-TOKEN', 'token': 'fixture'}}
    if path.endswith('/page'):
        data = {'items': [], 'page': 1, 'size': 20, 'total': 0, 'hasNext': False}
    else:
        data = []
    return 200, {'code': '0000', 'info': '成功', 'data': data}


def route_api(route):
    path = urlparse(route.request.url).path.removeprefix('/api/v1')
    status, body = api_reply(path)
    route.fulfill(status=status, content_type='application/json', body=json.dumps(body, ensure_ascii=False))


def open_page(browser, base, name):
    page = browser.new_page(viewport={'width': 1280, 'height': 900}, locale='zh-CN')
    page.on('pageerror', lambda exc: ERRORS.append(f'{name}: {exc}'))
    page.on(
        'console',
        lambda message: CONSOLE.append(message.text)
        if 'Content Security Policy' in message.text or 'Refused to' in message.text
        else None,
    )
    requested = []
    style_responses = []
    page.on('request', lambda request: requested.append(request.url))
    page.on(
        'response',
        lambda response: style_responses.append((urlparse(response.url).path, response.status))
        if '/src/styles/' in urlparse(response.url).path else None,
    )
    page.route('**/api/v1/**', route_api)
    page.goto(f'{base}/{name}', wait_until='load')
    try:
        expect(page.locator('.application')).to_have_count(1)
    except AssertionError:
        print('STATIC', STATIC, 'BASE', base, 'NAME', name, 'URL', page.url)
        print('PAGE ERRORS', ERRORS)
        print('CSP CONSOLE', CONSOLE)
        print('BODY', page.content()[:1200])
        raise
    return page, requested, style_responses


def main():
    servers = [
        ThreadingHTTPServer(('127.0.0.1', 0), partial(StaticHandler, directory=str(STATIC))),
        ThreadingHTTPServer(('127.0.0.1', 0), partial(StaticHandler, directory=str(UI))),
    ]
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    entries = [
        (f'http://127.0.0.1:{servers[0].server_address[1]}', 'index.html', 'Java 静态 index'),
        (f'http://127.0.0.1:{servers[1].server_address[1]}', 'offline.html', '离线 offline'),
    ]
    checks = []
    launch = {'headless': True, 'args': ['--no-sandbox']}
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    if executable:
        launch['executable_path'] = executable
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(**launch)
            for base, name, label in entries:
                page, requested, style_responses = open_page(browser, base, name)
                assert page.evaluate('typeof window.Vue === "object"'), label
                version = page.evaluate('window.Vue.version')
                assert version.startswith('3.'), version
                assert page.locator('script[src*="vendor"]').count() == 0, label
                assert page.locator('script:not([src])').count() == 0, label
                assert not [url for url in requested if '/vendor/' in url], requested
                assert page.evaluate('document.documentElement.scrollWidth') <= 1280
                expected_styles = {f'/src/styles/{path.name}' for path in (UI / 'src/styles').glob('*.css')}
                assert expected_styles == {path for path, status in style_responses if status == 200}
                assert all(status == 200 for _, status in style_responses)
                assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--gradient-brand').trim()")
                expect(page.locator('.consumer-shell')).to_have_count(1)
                assert 'gradient' in page.locator('.consumer-shell').evaluate(
                    '(element) => getComputedStyle(element).backgroundImage'
                )
                login = page.get_by_role('button', name='登录', exact=True)
                login.focus()
                page.keyboard.press('Enter')
                dialog = page.locator('form.login-dialog')
                expect(dialog).to_be_visible()
                page.keyboard.press('Tab')
                account = dialog.locator('#login-name')
                expect(account).to_be_focused()
                assert account.evaluate(
                    "(element) => element.matches(':focus-visible') && "
                    "getComputedStyle(element).outlineStyle === 'solid' && "
                    "getComputedStyle(element).outlineWidth === '3px'"
                )
                page.keyboard.press('Escape')
                expect(dialog).to_have_count(0)
                expect(login).to_be_focused()
                checks.append(f'{label} 在 CSP 下只加载打包的单一 Vue 运行时')
                checks.append(f'{label} 在 CSP 下加载全部样式模块并应用品牌变量')
                checks.append(f'{label} 登录弹窗支持键盘焦点提示、Escape 和焦点恢复')
                page.close()
            assert not CONSOLE, CONSOLE
            assert not ERRORS, ERRORS
            close_browser(browser)
    finally:
        for server in servers:
            server.shutdown()
    print('PASSED', len(checks), 'SHELL BUNDLE CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
    check_design_system()
