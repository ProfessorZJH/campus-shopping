#!/usr/bin/env python3
"""M1 导购会话回归：新对话隔离、迟到响应、引用结构与账号切换。

真实 Chromium + 交付 JS + 明确标注的 API 契约替身；不代表真实 AI/Java 端到端。
运行: python frontend/tests/ui_guide_conversation.py
"""
import json
import os
import shutil
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

from browser_transport import track_bindings, close_page, close_browser
from contract_ui import BackendContractDouble, DEADLINE, NOW
from ui_three_pages import UI, fixture_call

ERRORS = []

FETCH_DOUBLE = """(holdChat) => {
  window.__pendingChats = [];
  window.__pendingConfirms = [];
  window.__holdChat = holdChat;
  window.fetch = async (url, options = {}) => {
    const address = String(url);
    if (window.__holdChat && address.includes('/ai/chat')) {
      return new Promise((resolve) => window.__pendingChats.push({ url: address, resolve }));
    }
    if (window.__holdConfirm && address.includes('/ai/proposals/') && address.endsWith('/confirm')) {
      return new Promise((resolve) => window.__pendingConfirms.push({ url: address, options, resolve }));
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
  window.__releaseChat = (payload) => {
    const [entry] = window.__pendingChats.splice(0, 1);
    if (!entry) throw new Error('没有挂起的导购请求');
    entry.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  window.__releaseConfirm = async () => {
    const [entry] = window.__pendingConfirms.splice(0, 1);
    if (!entry) throw new Error('没有挂起的提案确认请求');
    const reply = await window.__contractApi({
      url: entry.url,
      method: entry.options.method || 'POST',
      headers: entry.options.headers || {},
      body: entry.options.body,
    });
    entry.resolve(
      new Response(reply.body, {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
}"""


class GuideBackend(BackendContractDouble):
    def __init__(self):
        super().__init__()
        self.logged = True
        self.auth_expired = False

    def handle(self, route):
        path = urlparse(route.request.url).path.removeprefix('/api/v1')
        # 会话过期必须同时拒绝身份回读，否则前端会把 401 后刚清空的状态又登录回来。
        if self.auth_expired and path in ('/ai/conversations', '/auth/me'):
            route.fulfill(status=401, json=self.data(None, 'A0004', '请先登录'))
            return
        return super().handle(route)


def open_guide(browser, fixture, hold_chat=False):
    page = browser.new_page(viewport={'width': 430, 'height': 932}, locale='zh-CN')
    page.on('pageerror', lambda exc: ERRORS.append(str(exc)))
    page.set_content(
        '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        '<body><div id="app"></div></body></html>'
    )
    page.add_style_tag(path=str(UI / 'src/styles/app.css'))
    page.evaluate(
        """() => {
          window.__CAMPUS_TEST_DEMO__ = false;
          window.__CAMPUS_TEST_ROUTE__ = '/ai';
          window.__CAMPUS_UI_TEST_IMAGES__ = {};
          if (!crypto.randomUUID) crypto.randomUUID = () => String(Date.now()) + Math.random();
        }"""
    )
    page.expose_binding('__contractApi', fixture_call(fixture))
    track_bindings(page)
    page.evaluate(FETCH_DOUBLE, hold_chat)
    page.add_script_tag(path=str(UI / 'ui.bundle.js'))
    expect(page.locator('.application')).to_have_count(1)
    return page


def ask(page, question):
    page.get_by_label('输入问题').fill(question)
    page.get_by_label('发送问题').click()


def main():
    checks = []
    launch = {'headless': True, 'args': ['--no-sandbox']}
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    if executable:
        launch['executable_path'] = executable
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch)
        fixture = GuideBackend()

        # 1. 新对话后旧响应晚到：不得写回消息、提案或引用。
        page = open_guide(browser, fixture, hold_chat=True)
        ask(page, '旧会话问题')
        expect(page.locator('.typing-bubble')).to_be_visible()
        page.get_by_role('button', name='新对话', exact=False).click()
        expect(page.locator('.typing-bubble')).to_have_count(0)
        expect(page.locator('.chat-row.is-user')).to_have_count(0)
        page.evaluate(
            """window.__releaseChat({code:'0000',info:'成功',data:{
              conversationId:'conv-old',
              answer:'旧回答不应出现',
              citations:[{documentId:'doc-old',title:'旧资料',snippet:'旧会话片段'}],
              proposal:{id:'p-old',status:'PENDING',items:[{
                skuId:'sku0',merchantId:'m1',title:'书写顺滑中性笔',
                specKey:'标准装',priceCent:1200,quoteVersion:1,quantity:1
              }]}
            }})"""
        )
        page.wait_for_timeout(250)
        assert '旧回答不应出现' not in page.locator('.chat-thread').inner_text()
        expect(page.locator('.recommendation-panel')).to_have_count(0)
        assert '旧资料' not in page.locator('.chat-thread').inner_text()
        checks.append('新对话后旧响应不写入消息、提案和引用')
        close_page(page)

        # 2. 新对话后仍能继续提问，旧请求的 finally 不能卡住新轮次。
        fixture.citations = [
            {'documentId': 'doc1', 'title': '自提指南', 'snippet': '付款后到店自提。'}
        ]
        page = open_guide(browser, fixture)
        ask(page, '新会话问题')
        expect(page.locator('.chat-bubble').last).to_contain_text('这是明确标注的本地检索演示')
        assert '旧回答不应出现' not in page.locator('.chat-thread').inner_text()
        checks.append('新对话后可以继续提问')
        expect(page.locator('.recommendation-panel')).to_be_visible()
        page.evaluate('window.__holdConfirm = true')
        page.get_by_role('button', name='确认加购', exact=True).click()
        new_chat = page.get_by_role('button', name='新对话')
        expect(new_chat).to_be_disabled()
        page.evaluate('window.__releaseConfirm()')
        expect(new_chat).to_be_enabled(timeout=15000)
        checks.append('提案确认请求未完成时禁止新对话，完成后恢复')
        close_page(page)

        # 3. 引用保留标题和片段，展开可见，且不生成文档直链。
        page = open_guide(browser, fixture)
        ask(page, '引用测试')
        chip = page.locator('.citation-chip').first
        expect(chip.locator('summary')).to_contain_text('自提指南')
        chip.locator('summary').click()
        expect(chip.locator('p')).to_contain_text('付款后到店自提。')
        assert page.locator('.citation-chips a').count() == 0
        checks.append('引用标题与片段可展开且无内部直链')
        close_page(page)

        # 4. 历史消息没有引用记录：不拼造引用卡片。
        fixture.conversations = [{'id': 'conv-old', 'title': '旧会话', 'createdAt': NOW, 'lastActiveAt': NOW, 'summary': '旧会话摘要'}]
        fixture.messages = [{'id': 'm1', 'role': 'assistant', 'content': '旧会话回答'}]
        fixture.proposals = []
        page = open_guide(browser, fixture)
        page.get_by_role('button', name='历史会话', exact=False).click()
        page.get_by_role('button', name='旧会话', exact=False).click()
        expect(page.locator('.chat-thread')).to_contain_text('旧会话回答')
        expect(page.locator('.citation-chip')).to_have_count(0)
        checks.append('历史消息无引用时不拼造引用')
        close_page(page)

        # 5. 会话失效后换账号登录：原账号消息、提案和输入不得保留。
        fixture.conversations = []
        fixture.messages = []
        fixture.proposals = []
        fixture.auth_expired = False
        page = open_guide(browser, fixture)
        ask(page, '账号A的问题')
        expect(page.locator('.recommendation-panel')).to_be_visible()
        page.get_by_label('输入问题').fill('账号A未发送的草稿')
        fixture.auth_expired = True
        page.get_by_role('button', name='历史会话', exact=False).click()
        expect(page.locator('.header-login')).to_be_visible()
        expect(page.locator('.chat-row')).to_have_count(0)
        expect(page.locator('.recommendation-panel')).to_have_count(0)
        expect(page.get_by_label('输入问题')).to_have_value('')
        fixture.auth_expired = False
        fixture.user = {
            'userId': 'u2',
            'username': 'student002',
            'displayName': '账号B',
            'status': 'ACTIVE',
        }
        page.locator('.header-login').click()
        page.locator('#login-name').fill('student002')
        page.locator('#login-password').fill('safe-test-password')
        page.locator('.login-dialog').get_by_role('button', name='登录', exact=True).click()
        expect(page.locator('.account-pill')).to_be_visible()
        expect(page.locator('.chat-row')).to_have_count(0)
        expect(page.locator('.recommendation-panel')).to_have_count(0)
        expect(page.get_by_label('输入问题')).to_have_value('')
        checks.append('会话失效并换账号后清空旧消息、提案和输入')
        close_page(page)

        assert not ERRORS, ERRORS
        close_browser(browser)
    print('PASSED', len(checks), 'GUIDE CONVERSATION CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
