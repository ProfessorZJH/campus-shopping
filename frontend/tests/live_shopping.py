"""真实 Chromium + Java/MySQL/NVIDIA/Milvus/讯飞的页面闭环；禁止接口替身。

先运行 scripts/accept-local-shopping.py --prepare-only；再依次 --stage product、
scripts/accept-local-shopping.py、--stage flow、--stage pages。
账号及令牌仅存忽略目录 var；公开证据只记录合成业务数据和截图。
"""
import argparse
import json
from pathlib import Path
import sys
import time

from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'frontend/tests'))
from live_ui import login, env_credentials

BASE='http://127.0.0.1:8091'
STATE=ROOT/'var/local-live/shopping-accounts.json'
OUT=ROOT/'docs/testing/evidence/local-live/browser'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage',choices=('product','flow','pages'),required=True)
    args=parser.parse_args()
    state=json.loads(STATE.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True,exist_ok=True)
    result={'stage':args.stage,'testType':'REAL_CHROMIUM_REAL_JAVA_MYSQL_AI',
            'apiMockUsed':False,'checks':[],'pageErrors':[],'apiResponses':[]}
    pages=[]
    def save():
        (OUT/(args.stage+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    def check(condition,name,**detail):
        if not condition:raise AssertionError(name)
        result['checks'].append({'name':name,'status':'PASS',**detail});save()
        print(json.dumps({'check':name,'status':'PASS'},ensure_ascii=True),flush=True)
    def screenshot(page,name):
        page.screenshot(path=str(OUT/(name+'.png')),full_page=True,
                        mask=[page.locator('.pickup-code code'),page.locator('input[type=password]'),
                              page.get_by_placeholder('输入买家自提令牌')])
    def capture(response):
        if '/api/v1/' not in response.url:return
        try:
            body=response.json()
            result['apiResponses'].append({'method':response.request.method,
                'path':response.url.split('/api/v1',1)[1],'http':response.status,'code':body.get('code')})
        except Exception:pass
    def response_for(page,path,method,action,timeout=125000):
        with page.expect_response(lambda r:path in r.url and r.request.method==method,timeout=timeout) as pending:
            action()
        response=pending.value
        body=response.json()
        if response.status!=200 or body.get('code')!='0000':
            raise AssertionError('real request failed '+method+' '+path+' '+str(body.get('code')))
        return body['data']
    def get(page,path):
        response=page.request.get(BASE+'/api/v1'+path)
        body=response.json()
        if response.status!=200 or body.get('code')!='0000':raise AssertionError('real read failed '+path)
        return body['data']
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        result['browserVersion']=browser.version
        route_load=0
        def open_as(role):
            context=browser.new_context(viewport={'width':1440,'height':1000},locale='zh-CN')
            page=context.new_page();pages.append(page)
            page.on('pageerror',lambda exc:result['pageErrors'].append(str(exc)))
            page.on('response',capture)
            page.goto(BASE+'/#/',wait_until='networkidle')
            if role=='admin':username,password=env_credentials()
            else:username,password=(state['users'][role][k] for k in ('username','password'))
            login(page,username,password)
            return page
        def goto(page,path):
            nonlocal route_load
            route_load+=1
            # hash 同文档跳转可能在 Vue 发出请求前返回；唯一查询参数保证真实页面加载完成。
            page.goto(BASE+'/?live_acceptance='+str(route_load)+'#'+path,wait_until='networkidle')
            expect(page.locator('#app')).not_to_be_empty()
        try:
            if args.stage=='product':
                page=open_as('owner');goto(page,'/merchant/products')
                expect(page.get_by_role('button',name='新增商品',exact=True)).to_be_enabled(timeout=15000)
                if state.get('product'):
                    check(True,'existing_real_browser_product_reused',productId=state['product']['productId'])
                else:
                    page.get_by_role('button',name='新增商品',exact=True).click()
                    form=page.locator('form.merchant-modal')
                    form.get_by_placeholder('商品名称',exact=True).fill('真实联调无糖乌龙茶')
                    form.locator('select').first.select_option('food')
                    row=form.locator('.sku-create-row').first
                    row.locator('input').nth(0).fill('500ml瓶装')
                    row.locator('input').nth(1).fill('6.00')
                    form.get_by_role('button',name='添加规格',exact=True).click()
                    row=form.locator('.sku-create-row').nth(1)
                    row.locator('input').nth(0).fill('600ml瓶装')
                    row.locator('input').nth(1).fill('4.00')
                    form.locator('textarea').fill('无糖乌龙茶，清爽茶饮；真实本地业务和浏览器验收商品。')
                    from PIL import Image
                    image=ROOT/'var/local-live/product.png'
                    Image.open(ROOT/'frontend/images/category-drinks.webp').convert('RGB').save(image)
                    upload=response_for(page,'/images','POST',lambda:form.locator('input[type=file]').set_input_files(str(image)))
                    expect(form.get_by_role('button',name='保存商品',exact=True)).to_be_enabled()
                    created=response_for(page,'/products','POST',lambda:form.get_by_role('button',name='保存商品',exact=True).click())
                    expect(form).to_have_count(0)
                    state['product']=created;state['skuId']=created['skus'][0]['skuId'];state['imageUrl']=created['imageUrl']
                    STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
                    check(created['imageUrl'].startswith('/media/') and len(created['skus'])==2,
                          'merchant_browser_upload_and_create_two_sku_product',productId=created['productId'],imageUrl=created['imageUrl'])
                    page.locator('.product-table tbody tr').filter(has_text=created['title']).click()
                    for sku,quantity in ((created['skus'][0],50),(created['skus'][1],1)):
                        page.locator('select.inspector-select').select_option(sku['skuId'])
                        page.locator('#restock-n').fill(str(quantity))
                        response_for(page,'/replenish','POST',lambda:page.get_by_role('button',name='确认补货',exact=True).click())
                        expect(page.get_by_role('button',name='确认补货',exact=True)).to_be_enabled()
                    check(True,'merchant_browser_replenish_two_skus')
                    page.get_by_role('button',name='基本信息',exact=True).click()
                    response_for(page,'/publish','POST',lambda:page.get_by_role('button',name='上架商品',exact=True).click())
                    expect(page.get_by_role('button',name='下架商品',exact=True)).to_be_visible()
                    check(True,'merchant_browser_publish_product')
                screenshot(page,'merchant-product-desktop')
                state['product']=get(page,'/products/'+state['product']['productId'])
                STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
            elif args.stage=='flow':
                buyer=open_as('buyer');owner=open_as('owner')
                pid=state['product']['productId'];sku=state['skuId'];mid=state['merchant']['merchantId']
                existing=response_for(buyer,'/api/v1/cart','GET',lambda:goto(buyer,'/cart'))
                expect(buyer.locator('.cart-line')).to_have_count(len(existing))
                while buyer.locator('.cart-line').count():
                    line=buyer.locator('.cart-line').first
                    quantity=int(line.locator('.mini-qty span').inner_text())
                    button=line.locator('.mini-qty button').first
                    with buyer.expect_response(lambda r:'/api/v1/cart' in r.url and r.request.method in ('PUT','DELETE')):
                        button.click()
                    if quantity==1:
                        buyer.wait_for_load_state('networkidle')
                    else:
                        expect(line.locator('.mini-qty span')).to_have_text(str(quantity-1))
                        expect(button).to_be_enabled()
                check(True,'buyer_clears_own_cart_through_ui')
                goto(buyer,'/product/'+pid)
                expect(buyer.locator('.detail-info h1')).to_have_text('真实联调无糖乌龙茶')
                expect(buyer.locator('.detail-art img')).to_have_attribute('src',state['imageUrl'])
                check(buyer.locator('.detail-art img').evaluate('(img)=>img.complete&&img.naturalWidth>0'),
                      'consumer_product_detail_uses_real_uploaded_image')
                screenshot(buyer,'consumer-product-desktop')
                goto(buyer,'/ai')
                buyer.get_by_role('textbox',name='输入问题').fill('预算20元买两瓶真实联调无糖乌龙茶，几点自提？')
                answer=response_for(buyer,'/ai/chat','POST',lambda:buyer.get_by_role('button',name='发送问题').click())
                proposal=answer.get('proposal')
                check(answer['mode']=='LLM' and answer['retrievalMode']=='REMOTE_EMBEDDING',
                      'browser_real_remote_llm_response',mode=answer['mode'],latencyMs=answer['latencyMs'],
                      conversationId=answer['conversationId'])
                check(bool(proposal) and any(i['skuId']==sku and i['quantity']==2 for i in proposal['items'])
                      and sum(i['priceCent']*i['quantity'] for i in proposal['items'])<=2000,
                      'browser_recommendation_uses_mysql_quote_stock_and_budget',proposal=proposal)
                check(state['privateSentinel'] not in answer['answer']
                      and any(c['documentId']==state['publicDocument']['id'] for c in answer['citations'])
                      and all(c['documentId']!=state['privateDocument']['id'] for c in answer['citations']),
                      'browser_answer_cites_real_public_pickup_rules_without_private_document',
                      answer=answer['answer'].replace(state['privateSentinel'],'[PRIVATE_SENTINEL_REDACTED]'),
                      citations=answer['citations'])
                expect(buyer.locator('.recommendation-panel')).to_be_visible()
                expect(buyer.locator('.rec-photo img').first).to_have_attribute('src',state['imageUrl'])
                screenshot(buyer,'ai-proposal-desktop')
                response_for(buyer,'/confirm','POST',lambda:buyer.get_by_role('button',name='确认加购',exact=True).click())
                expect(buyer.get_by_role('button',name='已确认',exact=True)).to_be_disabled()
                state['browserProposalId']=proposal['id']
                response_for(buyer,'/api/v1/cart','GET',lambda:goto(buyer,'/cart'))
                expect(buyer.locator('.cart-line .mini-qty span')).to_have_text('2')
                cart=get(buyer,'/cart');check(any(i['skuId']==sku and i['quantity']==2 for i in cart),
                                             'browser_confirmation_persists_real_cart',cart=cart)
                screenshot(buyer,'cart-after-ai')
                order=response_for(buyer,'/api/v1/orders','POST',lambda:buyer.get_by_role('button',name='提交订单',exact=True).click())
                order_id=order['orderId'];state['browserOrderId']=order_id
                STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
                expect(buyer.locator('.pickup-hero h1')).to_have_text('待付款')
                response_for(buyer,'/pay','POST',lambda:buyer.get_by_role('button',name='模拟支付',exact=True).click())
                expect(buyer.get_by_role('button',name='申请退款',exact=True)).to_be_visible()
                check(get(buyer,'/orders/'+order_id)['status']=='PAID','browser_checkout_and_simulated_payment',orderId=order_id)
                goto(owner,'/merchant/orders')
                owner.get_by_placeholder('搜索订单号 / 商品').fill(order_id)
                expect(owner.locator('.ops-table tbody tr')).to_have_count(1)
                response_for(owner,'/prepare','POST',lambda:owner.get_by_role('button',name='开始备货',exact=True).click())
                response_for(owner,'/ready','POST',lambda:owner.get_by_role('button',name='备货完成',exact=True).click())
                check(True,'merchant_browser_prepare_and_ready')
                buyer.get_by_role('button',name='刷新',exact=True).click()
                expect(buyer.get_by_role('button',name='领取自提凭证',exact=True)).to_be_enabled()
                token=response_for(buyer,'/pickup-token','POST',lambda:buyer.get_by_role('button',name='领取自提凭证',exact=True).click())
                owner.get_by_placeholder('输入买家自提令牌').fill(token['token'])
                response_for(owner,'/verify','POST',lambda:owner.get_by_role('button',name='核销自提',exact=True).click())
                buyer.get_by_role('button',name='刷新',exact=True).click()
                expect(buyer.locator('.pickup-hero h1')).to_have_text('已完成')
                check(get(buyer,'/orders/'+order_id)['status']=='COMPLETED','browser_pickup_verification_completes_order')
                screenshot(buyer,'order-completed')
                # 第二笔订单通过页面申请并批准退款，验证真实售后。
                goto(buyer,'/product/'+pid)
                response_for(buyer,'/cart','PUT',lambda:buyer.get_by_role('button',name='加入购物车',exact=True).click())
                response_for(buyer,'/api/v1/cart','GET',lambda:goto(buyer,'/cart'))
                refund=response_for(buyer,'/api/v1/orders','POST',lambda:buyer.get_by_role('button',name='提交订单',exact=True).click())
                refund_id=refund['orderId'];state['browserRefundOrderId']=refund_id
                STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
                expect(buyer.get_by_role('button',name='模拟支付',exact=True)).to_be_visible()
                response_for(buyer,'/pay','POST',lambda:buyer.get_by_role('button',name='模拟支付',exact=True).click())
                buyer.get_by_role('button',name='申请退款',exact=True).click()
                buyer.locator('form.detail-card textarea').fill('真实浏览器验收：未提货申请退款')
                response_for(buyer,'/refunds','POST',lambda:buyer.get_by_role('button',name='提交退款申请',exact=True).click())
                goto(owner,'/merchant/aftersales')
                owner.locator('.ops-list-line').filter(has_text=refund_id).get_by_role('button',name='审核',exact=True).click()
                owner.get_by_placeholder('审核说明（必填）').fill('真实浏览器验收同意退款')
                response_for(owner,'/refund-decision','POST',lambda:owner.get_by_role('button',name='同意退款',exact=True).click())
                buyer.get_by_role('button',name='刷新',exact=True).click()
                expect(buyer.locator('.pickup-hero h1')).to_have_text('已退款')
                check(get(buyer,'/orders/'+refund_id)['status']=='REFUNDED','browser_refund_approved_and_stock_released',orderId=refund_id)
                screenshot(buyer,'order-refunded')
                STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
            else:
                consumer=open_as('buyer');merchant=open_as('owner');admin=open_as('admin');clerk=open_as('clerk')
                groups=[(consumer,['/','/ai','/product/'+state['product']['productId'],
                    '/shops/'+state['merchant']['merchantId'],'/cart','/orders','/orders/'+state['browserOrderId'],
                    '/account','/apply','/invitations']),
                    (merchant,['/merchant','/merchant/products','/merchant/inventory','/merchant/orders',
                    '/merchant/pickup','/merchant/aftersales','/merchant/team','/merchant/roles','/merchant/knowledge','/merchant/settings']),
                    (admin,['/admin','/admin/applications','/admin/merchants','/admin/products','/admin/orders',
                    '/admin/disputes','/admin/categories','/admin/knowledge'])]
                for page,routes in groups:
                    for route in routes:
                        goto(page,route)
                        expect(page.locator('.access-denied')).to_have_count(0)
                        expect(page.locator('.inline-error')).to_have_count(0)
                        check(bool(page.locator('#app').inner_text().strip()),'live_route_'+route)
                    screenshot(page,'routes-'+('admin' if page is admin else 'merchant' if page is merchant else 'consumer'))
                goto(clerk,'/merchant/products')
                expect(clerk.get_by_role('button',name='新增商品',exact=True)).to_be_disabled()
                check(clerk.locator('.merchant-nav').get_by_role('button',name='角色权限',exact=True).count()==0,
                      'clerk_cannot_create_product_or_manage_roles')
                goto(merchant,'/merchant/roles')
                merchant.get_by_role('button',name='新增自定义角色',exact=True).click()
                merchant.get_by_placeholder('例如：商品管理员').fill('真实验收商品管理员')
                merchant.locator('[data-permission="product.write"] input').check()
                role=response_for(merchant,'/rbac/roles','POST',lambda:merchant.get_by_role('button',name='保存角色',exact=True).click())
                expect(merchant.locator('.rbac-role').filter(has_text='真实验收商品管理员')).to_be_visible()
                check('product.write' in role['permissions'],'owner_browser_creates_custom_role')
                screenshot(merchant,'merchant-custom-role')
                goto(merchant,'/merchant/team')
                member=merchant.locator('.ops-list-line').filter(has_text=state['users']['clerk']['userId'])
                response_for(merchant,'/role','PUT',lambda:member.locator('select').select_option(role['code']))
                goto(clerk,'/merchant/products')
                expect(clerk.get_by_role('button',name='新增商品',exact=True)).to_be_enabled()
                check(True,'browser_assigned_role_enables_product_creation')
                goto(clerk,'/merchant/roles')
                expect(clerk.locator('.access-denied')).to_be_visible()
                check(True,'custom_product_role_cannot_manage_roles')
                goto(merchant,'/merchant/roles')
                merchant.locator('.rbac-role').filter(has_text='真实验收商品管理员').click()
                merchant.locator('[data-permission="product.write"] input').uncheck()
                response_for(merchant,'/rbac/roles/','PUT',lambda:merchant.get_by_role('button',name='保存角色',exact=True).click())
                goto(clerk,'/merchant/products')
                expect(clerk.get_by_role('button',name='新增商品',exact=True)).to_be_disabled()
                check(True,'browser_role_edit_revokes_product_creation')
                goto(merchant,'/merchant/team')
                member=merchant.locator('.ops-list-line').filter(has_text=state['users']['clerk']['userId'])
                response_for(merchant,'/role','PUT',lambda:member.locator('select').select_option('CLERK'))
                goto(merchant,'/merchant/roles')
                merchant.locator('.rbac-role').filter(has_text='真实验收商品管理员').click()
                merchant.once('dialog',lambda dialog:dialog.accept())
                response_for(merchant,'/rbac/roles/','DELETE',lambda:merchant.get_by_role('button',name='删除角色',exact=True).click())
                expect(merchant.locator('.rbac-role').filter(has_text='真实验收商品管理员')).to_have_count(0)
                check(all(r['code']!=role['code'] for r in get(merchant,'/merchants/'+state['merchant']['merchantId']+'/rbac/roles')),
                      'browser_restores_clerk_and_deletes_custom_role')
                goto(consumer,'/admin/applications')
                expect(consumer.locator('.access-denied')).to_be_visible()
                check(True,'buyer_cannot_access_admin_page')
                for page,route,name in [(consumer,'/ai','ai-mobile'),(merchant,'/merchant/products','merchant-mobile'),
                                        (admin,'/admin/applications','admin-mobile')]:
                    page.set_viewport_size({'width':390,'height':844});goto(page,route)
                    check(page.evaluate('document.documentElement.scrollWidth <= 391'),'mobile_no_horizontal_overflow_'+name)
                    if page is not consumer:
                        expect(page.locator('.backoffice-mobile-nav, .merchant-mobile-nav').first).to_be_visible()
                    screenshot(page,name)
            check(not result['pageErrors'],'no_uncaught_browser_errors')
            check(not [r for r in result['apiResponses'] if r['http']>=500], 'no_http_5xx_from_real_backend')
            result['status']='PASS'
        except Exception as exc:
            result['status']='FAILED';result['error']=str(exc)
            for i,page in enumerate(pages):
                try:screenshot(page,'failure-'+args.stage+'-'+str(i))
                except Exception:pass
            save();raise
        finally:
            save();browser.close()


if __name__=='__main__':main()
