#!/usr/bin/env python3
"""全局排序前端契约测试：真实打包的 Vue + 可控分页 API 替身（非 MySQL 验证）。"""
import json
import shutil
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
from ui_fix_regression import TwoMerchantBackend,browser_page,ERRORS

class SortedBackend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.products=[];self.queries=[]
        for i in range(35):
            rank=35-i
            self.products.append({'productId':f'item-{rank:03d}','merchantId':'m1','storeId':'s1',
                'title':f'全局价序 {rank:03d}', 'description':'全局排序', 'categoryCode':'stationery',
                'imageUrl':'','status':'PUBLISHED','version':0,
                'skus':[{'skuId':f'sku-{rank}','specKey':'标准','priceCent':rank*100,
                         'status':'ACTIVE','quoteVersion':0,'available':rank}]})
    def handle(self,route):
        url=urlparse(route.request.url);path=url.path.removeprefix('/api/v1')
        if route.request.method=='GET' and path in ('/products/page','/merchants/m1/products/page'):
            q=parse_qs(url.query);p=int(q.get('page',['1'])[0]);size=int(q.get('size',['20'])[0]);sort=q.get('sort',['NEWEST'])[0]
            self.queries.append((path,p,size,sort))
            rows=list(self.products)
            if sort=='PRICE_ASC':rows.sort(key=lambda x:(min(s['priceCent'] for s in x['skus']),x['productId']))
            elif sort=='STOCK_DESC':rows.sort(key=lambda x:(-sum(s['available'] for s in x['skus']),x['productId']))
            route.fulfill(status=200,json=self.data({'items':rows[(p-1)*size:p*size], 'page':p,
                'size':size,'total':len(rows),'hasNext':p*size<len(rows)}))
            return
        return super().handle(route)

def main():
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        f=SortedBackend();page=browser_page(browser,'/',f)
        expect(page.locator('.home-product')).to_have_count(20,timeout=12000)
        page.get_by_role('button',name='全局价格').click()
        expect(page.locator('.home-product').first).to_contain_text('全局价序 001')
        assert f.queries[-1] == ('/products/page',1,20,'PRICE_ASC')
        checks.append('首页价格排序发出 PRICE_ASC 且第一页是全局最便宜商品')
        page.locator('.sdd-pager').get_by_role('button',name='下一页').click()
        expect(page.locator('.home-product')).to_have_count(15)
        expect(page.locator('.home-product').first).to_contain_text('全局价序 021')
        assert f.queries[-1] == ('/products/page',2,20,'PRICE_ASC')
        checks.append('全局价格排序在 SQL 分页之后不是本页再排序，第二页连续接第 21 项')
        page.get_by_role('button',name='全局库存').click()
        expect(page.locator('.home-product').first).to_contain_text('全局价序 035')
        assert f.queries[-1] == ('/products/page',1,20,'STOCK_DESC')
        checks.append('全局库存排序发出 STOCK_DESC 并重置分页')
        page.close()
        page=browser_page(browser,'/merchant/products',f)
        expect(page.locator('.product-table tbody tr')).to_have_count(9,timeout=12000)
        # The backoffice select exposes supported server order values.
        sorts=page.locator('select').filter(has=page.locator('option[value="PRICE_ASC"]'))
        assert sorts.count()>0,'商户商品页必须暴露服务端价格排序选项'
        sorts.first.select_option('PRICE_ASC')
        expect(page.locator('.product-table tbody tr').first).to_contain_text('全局价序 001')
        assert f.queries[-1][0]=='/merchants/m1/products/page' and f.queries[-1][-1]=='PRICE_ASC'
        checks.append('商户商品页与购物端使用同一套排序枚举')
        page.close()
        assert not ERRORS,ERRORS
        browser.close()
    print('PASSED',len(checks),'GLOBAL SORT UI CONTRACT CHECKS',json.dumps(checks,ensure_ascii=False))
if __name__=='__main__':main()
