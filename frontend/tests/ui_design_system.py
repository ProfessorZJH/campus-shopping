#!/usr/bin/env python3
"""三端设计预览与响应式检查；不连接真实业务服务，也不代替后端验收。"""
import os
import shutil
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
STATIC = ROOT / 'campus-shopping-app/src/main/resources/static'
ROUTES = (
    ('/', '.consumer-shell'),
    ('/cart', '.consumer-shell'),
    ('/orders', '.consumer-shell'),
    ('/ai', '.consumer-shell'),
    ('/product/preview-p1', '.consumer-shell'),
    ('/shops/preview-m1', '.consumer-shell'),
    ('/merchant/products', '.merchant-shell'),
    ('/merchant/orders', '.merchant-shell'),
    ('/admin/products', '.merchant-shell'),
)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(STATIC)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_address[1]}'
    errors = []
    blocked = []
    checks = 0
    launch = {'headless': True, 'args': ['--no-sandbox']}
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    if executable:
        launch['executable_path'] = executable
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(**launch)
            for width in (320, 390, 1440):
                for path, shell in ROUTES:
                    page = browser.new_page(viewport={'width': width, 'height': 900}, locale='zh-CN')
                    page.on('pageerror', lambda _: errors.append((path, width)))

                    def local_assets(route):
                        url = route.request.url
                        parsed = urlparse(url)
                        if url.startswith(base + '/') and not parsed.path.startswith(('/api/', '/media/')):
                            route.continue_()
                        else:
                            blocked.append((path, width))
                            route.abort()

                    page.route('**/*', local_assets)
                    page.goto(f'{base}/index.html?demo=1#{path}', wait_until='load')
                    expect(page.locator(shell)).to_have_count(1)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (path, width)
                    assert page.evaluate(
                        "getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim()"
                    ), (path, width)
                    if shell == '.merchant-shell':
                        if width <= 560:
                            expect(page.locator('.merchant-mobile-nav')).to_be_visible()
                        else:
                            expect(page.locator('.merchant-sidebar')).to_be_visible()
                    if path == '/':
                        equal_gradient = page.evaluate('''() => {
                            const primary = document.createElement('button');
                            const wide = document.createElement('button');
                            primary.className = 'teal-button';
                            wide.className = 'primary-wide';
                            document.body.append(primary, wide);
                            const equal = getComputedStyle(primary).backgroundImage ===
                                getComputedStyle(wide).backgroundImage;
                            primary.remove();
                            wide.remove();
                            return equal;
                        }''')
                        assert equal_gradient, width
                    checks += 1
                    page.close()
            browser.close()
        assert not blocked, blocked
        assert not errors, errors
    finally:
        server.shutdown()
        server.server_close()
    print(f'PASSED {checks} DESIGN PREVIEW CHECKS: 320/390/1440 px, three workspaces, no real APIs')


if __name__ == '__main__':
    main()
