#!/usr/bin/env python3
"""门店公开资料与门店图片契约测试：真实打包 Vue + 显式 API 替身。"""
import base64
import json
import os
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import TwoMerchantBackend, browser_page, close_page, ERRORS

PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII='
)
STORE_IMAGE = 'http://contract.local/media/store.png'


class StorefrontBackend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.profile_bodies = []
        self.upload_bodies = []
        self.shops[0].update(
            {
                'description': '校园文具与打印服务，支持到店自提。',
                'businessHours': '周一至周五 08:00-20:00（北京时间）',
                'imageUrl': STORE_IMAGE + '?initial=1',
            }
        )
        self.shops[1].update({'description': '', 'businessHours': '', 'imageUrl': ''})

    def handle(self, route):
        path = urlparse(route.request.url).path.removeprefix('/api/v1')
        if path == '/merchants/public/suspended':
            route.fulfill(status=200, json=self.data(None, 'M0004', '商户当前暂停经营'))
            return
        if route.request.method == 'POST' and path == '/merchants/m1/store/images':
            self.upload_bodies.append(route.request.post_data_json)
            route.fulfill(status=200, json=self.data({'url': STORE_IMAGE}))
            return
        if route.request.method == 'PUT' and path == '/merchants/m1/profile':
            body = route.request.post_data_json
            self.profile_bodies.append(body)
            shop = dict(self.shops[0])
            shop.update(body)
            self.shops[0] = shop
            route.fulfill(status=200, json=self.data(shop))
            return
        return super().handle(route)


def media_routes(page):
    page.route(STORE_IMAGE, lambda route: route.fulfill(status=200, content_type='image/png', body=PNG))


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            args=['--no-sandbox'],
        )
        backend = StorefrontBackend()

        page = browser_page(browser, '/shops/m1', backend)
        media_routes(page)
        expect(page.locator('.shop-intro')).to_contain_text('校园文具与打印服务')
        expect(page.locator('.shop-intro')).to_contain_text('08:00-20:00（北京时间）')
        expect(page.locator('.shop-hero-image')).to_have_count(1)
        checks.append('门店详情展示介绍、营业时段和已授权门店图片')
        close_page(page)

        page = browser_page(browser, '/shops/m2', backend)
        expect(page.locator('.shop-intro')).to_contain_text('未填写')
        expect(page.locator('.shop-hero-image')).to_have_count(0)
        checks.append('未填写门店资料显示空态，不推测营业状态')
        close_page(page)

        page = browser_page(browser, '/shops/suspended', backend)
        expect(page.locator('.inline-error')).to_contain_text('暂停经营')
        checks.append('停用商户公开详情被拒绝，营业文案不恢复交易资格')
        close_page(page)

        page = browser_page(browser, '/merchant/settings', backend)
        media_routes(page)
        expect(page.locator('.ops-settings textarea')).to_have_value('校园文具与打印服务，支持到店自提。')
        page.locator('.ops-settings textarea').fill('新的门店介绍')
        page.get_by_label('营业时间').fill('每日 09:00-21:00（北京时间）')
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as handle:
            handle.write(PNG)
            image_path = handle.name
        try:
            page.locator('.store-image-field input[type=file]').set_input_files(image_path)
            expect(page.locator('.store-image-field img')).to_have_attribute('src', STORE_IMAGE)
            expect(page.locator('.toast')).to_contain_text('门店图片已上传')
        finally:
            Path(image_path).unlink(missing_ok=True)
        assert backend.upload_bodies and len(backend.upload_bodies[0]['base64']) > 0
        page.get_by_role('button', name='保存设置').click()
        expect(page.locator('.toast')).to_contain_text('门店资料已保存')
        saved = backend.profile_bodies[-1]
        assert saved['description'] == '新的门店介绍'
        assert saved['businessHours'] == '每日 09:00-21:00（北京时间）'
        assert saved['imageUrl'] == STORE_IMAGE
        checks.append('门店设置可上传 STORE 图片并保存介绍、时段与图片引用')
        close_page(page)

        assert not ERRORS, ERRORS
        browser.close()
    print('PASSED', len(checks), 'STOREFRONT UI CONTRACT CHECKS', json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
