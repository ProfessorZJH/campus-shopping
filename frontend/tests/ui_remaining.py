#!/usr/bin/env python3
"""扩展页面真实 Vue + Chromium 验证。明确区分演示与 Java 接口契约替身。"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_three_pages import render,BackendContractDouble,ERRORS
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/testing/evidence/ui-rest-pages'
OUT.mkdir(parents=True,exist_ok=True)
ROUTES=[
 ('/','home',430,932),('/ai','ai',430,932),('/product/preview-p1','product',430,932),('/cart','cart',430,932),('/orders','orders',430,932),('/orders/CS202610280001','pickup',430,932),('/account','account',430,932),('/apply','merchant-application',430,932),('/invitations','invitations',430,932),
 ('/merchant','merchant-overview',1448,1000),('/merchant/products','merchant-products',1448,1000),('/merchant/inventory','merchant-inventory',1448,1000),('/merchant/orders','merchant-orders',1448,1000),('/merchant/pickup','merchant-pickup',1448,1000),('/merchant/aftersales','merchant-after-sales',1448,1000),('/merchant/team','merchant-team',1448,1000),('/merchant/settings','merchant-settings',1448,1000),('/merchant/knowledge','merchant-knowledge',1448,1000),
 ('/admin','admin-overview',1448,1000),('/admin/applications','admin-applications',1448,1000),('/admin/merchants','admin-merchants',1448,1000),('/admin/products','admin-products',1448,1000),('/admin/orders','admin-orders',1448,1000),('/admin/disputes','admin-disputes',1448,1000),('/admin/categories','admin-categories',1448,1000),('/admin/knowledge','admin-knowledge',1448,1000)
]
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for route,name,w,h in ROUTES:
        page=render(browser,route,True,(w,h))
        expect(page.locator('.application')).to_be_visible()
        page.wait_for_timeout(160)
        body=page.locator('body').inner_text().strip()
        assert len(body)>30,(name,'empty',body)
        if w<500:assert page.evaluate('document.documentElement.scrollWidth')<=w,(name,'overflow')
        if name in ['cart','pickup','account','merchant-application','merchant-orders','merchant-inventory','merchant-knowledge','admin-applications','admin-disputes','admin-knowledge']:
            page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        checks.append(name)
        page.close()
    # consumer bottom navigation and details cross-page
    page=render(browser,'/',True,(430,932))
    page.get_by_role('button',name='购物车').click()
    expect(page.locator('.cart-store')).to_have_count(2)
    checks.append('consumer nav cart')
    page.get_by_role('button',name='订单',exact=True).click()
    expect(page.locator('.consumer-order-card')).to_have_count(3)
    checks.append('consumer nav orders')
    page.get_by_role('button',name='我的').click()
    expect(page.locator('.account-quick')).to_be_visible()
    checks.append('consumer nav account')
    page.close()
    # merchant navigation
    page=render(browser,'/merchant/products',True,(1448,1000))
    page.locator('.merchant-nav').get_by_role('button',name='订单管理').click()
    expect(page.locator('.ops-table')).to_be_visible()
    checks.append('merchant nav orders')
    page.locator('.merchant-nav').get_by_role('button',name='知识库').click()
    expect(page.locator('.knowledge-layout')).to_be_visible()
    checks.append('merchant nav knowledge')
    page.close()
    # preview write controls never silently succeed
    page=render(browser,'/cart',True,(430,932))
    expect(page.get_by_role('button',name='提交订单')).to_be_disabled()
    checks.append('preview checkout disabled')
    page.close()
    assert not ERRORS,ERRORS
    browser.close()
print('PASSED',len(checks),'CHECKS',json.dumps(checks,ensure_ascii=False))
