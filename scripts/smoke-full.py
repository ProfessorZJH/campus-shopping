#!/usr/bin/env python3
"""真实 HTTP 核心验收。会在本地库新增测试账号/商户/订单，不删除既有数据。
只允许 localhost，需已经启动 Java、MySQL 与 AI 服务。没有运行就没有验收结论。
"""
from __future__ import annotations
import argparse, base64, concurrent.futures, datetime, http.cookiejar, json, os
from pathlib import Path
import secrets, sys, time, urllib.error, urllib.parse, urllib.request, uuid
import hashlib, re

ROOT = Path(__file__).resolve().parents[1]
RESULTS = []
CONTRACT = None
CONTRACT_RESPONSES = []


def validate_response(method, path, status, data):
    if CONTRACT is None:
        return
    from jsonschema import Draft202012Validator, RefResolver
    route = urllib.parse.urlsplit('/api/v1'+path).path
    for candidate, operations in sorted(CONTRACT['paths'].items(), key=lambda item: ('{' in item[0], item[0])):
        pattern = '/'.join('[^/]+' if part.startswith('{') else re.escape(part) for part in candidate.split('/'))
        if re.fullmatch(pattern, route) and method.lower() in operations:
            response = operations[method.lower()]['responses'].get(str(status))
            if response is None:
                raise AssertionError(f'契约没有声明响应状态：{method} {route} HTTP {status}')
            schema = response['content']['application/json']['schema']
            errors = list(Draft202012Validator(schema, resolver=RefResolver.from_schema(CONTRACT)).iter_errors(data))
            if errors:
                # 仅输出字段位置/规则名，避免把响应或文档正文写进失败日志。
                field = '.'.join(str(p) for p in errors[0].absolute_path) or '$'
                raise AssertionError(f'响应契约不一致：{method} {route} HTTP {status} field={field} rule={errors[0].validator}')
            CONTRACT_RESPONSES.append((method, route, status))
            return
    raise AssertionError(f'契约没有声明路由：{method} {route}')

def check(condition, label):
    if not condition:
        raise AssertionError(label)
    RESULTS.append({'check': label, 'status': 'PASS'})

def env_file(path):
    values = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1); values[key.strip()] = value.strip().strip('"')
    return values

class Client:
    def __init__(self, base):
        self.base = base.rstrip('/') + '/api/v1'; self.token = None
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def csrf(self):
        self.token = self.call('GET','/auth/csrf'); return self.token
    def call(self, method, path, body=None, key=None, code='0000', status=200):
        headers = {'Accept':'application/json'}
        if method != 'GET':
            if self.token is None:self.csrf()
            headers[self.token['headerName']] = self.token['token']
        if body is not None:headers['Content-Type']='application/json'
        if key:headers['Idempotency-Key']=key
        payload=None if body is None else json.dumps(body,ensure_ascii=False).encode('utf-8')
        request=urllib.request.Request(self.base+path,data=payload,headers=headers,method=method)
        try:response=self.opener.open(request,timeout=125)
        except urllib.error.HTTPError as e:response=e
        with response:
            data=json.load(response)
            if response.status!=status or code is not None and data.get('code')!=code:
                raise AssertionError(f'{method} {path}: HTTP={response.status}, code={data.get("code")}, expected={status}/{code}')
            validate_response(method,path,response.status,data)
        RESULTS.append({'request':method+' '+path,'http':response.status,'businessCode':data.get('code'),'status':'PASS'})
        return data if code is None else data.get('data')
    def login(self, username, password):
        self.csrf();before=next((c.value for c in self.jar if c.name=='JSESSIONID'),None)
        user=self.call('POST','/auth/login',{'username':username,'password':password})
        after=next((c.value for c in self.jar if c.name=='JSESSIONID'),None)
        check(before and after and before!=after,'登录后替换会话ID')
        self.csrf();return user
    def logout(self):
        self.call('POST','/auth/logout',{});self.token=None
        self.call('GET','/auth/me',status=401,code='A0004')

def run(args):
    if urllib.parse.urlsplit(args.base_url).hostname not in {'localhost','127.0.0.1','::1'}:
        raise ValueError('只允许本地开发或隔离测试环境')
    env=env_file(args.env_file)
    username=os.getenv('ADMIN_USERNAME') or env.get('ADMIN_USERNAME')
    password=os.getenv('ADMIN_PASSWORD') or env.get('ADMIN_PASSWORD')
    if not username or not password:raise ValueError('请通过环境或 .env 提供已初始化的管理员凭据')
    anonymous=Client(args.base_url)
    public_page=anonymous.call('GET','/merchants/public/page?page=1&size=10')
    check(isinstance(public_page['items'],list) and isinstance(public_page['total'],int),
          '匿名公开商户分页 HTTP 200 且具有 items/total')
    anonymous.call('GET','/admin/merchants/page',code='A0004',status=401)
    admin=Client(args.base_url);admin.login(username,password)
    check(admin.call('GET','/workspace')['platformAdmin'],'管理员是数据库中的真实平台角色')
    users={};suffix=uuid.uuid4().hex[:12]
    for label in ('owner','second','buyer','clerk'):
        c=Client(args.base_url);name='smoke_'+label+'_'+suffix;pwd=secrets.token_urlsafe(24)
        payload={'username':name,'password':pwd,'displayName':'验收'+label}
        account=c.call('POST','/auth/register',payload)
        if label=='buyer':c.call('POST','/auth/register',payload,code='A0001')
        signed=c.login(name,pwd);check(account['userId']==signed['userId'],'注册账号可以通过数据库登录：'+label)
        users[label]={'client':c,'id':account['userId'],'username':name}
    owner=users['owner']['client'];other=users['second']['client'];buyer=users['buyer']['client'];clerk=users['clerk']['client']
    other.call('GET','/admin/merchant-applications',code='A0006')
    merchants=[]
    for label in ('owner','second'):
        c=users[label]['client'];body={'merchantName':'验收文具店'+label,'category':'stationery','contactName':'测试经营者','contactPhone':'13800000000','storeName':'校园门店'+label,'location':'校园西门测试区'}
        key=uuid.uuid4().hex;a=c.call('POST','/merchant-applications',body,key)
        check(a['applicationId']==c.call('POST','/merchant-applications',body,key)['applicationId'],'相同入驻请求返回同一申请')
        m=admin.call('POST','/admin/merchant-applications/'+a['applicationId']+'/review',{'approved':True,'reason':'测试环境审核'})
        m2=admin.call('POST','/admin/merchant-applications/'+a['applicationId']+'/review',{'approved':True,'reason':'重复测试'})
        check(m['merchantId']==m2['merchantId'],'审核开通幂等')
        check(any(x['merchantId']==m['merchantId'] and x['role']=='OWNER' for x in c.call('GET','/workspace')['memberships']),'开通后得到对应商户Owner')
        merchants.append(m)
    m=merchants[0]['merchantId'];base='/merchants/'+m
    public_detail=anonymous.call('GET','/merchants/public/'+urllib.parse.quote(m,safe=''))
    check(public_detail['merchantId']==m,'匿名可访问 ACTIVE 商户详情，Security 规则有效')
    def verify_page(data, label):
        check(isinstance(data,dict) and all(k in data for k in ('items','page','size','total','hasNext')),
              label+' 响应包含完整分页协议')
        check(data['total'] >= len(data['items']) and data['page']>=1,
              label+' total 不使用当前页长度冒充')
    for suffix in ('','/page'):
        admin.call('GET','/admin/merchant-applications'+suffix+'?state=UNKNOWN',code='0002')
    applications_page=admin.call('GET','/admin/merchant-applications/page?state=APPROVED&page=1&size=5&q='+urllib.parse.quote('验收文具店'))
    verify_page(applications_page,'平台审核申请筛选')
    check(any(x['applicationId'] for x in applications_page['items']),'入驻申请 q 在真实数据库过滤成功')
    merchants_page=admin.call('GET','/admin/merchants/page?page=1&size=5&q='+urllib.parse.quote('验收文具店'))
    verify_page(merchants_page,'平台商户筛选')
    check(any(x['merchantId']==m for x in merchants_page['items']),'商户 q 在真实数据库过滤成功')
    owner.call('PUT',base+'/profile',{'name':'验收校园文具店','storeName':'西门文具店','location':'西门三楼'})
    refreshed=admin.call('GET','/admin/merchants/page?page=1&size=2&q='+urllib.parse.quote('验收校园文具店'))
    verify_page(refreshed,'平台商户改名后搜索')
    check(any(x['merchantId']==m and x['name']=='验收校园文具店' for x in refreshed['items']),
          '商户名称变更后 COUNT/分页一致')
    other.call('PUT',base+'/profile',{'name':'越权','storeName':'越权','location':'越权'},code='A0006')
    p=owner.call('POST',base+'/products',{'title':'考试黑色签字笔','description':'考试书写用黑色签字笔，适合复习记录','categoryCode':'stationery','imageUrl':'','skus':[{'specKey':'单支黑色','priceCent':500},{'specKey':'单支蓝色','priceCent':600}]})
    sku=p['skus'][0]['skuId'];product=p['productId'];stockkey=uuid.uuid4().hex
    owner.call('POST',base+'/stocks/'+sku+'/replenish',{'quantity':5},stockkey)
    owner.call('POST',base+'/stocks/'+sku+'/replenish',{'quantity':5},stockkey)
    owner.call('POST',base+'/stocks/'+sku+'/replenish',{'quantity':6},stockkey,code='G0003')
    stocks_page=owner.call('GET',base+'/stocks/page?page=1&size=1&q='+urllib.parse.quote('单支黑色'))
    verify_page(stocks_page,'库存规格名称搜索')
    check(any(x['skuId']==sku for x in stocks_page['items']), '库存 q 先匹配后分页')
    owner.call('POST',base+'/products/'+product+'/publish',{'published':True})
    p=buyer.call('GET','/products/'+product)
    check(next(s for s in p['skus'] if s['skuId']==sku)['available']==5,'重复补货不增加两次库存')
    other.call('PUT',base+'/products/'+product+'/skus/'+sku+'/price',{'priceCent':100,'expectedVersion':p['version']},code='A0006')
    invitation=owner.call('POST',base+'/invitations',{'username':users['clerk']['username']})
    clerk.call('POST','/invitations/'+invitation['id']+'/accept',{})
    clerk.call('POST','/invitations/'+invitation['id']+'/accept',{})
    clerk.call('PUT',base+'/products/'+product+'/skus/'+sku+'/price',{'priceCent':100,'expectedVersion':p['version']},code='A0006')

    def submit_order(client=buyer):
        detail=client.call('GET','/products/'+product);offer=next(x for x in detail['skus'] if x['skuId']==sku)
        body={'merchantId':m,'items':[{'skuId':sku,'quantity':1,'expectedPriceCent':offer['priceCent'],'expectedVersion':detail['version']}]}
        key=uuid.uuid4().hex;o=client.call('POST','/orders',body,key)
        check(o['orderId']==client.call('POST','/orders',body,key)['orderId'],'重复下单返回同一订单')
        return o
    buyer.call('PUT','/cart',{'skuId':sku,'quantity':1})
    cart=buyer.call('GET','/cart')
    check(any(x['skuId']==sku and x['merchantName']=='验收校园文具店' for x in cart),
          '购物车由后端返回商户名，前端无需缓存反查')
    order=submit_order();oid=order['orderId']
    order_page=admin.call('GET','/admin/orders/page?page=1&size=1&q='+urllib.parse.quote(oid[:8]))
    verify_page(order_page,'平台订单号搜索')
    check(any(x['orderId']==oid for x in order_page['items']), '订单号 q 服务端搜索可命中当前订单')
    order_title_page=owner.call('GET',base+'/orders/page?page=1&size=5&q='+urllib.parse.quote('考试黑色签字笔'))
    verify_page(order_title_page,'商户订单商品名搜索')
    check(any(x['orderId']==oid for x in order_title_page['items']), '订单商品名 q 查询命中真实订单')
    check(not any(i['skuId']==sku for i in buyer.call('GET','/cart')),'结算成功消费对应购物车数量')
    buyer.call('POST','/orders/'+oid+'/pay',{})
    buyer.call('POST','/orders/'+oid+'/pay',{})
    clerk.call('POST',base+'/orders/'+oid+'/prepare',{})
    clerk.call('POST',base+'/orders/'+oid+'/ready',{})
    stale=buyer.call('POST','/orders/'+oid+'/pickup-token',{})
    token=buyer.call('POST','/orders/'+oid+'/pickup-token',{})
    clerk.call('POST',base+'/orders/'+oid+'/verify',{'token':stale['token']},code='F0001')
    completed=clerk.call('POST',base+'/orders/'+oid+'/verify',{'token':token['token']})
    clerk.call('POST',base+'/orders/'+oid+'/verify',{'token':token['token']})
    check(completed['status']=='COMPLETED','真实HTTP支付、备货、核销闭环完成')
    stock=next(x for x in owner.call('GET',base+'/stocks') if x['skuId']==sku)
    check(stock['onHand']==4 and stock['reserved']==0,'重复核销没有重复出库')

    refund=submit_order()['orderId'];buyer.call('POST','/orders/'+refund+'/pay',{})
    buyer.call('POST','/orders/'+refund+'/refunds',{'reason':'未提货申请退款'})
    owner.call('POST',base+'/orders/'+refund+'/refund-decision',{'approved':True,'reason':'同意整单模拟退款'})
    owner.call('POST',base+'/orders/'+refund+'/refund-decision',{'approved':True,'reason':'同意整单模拟退款'})
    check(buyer.call('GET','/orders/'+refund)['status']=='REFUNDED','未提货退款完成')

    disputed=submit_order()['orderId'];buyer.call('POST','/orders/'+disputed+'/pay',{})
    buyer.call('POST','/orders/'+disputed+'/refunds',{'reason':'平台裁决回归'})
    for approved in (True,False):
        admin.call('POST','/admin/orders/'+disputed+'/refund-decision',{'approved':approved,'reason':'不能跳过申诉'},code='T0004')
    owner.call('POST',base+'/orders/'+disputed+'/refund-decision',{'approved':False,'reason':'商户驳回'})
    owner.call('POST',base+'/orders/'+disputed+'/refund-decision',{'approved':False,'reason':'商户重复驳回'})
    admin.call('POST','/admin/orders/'+disputed+'/refund-decision',{'approved':True,'reason':'尚未申诉'},code='T0004')
    buyer.call('POST','/orders/'+disputed+'/appeal',{})
    owner.call('POST',base+'/orders/'+disputed+'/refund-decision',{'approved':True,'reason':'争议中商户无权裁决'},code='A0006')
    for _ in range(2):
        admin.call('POST','/admin/orders/'+disputed+'/refund-decision',{'approved':True,'reason':'平台裁决同意'})
    check(buyer.call('GET','/orders/'+disputed)['status']=='REFUNDED','申诉后平台裁决及重复请求完成')

    stock=next(x for x in owner.call('GET',base+'/stocks') if x['skuId']==sku)
    check(stock['onHand']==4 and stock['reserved']==0,'重复退款只释放一次预占')
    cancel=submit_order()['orderId'];buyer.call('POST','/orders/'+cancel+'/cancel',{})
    check(buyer.call('GET','/orders/'+cancel)['status']=='CANCELED','未付款取消完成')

    # 两个不同的真实用户抢同一份库存；不是用 FakeRepository 模拟。
    scarce=owner.call('POST',base+'/products',{'title':'并发测试限量文具','description':'仅用于测试最后一件库存','categoryCode':'stationery','imageUrl':'','skus':[{'specKey':'限量','priceCent':900}]})
    only=scarce['skus'][0]['skuId'];pid=scarce['productId']
    owner.call('POST',base+'/stocks/'+only+'/replenish',{'quantity':1},uuid.uuid4().hex)
    owner.call('POST',base+'/products/'+pid+'/publish',{'published':True});offer=buyer.call('GET','/products/'+pid)
    command={'merchantId':m,'items':[{'skuId':only,'quantity':1,'expectedPriceCent':900,'expectedVersion':offer['version']}]}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs=[pool.submit(c.call,'POST','/orders',command,uuid.uuid4().hex,None) for c in (buyer,other)]
        responses=[j.result() for j in jobs]
    check(sorted(r['code'] for r in responses)==['0000','I0001'],'最后一件库存只有一位真实用户下单成功')
    for c,response in zip((buyer,other),responses):
        if response['code']=='0000':c.call('POST','/orders/'+response['data']['orderId']+'/cancel',{})

    if not args.skip_ai:
        def document(visibility,title,text):
            b=owner.call('POST','/knowledge/bases',{'merchantId':m,'name':title,'visibility':visibility})
            d=owner.call('POST','/knowledge/bases/'+b['id']+'/documents',{'title':title,'filename':'rules.md','contentType':'text/markdown','base64':base64.b64encode(text.encode()).decode()})
            check(d['indexStatus']=='READY','文档经真实Python接口建立索引')
            owner.call('POST','/knowledge/documents/'+d['id']+'/publish',{})
            return d
        public=document('PUBLIC','文具店自提规则','考试签字笔可在西门三楼文具店自提。营业时间每天九点至二十一点，付款后等待备货。')
        secret='内部采购口令_'+uuid.uuid4().hex
        private=document('MERCHANT_INTERNAL','内部采购资料',secret)
        buyer.call('GET','/knowledge/documents/'+private['id'],code='A0006')
        refund_doc=document('PUBLIC','考试黑色签字笔退款说明','考试黑色签字笔退款请打开订单详情，选择申请售后并填写原因。')
        spec_reply=buyer.call('POST','/ai/chat',{'question':'考试黑色签字笔要单支黑色大杯'})
        check(not spec_reply['proposal'] and '规格' in spec_reply['answer'],'真实Java/Python组合规格不能忽略未知大杯')
        refund_reply=buyer.call('POST','/ai/chat',{'question':'这款考试黑色签字笔怎么申请退款？'})
        check(not refund_reply['proposal'],'真实退款知识问答不会因商品召回创建提案')
        check('申请售后' in refund_reply['answer'] and any(c['documentId']==refund_doc['id'] for c in refund_reply['citations']),'真实Java/Python退款知识正文和引用未被报价覆盖')
        reply=buyer.call('POST','/ai/chat',{'question':'预算12元买两支考试黑色签字笔，几点自提？'})
        check(reply['mode'] in {'LOCAL_RETRIEVAL_DEMO','LOCAL_FALLBACK','LLM'},'导购明确声明实际运行模式')
        check(secret not in reply['answer'] and all(c['documentId']!=private['id'] for c in reply['citations']),'普通买家回答及引用不包含商户内部资料')
        check(reply['proposal'] and reply['proposal']['items'],'有真实商品的待确认提案')
        proposal=reply['proposal'];selected=[i['skuId'] for i in proposal['items']]
        other.call('POST','/ai/proposals/'+proposal['id']+'/confirm',{'selectedSkuIds':selected},code='G0001')
        buyer.call('POST','/ai/proposals/'+proposal['id']+'/confirm',{'selectedSkuIds':selected})
        before=buyer.call('GET','/cart')
        buyer.call('POST','/ai/proposals/'+proposal['id']+'/confirm',{'selectedSkuIds':selected})
        check(before==buyer.call('GET','/cart'),'重复确认提案不会重复加购')
        owner.call('POST','/knowledge/documents/'+public['id']+'/withdraw',{})
        history=buyer.call('GET','/ai/conversations/'+reply['conversationId']+'/messages')
        check(any('已隐藏' in x['content'] for x in history if x['role']=='assistant'),'撤回文档后相关历史回答被隐藏')
    else:
        RESULTS.append({'check':'Java/Python知识与导购联调','status':'SKIPPED','reason':'显式 --skip-ai'})

    owner.call('DELETE',base+'/members/'+users['clerk']['id'])
    clerk.call('GET',base+'/stocks',code='A0006')
    check(any(x['productId']==product for x in admin.call('GET','/admin/products?size=100')),'平台监管列表可查看商品')
    admin.call('POST','/admin/products/'+product+'/unpublish',{})
    buyer.call('GET','/products/'+product,code='C0001')
    buyer.logout()
    print('真实HTTP验收完成；测试账号、商户和订单保留在本地库，未输出凭据。')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url',default='http://127.0.0.1:8091')
    parser.add_argument('--env-file',type=Path,default=ROOT/'.env')
    parser.add_argument('--skip-ai',action='store_true',help='只测交易，会在结果中明确标为部分通过')
    parser.add_argument('--check-contract',action='store_true',help='使用 jsonschema 逐条核对真实响应与当前 OpenAPI')
    parser.add_argument('--output',type=Path,default=ROOT/'docs/testing/evidence/full-http.json')
    args=parser.parse_args();started=datetime.datetime.now(datetime.timezone.utc).isoformat();error=None
    global CONTRACT
    if args.check_contract:
        CONTRACT=json.loads((ROOT/'docs/api/openapi.json').read_text('utf-8'))
    try:run(args)
    except Exception as e:error=str(e);print('真实验收未通过：',error,file=sys.stderr)
    report={'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'REAL_HTTP','status':'FAILED' if error else 'PARTIAL' if args.skip_ai else 'PASS','error':error,'checks':RESULTS,'realJavaMySqlTested':bool(RESULTS),'externalLlmConfigured':'由实际响应 mode 判断，不从本报告推断'}
    report['contractValidation']={'enabled':args.check_contract,'responsesChecked':len(CONTRACT_RESPONSES),
                                  'openapiSha256':hashlib.sha256((ROOT/'docs/api/openapi.json').read_bytes()).hexdigest() if args.check_contract else None}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('检查项：',len(RESULTS),'；报告：',args.output)
    if error:raise SystemExit(1)

if __name__=='__main__':main()
