"""Chromium/Vue with API doubles: state guards and contract input limits."""
import json
import shutil
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import TwoMerchantBackend, browser_page
from browser_transport import close_page, close_browser
from ui_three_pages import ERRORS

class Backend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.queries=[]
        self.sales=[dict(id='sale'+str(i),orderId='order'+str(i),status=status,reason='测试原因') for i,status in enumerate(('REQUESTED','REJECTED','DISPUTED','REFUNDED'))]
    def handle(self, route):
        parsed=urlparse(route.request.url)
        path=parsed.path.removeprefix('/api/v1')
        if path=='/merchants/m1/rbac/roles':
            route.fulfill(status=200,json=self.data([dict(code='OWNER',name='经营者'),dict(code='CLERK',name='店员')]))
            return
        if path in ('/admin/aftersales/page','/merchants/m1/aftersales/page'):
            self.queries.append(parse_qs(parsed.query))
            # 保留混合响应，以证明控件也能拒绝非待办记录。
            route.fulfill(status=200,json=self.data(dict(items=self.sales,page=1,size=10,total=len(self.sales),hasNext=False)))
            return
        if path=='/merchants/m1/stock-movements/page':
            route.fulfill(status=200,json=self.data(dict(items=[dict(id=t,type=t,quantity=3) for t in ('REPLENISH','RESERVE','RELEASE','CONSUME')],page=1,size=10,total=4,hasNext=False)))
            return
        return super().handle(route)

def main():
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        f=Backend();page=browser_page(browser,'/admin/disputes',f)
        expect(page.locator('.dispute-line')).to_have_count(4)
        assert f.queries[-1]['state']==['DISPUTED']
        expect(page.get_by_role('button',name='查看处理')).to_have_count(1)
        checks.append('disputes query DISPUTED; mixed history has one decision entry')
        close_page(page)
        page=browser_page(browser,'/merchant/aftersales',f)
        expect(page.get_by_role('button',name='审核',exact=True)).to_have_count(1)
        expect(page.locator('.ops-list-line')).to_have_count(4)
        checks.append('merchant only reviews REQUESTED and preserves history')
        close_page(page)
        page=browser_page(browser,'/merchant/inventory',f)
        for text in ('实物增加 3','预占增加 3','预占减少 3','实物减少 3，预占减少 3'):
            expect(page.get_by_text(text,exact=True)).to_be_visible()
        checks.append('all four inventory movement meanings')
        close_page(page)
        f.members.append(dict(merchantId='m1',userId='old',role='CLERK',status='REVOKED'))
        page=browser_page(browser,'/merchant/team',f)
        row=page.locator('.ops-list-line').filter(has_text='old')
        expect(row).to_contain_text('已撤销');expect(row.get_by_role('button',name='撤销')).to_have_count(0)
        checks.append('revoked member history has no revoke operation')
        close_page(page)
        f.products[0]['skus']=[dict(skuId='inactive',status='INACTIVE',priceCent=1),dict(skuId='expensive',status='ACTIVE',priceCent=2300),dict(skuId='cheap',status='ACTIVE',priceCent=1200)]
        page=browser_page(browser,'/admin/products',f)
        row=page.locator('tr').filter(has_text=f.products[0]['title'])
        expect(row).to_contain_text('¥12 起')
        checks.append('platform minimum price excludes inactive SKUs')
        close_page(page)
        f=Backend();f.cart=[dict(skuId='cart'+str(i),merchantId='m1',title='测试商品'+str(i),specKey='规格',quantity=1,priceCent=100,available=30,sellable=True) for i in range(21)]
        page=browser_page(browser,'/cart',f)
        page.get_by_role('button',name='提交订单',exact=True).click()
        expect(page.locator('.toast')).to_contain_text('最多支持20个SKU行')
        assert not any(x['path']=='/orders' for x in f.writes)
        checks.append('21 SKU rows cannot submit an order')
        close_page(page)
        f=Backend();page=browser_page(browser,'/merchant/knowledge',f)
        page.get_by_role('button',name='上传文档',exact=True).click()
        upload=page.locator('input[type=file]')
        upload.set_input_files(dict(name='rules.md',mimeType='text/markdown',buffer=b'x'*2000001))
        expect(page.locator('.toast')).to_contain_text('2,000,000')
        upload.set_input_files(dict(name='x'*118+'.md',mimeType='text/markdown',buffer=b'x'))
        expect(page.locator('.toast')).to_contain_text('文件名不能超过120')
        checks.append('upload rejects over 2,000,000 bytes and 120 character filename')
        close_page(page)
        f=Backend();page=browser_page(browser,'/merchant/products',f)
        page.get_by_role('button',name='规格售价',exact=True).click()
        expect(page.get_by_role('button',name='停用标准装',exact=True)).to_be_disabled()
        page.get_by_role('button',name='修改售价',exact=True).click()
        page.get_by_label('售价（元）',exact=True).fill('1000000.01')
        page.get_by_role('button',name='保存售价',exact=True).click()
        expect(page.locator('.toast')).to_contain_text('不能超过1,000,000元')
        checks.append('last active SKU cannot be disabled; price above server maximum rejected')
        close_page(page)
        f.products[0]['status']='UNPUBLISHED';f.products[0]['skus'][0]['status']='INACTIVE'
        page=browser_page(browser,'/merchant/products',f)
        page.get_by_role('button',name='基本信息',exact=True).click()
        expect(page.get_by_role('button',name='上架商品',exact=False)).to_be_disabled()
        expect(page.get_by_text('请先启用至少一个规格再上架',exact=True)).to_be_visible()
        checks.append('product without active SKU cannot publish and explains why')
        close_page(page)
        f=Backend();f.logged=False;page=browser_page(browser,'/account',f)
        page.get_by_role('button',name='登录 / 注册',exact=True).click()
        page.get_by_role('button',name='没有账号？注册',exact=True).click()
        page.get_by_label('账号',exact=True).fill('bad!name')
        page.get_by_label('密码',exact=True).fill('abcdefgh')
        page.get_by_role('button',name='注册',exact=True).click()
        expect(page.locator('.login-error')).to_contain_text('用户名须为4~32位')
        page.get_by_label('账号',exact=True).fill('valid_name')
        page.get_by_label('密码',exact=True).fill('密'*25)
        page.get_by_role('button',name='注册',exact=True).click()
        expect(page.locator('.login-error')).to_contain_text('72字节')
        checks.append('registration format and UTF-8 password limit are checked before API')
        close_page(page)
        assert not ERRORS,ERRORS
        close_browser(browser)
    print(json.dumps(dict(status='PASS',kind='CHROMIUM_WITH_API_DOUBLES',checks=checks),ensure_ascii=False,indent=2))

if __name__=='__main__':main()
