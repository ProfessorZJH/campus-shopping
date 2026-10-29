#!/usr/bin/env python3
import shutil
"""SDD A/B 修复：使用真实 Vue/Chromium + 明确标识的 HTTP 契约替身。非 Java/MySQL 联调。"""
import json
from copy import deepcopy
from playwright.sync_api import sync_playwright,expect
from ui_three_pages import render,BackendContractDouble,ERRORS

checks=[]
def check(cond,msg):
 assert cond,msg
 checks.append(msg)

with sync_playwright() as x:
 browser=x.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 f=BackendContractDouble();f.logged=True
 # 130+ products force a second/third page, search must reach beyond first 100.
 for i in range(135):
  p=deepcopy(f.products[0]);p.update(productId='large-'+str(i).zfill(3),merchantId='m1',title='测试商品 '+str(i).zfill(3),status='PUBLISHED')
  p['skus'][0]['skuId']='large-sku-'+str(i).zfill(3)
  f.products.append(p)
 p=render(browser,'/',False,(430,932),f)
 expect(p.locator('.home-product')).to_have_count(20)
 check(p.locator('.sdd-pager').inner_text().find('141')>=0,'首页读取真实 total，不限 100 条')
 p.locator('.sdd-pager').get_by_role('button',name='下一页').click()
 expect(p.locator('.home-product')).to_have_count(20)
 expect(p.locator('.home-product').first).to_contain_text('测试商品');check(True,'消费者首页服务器翻页')
 p.get_by_role('textbox',name='搜索校园商品').fill('测试商品 134')
 p.get_by_role('button',name='搜索',exact=True).click()
 expect(p.locator('.home-product')).to_have_count(1)
 check('134' in p.locator('.home-product').inner_text(),'公开商品服务器搜索覆盖第 100 条之后')
 p.close()
 p=render(browser,'/shops/m1',False,(430,932),f)
 expect(p.locator('.shop-hero')).to_contain_text('林间文具铺')
 expect(p.locator('.shop-product-card')).to_have_count(12)
 p.locator('.shop-pagination').get_by_role('button',name='下一页').click()
 expect(p.locator('.shop-product-card')).to_have_count(12)
 check(True,'公开商户详情 + 商户商品独立分页')
 p.close()
 p=render(browser,'/merchant/products',False,(1448,980),f)
 expect(p.locator('.product-table tbody tr')).to_have_count(9)
 expect(p.locator('.product-tabs button').first).to_contain_text(str(sum(z['merchantId']=='m1' for z in f.products)))
 check(True,'商户商品页签显示服务器总数而非当前页行数')
 p.get_by_role('textbox',name='搜索商品').fill('测试商品 134')
 expect(p.locator('.product-table')).to_contain_text('测试商品 134')
 check(p.locator('.product-table tbody tr').count()==1,'商户商品远端过滤覆盖全部数据')
 p.get_by_role('textbox',name='搜索商品').fill('')
 expect(p.locator('.product-table tbody tr')).to_have_count(9)
 p.locator('.table-footer').get_by_role('button',name='下一页').click()
 expect(p.locator('.product-table tbody tr')).to_have_count(9)
 check(True,'商户商品分页从服务端返回')
 p.get_by_role('button',name='新增商品').click()
 p.locator('.merchant-modal input.admin-input').nth(0).fill('双规格笔记本')
 p.locator('.merchant-modal input.admin-input').nth(1).fill('A5')
 p.locator('.merchant-modal input.admin-input').nth(2).fill('5.00')
 p.get_by_role('button',name='添加规格').click()
 p.locator('.merchant-modal input.admin-input').nth(3).fill('A4')
 p.locator('.merchant-modal input.admin-input').nth(4).fill('9.00')
 p.get_by_role('button',name='保存商品').click()
 expect(p.locator('.toast')).to_contain_text('商品已创建')
 product=next(z for z in f.products if z['productId']=='p-created')
 check(len(product['skus'])==2,'创建商品提交多规格 SKU 数组')
 # 商品可能位于任意服务器分页，必须搜索而非假定在当前页。
 p.get_by_role('textbox',name='搜索商品').fill('双规格笔记本')
 expect(p.locator('.product-table tbody tr').filter(has_text='双规格笔记本')).to_have_count(1)
 p.locator('.product-table tbody tr').filter(has_text='双规格笔记本').click()
 p.locator('.inspector-tabs').get_by_role('button',name='规格售价').click()
 p.get_by_role('button',name='新增规格').click()
 p.locator('.merchant-modal input.admin-input').nth(0).fill('B5')
 p.locator('.merchant-modal input.admin-input').nth(1).fill('7.50')
 p.get_by_role('button',name='保存规格').click()
 check(len(product['skus'])==3,'已创建商品可追加 SKU')
 p.close()
 p=render(browser,'/admin/products',False,(1448,980),f)
 expect(p.locator('.ops-table tbody tr')).to_have_count(12)
 p.locator('.sdd-pager').get_by_role('button',name='下一页').click()
 expect(p.locator('.ops-table tbody tr')).to_have_count(12)
 check(True,'平台商品监管返回分页结果')
 p.close()
 # Document version upload must retain the same rootId instead of creating a new tree.
 k=BackendContractDouble();k.logged=True
 k.bases=[{'id':'kb1','name':'校内规范','merchantId':'m1','visibility':'PUBLIC'}]
 k.docs=[{'id':'doc1','rootId':'root1','baseId':'kb1','title':'原始规范','version':1,'status':'PUBLISHED','indexStatus':'READY','createdAt':'2026-10-28T08:00:00Z'}]
 p=render(browser,'/merchant/knowledge',False,(1448,980),k)
 expect(p.locator('.kb-doc')).to_have_count(1)
 p.locator('.kb-doc-actions').get_by_role('button',name='上传新版本').click()
 expect(p.locator('.kb-forms h2')).to_contain_text('上传新版本')
 p.locator('.kb-forms input[type=file]').set_input_files({'name':'new.md','mimeType':'text/markdown','buffer':b'# updated documentation'})
 p.get_by_role('button',name='上传并索引').click()
 expect(p.locator('.kb-doc')).to_have_count(2)
 check(k.doc_uploads and k.doc_uploads[-1]['rootId']=='root1' and k.docs[-1]['version']==2,'知识新版本保持 rootId 并递增版本号')
 p.close()
 # Historic order images are immutable snapshots. Old rows without a picture
 # must show a placeholder, never the new image from the current Catalog.
 history=BackendContractDouble();history.logged=True
 history.products[0]['imageUrl']='/media/changed-after-purchase.png'
 history.orders=[{'orderId':'old-order-1','buyerId':'u1','merchantId':'m1','merchantName':'林间文具铺（测试）','storeId':'s1',
   'status':'COMPLETED','totalCent':1200,'createdAt':'2026-10-20T12:00:00Z','deadline':None,'pickup':None,'afterSale':None,
   'items':[{'skuId':'sku0','title':'书写顺滑中性笔','specKey':'标准装','unitPriceCent':1200,'quantity':1,'imageUrl':''}]}]
 p=render(browser,'/orders',False,(430,932),history)
 expect(p.locator('.consumer-order-card')).to_have_count(1)
 expect(p.locator('.consumer-order-card img')).to_have_attribute('src','./images/product-placeholder.svg')
 p.locator('.consumer-order-card').click()
 expect(p.locator('.order-detail-line')).to_have_count(1)
 expect(p.locator('.order-detail-line img')).to_have_attribute('src','./images/product-placeholder.svg')
 check(True,'旧订单无图使用占位图，不回查商户修改后的商品主图')
 p.close()
 check(not history.unhandled,'旧订单页面未调用未实现的契约替身接口')
 check(not f.unhandled,'没有调用未实现的契约替身接口')
 check(not ERRORS,'没有 Chromium 未捕获异常')
 browser.close()
print('PASSED',len(checks),'SDD browser checks',json.dumps(checks,ensure_ascii=False))
