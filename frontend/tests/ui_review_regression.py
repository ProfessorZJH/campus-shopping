"""PR48 review edges: Chromium with explicit HTTP doubles and abort-aware delays."""
import json
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from ui_remediation import Backend
from ui_fix_regression import browser_page, ERRORS
from browser_transport import close_page, close_browser


class AuthBackend(Backend):
    def handle(self, route):
        path = urlparse(route.request.url).path.removeprefix('/api/v1')
        if path == '/workspace' and not self.logged:
            self.requests.append(('GET', path, {}))
            return route.fulfill(status=401, json=self.data(None, 'A0004', '请先登录'))
        return super().handle(route)


def login(page):
    page.get_by_role('button', name='登录', exact=True).click()
    dialog = page.locator('form.login-dialog')
    dialog.locator('#login-name').fill('fixture_admin')
    dialog.locator('#login-password').fill('fixture-password')
    dialog.locator('button[type=submit]').click()


def anonymous_backend(browser):
    for route, title in [('/admin', '平台总览'), ('/admin/products', '商品监管'), ('/admin/knowledge', '知识库'), ('/merchant/settings', '门店设置')]:
        f = AuthBackend(); f.logged = False
        page = browser_page(browser, route, f)
        try:
            login(page)
            expect(page.locator('.merchant-page-heading h1')).to_have_text(title)
            expect(page.locator('form.login-dialog')).to_have_count(0)
            expect(page.locator('.access-denied')).to_have_count(0)
            assert page.evaluate('location.hash') in ('', '#' + route)
            # Logged-in context is restored exactly once; anonymous never requests it.
            assert f.count('/workspace') == 1
        finally:
            close_page(page)


def slow_initial_data(browser):
    f = AuthBackend()
    page = browser_page(browser, '/', f, before_mount="""() => {
      const fetch = window.fetch;
      window.initialPending = []; window.baseAborted = [];
      window.releaseInitial = () => window.initialPending.splice(0).forEach(resolve => resolve());
      window.fetch = async (url, options = {}) => {
        const u = new URL(url, 'http://contract.local');
        const base = u.pathname.endsWith('/categories') || u.pathname.includes('/merchants/public/page');
        if (base || (u.pathname.endsWith('/products/page') && !u.searchParams.has('q'))) {
          options.signal?.addEventListener('abort', () => { if (base) window.baseAborted.push(u.pathname); });
          await new Promise(resolve => window.initialPending.push(resolve));
          if (options.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        }
        return fetch(url, options);
      };
    }""")
    try:
        page.wait_for_function('window.initialPending.length === 3')
        search = page.get_by_role('textbox', name='搜索校园商品')
        search.fill(f.products[0]['title'])
        page.locator('.big-search button').click()
        expect(page.locator('.home-product')).to_have_count(1)
        assert page.evaluate('window.baseAborted') == []
        page.evaluate('window.releaseInitial()')
        expect(page.locator('.category-item')).not_to_have_count(0)
        expect(page.locator('.merchant-card')).not_to_have_count(0)
        expect(page.locator('.home-product')).to_have_count(1)
    finally:
        close_page(page)


def identity_request_counts(browser):
    f = AuthBackend(); f.logged = False
    page = browser_page(browser, '/', f)
    try:
        expect(page.locator('.home-product').first).to_be_visible()
        paths = ['/products/page', '/categories', '/merchants/public/page']
        assert [f.count(path) for path in paths] == [1, 1, 1]
        login(page)
        expect(page.locator('.account-pill')).to_be_visible()
        expect(page.locator('.home-product').first).to_be_visible()
        page.wait_for_timeout(150)
        assert [f.count(path) for path in paths] == [2, 2, 2]
        page.locator('.account-pill').click()
        expect(page.locator('.header-login')).to_be_visible()
        expect(page.locator('.home-product').first).to_be_visible()
        page.wait_for_timeout(150)
        assert [f.count(path) for path in paths] == [3, 3, 3]
    finally:
        close_page(page)


def session_failure(browser):
    for route in ['/', '/admin/products']:
        for mode in ['503', 'timeout']:
            f = AuthBackend(); f.logged = False
            script = """mode => {
              const fetch = window.fetch;
              if (mode === 'timeout') {
                const timer = window.setTimeout;
                window.setTimeout = (fn, ms, ...args) => {
                  if (ms === 15000) { window.setTimeout = timer; return timer(fn, 40, ...args); }
                  return timer(fn, ms, ...args);
                };
              }
              window.fetch = (url, options = {}) => {
                if (String(url).endsWith('/auth/me')) {
                  if (mode === '503') return Promise.resolve(new Response(JSON.stringify({code:'UNAVAILABLE',info:'会话暂不可用'}), {status:503}));
                  return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted','AbortError'))));
                }
                return fetch(url, options);
              };
            }"""
            page = browser_page(browser, route, f, before_mount='(' + script + ')(' + json.dumps(mode) + ')')
            try:
                if route == '/':
                    expect(page.locator('.home-product').first).to_be_visible()
                    expect(page.locator('.header-login')).to_be_visible()
                    login(page)
                    # 登录后再次核验会话；第二次超时使用真实的默认 15 秒。
                    expect(page.locator('.account-pill')).to_be_visible(timeout=20000)
                    expect(page.locator('.home-product').first).to_be_visible()
                    expect(page.locator('form.login-dialog')).to_have_count(0)
                else:
                    expect(page.get_by_role('button', name='重试', exact=True)).to_be_visible()
                    expect(page.locator('.merchant-shell')).to_have_count(0)
                    assert f.count('/workspace') == 0 and f.count('/admin/products/page') == 0
            finally:
                close_page(page)


def main():
    passed, failed = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'))
        for case in [anonymous_backend, slow_initial_data, identity_request_counts, session_failure]:
            try:
                case(browser); passed.append(case.__name__)
            except Exception as error:
                failed.append(dict(case=case.__name__, error=str(error)))
        close_browser(browser)
    print(json.dumps(dict(status='FAILED' if failed or ERRORS else 'PASS', kind='CHROMIUM_WITH_API_DOUBLES', passed=passed, failed=failed, browserErrors=ERRORS), ensure_ascii=False))
    if failed or ERRORS:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
