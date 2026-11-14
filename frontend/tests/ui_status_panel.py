#!/usr/bin/env python3
"""M1 公共状态与表单反馈回归：真实 Chromium + 交付 JS + 明确标注的 API 契约替身。

覆盖加载、空态、错误重试、提交中禁用、键盘操作与手机/桌面布局；
契约替身不代表 Spring/MySQL 端到端。
运行: python frontend/tests/ui_status_panel.py
"""
import json
import os
import shutil
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

from browser_transport import add_campus_styles, track_bindings, close_page, close_browser
from contract_ui import BackendContractDouble, DEADLINE, NOW
from ui_three_pages import UI, fixture_call

ERRORS = []

FETCH_DOUBLE = """({ holdOrder, holdChat }) => {
  window.__pendingOrders = [];
  window.__pendingChats = [];
  window.__streamResponse = (payload) => {
    const answer = payload.data || {};
    const conversationId = answer.conversationId || 'conv-contract';
    if (payload.code && payload.code !== '0000') {
      const failed = {conversationId, mode:'FULL_RESPONSE', data:null, errorCode:payload.code};
      const stream = 'event: failed\\ndata: ' + JSON.stringify(failed) + '\\n\\n';
      return new Response(stream, {status:200, headers:{'Content-Type':'text/event-stream'}});
    }
    const started = {conversationId, mode:'FULL_RESPONSE', data:null, errorCode:null};
    const completed = {conversationId, mode:'FULL_RESPONSE', data:answer, errorCode:null};
    const stream = 'event: started\\ndata: ' + JSON.stringify(started) + '\\n\\n'
      + 'event: completed\\ndata: ' + JSON.stringify(completed) + '\\n\\n';
    return new Response(stream, {status:200, headers:{'Content-Type':'text/event-stream'}});
  };
  window.fetch = async (url, options = {}) => {
    const address = String(url);
    const method = options.method || 'GET';
    const isStream = address.includes('/ai/chat/stream');
    if (holdOrder && method === 'GET' && /\\/orders\\/order-1$/.test(address)) {
      return new Promise((resolve) => window.__pendingOrders.push({ url: address, resolve }));
    }
    if (holdChat && address.includes('/ai/chat')) {
      return new Promise((resolve) => window.__pendingChats.push({ url: address, resolve, isStream }));
    }
    const reply = await window.__contractApi({
      url: isStream ? address.replace('/ai/chat/stream', '/ai/chat') : address,
      method,
      headers: options.headers || {},
      body: options.body,
    });
    if (isStream) return window.__streamResponse(JSON.parse(reply.body));
    return new Response(reply.body, {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  window.__releaseOrder = (payload) => {
    const [entry] = window.__pendingOrders.splice(0, 1);
    if (!entry) throw new Error('没有挂起的订单请求');
    entry.resolve(entry.isStream ? window.__streamResponse(payload) : new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  };
  window.__releaseChat = (payload) => {
    const [entry] = window.__pendingChats.splice(0, 1);
    if (!entry) throw new Error('没有挂起的导购请求');
    entry.resolve(entry.isStream ? window.__streamResponse(payload) : new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  };
}"""


def order(order_id='order-1'):
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


class StatusBackend(BackendContractDouble):
    def __init__(self):
        super().__init__()
        self.logged = True
        self.fail_orders = 0
        self.fail_admin = 0
        self.fail_chat = 0
        self.admin_calls = 0
        self.orders = [order()]

    def handle(self, route):
        path = urlparse(route.request.url).path.removeprefix('/api/v1')
        method = route.request.method
        if method == 'GET' and path == '/orders/order-1' and self.fail_orders > 0:
            self.fail_orders -= 1
            route.fulfill(status=500, json=self.data(None, 'G0001', '订单加载失败'))
            return
        if method == 'GET' and path == '/admin/merchants/page':
            self.admin_calls += 1
        if method == 'GET' and path == '/admin/merchants/page' and self.fail_admin > 0:
            self.fail_admin -= 1
            route.fulfill(status=500, json=self.data(None, 'G0001', '商户列表加载失败'))
            return
        if method == 'POST' and path == '/ai/chat' and self.fail_chat > 0:
            self.fail_chat -= 1
            route.fulfill(status=500, json=self.data(None, 'G0001', '导购服务暂不可用'))
            return
        return super().handle(route)


def render(browser, fixture, route, size=(430, 932), hold_order=False, hold_chat=False):
    page = browser.new_page(viewport={'width': size[0], 'height': size[1]}, locale='zh-CN')
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
    page.evaluate(FETCH_DOUBLE, {'holdOrder': hold_order, 'holdChat': hold_chat})
    page.add_script_tag(path=str(UI / 'ui.bundle.js'))
    expect(page.locator('.application')).to_have_count(1)
    return page


def no_overflow(page, width):
    assert page.evaluate('document.documentElement.scrollWidth') <= width


def main():
    checks = []
    launch = {'headless': True, 'args': ['--no-sandbox']}
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    if executable:
        launch['executable_path'] = executable
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch)
        fixture = StatusBackend()

        # 1. 订单加载中：公共加载状态可读，释放后进入详情。
        page = render(browser, fixture, '/orders/order-1', hold_order=True)
        loading = page.locator('.status-panel--loading')
        expect(loading).to_be_visible()
        expect(loading).to_have_attribute('role', 'status')
        expect(loading).to_contain_text('正在加载')
        page.evaluate(
            """window.__releaseOrder({code:'0000',info:'成功',data:%s})"""
            % json.dumps(order(), ensure_ascii=False)
        )
        expect(page.locator('.order-metadata')).to_contain_text('order-1')
        expect(page.locator('.status-panel--loading')).to_have_count(0)
        checks.append('订单加载态使用公共状态组件并在完成后消失')
        close_page(page)

        # 2. 订单加载失败：错误态提供可键盘操作的重试，重试成功恢复内容。
        fixture.fail_orders = 1
        page = render(browser, fixture, '/orders/order-1')
        error = page.locator('.status-panel--error')
        expect(error).to_be_visible()
        expect(error).to_have_attribute('role', 'alert')
        expect(error).to_contain_text('订单加载失败')
        retry = page.get_by_role('button', name='重新加载')
        retry.focus()
        page.keyboard.press('Enter')
        expect(page.locator('.order-metadata')).to_contain_text('order-1')
        expect(page.locator('.status-panel--error')).to_have_count(0)
        fixture.fail_orders = 0
        checks.append('订单错误态支持键盘重试并在成功后恢复')
        close_page(page)

        # 3. 订单空态：移动端与桌面端都不产生横向溢出。
        fixture.orders = []
        page = render(browser, fixture, '/orders')
        empty = page.locator('.status-panel--empty')
        expect(empty).to_be_visible()
        expect(empty).to_contain_text('暂无订单')
        no_overflow(page, 430)
        close_page(page)
        fixture.orders = [order()]
        fixture.fail_orders = 6
        page = render(browser, fixture, '/orders/order-1', size=(1280, 900))
        expect(page.locator('.status-panel--error')).to_be_visible()
        expect(page.get_by_role('button', name='重新加载')).to_be_visible()
        no_overflow(page, 1280)
        fixture.fail_orders = 0
        checks.append('订单空态与桌面错误态布局无横向溢出')
        close_page(page)

        # 4. 管理端列表失败：公共错误态可重试，窄屏仍可操作。
        fixture.fail_admin = 1
        page = render(browser, fixture, '/admin/merchants', size=(390, 844))
        error = page.locator('.status-panel--error')
        expect(error).to_be_visible()
        expect(error).to_contain_text('商户列表加载失败')
        retry = page.get_by_role('button', name='重新加载')
        retry.focus()
        page.keyboard.press('Enter')
        expect(page.locator('.ops-table')).to_contain_text('林间文具铺（测试）')
        assert fixture.admin_calls >= 2
        no_overflow(page, 390)
        fixture.fail_admin = 0
        page.set_viewport_size({'width': 1280, 'height': 900})
        no_overflow(page, 1280)
        checks.append('管理端错误态支持键盘重试且手机/桌面布局可用')
        close_page(page)

        # 5. AI 提交中禁用发送；失败后恢复输入并可键盘再次提交。
        page = render(browser, fixture, '/ai', hold_chat=True)
        page.get_by_label('输入问题').fill('导购提交中')
        page.get_by_label('发送问题').click()
        expect(page.get_by_role('button', name='停止生成', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='停止生成', exact=True)).to_be_disabled()
        expect(page.get_by_label('输入问题')).to_be_disabled()
        page.evaluate(
            """window.__releaseChat({code:'0000',info:'成功',data:{
              conversationId:'conv-status',
              answer:'这是明确标注的本地检索演示。',
              mode:'LOCAL_RETRIEVAL_DEMO',
              retrievalMode:'LOCAL_CHAR_NGRAM_DEMO',
              warning:null,
              citations:[],
              proposal:null,
              latencyMs:15
            }})"""
        )
        expect(page.locator('.chat-bubble').last).to_contain_text('本地检索演示')
        close_page(page)

        page = render(browser, fixture, '/ai')
        fixture.fail_chat = 1
        page.get_by_label('输入问题').fill('导购失败重试')
        page.get_by_label('发送问题').click()
        expect(page.locator('.inline-error')).to_contain_text('智能服务暂不可用')
        expect(page.get_by_label('输入问题')).to_have_value('导购失败重试')
        expect(page.get_by_label('发送问题')).to_be_enabled()
        page.get_by_label('输入问题').press('Enter')
        expect(page.locator('.chat-bubble').last).to_contain_text('本地检索演示')
        no_overflow(page, 430)
        page.set_viewport_size({'width': 1280, 'height': 900})
        no_overflow(page, 1280)
        checks.append('AI 提交中禁用、失败恢复输入并可键盘重试')
        close_page(page)

        assert not ERRORS, ERRORS
        close_browser(browser)
    print('PASSED', len(checks), 'STATUS PANEL CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
