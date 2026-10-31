from browser_transport import track_bindings, close_page, close_browser
#!/usr/bin/env python3
import shutil
"""2026-10-28 修复回归：真实 Chromium + Vue 交付 JS + 明确的 API 契约替身。

使用可控旧响应乱序测试 UI，不代表 MySQL/Spring 集成通过。
运行: python frontend/tests/ui_fix_regression.py
"""
import json
import re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from contract_ui import BackendContractDouble
from ui_three_pages import UI, ERRORS, IMAGES, fixture_call


class TwoMerchantBackend(BackendContractDouble):
    def __init__(self):
        super().__init__()
        self.logged = True
        self.members = [
            {'merchantId':'m1','userId':'u1','role':'OWNER','status':'ACTIVE'},
            {'merchantId':'m2','userId':'u1','role':'OWNER','status':'ACTIVE'},
        ]
        self.bases = [
            {'id':'base-1','merchantId':'m1','name':'商户一私有资料','visibility':'MERCHANT_INTERNAL'},
            {'id':'base-2','merchantId':'m2','name':'商户二私有资料','visibility':'MERCHANT_INTERNAL'},
        ]
        self.calls = []
        self.refund_reasons=[]
        self.platform_admin=True

    def handle(self, route):
        path=urlparse(route.request.url).path.removeprefix('/api/v1')
        self.calls.append(path)
        if path.endswith('/refund-decision') and route.request.method=='POST':
            body=route.request.post_data_json
            self.refund_reasons.append(body['reason'])
            route.fulfill(status=200,json=self.data(None))
            return
        if path == '/workspace':
            mine=[m for m in self.members if m['userId']==self.user['userId'] and m['status']=='ACTIVE']
            mids={m['merchantId'] for m in mine}
            role_grants={'OWNER':['dashboard.read','product.read','product.write','stock.read','stock.replenish','order.read','order.prepare','pickup.verify','aftersale.read','aftersale.review','knowledge.read','knowledge.manage','team.manage','store.manage','role.manage'],
                         'CLERK':['product.read','stock.read','stock.replenish','order.read','order.prepare','pickup.verify']}
            route.fulfill(status=200,json=self.data({'platformAdmin':self.platform_admin,'memberships':mine,'merchantPermissions':{m['merchantId']:role_grants.get(m['role'],[]) for m in mine},'merchants':[shop for shop in self.shops if shop['merchantId'] in mids]}))
            return
        if path in ('/merchants/m1/aftersales/page','/admin/aftersales/page'):
            items=[{'id':'sale-1','orderId':'order-1','status':'REQUESTED','reason':'无法自提'}]
            route.fulfill(status=200,json=self.data({'items':items,'page':1,'size':10,'total':1,'hasNext':False}))
            return
        return super().handle(route)


def browser_page(browser, route, fixture, *, race=False):
    page=browser.new_page(viewport={'width':1448,'height':970},locale='zh-CN')
    page.on('pageerror',lambda exc:ERRORS.append(str(exc)))
    page.set_content('<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>')
    page.add_style_tag(path=str(UI/'src/styles/app.css'))
    page.evaluate('''({route,images})=>{window.__CAMPUS_TEST_DEMO__=false;window.__CAMPUS_TEST_ROUTE__=route;
      window.__CAMPUS_UI_TEST_IMAGES__=images;
      if(!crypto.randomUUID)crypto.randomUUID=()=>String(Date.now())+Math.random();}''',{'route':route,'images':IMAGES})
    page.expose_binding('__contractApi',fixture_call(fixture))
    track_bindings(page)
    page.evaluate('''({race})=>{
      window.__pending=[];
      window.__holdMerchant=false;
      window.__release=(match,body)=>{
        const index=window.__pending.findIndex(x=>x.url.includes(match));
        if(index<0)throw new Error('没有找到挂起请求 '+match);
        const [entry]=window.__pending.splice(index,1);
        entry.resolve(new Response(JSON.stringify({code:'0000',info:'成功',data:body}),{status:200,headers:{'Content-Type':'application/json'}}));
      };
      window.fetch=async (url,options={})=>{
        const address=String(url),parsed=new URL(address,'http://contract.local'),q=parsed.searchParams.get('q');
        const paused=race&&((parsed.pathname==='/api/v1/products/page'&&(q==='alpha'||q==='beta')) ||
            (window.__holdMerchant && parsed.pathname==='/api/v1/merchants/m1/products/page'));
        if(paused)return new Promise(resolve=>window.__pending.push({url:address,resolve}));
        const reply=await window.__contractApi({url:address,method:options.method||'GET',headers:options.headers||{},body:options.body});
        return new Response(reply.body,{status:reply.status,headers:{'Content-Type':'application/json'}});
      };
    }''',{'race':race})
    page.add_script_tag(path=str(UI/'vendor/vue.global.prod.js'))
    page.add_script_tag(path=str(UI/'ui.bundle.js'))
    expect(page.locator('.application')).to_have_count(1)
    return page


def paged(product):
    return {'items':[product],'page':1,'size':20,'total':1,'hasNext':False}


def main():
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        f=TwoMerchantBackend()
        page=browser_page(browser,'/',f,race=True)
        expect(page.locator('.home-product')).to_have_count(6)
        field=page.get_by_role('textbox',name='搜索校园商品')
        field.fill('alpha');page.locator('.big-search button').click()
        page.wait_for_function("window.__pending.some(p=>p.url.includes('q=alpha'))")
        field.fill('beta');page.locator('.big-search button').click()
        page.wait_for_function("window.__pending.some(p=>p.url.includes('q=beta'))")
        beta={**f.products[0],'productId':'product-beta','title':'匹配beta'}
        alpha={**f.products[0],'productId':'product-alpha','title':'过期alpha'}
        page.evaluate('data=>window.__release("q=beta",data)',paged(beta))
        expect(page.locator('.home-product')).to_have_count(1)
        expect(page.locator('.home-product').first).to_contain_text('匹配beta')
        page.evaluate('data=>window.__release("q=alpha",data)',paged(alpha))
        page.wait_for_timeout(200)
        assert '匹配beta' in page.locator('.home-product').inner_text()
        assert '过期alpha' not in page.locator('.home-product').inner_text()
        checks.append('首页 alpha/beta 乱序只提交 beta')
        close_page(page)

        page=browser_page(browser,'/merchant/products',f,race=True)
        expect(page.locator('.product-table tbody tr')).to_have_count(4)
        page.evaluate('window.__holdMerchant=true')
        page.get_by_role('button',name='刷新',exact=False).click()
        page.wait_for_function("window.__pending.some(p=>p.url.includes('/merchants/m1/products/page'))")
        page.locator('.topbar-merchant-select select').select_option('m2')
        expect(page.locator('.product-table tbody tr')).to_have_count(2,timeout=15000)
        assert page.locator('.topbar-merchant-select select').input_value()=='m2'
        old={'items':[x for x in f.products if x['merchantId']=='m1'],'page':1,'size':9,'total':4,'hasNext':False}
        # 先完成新商户，再放回旧商户的商品结果：旧数据必须被抛弃。
        page.evaluate('data=>window.__release("/merchants/m1/products/page",data)',old)
        page.wait_for_timeout(200)
        assert page.locator('.product-table tbody tr').count()==2
        assert '当季新鲜苹果' in page.locator('.product-table').inner_text()
        assert '轻量空白笔记本' not in page.locator('.product-table').inner_text()
        checks.append('商户 m1/m2 切换时旧数据不能覆盖新商户')
        close_page(page)

        page=browser_page(browser,'/merchant/knowledge',f)
        expect(page.locator('.kb-base')).to_have_count(1)
        assert '商户一私有资料' in page.locator('.kb-list').inner_text()
        assert '商户二私有资料' not in page.locator('.kb-list').inner_text()
        page.locator('.topbar-merchant-select select').select_option('m2')
        expect(page.locator('.kb-list')).to_contain_text('商户二私有资料')
        assert '商户一私有资料' not in page.locator('.kb-list').inner_text()
        checks.append('知识库按当前商户过滤，切换后不会继续显示前商户')
        close_page(page)

        page=browser_page(browser,'/merchant/aftersales',f)
        expect(page.get_by_role('button',name='审核')).to_be_visible()
        page.get_by_role('button',name='审核').click()
        expect(page.get_by_role('button',name='同意退款')).to_be_disabled()
        page.locator('.review-inline textarea').fill('审核通过，等待模拟退款')
        expect(page.get_by_role('button',name='同意退款')).to_be_enabled()
        page.get_by_role('button',name='同意退款').click()
        expect(page.locator('.toast')).to_contain_text('操作成功')
        assert '审核通过，等待模拟退款' in f.refund_reasons
        checks.append('商户批准退款必须填写审核说明')
        close_page(page)

        page=browser_page(browser,'/admin/disputes',f)
        expect(page.get_by_role('button',name='查看处理')).to_be_visible()
        page.get_by_role('button',name='查看处理').click()
        expect(page.get_by_role('button',name='批准退款')).to_be_disabled()
        page.locator('.review-inline textarea').fill('平台复核同意')
        expect(page.get_by_role('button',name='批准退款')).to_be_enabled()
        checks.append('平台批准退款必须填写审核说明')
        close_page(page)

        f.members=[{'merchantId':'m1','userId':'u1','role':'CLERK','status':'ACTIVE'}]
        page=browser_page(browser,'/merchant/orders',f)
        expect(page.locator('.merchant-nav')).to_be_visible()
        for text in ('售后处理','店员管理','知识库','门店设置'):
            assert text not in page.locator('.merchant-nav').inner_text(),text
        page.evaluate("location.hash='/merchant/aftersales'")
        expect(page.locator('.access-denied')).to_contain_text('无权限访问')
        checks.append('店员菜单隐藏 Owner 入口，直接输入 Owner URL 被界面拒绝')
        close_page(page)
        # 已登录用户退出/重新登录：必须恢复首页公共列表，不能留空。
        f.logged=True
        page=browser_page(browser,'/',f)
        expect(page.locator('.home-product')).to_have_count(6)
        expect(page.locator('.account-pill')).to_be_visible()
        page.locator('.account-pill').click()
        expect(page.get_by_role('button',name='登录',exact=True)).to_be_visible()
        expect(page.locator('.home-product')).to_have_count(6)
        page.get_by_role('button',name='登录',exact=True).click()
        page.locator('#login-name').fill('testuser')
        page.locator('#login-password').fill('safe-test-password')
        page.locator('.login-dialog').get_by_role('button',name='登录',exact=True).click()
        expect(page.locator('.account-pill')).to_be_visible()
        expect(page.locator('.home-product')).to_have_count(6)
        checks.append('退出及重新登录后恢复公开商品，旧缓存不会造成空列表')
        close_page(page)

        # 跳出商户端后，旧商户商品晚到不应覆盖公开首页。
        page=browser_page(browser,'/merchant/products',f,race=True)
        expect(page.locator('.product-table tbody tr')).to_have_count(4)
        page.evaluate('window.__holdMerchant=true')
        page.get_by_role('button',name='刷新',exact=False).click()
        page.wait_for_function("window.__pending.some(p=>p.url.includes('/merchants/m1/products/page'))")
        page.locator('.sidebar-back').click()
        expect(page.locator('.home-product')).to_have_count(6)
        old={'items':[x for x in f.products if x['merchantId']=='m1'],'page':1,'size':9,'total':4,'hasNext':False}
        page.evaluate('data=>window.__release("/merchants/m1/products/page",data)',old)
        page.wait_for_timeout(160)
        expect(page.locator('.home-product')).to_have_count(6)
        checks.append('商户端切回购物端时旧库存/商品响应被丢弃')
        close_page(page)
        # 切换不同登录主体，后台原有数据不得留在无权账号页面。
        f.platform_admin=True
        f.user={'userId':'u1','username':'student001','displayName':'管理员A','status':'ACTIVE'}
        page=browser_page(browser,'/admin/merchants',f)
        expect(page.locator('.ops-table tbody tr')).to_have_count(2)
        f.platform_admin=False
        f.user={'userId':'u2','username':'student002','displayName':'普通用户B','status':'ACTIVE'}
        page.locator('.topbar-avatar').click()
        page.locator('#login-name').fill('student002')
        page.locator('#login-password').fill('safe-test-password')
        page.locator('.login-dialog').get_by_role('button',name='登录',exact=True).click()
        expect(page.locator('.access-denied')).to_contain_text('无权限访问')
        assert page.locator('.ops-table tbody tr').count()==0
        checks.append('管理员 A 登录切换至普通账号 B 后清空私有表格并阻止展示')
        close_page(page)

        f.platform_admin=False
        f.user={'userId':'u1','username':'student001','displayName':'商户A','status':'ACTIVE'}
        f.members=[{'merchantId':'m1','userId':'u1','role':'OWNER','status':'ACTIVE'},
                   {'merchantId':'m2','userId':'u2','role':'OWNER','status':'ACTIVE'}]
        page=browser_page(browser,'/merchant/inventory',f)
        expect(page.locator('.ops-table tbody tr')).to_have_count(4)
        f.user={'userId':'u2','username':'student002','displayName':'商户B','status':'ACTIVE'}
        page.locator('.topbar-avatar').click()
        page.locator('#login-name').fill('student002')
        page.locator('#login-password').fill('safe-test-password')
        page.locator('.login-dialog').get_by_role('button',name='登录',exact=True).click()
        expect(page.locator('.topbar-merchant-select select')).to_have_value('m2')
        expect(page.locator('.ops-table tbody tr')).to_have_count(2)
        assert 'sku0' not in page.locator('.ops-table tbody').inner_text()
        assert 'sku4' in page.locator('.ops-table tbody').inner_text()
        checks.append('账号 A/m1 切到账号 B/m2 后库存只显示新账号商户')
        close_page(page)
        assert not ERRORS, ERRORS
        close_browser(browser)
    print('PASSED',len(checks),'FIX REGRESSION CHECKS',json.dumps(checks,ensure_ascii=False))

if __name__=='__main__':main()
