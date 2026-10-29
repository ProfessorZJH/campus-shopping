#!/usr/bin/env python3
"""新增页面前端请求契约测试，后端为明确的测试替身，非真实 Java/MySQL。"""
import json
from playwright.sync_api import sync_playwright,expect
from ui_three_pages import render,BackendContractDouble,ERRORS
checks=[]
f=BackendContractDouble();f.logged=True
# 供应商订单与购物车有真实请求结构样例
p=f.products[0];s=p['skus'][0];f.cart=[{'merchantId':p['merchantId'],'skuId':s['skuId'],'title':p['title'],'specKey':s['specKey'],'priceCent':s['priceCent'],'quoteVersion':s['quoteVersion'],'quantity':2,'available':30,'sellable':True}]
with sync_playwright() as x:
 browser=x.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=render(browser,'/cart',False,(430,932),f)
 expect(page.locator('.cart-line')).to_have_count(1)
 page.get_by_role('button',name='提交订单').click()
 expect(page.locator('.pickup-hero')).to_be_visible()
 assert f.writes[-1]['path']=='/orders' and f.writes[-1]['hasIdempotency'],f.writes[-1]
 checks.append('cart checkout creates order with idempotency');page.close()
 page=render(browser,'/orders/o1',False,(430,932),f)
 expect(page.get_by_role('button',name='模拟支付')).to_be_visible()
 page.get_by_role('button',name='模拟支付').click()
 expect(page.locator('.pickup-hero h1')).to_contain_text('已支付')
 checks.append('order simulated payment');page.close()
 page=render(browser,'/merchant/orders',False,(1448,1000),f)
 expect(page.locator('.ops-table tbody tr')).to_have_count(1)
 assert page.locator('body').inner_text().find('开始备货')!=-1
 checks.append('merchant orders GET contract');page.close()
 page=render(browser,'/admin/applications',False,(1448,1000),f)
 expect(page.locator('.ops-table tbody tr')).to_have_count(1)
 page.get_by_role('button',name='通过审核').click()
 expect(page.locator('.ops-table')).to_contain_text('已通过')
 assert any(w['path'].startswith('/admin/merchant-applications/') for w in f.writes)
 checks.append('admin admission review contract');page.close()
 page=render(browser,'/account',False,(430,932),f)
 expect(page.locator('.account-quick')).to_be_visible()
 page.locator('.account-quick').get_by_role('button',name='商户入驻').click()
 expect(page.locator('.account-form')).to_be_visible()
 page.locator('.account-form input').nth(0).fill('图书馆咖啡')
 page.locator('.account-form input').nth(1).fill('测试联系人')
 page.locator('.account-form input').nth(2).fill('13800000000')
 page.locator('.account-form input').nth(3).fill('图书馆咖啡吧')
 page.locator('.account-form input').nth(4).fill('图书馆1楼')
 page.get_by_role('button',name='提交入驻申请').click()
 expect(page.locator('.account-application')).to_have_count(2)
 assert any(w['path']=='/merchant-applications' and w['hasIdempotency'] for w in f.writes)
 checks.append('merchant application submit contract');page.close()
 page=render(browser,'/merchant/inventory',False,(1448,1000),f)
 expect(page.locator('.ops-table tbody tr')).to_have_count(4)
 page.locator('.ops-sideform select').select_option('sku0')
 page.locator('.ops-sideform input[type=number]').fill('5')
 page.get_by_role('button',name='确认补货').click()
 expect(page.locator('.toast')).to_contain_text('操作成功')
 assert any(w['path'].endswith('/replenish') and w['hasIdempotency'] for w in f.writes)
 checks.append('merchant replenishment contract');page.close()
 page=render(browser,'/admin/products',False,(1448,1000),f)
 expect(page.locator('.ops-table tbody tr')).to_have_count(6)
 page.get_by_role('button',name='强制下架').first.click()
 expect(page.locator('.toast')).to_contain_text('操作成功')
 assert any(w['path'].endswith('/unpublish') for w in f.writes)
 checks.append('admin unpublish contract');page.close()
 for route in ['/merchant/knowledge','/admin/knowledge']:
  page=render(browser,route,False,(1448,1000),f)
  page.get_by_role('button',name='新建知识库').click()
  page.locator('.kb-forms input').first.fill('测试知识库')
  page.get_by_role('button',name='创建',exact=True).click()
  expect(page.locator('.kb-base')).to_have_count(1 if route.startswith('/merchant') else 2)
  checks.append(route+' create knowledge base');page.close()
 assert not ERRORS,ERRORS
 browser.close()
print('PASSED',len(checks),'CHECKS',json.dumps(checks,ensure_ascii=False))
