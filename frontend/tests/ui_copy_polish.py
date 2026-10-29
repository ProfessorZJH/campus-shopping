#!/usr/bin/env python3
"""界面精简验收：真实 Chromium + 预编译 Vue + 显式 HTTP 契约替身。
不代表 Spring / MySQL 集成测试。
"""
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from ui_rbac_regression import RoleBackend
from ui_fix_regression import browser_page
from ui_three_pages import UI

ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=ROOT/'docs/testing/evidence/ui-polish'

def main():
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        backend=RoleBackend()
        page=browser_page(browser,'/merchant/roles',backend)
        expect(page.locator('.rbac-permission')).to_have_count(15)
        expect(page.locator('.rbac-role')).to_have_count(2)
        content=page.locator('.rbac-editor').inner_text()
        assert 'product.read' not in content and '权限以商户为边界' not in content
        assert '已选 15 项' in content
        assert 'ACCESS CONTROL' not in page.locator('body').inner_text()
        checks.append('RBAC 权限技术码、重复解释和英文装饰标题不再出现在页面')
        assert page.locator('.merchant-mobile-nav').is_hidden()
        page.screenshot(path=str(EVIDENCE/'roles-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        expect(page.locator('.merchant-mobile-nav')).to_be_visible()
        expect(page.locator('.merchant-mobile-nav button.active')).to_be_in_viewport(timeout=5000)
        expect(page.locator('.merchant-sidebar')).to_be_hidden()
        page.screenshot(path=str(EVIDENCE/'roles-mobile.png'),full_page=True)
        # 手机端功能导航不应消失，且使用与桌面相同的授权列表。
        menu=page.locator('.merchant-mobile-nav').inner_text()
        assert '角色权限' in menu and '商品管理' in menu and '店员管理' in menu
        page.locator('.merchant-mobile-nav').get_by_role('button',name='商品管理').click()
        expect(page.locator('.product-table')).to_be_visible(timeout=15000)
        expect(page.locator('.merchant-mobile-nav')).to_be_visible()
        checks.append('手机端 RBAC 与商品页可互相导航，菜单保持功能可用')
        page.screenshot(path=str(EVIDENCE/'products-mobile.png'),full_page=True)
        page.close()

        backend.user={'userId':'u2','username':'staff','displayName':'店员','status':'ACTIVE'}
        page=browser_page(browser,'/merchant/inventory',backend)
        page.set_viewport_size({'width':390,'height':844})
        expect(page.locator('.merchant-mobile-nav')).to_be_visible()
        menu=page.locator('.merchant-mobile-nav').inner_text()
        assert '角色权限' not in menu and '店员管理' not in menu and '门店设置' not in menu
        assert '库存管理' in menu
        checks.append('手机导航仍按服务端权限过滤 Owner 专属入口')
        page.close()

        page=browser.new_page(viewport={'width':1448,'height':900},locale='zh-CN')
        page.set_content('<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
        page.add_style_tag(path=str(UI/'src/styles/app.css'))
        page.evaluate("window.__CAMPUS_TEST_DEMO__=true;window.__CAMPUS_TEST_ROUTE__='/merchant/roles';")
        page.add_script_tag(path=str(UI/'vendor/vue.global.prod.js'))
        page.add_script_tag(path=str(UI/'ui.bundle.js'))
        expect(page.locator('.rbac-role')).to_have_count(3,timeout=15000)
        expect(page.locator('.rbac-permission')).to_have_count(15)
        expect(page.get_by_role('button',name='新增自定义角色')).to_be_disabled()
        page.locator('.rbac-role').filter(has_text='商品运营').click()
        expect(page.locator('.rbac-editor input[type=checkbox]:enabled')).to_have_count(0)
        checks.append('设计预览展示真实权限结构但禁用写操作，不再是空白说明页')
        page.screenshot(path=str(EVIDENCE/'roles-preview.png'),full_page=True)
        page.close()
        browser.close()
    print('PASSED',len(checks),'UI POLISH CHECKS',checks)

if __name__=='__main__':main()
