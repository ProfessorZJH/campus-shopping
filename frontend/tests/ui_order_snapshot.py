#!/usr/bin/env python3
"""订单自提地点快照契约测试：真实打包 Vue + 显式 API 替身。"""
import json
import os
import shutil
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import TwoMerchantBackend, browser_page, close_page, ERRORS
from ui_status_panel import order


class SnapshotBackend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.orders = [order()]
        self.orders[0].update(
            {'pickupStoreName': '图书馆店', 'pickupLocation': '图书馆一层东侧'}
        )


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            args=['--no-sandbox'],
        )
        backend = SnapshotBackend()
        page = browser_page(browser, '/orders/order-1', backend)
        expect(page.locator('.pickup-location')).to_contain_text('图书馆店 · 图书馆一层东侧')
        backend.shops[0]['location'] = '商户后来修改的新地点'
        page.get_by_role('button', name='刷新').click()
        expect(page.locator('.pickup-location')).to_contain_text('图书馆一层东侧')
        assert '新地点' not in page.locator('.pickup-location').inner_text()
        checks.append('订单详情展示下单时自提快照，商户改址不改写历史')
        close_page(page)

        backend = SnapshotBackend()
        backend.orders[0].pop('pickupStoreName')
        backend.orders[0].pop('pickupLocation')
        page = browser_page(browser, '/orders/order-1', backend)
        card = page.locator('.detail-card').first
        expect(card).to_contain_text('历史自提地点未记录')
        expect(card).to_contain_text('当前门店')
        expect(card).to_contain_text('非下单时快照')
        checks.append('旧订单缺快照时明确未记录，当前门店信息另行标注')
        close_page(page)

        assert not ERRORS, ERRORS
        browser.close()
    print('PASSED', len(checks), 'ORDER PICKUP SNAPSHOT UI CONTRACT CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
