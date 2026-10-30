#!/usr/bin/env python3
"""真实 Chromium + 明确的 HTTP 替身：会话与邀请可以访问第 101 条。"""
import json
import shutil
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
from ui_three_pages import render, BackendContractDouble, ERRORS
from browser_transport import close_page, close_browser


class PagedBackend(BackendContractDouble):
    def __init__(self):
        super().__init__()
        self.logged = True
        self.pages = []

    def handle(self, route):
        parsed = urlparse(route.request.url)
        path = parsed.path.removeprefix('/api/v1')
        if path in ('/ai/conversations', '/invitations'):
            params = parse_qs(parsed.query)
            page, size = int(params.get('page', ['1'])[0]), int(params.get('size', ['100'])[0])
            self.pages.append((path, page, size))
            rows = [dict(id=f'row-{i}', title=f'历史会话 {i}', merchantId=f'商户 {i}', status='PENDING',
                         createdAt='2026-10-30T00:00:00Z', expiresAt='2027-01-01T00:00:00Z') for i in range(101)]
            return route.fulfill(status=200, json=self.data(rows[(page-1)*size:page*size]))
        return super().handle(route)


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
        fixture = PagedBackend()
        page = render(browser, '/ai', False, fixture=fixture)
        page.get_by_role('button', name='历史会话').click()
        expect(page.locator('.ai-history-list button').filter(has_text='历史会话')).to_have_count(20)
        for expected in (40, 60, 80, 100, 101):
            page.get_by_role('button', name='加载更多会话').click()
            expect(page.locator('.ai-history-list button').filter(has_text='历史会话')).to_have_count(expected)
        expect(page.get_by_role('button', name='加载更多会话')).to_have_count(0)
        checks.append('会话加载至第 101 条，末页隐藏继续加载')
        close_page(page)
        page = render(browser, '/invitations', False, fixture=fixture)
        expect(page.locator('.invitation-line')).to_have_count(20)
        for _ in range(5):
            page.get_by_role('button', name='下一页').click()
            expect(page.locator('.sdd-pager span')).to_have_text(str(_+2))
        expect(page.locator('.invitation-line')).to_have_count(1)
        expect(page.locator('.invitation-line')).to_contain_text('商户 100')
        expect(page.get_by_role('button', name='下一页')).to_be_disabled()
        page.get_by_role('button', name='上一页').click()
        expect(page.locator('.invitation-line')).to_have_count(20)
        checks.append('邀请第六页可访问第 101 条，并可返回上一页')
        assert ('/ai/conversations', 6, 20) in fixture.pages
        assert ('/invitations', 6, 20) in fixture.pages
        assert not ERRORS, ERRORS
        close_page(page)
        close_browser(browser)
    print(json.dumps({'status': 'PASS', 'type': 'CHROMIUM_WITH_HTTP_CONTRACT_DOUBLE', 'checks': checks}, ensure_ascii=False))


if __name__ == '__main__':
    main()
