"""R1 D: Chromium + Vue + explicit API doubles; not a Java/MySQL acceptance claim."""
import json
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import browser_page, TwoMerchantBackend
from browser_transport import close_page, close_browser
from ui_three_pages import ERRORS

class Backend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.attempts=[]
        self.cart=[dict(skuId='sku0',merchantId='m1',title='测试笔',specKey='标准装',quantity=1,priceCent=1200,quoteVersion=1,available=30,sellable=True)]
    def handle(self, route):
        path=urlparse(route.request.url).path.removeprefix('/api/v1')
        if path in ('/orders','/merchant-applications') and route.request.method=='POST':
            self.attempts.append({'path':path,'body':route.request.post_data_json,'key':route.request.headers.get('idempotency-key')})
            route.fulfill(status=503,json=self.data(None,'TEST','可重试的测试故障'))
            return
        return super().handle(route)

def hold(page, path):
    page.evaluate('''path=>{
      window.__savedFetch=window.fetch;window.__held=[];
      window.fetch=(url,options={})=>String(url).split('?')[0]===path
        ?new Promise(resolve=>window.__held.push({resolve,url:String(url),options}))
        :window.__savedFetch(url,options);
      window.__finish=(data,status=200,code='0000')=>{const next=window.__held.shift();if(!next)throw Error('missing held request');next.resolve(new Response(JSON.stringify({code,info:'test',data}),{status}));};
    }''','/api/v1'+path)

def pending(page):
    page.wait_for_function('window.__held.length>0')

def finish(page,data,status=200,code='0000'):
    page.evaluate('([d,s,c])=>window.__finish(d,s,c)',[data,status,code])

def main():
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        f=Backend();page=browser_page(browser,'/cart',f)
        expect(page.locator('.cart-line')).to_have_count(1)
        submit=page.get_by_role('button',name='提交订单',exact=True)
        submit.click();expect(page.locator('.toast')).to_contain_text('测试故障')
        submit.click();page.wait_for_function("document.querySelector('.mobile-checkout-bar button').textContent==='提交订单'")
        assert len(f.attempts)==2 and f.attempts[0]['key'] and f.attempts[0]['key']==f.attempts[1]['key']
        page.get_by_role('button',name='增加测试笔',exact=True).click();expect(page.locator('.mini-qty span')).to_have_text('2')
        page.locator('.mini-qty button').first.click();expect(page.locator('.mini-qty span')).to_have_text('1')
        submit.click();page.wait_for_function("document.querySelector('.mobile-checkout-bar button').textContent==='提交订单'")
        assert len(f.attempts)==3 and f.attempts[-1]['key'] and f.attempts[-1]['key']!=f.attempts[0]['key']
        checks.append('cart retry reuses key; edit then restore has a fresh nonempty key')
        hold(page,'/cart');page.get_by_role('button',name='刷新',exact=True).click();pending(page)
        expect(page.locator('.inline-loading')).to_contain_text('加载购物车');expect(page.locator('.mobile-empty')).to_have_count(0)
        page.locator('.mobile-tabbar').get_by_role('button',name='订单',exact=True).click()
        expect(page.locator('.order-tabs')).to_be_visible();finish(page,f.cart)
        expect(page.locator('.cart-line')).to_have_count(0)
        checks.append('late cart read cannot repaint another route; loading is not empty')
        close_page(page)

        f=Backend();page=browser_page(browser,'/apply',f)
        for name,value in [('经营名称','测试店'),('联系人','测试人'),('联系电话','10000000000'),('首个门店名称','测试门店'),('自提位置','测试楼')]:
            page.get_by_label(name,exact=True).fill(value)
        submit=page.get_by_role('button',name='提交入驻申请',exact=True)
        submit.click();expect(page.locator('.toast')).to_contain_text('测试故障')
        submit.click();page.wait_for_timeout(100)
        assert f.attempts[0]['key']==f.attempts[1]['key'] and f.attempts[0]['key']
        page.get_by_label('经营名称',exact=True).fill('另一家测试店');submit.click();page.wait_for_timeout(100)
        assert f.attempts[-1]['key']!=f.attempts[0]['key']
        checks.append('application retry key tracks body changes')
        close_page(page)

        f=Backend();page=browser_page(browser,'/product/p0',f)
        expect(page.locator('.detail-info h1')).to_have_text(f.products[0]['title'])
        hold(page,'/products/p0');page.get_by_role('button',name='加入购物车',exact=True).click();pending(page)
        expect(page.get_by_role('button',name='增加',exact=True)).to_be_disabled()
        expect(page.locator('.sku-picker button')).to_be_disabled()
        finish(page,f.products[0]);expect(page.locator('.toast')).to_contain_text('已加入购物车')
        assert f.cart[0]['quantity']==2
        checks.append('add captures requested SKU/quantity and disables mutation during IO')
        close_page(page)

        for route in ['/product/%E0%A4%A','/orders/%ZZ','/shops/%E0%A4%A']:
            page=browser_page(browser,route,Backend());page.wait_for_timeout(100)
            expect(page.locator('.application')).to_be_visible();close_page(page)
        checks.append('malformed route escapes do not crash Vue')

        f=Backend();page=browser_page(browser,'/',f)
        page.locator('.home-product-open').first.focus();page.keyboard.press('Enter')
        expect(page.get_by_role('dialog')).to_be_visible()
        page.keyboard.press('Shift+Tab');assert page.evaluate("!!document.activeElement.closest('[role=dialog]')")
        page.keyboard.press('Escape');expect(page.get_by_role('dialog')).to_have_count(0)
        assert page.evaluate("document.activeElement.classList.contains('home-product-open')")
        checks.append('product modal keyboard entry, trap, escape and focus restoration')
        for width in [320,360,390,768]:
            page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(50)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        checks.append('home has no document overflow at 320/360/390/768px')
        close_page(page)

        f=Backend()
        f.orders=[dict(orderId=k,merchantId='m1',status='PAID',totalCent=1200,items=[],pickup={'status':'READY'}) for k in ['order-a','order-b']]
        page=browser_page(browser,'/orders/order-a',f)
        expect(page.locator('.order-metadata')).to_contain_text('order-a')
        hold(page,'/orders/order-a/pickup-token')
        page.get_by_role('button',name='领取自提凭证',exact=True).click();pending(page)
        page.evaluate("location.hash='/orders/order-b'")
        expect(page.locator('.order-metadata')).to_contain_text('order-b')
        finish(page,{'token':'old-order-secret','expiresAt':'2099-01-01T00:00:00Z'})
        expect(page.locator('.pickup-code code')).to_have_count(0)
        checks.append('late pickup token cannot enter another order detail')
        close_page(page)

        f=Backend();f.bases=[dict(id=k,merchantId='m1',name=k,visibility='PUBLIC') for k in ['base-a','base-b']]
        f.docs=[dict(id='doc-'+str(i),rootId='root-'+str(i),baseId='base-a',title='document-'+str(i),version=1,status='DRAFT',indexStatus='READY') for i in range(27)]
        page=browser_page(browser,'/merchant/knowledge',f)
        expect(page.locator('.kb-docs .ops-card-header')).to_contain_text('27 项')
        page.get_by_role('button',name='上传新版本',exact=True).first.click()
        page.locator('.kb-forms input[type=file]').set_input_files({'name':'test.txt','mimeType':'text/plain','buffer':b'test'})
        page.locator('.kb-base').filter(has_text='base-b').click()
        expect(page.locator('.kb-forms')).to_have_count(0)
        page.get_by_role('button',name='上传文档',exact=True).click()
        expect(page.locator('.kb-forms input:not([type=file])')).to_have_value('')
        assert page.locator('.kb-forms input[type=file]').evaluate('(el)=>el.files.length')==0
        expect(page.locator('.kb-forms h2')).to_have_text('上传文档')
        checks.append('base switch clears version root/title/file and shows server document total')
        close_page(page)

        f=Backend();page=browser_page(browser,'/merchant/products',f)
        page.get_by_role('button',name='新增商品',exact=True).click()
        hold(page,'/merchants/m1/images')
        import base64
        image=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAE0lEQVR4nGP8//8/AxgwQSgUFgBUJAMDB977AAAAAABJRU5ErkJggg==')
        page.locator('.merchant-modal input[type=file]').set_input_files({'name':'test.png','mimeType':'image/png','buffer':image});pending(page)
        page.locator('.merchant-modal-header button').click()
        page.locator('.topbar-merchant-select select').select_option('m2')
        page.get_by_role('button',name='新增商品',exact=True).click()
        finish(page,{'url':'/media/11111111-1111-1111-1111-111111111111.png'})
        expect(page.locator('.merchant-modal .product-image-preview img')).not_to_have_attribute('src','/media/11111111-1111-1111-1111-111111111111.png')
        expect(page.locator('.merchant-modal .image-field-notice')).to_have_count(0)
        page.keyboard.press('Escape')
        for width in [320,360,390,768]:
            page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(60)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),('merchant',width)
        checks.append('late image upload cannot modify a new merchant form; narrow table stays inside scroller')
        close_page(page)

        f=Backend();page=browser_page(browser,'/',f)
        expect(page.locator('.home-product')).to_have_count(6)
        hold(page,'/merchants/public/page')
        page.locator('.account-pill').click();pending(page)
        page.locator('.popular-tags button').first.click()
        for _ in range(page.evaluate('window.__held.length')):
            finish(page,{'items':f.shops,'page':1,'size':50,'total':2,'hasNext':False})
        expect(page.locator('.merchant-card')).to_have_count(2)
        expect(page.locator('.category-item')).to_have_count(4)
        checks.append('product search cannot discard delayed base merchants/categories')
        close_page(page)
        assert not ERRORS,ERRORS
        close_browser(browser)
    print('PASS',len(checks),json.dumps(checks,ensure_ascii=True))
if __name__=='__main__':main()
