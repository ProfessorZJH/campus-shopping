#!/usr/bin/env python3
"""订单时间线与售后处理历程契约测试：真实打包 Vue + 显式 API 替身。"""
import json
import os
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import TwoMerchantBackend, browser_page, close_page, ERRORS
from ui_status_panel import order

NOW = '2026-11-06T10:00:00Z'


def event(event_id, event_type, role='BUYER', reason=''):
    return {
        'eventId': event_id,
        'type': event_type,
        'occurredAt': NOW,
        'actorRole': role,
        'reason': reason,
    }


class HistoryBackend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.orders = [order()]
        self.orders[0].update(
            {
                'pickupStoreName': '图书馆店',
                'pickupLocation': '图书馆一层东侧',
                'events': [
                    event('e1', 'ORDER_CREATED'),
                    event('e2', 'PAYMENT_SUCCEEDED'),
                    event('e3', 'REFUND_REQUESTED', 'BUYER', '无法自提'),
                    event('e4', 'MERCHANT_REJECTED', 'MERCHANT', '请到店处理'),
                    event('e5', 'REFUND_DISPUTED'),
                ],
            }
        )


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            args=['--no-sandbox'],
        )
        backend = HistoryBackend()
        page = browser_page(browser, '/orders/order-1', backend)
        timeline = page.locator('.order-timeline')
        expect(timeline).to_contain_text('已下单')
        expect(timeline).to_contain_text('已付款')
        expect(timeline).to_contain_text('申请退款')
        expect(timeline).to_contain_text('商户驳回退款')
        expect(timeline).to_contain_text('请到店处理')
        expect(timeline).to_contain_text('申请平台介入')
        checks.append('消费者订单时间线按真实事件展示阶段、时间和原因')
        close_page(page)

        backend = HistoryBackend()
        backend.orders[0].update({'afterSale': {'status': 'REQUESTED'}, 'events': []})
        page = browser_page(browser, '/orders/order-1', backend)
        expect(page.locator('.order-timeline')).to_contain_text('历史进度未记录')
        expect(page.locator('.token-card')).to_contain_text('退款处理中')
        assert page.get_by_role('button', name='领取自提凭证').count() == 0
        checks.append('退款处理中暂停凭证，旧订单无事件时明确历史缺失')
        close_page(page)

        backend = HistoryBackend()
        page = browser_page(browser, '/merchant/aftersales', backend)
        expect(page.locator('.ops-list-line')).to_contain_text('order-1')
        page.get_by_role('button', name='审核').click()
        history = page.locator('.review-history')
        expect(history).to_contain_text('申请退款')
        expect(history).to_contain_text('商户驳回退款')
        expect(history).to_contain_text('请到店处理')
        checks.append('商户售后审核复用订单历史，展示前序申请与拒绝原因')
        close_page(page)

        backend = HistoryBackend()
        page = browser_page(browser, '/admin/disputes', backend)
        expect(page.locator('.dispute-line')).to_contain_text('order-1')
        page.get_by_role('button', name='查看处理').click()
        history = page.locator('.review-history')
        expect(history).to_contain_text('申请退款')
        expect(history).to_contain_text('申请平台介入')
        checks.append('平台争议详情展示共享售后历程，可追溯前序决定')
        close_page(page)

        assert not ERRORS, ERRORS
        browser.close()
    print('PASSED', len(checks), 'ORDER/AFTER-SALE HISTORY UI CONTRACT CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
