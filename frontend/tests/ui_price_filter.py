#!/usr/bin/env python3
"""价格筛选前端契约测试：真实打包 Vue + 可控分页 API 替身（非 MySQL 验证）。"""
import json
import os
import shutil
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import TwoMerchantBackend, browser_page, close_page, ERRORS


class PriceBackend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.queries = []
        self.products = []
        for i in range(25):
            price = 100 + i * 100
            self.products.append(
                {
                    'productId': f'price-{i:02d}',
                    'merchantId': 'm1',
                    'storeId': 's1',
                    'title': f'价格商品{i:02d}',
                    'description': '价格筛选契约数据',
                    'categoryCode': 'stationery',
                    'imageUrl': '',
                    'status': 'PUBLISHED',
                    'version': 1,
                    'skus': [
                        {
                            'skuId': f'price-sku-{i:02d}',
                            'specKey': '标准装',
                            'priceCent': price,
                            'status': 'ACTIVE',
                            'quoteVersion': 1,
                            'available': 10,
                        }
                    ],
                }
            )
        self.products.append(
            {
                'productId': 'price-multi',
                'merchantId': 'm1',
                'storeId': 's1',
                'title': '多规格价格商品',
                'description': '低价规格不应作为筛选结果价格',
                'categoryCode': 'stationery',
                'imageUrl': '',
                'status': 'PUBLISHED',
                'version': 1,
                'skus': [
                    {
                        'skuId': 'multi-low',
                        'specKey': '小份',
                        'priceCent': 123,
                        'status': 'ACTIVE',
                        'quoteVersion': 1,
                        'available': 10,
                    },
                    {
                        'skuId': 'multi-high',
                        'specKey': '大份',
                        'priceCent': 987,
                        'status': 'ACTIVE',
                        'quoteVersion': 1,
                        'available': 10,
                    },
                ],
            }
        )

    def handle(self, route):
        url = urlparse(route.request.url)
        path = url.path.removeprefix('/api/v1')
        if route.request.method == 'GET' and path == '/products/page':
            q = parse_qs(url.query)
            page = int(q.get('page', ['1'])[0])
            size = int(q.get('size', ['20'])[0])
            sort = q.get('sort', ['NEWEST'])[0]
            min_price = q.get('minPriceCent', [None])[0]
            max_price = q.get('maxPriceCent', [None])[0]
            self.queries.append((page, size, sort, min_price, max_price))
            rows = self.products
            if min_price is not None or max_price is not None:
                low = int(min_price) if min_price is not None else None
                high = int(max_price) if max_price is not None else None
                rows = [
                    product
                    for product in rows
                    if any(
                        sku['status'] == 'ACTIVE'
                        and (low is None or sku['priceCent'] >= low)
                        and (high is None or sku['priceCent'] <= high)
                        for sku in product['skus']
                    )
                ]
            if sort == 'PRICE_ASC':
                rows = sorted(
                    rows,
                    key=lambda product: (
                        min(
                            sku['priceCent']
                            for sku in product['skus']
                            if sku['status'] == 'ACTIVE'
                        ),
                        product['productId'],
                    ),
                )
            total = len(rows)
            rows = rows[(page - 1) * size : page * size]
            route.fulfill(
                status=200,
                json=self.data(
                    {
                        'items': rows,
                        'page': page,
                        'size': size,
                        'total': total,
                        'hasNext': page * size < total,
                    }
                ),
            )
            return
        return super().handle(route)


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            args=['--no-sandbox'],
        )
        backend = PriceBackend()
        page = browser_page(browser, '/', backend)
        expect(page.locator('.home-product')).to_have_count(20, timeout=12000)

        page.get_by_role('textbox', name='最低价（元）').fill('24')
        page.get_by_role('textbox', name='最高价（元）').fill('26')
        page.get_by_role('button', name='应用', exact=True).click()
        expect(page.locator('.home-product')).to_have_count(2)
        expect(page.locator('.sdd-pager')).to_contain_text('共 2 件')
        assert backend.queries[-1] == (1, 20, 'NEWEST', '2400', '2600'), backend.queries[-1]
        assert '价格商品23' in page.locator('.home-product').first.inner_text()
        checks.append('价格区间在服务端分页前过滤：第 2 页商品出现在筛选后的第 1 页')

        page.get_by_role('textbox', name='最低价（元）').fill('9')
        page.get_by_role('textbox', name='最高价（元）').fill('10')
        page.get_by_role('button', name='应用', exact=True).click()
        multi = page.locator('.home-product').filter(has_text='多规格价格商品')
        expect(multi).to_have_count(1)
        expect(multi).to_contain_text('¥9.87')
        assert '¥1.23' not in multi.inner_text()
        checks.append('卡片展示命中区间的最低有效规格价格，不展示区间外低价')

        before = len(backend.queries)
        page.get_by_role('textbox', name='最低价（元）').fill('-1')
        page.get_by_role('button', name='应用', exact=True).click()
        expect(page.locator('.price-filter-error')).to_contain_text('价格条件无效')
        assert len(backend.queries) == before
        checks.append('负数价格在本地明确拒绝，不发起请求')

        page.get_by_role('textbox', name='最低价（元）').fill('abc')
        page.get_by_role('button', name='应用', exact=True).click()
        expect(page.locator('.price-filter-error')).to_contain_text('价格条件无效')
        assert len(backend.queries) == before
        checks.append('非数字价格在本地明确拒绝，不发起请求')

        page.get_by_role('textbox', name='最低价（元）').fill('10')
        page.get_by_role('textbox', name='最高价（元）').fill('5')
        page.get_by_role('button', name='应用', exact=True).click()
        expect(page.locator('.price-filter-error')).to_contain_text('最低价不能高于最高价')
        assert len(backend.queries) == before
        checks.append('最低价高于最高价时提示并保留输入，不发起请求')

        page.get_by_role('button', name='清除价格').click()
        assert backend.queries[-1] == (1, 20, 'NEWEST', None, None), backend.queries[-1]
        expect(page.locator('.home-product')).to_have_count(20)
        checks.append('清除价格只移除价格条件并重置分页')

        page.get_by_role('textbox', name='搜索校园商品').fill('文具')
        page.get_by_role('button', name='重置筛选').click()
        assert backend.queries[-1] == (1, 20, 'NEWEST', None, None), backend.queries[-1]
        assert page.get_by_role('textbox', name='搜索校园商品').input_value() == ''
        assert page.get_by_role('textbox', name='最低价（元）').input_value() == ''
        checks.append('重置筛选清空关键词、分类、商户、排序和价格并重新查询')

        close_page(page)
        assert not ERRORS, ERRORS
        browser.close()
    print('PASSED', len(checks), 'PRICE FILTER UI CONTRACT CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
