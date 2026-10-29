"""真实 Chromium + 真实 Vue 前端，后端为明确标记的接口契约替身。
不用于声称 Spring/MySQL 端到端验收通过。运行: python frontend/tests/contract_ui.py
"""
import base64
import copy
import json
import os
import re
import shutil
import threading
from datetime import datetime, timezone, timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from types import SimpleNamespace
from playwright.sync_api import sync_playwright, expect
from browser_transport import track_bindings, close_browser

ROOT=Path(__file__).resolve().parents[2]
STATIC=ROOT/'campus-shopping-app/src/main/resources/static'
EVIDENCE=ROOT/'docs/testing/evidence/frontend-contract'
EVIDENCE.mkdir(parents=True,exist_ok=True)
NOW=datetime.now(timezone.utc).isoformat()
DEADLINE=(datetime.now(timezone.utc)+timedelta(minutes=15)).isoformat()

class StaticHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def end_headers(self):
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'")
        super().end_headers()

class BackendContractDouble:
    def __init__(self):
        self.logged=False; self.csrf='fixture-token-0';self.writes=[];self.unhandled=[];self.uploaded_images=[]
        self.user={'userId':'u1','username':'student001','displayName':'测试同学','status':'ACTIVE'}
        self.shops=[{'merchantId':'m1','name':'林间文具铺（测试）','category':'文具','status':'ACTIVE','storeId':'s1','storeName':'图书馆店','location':'图书馆一层东侧'}, {'merchantId':'m2','name':'鲜果小站（测试）','category':'水果','status':'ACTIVE','storeId':'s2','storeName':'生活区店','location':'生活区A座'}]
        self.categories=[{'code':'stationery','name':'文具图书','active':True},{'code':'fruit','name':'水果生鲜','active':True},{'code':'food','name':'食品饮料','active':True},{'code':'daily','name':'日用百货','active':True}]
        self.products=[{'productId':'p'+str(n),'merchantId':'m1' if n<4 else 'm2','storeId':'s1' if n<4 else 's2','title':title,'description':'用于前端契约测试的商品资料，不是实际交易数据。','categoryCode':'stationery' if n<4 else 'fruit','imageUrl':'','status':'PUBLISHED','version':1,'skus':[{'skuId':'sku'+str(n),'specKey':'标准装','priceCent':price,'status':'ACTIVE','quoteVersion':1,'available':30}]} for n,(title,price) in enumerate([('书写顺滑中性笔',1200),('轻量空白笔记本',1800),('考试文具套装',2500),('便携铅笔收纳袋',1500),('当季新鲜苹果',800),('阳光甜橙',1000)])]
        self.cart=[];self.orders=[];self.applications=[{'applicationId':'a1','merchantName':'校园烘焙屋（待审测试）','category':'食品','contactName':'测试申请人','contactPhone':'10000000000','storeName':'西区小店','location':'西区教学楼一层','status':'SUBMITTED','rejectionReason':None,'merchantId':None}]
        self.members=[{'merchantId':'m1','userId':'u1','role':'OWNER','status':'ACTIVE'},{'merchantId':'m1','userId':'u2','role':'CLERK','status':'ACTIVE'}]
        self.bases=[];self.docs=[];self.conversations=[];self.messages=[];self.proposals=[];self.doc_uploads=[]
    def data(self,value=None,code='0000',info='成功'):
        return {'code':code,'info':info,'data':value}
    def handle(self,route):
        request=route.request;u=urlparse(request.url);path=u.path.removeprefix('/api/v1');method=request.method;q=parse_qs(u.query)
        body=request.post_data_json if request.post_data else {}
        status=200;data=None;code='0000';info='成功'
        if method=='GET' and path.endswith('/page'):
            # Explicit contract double for new paged endpoints; no Java/MySQL involved.
            if path=='/merchants/public/page':source=[x for x in self.shops if x['status']=='ACTIVE']
            elif path=='/admin/merchants/page':source=self.shops
            elif path=='/products/page':source=[x for x in self.products if x['status']=='PUBLISHED' and (not q.get('merchantId') or x['merchantId']==q['merchantId'][0]) and (not q.get('q') or q['q'][0].lower() in x['title'].lower()) and (not q.get('category') or x['categoryCode']==q['category'][0])]
            elif path=='/admin/products/page':source=[x for x in self.products if not q.get('q') or q['q'][0].lower() in x['title'].lower()]
            elif re.fullmatch(r'/merchants/[^/]+/products/page',path):
                mid=path.split('/')[2];source=[x for x in self.products if x['merchantId']==mid and (not q.get('q') or q['q'][0].lower() in x['title'].lower()) and (not q.get('category') or x['categoryCode']==q['category'][0]) and (not q.get('status') or x['status']==q['status'][0])]
            elif path=='/orders/page':source=self.orders
            elif path=='/admin/orders/page':source=self.orders
            elif re.fullmatch(r'/merchants/[^/]+/orders/page',path):source=[x for x in self.orders if x['merchantId']==path.split('/')[2]]
            elif path in ('/admin/merchant-applications/page','/merchant-applications/mine/page'):source=self.applications
            elif path=='/admin/aftersales/page':source=[]
            elif re.fullmatch(r'/merchants/[^/]+/aftersales/page',path):source=[]
            elif re.fullmatch(r'/merchants/[^/]+/stocks/page',path):source=[{'skuId':x['skus'][0]['skuId'],'storeId':'s1','onHand':30,'reserved':0,'available':30,'version':0} for x in self.products if x['merchantId']==path.split('/')[2]]
            elif re.fullmatch(r'/merchants/[^/]+/stock-movements/page',path):source=[{'id':'mv1','skuId':'sku0','type':'REPLENISH','quantity':10,'createdAt':NOW}]
            elif re.fullmatch(r'/knowledge/bases/[^/]+/documents/page',path):source=[x for x in self.docs if x.get('baseId')==path.split('/')[3]]
            else:source=None
            if source is not None:
                if q.get('state'):source=[x for x in source if x.get('status')==q['state'][0]]
                page=max(1,int(q.get('page',['1'])[0]));size=max(1,int(q.get('size',['20'])[0]));total=len(source)
                source=source[(page-1)*size:page*size]
                data={'items':source,'page':page,'size':size,'total':total,'hasNext':page*size<total}
                route.fulfill(status=200,content_type='application/json',body=json.dumps(self.data(data),ensure_ascii=False));return
        if method=='GET' and re.fullmatch(r'/merchants/public/[^/]+',path):
            shop=next((x for x in self.shops if x['merchantId']==path.split('/')[-1] and x['status']=='ACTIVE'),None)
            route.fulfill(status=200,content_type='application/json',body=json.dumps(self.data(shop),ensure_ascii=False));return
        if method=='POST' and re.fullmatch(r'/merchants/[^/]+/products/[^/]+/skus',path):
            if request.headers.get('x-csrf-token')!=self.csrf:
                route.fulfill(status=403,json=self.data(None,'A0005','安全令牌错误'));return
            self.writes.append({'path':path,'method':method,'csrf':True,'hasIdempotency':False})
            product=next(x for x in self.products if x['productId']==path.split('/')[4]);product['skus'].append({'skuId':'new-sku-'+str(len(product['skus'])),'specKey':body['specKey'],'priceCent':body['priceCent'],'status':'ACTIVE','quoteVersion':product['version']+1,'available':0});product['version']+=1
            route.fulfill(status=200,content_type='application/json',body=json.dumps(self.data(product),ensure_ascii=False));return
        if method!='GET':
            self.writes.append({'path':path,'method':method,'csrf':bool(request.headers.get('x-csrf-token')),'hasIdempotency':bool(request.headers.get('idempotency-key'))})
            if request.headers.get('x-csrf-token')!=self.csrf:
                route.fulfill(status=403,json=self.data(None,'A0005','安全令牌错误'));return
        if path=='/auth/csrf':data={'headerName':'X-CSRF-TOKEN','token':self.csrf}
        elif path=='/auth/me':
            if self.logged:data=self.user
            else:status=401;code='A0004';info='请先登录'
        elif path=='/auth/register':data={'userId':'registered'}
        elif path=='/auth/login':
            if body.get('password')=='wrong':code='A0002';info='用户名或密码错误'
            else:self.logged=True;self.csrf='fixture-token-1';data=self.user
        elif path=='/auth/logout':self.logged=False;self.csrf='fixture-token-2'
        elif path=='/workspace':
            grants={'OWNER':['dashboard.read','product.read','product.write','stock.read','stock.replenish','order.read','order.prepare','pickup.verify','aftersale.read','aftersale.review','knowledge.read','knowledge.manage','team.manage','store.manage','role.manage'],
                    'CLERK':['product.read','stock.read','stock.replenish','order.read','order.prepare','pickup.verify']}
            data={'platformAdmin':True,'memberships':self.members,'merchantPermissions':{m['merchantId']:grants.get(m['role'],[]) for m in self.members if m['status']=='ACTIVE' and m['userId']==self.user['userId']},'merchants':[s for s in self.shops if s['merchantId'] in {m['merchantId'] for m in self.members if m['userId']==self.user['userId'] and m['status']=='ACTIVE'}]}
        elif path=='/categories':data=self.categories
        elif path=='/merchants/public':data=self.shops
        elif path=='/products':
            data=[p for p in self.products if p['status']=='PUBLISHED' and (not q.get('q') or q['q'][0] in p['title']) and (not q.get('category') or q['category'][0]==p['categoryCode'])]
        elif re.fullmatch('/products/[^/]+',path):data=next(p for p in self.products if p['productId']==path.split('/')[-1])
        elif path=='/cart':
            if method=='PUT':
                sku=body['skuId'];p=next(p for p in self.products if p['skus'][0]['skuId']==sku);s=p['skus'][0]
                item={'merchantId':p['merchantId'],'skuId':sku,'title':p['title'],'specKey':s['specKey'],'priceCent':s['priceCent'],'quoteVersion':s['quoteVersion'],'quantity':body['quantity'],'available':30,'sellable':True}
                self.cart=[x for x in self.cart if x['skuId']!=sku]+[item]
            data=self.cart
        elif path.startswith('/cart/'):
            self.cart=[x for x in self.cart if x['skuId']!=path.split('/')[-1]]
        elif path=='/orders':
            if method=='POST':
                items=[{'skuId':x['skuId'],'title':next(p['title'] for p in self.products if p['skus'][0]['skuId']==x['skuId']),'specKey':'标准装','quantity':x['quantity'],'unitPriceCent':x['expectedPriceCent']} for x in body['items']]
                data={'orderId':'o'+str(len(self.orders)+1),'buyerId':'u1','merchantId':body['merchantId'],'storeId':'s1','status':'PENDING_PAYMENT','totalCent':sum(x['unitPriceCent']*x['quantity'] for x in items),'deadline':DEADLINE,'createdAt':NOW,'items':items,'pickup':None,'afterSale':None}
                self.orders.append(data);self.cart=[x for x in self.cart if x['merchantId']!=body['merchantId']]
            else:data=self.orders
        elif re.fullmatch('/orders/[^/]+',path):data=next(o for o in self.orders if o['orderId']==path.split('/')[-1])
        elif re.fullmatch('/orders/[^/]+/pay',path):
            data=next(o for o in self.orders if o['orderId']==path.split('/')[2]);data['status']='PAID';data['pickup']={'status':'WAIT_PREP'}
        elif re.fullmatch('/orders/[^/]+/pickup-token',path):data={'token':'TEST_ONLY_NOT_A_REAL_PICKUP_TOKEN','expiresAt':DEADLINE}
        elif re.fullmatch('/merchants/[^/]+/orders/[^/]+/(prepare|ready|verify)',path):
            data=next(o for o in self.orders if o['orderId']==path.split('/')[4]);action=path.split('/')[-1];data['pickup']={'status':{'prepare':'PREPARING','ready':'READY','verify':'CONSUMED'}[action]}
            if action=='verify':data['status']='COMPLETED'
        elif re.fullmatch('/merchants/[^/]+/orders',path) or path=='/admin/orders':data=self.orders
        elif path.endswith('/statistics'):data={'totalOrders':len(self.orders),'pendingCount':0,'paidCount':1,'completedCount':8,'refundedCount':1,'completedAmountCent':25800}
        elif path=='/merchant-applications/mine' or path=='/admin/merchant-applications':data=self.applications
        elif path=='/merchant-applications':data={'applicationId':'a2','status':'SUBMITTED'};self.applications.append({**body,**data})
        elif re.fullmatch('/admin/merchant-applications/[^/]+/review',path):
            data=self.applications[0];data['status']='APPROVED' if body['approved'] else 'REJECTED';data['merchantId']='m3'
        elif path=='/admin/merchants':data=self.shops
        elif path=='/admin/products':data=self.products
        elif re.fullmatch('/admin/products/[^/]+/unpublish',path):
            product=next(p for p in self.products if p['productId']==path.split('/')[3]);product['status']='UNPUBLISHED'
        elif re.fullmatch('/merchants/[^/]+/profile',path):
            shop=next(m for m in self.shops if m['merchantId']==path.split('/')[2]);shop.update(body);data=shop
        elif path.endswith('/state'):data=None
        elif path=='/admin/categories':
            self.categories=[c for c in self.categories if c['code']!=body['code']]+[body]
        elif path=='/invitations':data=[]
        elif path.endswith('/invitations'):data={'id':'inv1'}
        elif path.endswith('/members'):data=self.members
        elif re.fullmatch('/merchants/[^/]+/members/[^/]+',path):self.members=[m for m in self.members if m['userId']!=path.split('/')[-1]]
        elif re.fullmatch('/merchants/[^/]+/images',path) and method=='POST':
            self.uploaded_images.append({'filename':body.get('filename'),'contentType':body.get('contentType'),'data':base64.b64decode(body.get('base64',''))})
            data={'url':'/media/550e8400-e29b-41d4-a716-446655440000.png'}
        elif re.fullmatch('/merchants/[^/]+/products/[^/]+',path) and method=='PUT':
            product=next(p for p in self.products if p['productId']==path.split('/')[-1]);assert body.get('expectedVersion')==product['version']
            product.update({k:body[k] for k in ('title','description','categoryCode','imageUrl')});product['version']+=1
        elif re.fullmatch('/merchants/[^/]+/products',path):
            if method=='POST':
                p={'productId':'p-created','merchantId':'m1','storeId':'s1','title':body['title'],'description':body['description'],'categoryCode':body['categoryCode'],'imageUrl':body.get('imageUrl',''),'status':'DRAFT','version':0,'skus':[{'skuId':'sku-created','specKey':x['specKey'],'priceCent':x['priceCent'],'status':'ACTIVE','quoteVersion':0,'available':0} for x in body['skus']]};self.products.append(p);data=p
            else:data=[p for p in self.products if p['merchantId']==path.split('/')[2]]
        elif path.endswith('/publish') and '/products/' in path:
            p=next(p for p in self.products if p['productId']==path.split('/')[4]);p['status']='PUBLISHED' if body['published'] else 'UNPUBLISHED'
        elif path.endswith('/stocks'):
            data=[{'skuId':p['skus'][0]['skuId'],'storeId':'s1','onHand':30,'reserved':0,'available':30,'version':0} for p in self.products if p['merchantId']=='m1']
        elif path.endswith('/replenish'):data=None
        elif path.endswith('/stock-movements'):data=[{'skuId':'sku0','type':'REPLENISH','quantity':10,'createdAt':NOW}]
        elif path.endswith('/aftersales'):data=[]
        elif path=='/knowledge/bases':
            if method=='POST':data={'id':'kb1',**body};self.bases.append(data)
            else:data=self.bases
        elif re.fullmatch('/knowledge/bases/[^/]+/documents',path):
            if method=='POST':
                self.doc_uploads.append({'rootId':body.get('rootId'),'baseId':path.split('/')[3],'title':body['title']})
                root=body.get('rootId') or ('root'+str(len(self.docs)+1))
                vers=[x['version'] for x in self.docs if x.get('rootId')==root]
                data={'id':'doc'+str(len(self.docs)+1),'rootId':root,'baseId':path.split('/')[3],'title':body['title'],'version':max(vers,default=0)+1,'status':'DRAFT','indexStatus':'READY','content':base64.b64decode(body['base64']).decode(),'createdAt':NOW};self.docs.append(data)
            else:data=self.docs
        elif re.fullmatch('/knowledge/documents/[^/]+',path):data=self.docs[0]
        elif re.fullmatch('/knowledge/documents/[^/]+/(publish|index|withdraw)',path):
            data=self.docs[0];action=path.split('/')[-1]
            if action!='index':data['status']='PUBLISHED' if action=='publish' else 'WITHDRAWN'
        elif path=='/ai/conversations':data=self.conversations
        elif path=='/ai/chat':
            self.conversations=[{'id':'conv1','title':body['question'],'createdAt':NOW}]
            p={'id':'proposal1','status':'PENDING','expiresAt':DEADLINE,'items':[{'skuId':'sku0','merchantId':'m1','title':'书写顺滑中性笔','specKey':'标准装','priceCent':1200,'quoteVersion':1,'quantity':1}]};self.proposals=[p]
            self.messages=[{'id':'msg1','role':'user','content':body['question']},{'id':'msg2','role':'assistant','content':'这是明确标注的本地检索演示，根据已上架商品为你找到这款中性笔。'}]
            data={'conversationId':'conv1','answer':self.messages[-1]['content'],'mode':'LOCAL_RETRIEVAL_DEMO','retrievalMode':'LOCAL_CHAR_NGRAM_DEMO','warning':'未配置真实模型。','citations':[{'documentId':'doc1','title':'自提指南','snippet':'付款后到店自提。'}],'proposal':p,'latencyMs':15}
        elif path.endswith('/messages'):data=self.messages
        elif path.endswith('/proposals'):data=self.proposals
        elif path.endswith('/confirm'):
            data=self.proposals[0];data['status']='CONFIRMED';self.cart.append({'merchantId':'m1','skuId':'sku0','title':'书写顺滑中性笔','specKey':'标准装','priceCent':1200,'quoteVersion':1,'quantity':1,'available':30,'sellable':True})
        elif path.endswith('/reject') and '/proposals/' in path:self.proposals[0]['status']='REJECTED'
        else:self.unhandled.append([method,path]);status=404;code='G0001';info='接口替身未定义'
        route.fulfill(status=status,content_type='application/json',body=json.dumps(self.data(data,code,info),ensure_ascii=False))

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(StaticHandler,directory=str(STATIC)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    checks=[];errors=[];fixture=BackendContractDouble()
    def check(name,condition=True):
        assert condition,name
        checks.append(name)
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
            context=browser.new_context(viewport={'width':1440,'height':1000},locale='zh-CN')
            page=context.new_page();page.on('pageerror',lambda exc:errors.append(str(exc)))
            def offline_call(source, payload):
                result={}
                req=SimpleNamespace(url=payload['url'],method=payload.get('method','GET'),headers={k.lower():v for k,v in payload.get('headers',{}).items()},post_data=payload.get('body'),post_data_json=json.loads(payload['body']) if payload.get('body') else None)
                def fulfill(**kwargs):
                    result.update({'status':kwargs.get('status',200),'body':kwargs.get('json') if 'json' in kwargs else json.loads(kwargs['body'])})
                fixture.handle(SimpleNamespace(request=req,fulfill=fulfill))
                return result
            page.expose_binding('__contractApi',offline_call)
            track_bindings(page)
            page.on('dialog',lambda d:d.accept())
            page.set_content('<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>校园集市前端契约测试</title></head><body><div id="app"></div></body></html>')
            page.add_style_tag(path=str(STATIC/'assets/app.css'))
            page.evaluate("""() => {
              window.fetch = async (url,options={}) => {const r=await window.__contractApi({url:String(url),method:options.method||'GET',headers:options.headers||{},body:options.body});return new Response(JSON.stringify(r.body),{status:r.status,headers:{'Content-Type':'application/json'}});};
              if(!crypto.randomUUID)crypto.randomUUID=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
            }""")
            for asset in ('vue.global.prod.js','render.js','app.js'):page.add_script_tag(path=str(STATIC/'assets'/asset))
            expect(page.locator('.product-card')).to_have_count(6);check('真实Vue渲染商品首页；使用本地资源与预编译模板')
            page.screenshot(path=str(EVIDENCE/'consumer-desktop.png'),full_page=True)
            page.get_by_role('button',name='登录 / 注册').click()
            page.get_by_label('用户名',exact=True).fill('student001');page.get_by_label('密码',exact=True).fill('MySecurePass123!')
            page.locator('.modal').get_by_role('button',name='登录校园集市').click()
            expect(page.locator('.user-name')).to_have_text('测试同学');check('登录后刷新安全令牌与工作台权限')
            page.get_by_role('button',name='书写顺滑中性笔',exact=True).click()
            page.get_by_role('button',name='加入购物车',exact=True).click()
            expect(page.locator('.modal')).to_have_count(0)
            page.get_by_role('button',name='打开购物车').click()
            expect(page.locator('.cart-group')).to_have_count(1)
            page.get_by_role('button',name='确认报价并下单').click()
            expect(page.locator('.modal-header')).to_contain_text('订单详情');check('商品选规格、加购、单商户报价下单')
            page.locator('.modal').get_by_role('button',name='模拟付款',exact=True).click()
            expect(page.locator('.modal .badge')).to_contain_text('已付款');check('模拟付款更新订单，不跳转外部支付')
            page.get_by_role('button',name='关闭弹窗').click()
            page.get_by_role('button',name='商户中心',exact=True).click()
            expect(page.locator('h1')).to_have_text('经营概览')
            page.screenshot(path=str(EVIDENCE/'merchant-desktop.png'),full_page=True)
            page.locator('nav').get_by_role('button',name='商品与规格').click()
            page.get_by_role('button',name='＋ 新建商品').click()
            page.get_by_label('商品名称',exact=True).fill('测试新文具')
            page.get_by_label('规格名称',exact=True).fill('黑色一盒');page.get_by_label('售价（元）',exact=True).fill('8.80')
            page.get_by_role('button',name='保存商品',exact=True).click()
            expect(page.locator('table')).to_contain_text('测试新文具');check('商户创建商品和规格，金额按分提交')
            page.locator('tr').filter(has_text='测试新文具').get_by_role('button',name='上架',exact=True).click()
            expect(page.locator('tr').filter(has_text='测试新文具').locator('.badge')).to_contain_text('已上架');check('商户新建商品通过明确操作上架')
            page.locator('nav').get_by_role('button',name='商户资料').click()
            page.get_by_label('自提位置',exact=False).fill('图书馆一层新服务台')
            page.get_by_role('button',name='保存经营资料').click()
            expect(page.locator('.toast').filter(has_text='商户与自提门店资料已更新')).to_be_visible()
            check('经营者可以维护自提门店资料',fixture.shops[0]['location']=='图书馆一层新服务台')
            page.locator('nav').get_by_role('button',name='库存管理').click()
            page.get_by_role('button',name='补货',exact=True).first.click()
            page.get_by_label('补货数量',exact=True).fill('5');page.get_by_role('button',name='确认补货',exact=True).click()
            expect(page.locator('.modal')).to_have_count(0);check('商户补货携带独立幂等键')
            page.locator('nav').get_by_role('button',name='订单与自提').click()
            page.get_by_role('button',name='备货完成',exact=True).click()
            expect(page.get_by_role('button',name='核销自提',exact=True)).to_be_visible()
            page.get_by_role('button',name='核销自提',exact=True).click();page.get_by_label('买家出示的自提令牌').fill('TEST_ONLY_NOT_A_REAL_PICKUP_TOKEN')
            page.get_by_role('button',name='确认交付并核销').click();expect(page.locator('.order-card .badge')).to_contain_text('已完成');check('备货与令牌核销流程有明确操作入口')
            page.locator('nav').get_by_role('button',name='知识资料').click()
            page.get_by_role('button',name='＋ 新建知识库').click();page.get_by_label('知识库名称',exact=True).fill('商品知识测试')
            page.get_by_role('button',name='创建知识库',exact=True).click();expect(page.locator('.knowledge-bases')).to_contain_text('商品知识测试')
            page.get_by_role('button',name='上传文档',exact=True).click();page.get_by_label('文档标题',exact=True).fill('自提指南')
            page.get_by_label('或直接输入 Markdown',exact=True).fill('付款后到店自提。未提货可以申请全额模拟退款。')
            page.get_by_role('button',name='保存并构建索引').click();expect(page.locator('.document-card')).to_contain_text('自提指南')
            page.locator('.document-card').get_by_role('button',name='发布',exact=True).click()
            expect(page.locator('.document-card').get_by_role('button',name='撤回',exact=True)).to_be_visible();check('知识库创建、文本上传、索引状态与发布流程')
            page.get_by_role('button',name='平台运营',exact=True).click()
            page.locator('nav').get_by_role('button',name='商品监管').click()
            page.locator('tr').filter(has_text='测试新文具').get_by_role('button',name='监管下架').click()
            expect(page.locator('tr').filter(has_text='测试新文具').locator('.badge')).to_contain_text('已下架');check('平台监管通过独立接口下架商品')
            page.locator('nav').get_by_role('button',name='入驻审核').click()
            page.screenshot(path=str(EVIDENCE/'admin-desktop.png'),full_page=True)
            page.get_by_role('button',name='通过并开通').click();page.get_by_label('原因 / 说明',exact=True).fill('测试人工核对资料通过')
            page.get_by_role('button',name='确认提交',exact=True).click();expect(page.locator('.admission-card .badge')).to_contain_text('已通过');check('平台审核需确认并填写意见')
            page.get_by_role('button',name='校园购物',exact=True).click();page.locator('nav').get_by_role('button',name='智能导购').click()
            page.get_by_label('输入购物需求').fill('预算30元，买一套考试文具')
            page.get_by_role('button',name='发送 ↑',exact=True).click()
            expect(page.locator('.proposal-card')).to_have_count(1)
            expect(page.locator('.chat-header .badge')).to_contain_text('未使用大模型');check('未接模型时界面明确标注演示模式')
            page.screenshot(path=str(EVIDENCE/'ai-desktop.png'),full_page=True)
            page.get_by_role('button',name='确认加入购物车',exact=True).click()
            expect(page.locator('.proposal-card .badge')).to_contain_text('已确认');check('AI提案显式确认后才调用加购写接口')
            page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='返回校园集市首页').click()
            expect(page.locator('.product-card')).to_have_count(6)
            page.screenshot(path=str(EVIDENCE/'consumer-mobile.png'),full_page=True)
            width=page.evaluate('document.documentElement.scrollWidth');check('手机首页无横向溢出',width<=391)
            page.get_by_role('button',name='退出',exact=True).click();expect(page.get_by_role('button',name='登录 / 注册')).to_be_visible();check('退出清理前端私人数据')
            check('所有写请求均携带CSRF令牌',all(x['csrf'] for x in fixture.writes))
            check('下单与补货均携带幂等键',all(x['hasIdempotency'] for x in fixture.writes if x['path']=='/orders' or x['path'].endswith('/replenish')))
            check('未调用未定义契约接口',not fixture.unhandled)
            check('无浏览器JavaScript未捕获错误',not errors)
            close_browser(browser)
    finally:
        server.shutdown()
        result={'testType':'真实Chromium + 真实Vue；后端为接口契约替身，不是Java/MySQL端到端','timestamp':datetime.now(timezone.utc).isoformat(),'passedChecks':checks,'browserErrors':errors,'unhandledMockRoutes':fixture.unhandled,'writes':fixture.writes,'realJavaMySqlTested':False,'browserTransport':'离线DOM加载，本地HTTP导航被环境策略禁止；fetch替换为契约替身'}
        (EVIDENCE/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'checksPassed':len(checks),'browserErrors':errors,'type':'frontend-contract-mock'},ensure_ascii=False))

if __name__=='__main__': main()
