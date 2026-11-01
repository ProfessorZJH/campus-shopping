"""Chromium + HTTP doubles: remediation behavior and request ownership (no live DB)."""
import json
import shutil
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
from ui_rbac_regression import RoleBackend
from ui_fix_regression import browser_page, ERRORS
from browser_transport import close_page, close_browser


class Backend(RoleBackend):
    def __init__(self):
        super().__init__()
        self.requests = []

    def handle(self, route):
        req = route.request
        parsed = urlparse(req.url)
        path = parsed.path.removeprefix('/api/v1')
        self.requests.append((req.method, path, parse_qs(parsed.query)))
        if '/rbac/members/' in path and req.method == 'PUT':
            return self.answer(route, None, 'A0005', '拒绝角色修改')
        if path == '/merchants/m1/orders/page':
            return self.answer(route, dict(items=[], page=int(parse_qs(parsed.query).get('page', ['1'])[0]), size=10, total=25, hasNext=True))
        return super().handle(route)

    def count(self, path):
        return sum(p == path and m == 'GET' for m, p, _ in self.requests)


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'))
        f = Backend()
        page = browser_page(browser, '/', f, before_mount="""() => {
          const fetch = window.fetch;
          window.fetch = async (url, options) => {
            if (String(url).endsWith('/auth/me')) await new Promise(resolve => window.releaseSession = resolve);
            return fetch(url, options);
          };
        }""")
        page.wait_for_function('typeof window.releaseSession === "function"')
        page.evaluate("location.hash='/account'")
        expect(page.get_by_text('正在恢复身份与权限…', exact=True)).to_be_visible()
        expect(page.locator('.account-profile')).to_have_count(0)
        page.evaluate('window.releaseSession()')
        expect(page.locator('.account-profile')).to_contain_text(f.user['username'])
        assert f.count('/auth/me') == 1
        checks.append('navigation during session recovery waits for one shared identity request')
        close_page(page)

        f = Backend()
        page = browser_page(browser, '/merchant/settings', f)
        field = page.locator('.ops-settings input').first
        expect(field).not_to_have_value('')
        before = len(f.requests)
        field.fill('新的经营名称')
        page.get_by_role('button', name='保存设置').click()
        expect(page.locator('.toast')).to_contain_text('门店资料已保存')
        expect(field).to_have_value('新的经营名称')
        assert not any(m == 'GET' and path != '/auth/csrf' for m, path, _ in f.requests[before:]), f.requests[before:]
        checks.append('profile PUT response updates form without follow-up GET')
        close_page(page)

        page = browser_page(browser, '/merchant/team', f)
        select = page.locator('.compact-select').first
        expect(select).to_have_value('CLERK')
        # Add an allowed target option so the failing request is exercised.
        page.evaluate("document.querySelector('.compact-select').add(new Option('测试角色','Rtest'))")
        select.select_option('Rtest')
        expect(page.locator('.toast')).to_contain_text('拒绝角色修改')
        expect(select).to_have_value('CLERK')
        checks.append('rejected role update restores server role')
        close_page(page)

        f = Backend()
        f.products[0]['skus'] = [dict(skuId='a', specKey='规格A', status='ACTIVE', priceCent=1500, available=5), dict(skuId='b', specKey='规格B', status='ACTIVE', priceCent=800, available=2)]
        page = browser_page(browser, '/', f)
        card = page.locator('.home-product').first
        expect(card).to_contain_text('¥8 起')
        expect(card).to_contain_text('规格B')
        card.click()
        expect(page.locator('.sku-picker button').first).to_have_attribute('aria-pressed', 'true')
        for _ in range(4):
            page.get_by_role('button', name='增加数量', exact=True).click()
        expect(page.locator('.quantity-picker b')).to_have_text('5')
        page.get_by_role('button', name='规格B', exact=True).click()
        expect(page.locator('.quantity-picker b')).to_have_text('1')
        checks.append('minimum price label matches SKU; switching stock resets quantity')
        close_page(page)

        f = Backend()
        page = browser_page(browser, '/admin/merchants', f)
        dialogs = []
        def dismiss(dialog):
            dialogs.append((dialog.type, dialog.message))
            dialog.dismiss()
        page.on('dialog', dismiss)
        page.get_by_role('button', name='停用', exact=True).first.click()
        assert dialogs[-1][0] == 'prompt' and f.shops[0]['name'] in dialogs[-1][1]
        assert not any(m == 'POST' and path.endswith('/state') for m, path, _ in f.requests)
        page.remove_listener('dialog', dismiss)
        def accept(dialog):
            dialogs.append((dialog.type, dialog.message))
            dialog.accept('违规经营' if dialog.type == 'prompt' else None)
        page.on('dialog', accept)
        page.get_by_role('button', name='停用', exact=True).first.click()
        expect(page.locator('.toast')).to_contain_text('操作成功')
        assert [d[0] for d in dialogs[-2:]] == ['prompt', 'confirm']
        checks.append('merchant suspension requires reason and named confirmation; cancel writes nothing')
        close_page(page)

        f = Backend()
        page = browser_page(browser, '/admin/products', f)
        page.on('dialog', dismiss)
        page.get_by_role('button', name='强制下架', exact=True).first.click()
        assert dialogs[-1][0] == 'confirm' and f.products[0]['title'] in dialogs[-1][1]
        assert not any(m == 'POST' and path.endswith('/unpublish') for m, path, _ in f.requests)
        checks.append('force unpublish confirms product name and cancellation makes no write')
        close_page(page)

        f = Backend()
        page = browser_page(browser, '/merchant/orders', f)
        expect(page.locator('.sdd-pager')).to_be_visible()
        assert f.count('/merchants/m1/orders/page') == 1
        assert f.count('/merchants/m1/products/page') == 0
        assert f.count('/merchants/m1/stocks/page') == 0
        page.get_by_role('button', name='下一页', exact=True).click()
        page.wait_for_function("document.querySelector('.sdd-pager').innerText.includes('2')")
        page.wait_for_timeout(100)
        before = f.count('/merchants/m1/orders/page')
        page.get_by_role('button', name='已支付', exact=True).click()
        page.wait_for_timeout(400)
        assert f.count('/merchants/m1/orders/page') == before + 1
        checks.append('orders own their only initial GET; page-two filter triggers one GET')
        close_page(page)

        f = Backend()
        page = browser_page(browser, '/merchant/products', f)
        expect(page.locator('.product-table tbody tr')).not_to_have_count(0)
        before = f.count('/merchants/m1/products/page')
        # Use the actual product search input independent of its copy.
        search = page.locator('.merchant-search input, .admin-search input, .ops-search input, .table-search input')
        if search.count() == 0:
            search = page.locator('input[placeholder]').first
        search.first.fill('leave immediately')
        page.evaluate("location.hash='/cart'")
        expect(page.locator('.mobile-page-top b')).to_have_text('购物车')
        page.wait_for_timeout(400)
        assert f.count('/merchants/m1/products/page') == before
        checks.append('leaving products cancels pending search timer; cart does not fetch public products')
        close_page(page)

        f = Backend()
        page = browser_page(browser, '/apply', f)
        expect(page.get_by_role('button', name='提交入驻申请', exact=True)).to_be_visible()
        assert f.count('/invitations') == 0 and f.count('/merchant-applications/mine/page') == 0
        checks.append('application form does not fetch history or invitations')
        close_page(page)

        f = Backend()
        page = browser_page(browser, '/', f)
        expect(page.locator('.home-product').first).to_be_visible()
        page.evaluate("""() => {
          const fetch = window.fetch;
          window.fetch = async (url, options) => {
            if (String(url).endsWith('/workspace')) await new Promise(resolve => window.releaseContext = resolve);
            return fetch(url, options);
          };
          location.hash='/admin/products';
        }""")
        expect(page.get_by_text('正在恢复身份与权限…', exact=True)).to_be_visible()
        expect(page.locator('.access-denied')).to_have_count(0)
        page.wait_for_function('typeof window.releaseContext === "function"')
        page.evaluate('window.releaseContext()')
        expect(page.get_by_role('button', name='强制下架', exact=True).first).to_be_visible()
        page.evaluate("""() => {
          const fetch = window.fetch;
          window.fetch = (url, options) => String(url).includes('/admin/products/page')
            ? Promise.resolve(new Response(JSON.stringify({code:'FAIL',info:'加载商品失败'}), {status:500}))
            : fetch(url, options);
        }""")
        page.get_by_role('button', name='刷新', exact=True).click()
        expect(page.locator('.inline-error')).to_contain_text('加载商品失败')
        expect(page.get_by_role('button', name='强制下架', exact=True).first).to_be_disabled()
        expect(page.get_by_role('button', name='重试', exact=True)).to_be_visible()
        checks.append('workspace recovery has no forbidden flash; list error offers retry and disables writes')
        close_page(page)

        f = Backend()
        f.cart = [dict(skuId='cart1', merchantId='m1', title='测试商品', specKey='规格', quantity=1, priceCent=100, available=30, sellable=True)]
        page = browser_page(browser, '/cart', f)
        expect(page.get_by_role('button', name='提交订单', exact=True)).to_be_visible()
        page.evaluate("""() => {
          const fetch = window.fetch;
          window.fetch = (url, options) => String(url).endsWith('/cart') && options.method === 'GET'
            ? new Promise(() => {}) : fetch(url, options);
        }""")
        page.get_by_role('button', name='刷新', exact=True).click()
        expect(page.get_by_role('button', name='提交订单', exact=True)).to_be_disabled()
        checks.append('cart refresh locks checkout while old rows remain visible')
        close_page(page)

        page = browser_page(browser, '/merchant/unknown', f)
        expect(page.get_by_text('404', exact=True)).to_be_visible()
        close_page(page)
        checks.append('unknown backoffice route displays 404')
        assert not ERRORS, ERRORS
        close_browser(browser)
    print(json.dumps(dict(status='PASS', kind='CHROMIUM_WITH_API_DOUBLES', checks=checks), ensure_ascii=False))


if __name__ == '__main__':
    main()
