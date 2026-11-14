#!/usr/bin/env python3
"""商品详情契约测试：真实打包 Vue + 显式 API 替身，覆盖多图、规格状态与失败区分。"""
import base64
import json
import os
import re
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import TwoMerchantBackend
from ui_three_pages import UI, ERRORS, render, close_page

PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII='
)
OK_IMAGE = 'http://contract.local/media/ok.png'
BROKEN_IMAGE = 'http://contract.local/media/broken.png'


class DetailBackend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.detail_requests = []
        self.network_failures = 1
        detail = self.products[0]
        detail.update(
            {
                'title': '详情一致性商品',
                'description': '完整商品描述，含多图与规格状态。',
                'images': [
                    {
                        'imageId': 'img-ok',
                        'provider': 'LOCAL',
                        'url': OK_IMAGE,
                        'sortOrder': 0,
                    },
                    {
                        'imageId': 'img-broken',
                        'provider': 'LOCAL',
                        'url': BROKEN_IMAGE,
                        'sortOrder': 1,
                    },
                ],
                'skus': [
                    {
                        'skuId': 'detail-active',
                        'specKey': '标准装',
                        'priceCent': 1200,
                        'status': 'ACTIVE',
                        'quoteVersion': 1,
                        'available': 5,
                    },
                    {
                        'skuId': 'detail-inactive',
                        'specKey': '旧包装',
                        'priceCent': 1100,
                        'status': 'INACTIVE',
                        'quoteVersion': 1,
                        'available': 5,
                    },
                    {
                        'skuId': 'detail-empty',
                        'specKey': '大包装',
                        'priceCent': 2200,
                        'status': 'ACTIVE',
                        'quoteVersion': 1,
                        'available': 0,
                    },
                ],
            }
        )

    def handle(self, route):
        path = urlparse(route.request.url).path.removeprefix('/api/v1')
        if route.request.method == 'GET' and path.startswith('/products/'):
            product_id = path.split('/')[-1]
            self.detail_requests.append(product_id)
            if product_id == 'detail-unavailable':
                route.fulfill(
                    status=200,
                    json=self.data(None, 'C0001', '商品已下架或规格不可售'),
                )
                return
            if product_id == 'detail-missing':
                route.fulfill(status=200, json=self.data(None, 'G0001', '资源不存在或不可访问'))
                return
            if product_id == 'detail-network' and self.network_failures:
                self.network_failures -= 1
                route.fulfill(status=502, content_type='text/html', body='temporary failure')
                return
            if product_id == 'detail-network':
                route.fulfill(status=200, json=self.data({**self.products[0], 'productId': product_id}))
                return
        return super().handle(route)


def media_routes(page):
    page.route(OK_IMAGE, lambda route: route.fulfill(status=200, content_type='image/png', body=PNG))
    page.route(BROKEN_IMAGE, lambda route: route.abort())


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            args=['--no-sandbox'],
        )
        backend = DetailBackend()
        page = render(browser, '/product/p0', demo=False, fixture=backend, routes=media_routes)
        expect(page.locator('.detail-info h1')).to_have_text('详情一致性商品', timeout=12000)
        expect(page.locator('.detail-info')).to_contain_text('完整商品描述')
        expect(page.locator('.detail-image-thumbs img')).to_have_count(2)
        expect(page.locator('.detail-image-thumbs img').nth(1)).to_have_attribute(
            'src', re.compile('product-placeholder')
        )
        checks.append('商品详情展示描述与多图，失败图片回退占位图')

        skus = page.locator('.sku-picker button')
        expect(skus).to_have_count(3)
        assert not skus.nth(0).is_disabled()
        assert skus.nth(1).is_disabled() and '已下架' in skus.nth(1).inner_text()
        assert skus.nth(2).is_disabled() and '无货' in skus.nth(2).inner_text()
        checks.append('详情明确区分可售、已下架与无货规格')

        page.get_by_role('button', name='加入购物车').click()
        expect(page.locator('.toast')).to_contain_text('已加入购物车')
        assert any(item['skuId'] == 'detail-active' for item in backend.cart)
        checks.append('可售规格可加入购物车，请求携带当前规格')

        page.evaluate("location.hash='#/product/detail-unavailable'")
        expect(page.locator('.status-panel--error')).to_contain_text('该商品已下架或暂不可售')
        assert page.get_by_role('button', name='加入购物车').count() == 0
        checks.append('下架商品显示不可售而非通用加载失败')

        page.evaluate("location.hash='#/product/detail-missing'")
        expect(page.locator('.status-panel--error')).to_contain_text('商品不存在或已删除')
        checks.append('不存在商品显示独立缺失提示')

        page.evaluate("location.hash='#/product/detail-network'")
        expect(page.locator('.status-panel--error')).to_contain_text('商品加载失败')
        page.get_by_role('button', name='重新加载').click()
        expect(page.locator('.detail-info h1')).to_have_text('详情一致性商品')
        checks.append('加载失败可重试且成功后恢复详情')

        page.evaluate("location.hash='#/'")
        expect(page.locator('.home-product').first).to_be_visible(timeout=12000)
        page.locator('.home-product').first.click()
        page.get_by_role('button', name='查看商品详情').click()
        expect(page.locator('.detail-info h1')).to_have_text('详情一致性商品')
        home_requests = list(backend.detail_requests)
        checks.append('首页入口进入同一商品详情身份')

        page.evaluate("location.hash='#/shops/m1'")
        expect(page.locator('.shop-product-card').first).to_be_visible(timeout=12000)
        page.locator('.shop-product-card').first.click()
        expect(page.locator('.detail-info h1')).to_have_text('详情一致性商品')
        assert backend.detail_requests[-1] == home_requests[-1] == 'p0'
        checks.append('店铺入口与首页使用同一商品 ID 与详情数据')

        close_page(page)
        assert not ERRORS, ERRORS
        browser.close()
    print('PASSED', len(checks), 'PRODUCT DETAIL UI CONTRACT CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
