#!/usr/bin/env python3
"""结算确认契约测试：真实打包 Vue + 显式 API 替身，验证刷新、失败恢复与幂等。"""
import json
import os
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import TwoMerchantBackend, browser_page, close_page, ERRORS

NOW = '2026-11-06T10:00:00Z'


class CheckoutBackend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.cart = [
            {
                'merchantId': 'm1',
                'merchantName': '林间文具铺（测试）',
                'skuId': 'sku0',
                'title': '书写顺滑中性笔',
                'specKey': '标准装',
                'imageUrl': '',
                'priceCent': 1200,
                'quoteVersion': 1,
                'quantity': 2,
                'available': 30,
                'sellable': True,
            }
        ]
        self.cart_reads = 0
        self.fail_cart = 0
        self.order_reject = False
        self.order_bodies = []

    def handle(self, route):
        path = urlparse(route.request.url).path.removeprefix('/api/v1')
        if route.request.method == 'GET' and path == '/cart':
            self.cart_reads += 1
            if self.fail_cart:
                self.fail_cart -= 1
                route.fulfill(status=200, json=self.data(None, 'G0001', '购物车刷新失败'))
                return
            route.fulfill(status=200, json=self.data(self.cart))
            return
        if route.request.method == 'POST' and path == '/orders':
            if route.request.headers.get('x-csrf-token') != self.csrf:
                route.fulfill(status=403, json=self.data(None, 'A0005', '安全令牌错误'))
                return
            body = route.request.post_data_json
            self.order_bodies.append(
                {
                    'body': body,
                    'key': route.request.headers.get('idempotency-key'),
                }
            )
            if self.order_reject:
                route.fulfill(status=200, json=self.data(None, 'C0002', '价格或库存已变化'))
                return
            order = {
                'orderId': 'o-checkout',
                'buyerId': 'u1',
                'merchantId': body['merchantId'],
                'merchantName': '林间文具铺（测试）',
                'storeId': 's1',
                'status': 'PENDING_PAYMENT',
                'totalCent': sum(
                    item['expectedPriceCent'] * item['quantity'] for item in body['items']
                ),
                'deadline': NOW,
                'createdAt': NOW,
                'items': [
                    {
                        'skuId': item['skuId'],
                        'title': '书写顺滑中性笔',
                        'specKey': '标准装',
                        'imageUrl': '',
                        'unitPriceCent': item['expectedPriceCent'],
                        'quantity': item['quantity'],
                    }
                    for item in body['items']
                ],
                'pickup': None,
                'afterSale': None,
            }
            self.orders.append(order)
            self.cart = []
            route.fulfill(status=200, json=self.data(order))
            return
        return super().handle(route)


HOLD_ORDERS = """() => {
  const original = window.fetch;
  window.__orderPending = [];
  window.fetch = (url, options = {}) => {
    if (String(url).endsWith('/orders') && (options.method || 'GET') === 'POST') {
      return new Promise((resolve, reject) =>
        window.__orderPending.push({ resolve, reject, headers: options.headers, body: options.body })
      );
    }
    return original(url, options);
  };
}"""


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            args=['--no-sandbox'],
        )

        # 1. 确认前刷新失败保留选择，重试后展示最新价格与门店信息。
        backend = CheckoutBackend()
        page = browser_page(browser, '/cart', backend)
        expect(page.locator('.cart-line')).to_contain_text('¥12')
        backend.cart[0]['priceCent'] = 1500
        backend.cart[0]['quoteVersion'] = 2
        backend.fail_cart = 1
        page.get_by_role('button', name='提交订单').click()
        expect(page.locator('.checkout-confirm .status-panel--error')).to_contain_text('购物车刷新失败')
        assert not backend.order_bodies
        page.get_by_role('button', name='重新加载').click()
        expect(page.locator('.checkout-confirm')).to_contain_text('林间文具铺（测试）')
        expect(page.locator('.checkout-confirm')).to_contain_text('图书馆一层东侧')
        expect(page.locator('.checkout-confirm')).to_contain_text('¥15')
        expect(page.locator('.checkout-confirm')).to_contain_text('模拟支付')
        checks.append('确认层重新读取购物车与门店，刷新失败可重试且不提交旧内容')
        close_page(page)

        # 2. 连续点击只发出一次请求；结果未知后同内容重试复用幂等键。
        backend = CheckoutBackend()
        page = browser_page(browser, '/cart', backend, before_mount=HOLD_ORDERS)
        page.get_by_role('button', name='提交订单').click()
        expect(page.locator('.checkout-confirm')).to_contain_text('确认下单（模拟支付）')
        confirm = page.get_by_role('button', name='确认下单（模拟支付）')
        confirm.click()
        page.wait_for_function('window.__orderPending.length === 1')
        assert page.locator('.checkout-actions .teal-button').is_disabled()
        first_key = page.evaluate("window.__orderPending[0].headers['Idempotency-Key']")
        page.evaluate("window.__orderPending[0].reject(new TypeError('Failed to fetch'))")
        expect(page.locator('.checkout-confirm .inline-error')).to_contain_text('服务连接失败')
        page.get_by_role('button', name='刷新确认信息').click()
        expect(page.locator('.checkout-confirm')).to_contain_text('¥12')
        page.get_by_role('button', name='确认下单（模拟支付）').click()
        page.wait_for_function('window.__orderPending.length === 2')
        second_key = page.evaluate("window.__orderPending[1].headers['Idempotency-Key']")
        assert first_key == second_key
        checks.append('提交中禁用确认按钮且只发出一次请求；未知结果重试沿用同一幂等键')

        order = {
            'orderId': 'o-checkout',
            'buyerId': 'u1',
            'merchantId': 'm1',
            'merchantName': '林间文具铺（测试）',
            'storeId': 's1',
            'status': 'PENDING_PAYMENT',
            'totalCent': 2400,
            'deadline': NOW,
            'createdAt': NOW,
            'items': [],
            'pickup': None,
            'afterSale': None,
        }
        backend.orders.append(order)
        page.evaluate(
            """order => window.__orderPending[1].resolve(
              new Response(JSON.stringify({code:'0000', info:'成功', data:order}),
                {status:200, headers:{'Content-Type':'application/json'}})
            )""",
            order,
        )
        page.wait_for_function("location.hash.includes('/orders/o-checkout')")
        checks.append('确认成功后进入可识别订单详情')
        close_page(page)

        # 3. 业务拒绝停留在确认层并保留可刷新内容。
        backend = CheckoutBackend()
        backend.order_reject = True
        page = browser_page(browser, '/cart', backend)
        page.get_by_role('button', name='提交订单').click()
        expect(page.locator('.checkout-confirm')).to_contain_text('确认下单（模拟支付）')
        page.get_by_role('button', name='确认下单（模拟支付）').click()
        expect(page.locator('.checkout-confirm .inline-error')).to_contain_text('价格或库存已变化')
        assert not backend.orders
        assert '/orders/' not in page.evaluate('location.hash')
        backend.order_reject = False
        page.get_by_role('button', name='刷新确认信息').click()
        page.get_by_role('button', name='确认下单（模拟支付）').click()
        page.wait_for_function("location.hash.includes('/orders/o-checkout')")
        checks.append('业务拒绝保留确认内容并允许刷新后重新提交')
        close_page(page)

        assert not ERRORS, ERRORS
        browser.close()
    print('PASSED', len(checks), 'CHECKOUT CONFIRMATION UI CONTRACT CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
