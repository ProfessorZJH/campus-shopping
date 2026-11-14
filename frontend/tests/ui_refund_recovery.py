#!/usr/bin/env python3
"""M1 退款失败恢复回归：真实 Chromium + 交付 JS + 明确标注的 API 契约替身。

覆盖业务拒绝、成功清理、写成功但刷新失败、提交中重复点击和切换订单后的迟到响应。
契约替身不代表 Spring/MySQL 端到端。
运行: python frontend/tests/ui_refund_recovery.py
"""
import json
import os
import re
import shutil
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

from browser_transport import add_campus_styles, track_bindings, close_page, close_browser
from contract_ui import BackendContractDouble, DEADLINE, NOW
from ui_three_pages import UI, fixture_call

ERRORS = []

FETCH_DOUBLE = """(holdRefund) => {
  window.__pendingRefunds = [];
  window.__holdRefund = holdRefund;
  window.fetch = async (url, options = {}) => {
    const address = String(url);
    if (window.__holdRefund && address.includes('/refunds')) {
      return new Promise((resolve) => window.__pendingRefunds.push({ url: address, resolve }));
    }
    const reply = await window.__contractApi({
      url: address,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
    });
    return new Response(reply.body, {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  window.__releaseRefund = (payload) => {
    const [entry] = window.__pendingRefunds.splice(0, 1);
    if (!entry) throw new Error('没有挂起的退款请求');
    entry.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
}"""


def refund_order(order_id):
    return {
        'orderId': order_id,
        'buyerId': 'u1',
        'merchantId': 'm1',
        'storeId': 's1',
        'status': 'PAID',
        'totalCent': 1200,
        'deadline': DEADLINE,
        'createdAt': NOW,
        'items': [
            {
                'skuId': 'sku0',
                'title': '书写顺滑中性笔',
                'specKey': '标准装',
                'quantity': 1,
                'unitPriceCent': 1200,
                'imageUrl': '',
            }
        ],
        'pickup': {'status': 'WAIT_PREP'},
        'afterSale': None,
    }


class RefundBackend(BackendContractDouble):
    def __init__(self):
        super().__init__()
        self.logged = True
        self.refund_mode = 'reject'
        self.fail_order_reads = False
        self.refund_reasons = []
        self.orders = [refund_order('order-1'), refund_order('order-2')]

    def handle(self, route):
        path = urlparse(route.request.url).path.removeprefix('/api/v1')
        body = route.request.post_data_json if route.request.post_data else {}
        if re.fullmatch(r'/orders/[^/]+/refunds', path) and route.request.method == 'POST':
            self.refund_reasons.append(body['reason'])
            if self.refund_mode == 'reject':
                route.fulfill(status=200, json=self.data(None, 'T0001', '该订单当前不可申请退款'))
                return
            order = next(x for x in self.orders if x['orderId'] == path.split('/')[2])
            if self.refund_mode == 'accept_refresh_fail':
                self.fail_order_reads = True
            route.fulfill(
                status=200,
                json=self.data(
                    {
                        'id': 'sale-1',
                        'orderId': order['orderId'],
                        'status': 'REQUESTED',
                        'reason': body['reason'],
                    }
                ),
            )
            return
        if self.fail_order_reads and re.fullmatch(r'/orders/[^/]+', path) and route.request.method == 'GET':
            route.fulfill(status=500, json=self.data(None, 'G0001', '订单刷新失败'))
            return
        return super().handle(route)


def open_order(browser, fixture, route, hold_refund=False):
    page = browser.new_page(viewport={'width': 430, 'height': 932}, locale='zh-CN')
    page.on('pageerror', lambda exc: ERRORS.append(str(exc)))
    page.set_content(
        '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        '<body><div id="app"></div></body></html>'
    )
    add_campus_styles(page, UI)
    page.evaluate(
        """(route) => {
          window.__CAMPUS_TEST_DEMO__ = false;
          window.__CAMPUS_TEST_ROUTE__ = route;
          window.__CAMPUS_UI_TEST_IMAGES__ = {};
          if (!crypto.randomUUID) crypto.randomUUID = () => String(Date.now()) + Math.random();
        }""",
        route,
    )
    page.expose_binding('__contractApi', fixture_call(fixture))
    track_bindings(page)
    page.evaluate(FETCH_DOUBLE, hold_refund)
    page.add_script_tag(path=str(UI / 'ui.bundle.js'))
    expect(page.locator('.application')).to_have_count(1)
    return page


def fill_refund(page, reason):
    page.get_by_role('button', name='申请退款', exact=True).click()
    page.locator('form.detail-card textarea').fill(reason)


def main():
    checks = []
    launch = {'headless': True, 'args': ['--no-sandbox']}
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    if executable:
        launch['executable_path'] = executable
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch)
        fixture = RefundBackend()

        # 1. 业务拒绝：失败必须保留原因和表单，不能当作成功清理。
        page = open_order(browser, fixture, '/orders/order-1')
        fill_refund(page, '商品缺货，申请退款')
        page.get_by_role('button', name='提交退款申请', exact=True).click()
        expect(page.locator('.toast')).to_contain_text('该订单当前不可申请退款')
        expect(page.locator('form.detail-card textarea')).to_be_visible()
        assert page.locator('form.detail-card textarea').input_value() == '商品缺货，申请退款'
        assert fixture.refund_reasons == ['商品缺货，申请退款']
        checks.append('业务拒绝后保留退款原因和表单')
        close_page(page)

        # 2. 业务成功：只有成功才关闭表单并清空原因。
        fixture.refund_mode = 'accept'
        fixture.refund_reasons = []
        page = open_order(browser, fixture, '/orders/order-1')
        fill_refund(page, '未提货申请退款')
        page.get_by_role('button', name='提交退款申请', exact=True).click()
        expect(page.locator('.toast')).to_contain_text('操作成功')
        expect(page.locator('form.detail-card')).to_have_count(0)
        page.get_by_role('button', name='申请退款', exact=True).click()
        expect(page.locator('form.detail-card textarea')).to_have_value('')
        assert fixture.refund_reasons == ['未提货申请退款']
        checks.append('业务成功后才关闭表单并清空原因')
        close_page(page)

        # 3. 写成功但刷新失败：提示刷新问题，不诱导再次提交。
        fixture.refund_mode = 'accept_refresh_fail'
        fixture.refund_reasons = []
        fixture.fail_order_reads = False
        page = open_order(browser, fixture, '/orders/order-1')
        fill_refund(page, '刷新失败仍应提示成功')
        page.get_by_role('button', name='提交退款申请', exact=True).click()
        expect(page.locator('.toast')).to_contain_text('刷新失败')
        expect(page.locator('form.detail-card')).to_have_count(0)
        expect(page.locator('.status-panel--error')).to_contain_text('订单刷新失败')
        expect(page.get_by_role('button', name='重新加载')).to_be_visible()
        assert fixture.refund_reasons == ['刷新失败仍应提示成功']
        checks.append('写成功但刷新失败时区分提示且不重复提交')
        close_page(page)

        # 4. 提交中重复点击：请求未完成前不得再发一次。
        fixture.refund_mode = 'accept'
        fixture.refund_reasons = []
        fixture.fail_order_reads = False
        page = open_order(browser, fixture, '/orders/order-1', hold_refund=True)
        fill_refund(page, '重复点击只提交一次')
        submit = page.get_by_role('button', name='提交退款申请', exact=True)
        submit.click()
        expect(submit).to_be_disabled()
        submit.click(force=True)
        page.wait_for_timeout(120)
        assert page.evaluate('window.__pendingRefunds.length') == 1
        page.evaluate("window.__releaseRefund({code:'0000',info:'成功',data:{}})")
        expect(page.locator('.toast')).to_contain_text('操作成功')
        checks.append('提交中重复点击只发一次退款请求')
        close_page(page)

        # 5. 切换订单后的迟到响应：不得修改新订单的表单或提示成功。
        page = open_order(browser, fixture, '/orders/order-1', hold_refund=True)
        fill_refund(page, '旧订单退款请求')
        page.get_by_role('button', name='提交退款申请', exact=True).click()
        expect(page.get_by_role('button', name='提交退款申请', exact=True)).to_be_disabled()
        page.evaluate("location.hash='/orders/order-2'")
        expect(page.locator('.order-metadata')).to_contain_text('order-2')
        fill_refund(page, '新订单尚未提交')
        page.evaluate("window.__releaseRefund({code:'0000',info:'成功',data:{}})")
        page.wait_for_timeout(300)
        toast = page.locator('.toast')
        assert toast.count() == 0 or '操作成功' not in toast.inner_text()
        expect(page.locator('form.detail-card textarea')).to_have_value('新订单尚未提交')
        checks.append('切换订单后迟到退款响应不污染新页面')
        close_page(page)

        assert not ERRORS, ERRORS
        close_browser(browser)
    print('PASSED', len(checks), 'REFUND RECOVERY CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
