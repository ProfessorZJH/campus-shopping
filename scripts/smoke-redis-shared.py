"""Real two-instance Redis regression; creates synthetic records only through local Java APIs."""
import argparse
import os
from urllib.parse import urlsplit
import urllib.error
import urllib.request
import copy
import importlib.util
import json
from pathlib import Path
import secrets
import sys
import uuid

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url',default='http://127.0.0.1:8091')
parser.add_argument('--secondary-base-url',default='http://127.0.0.1:8092')
parser.add_argument('--env-file',type=Path,default=ROOT/'.env')
parser.add_argument('--output',type=Path,default=ROOT/'docs/testing/evidence/redis-shared-http.json')
args=parser.parse_args()
for url in [args.base_url,args.secondary_base_url]:
    if urlsplit(url).hostname not in {'127.0.0.1','localhost','::1'}:parser.error('Only local test services are allowed')
if args.base_url.rstrip('/')==args.secondary_base_url.rstrip('/'):parser.error('Two distinct service endpoints are required')
spec=importlib.util.spec_from_file_location('smoke',ROOT/'scripts/smoke-full.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
out=args.output;out.parent.mkdir(parents=True,exist_ok=True)
report={'status':'RUNNING','testType':'TWO_REAL_JAVA_MYSQL_REDIS_INSTANCES','apiMockUsed':False,'checks':[],'testData':{}}
def save():out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def check(condition,name):
    report['checks'].append({'name':name,'status':'PASS' if condition else 'FAILED'});save()
    assert condition,name
def peer(client):
    other=s.Client(args.secondary_base_url)
    for cookie in client.jar:other.jar.set_cookie(copy.copy(cookie))
    import urllib.request
    other.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(other.jar));other.token=copy.deepcopy(client.token)
    return other
try:
    env=s.env_file(args.env_file);env.update({k:os.environ[k] for k in ['ADMIN_USERNAME','ADMIN_PASSWORD'] if k in os.environ});admin=s.Client(args.base_url);admin.login(env['ADMIN_USERNAME'],env['ADMIN_PASSWORD'])
    accounts={};clients={};suffix=uuid.uuid4().hex[:10]
    for role in ('owner','clerk','buyer'):
        c=s.Client(args.base_url);name='redis_'+role+'_'+suffix;password=secrets.token_urlsafe(24)
        user=c.call('POST','/auth/register',{'username':name,'password':password,'displayName':'Redis本地验收'+role})
        c.login(name,password);accounts[role]={'username':name,'password':password,'userId':user['userId']};clients[role]=c
    report['testData']['userIds']={k:v['userId'] for k,v in accounts.items()}
    owner,clerk,buyer=[clients[k] for k in ('owner','clerk','buyer')]
    b2=peer(buyer)
    check(b2.call('GET','/auth/me')['userId']==accounts['buyer']['userId'],'A登录后B识别同一Redis会话')
    b2.csrf();b2.call('POST','/auth/logout',{})
    buyer.call('GET','/auth/me',status=401,code='A0004')
    check(True,'B退出后A持有的旧Cookie立即失效')
    buyer.login(accounts['buyer']['username'],accounts['buyer']['password']);b2=peer(buyer)
    app=owner.call('POST','/merchant-applications',{'merchantName':'Redis验收专用店'+suffix,'category':'stationery','contactName':'本地验收','contactPhone':'13800000000','storeName':'Redis验收店','location':'本地测试区'},uuid.uuid4().hex)
    merchant=admin.call('POST','/admin/merchant-applications/'+app['applicationId']+'/review',{'approved':True,'reason':'Redis本地跨实例验收'})
    mid=merchant['merchantId'];base='/merchants/'+mid;report['testData']['merchantId']=mid
    invite=owner.call('POST',base+'/invitations',{'username':accounts['clerk']['username']});clerk.call('POST','/invitations/'+invite['id']+'/accept',{})
    c2=peer(clerk)
    role=owner.call('POST',base+'/rbac/roles',{'name':'Redis库存只读','permissions':['stock.read']})
    owner.call('PUT',base+'/rbac/members/'+accounts['clerk']['userId']+'/role',{'roleCode':role['code']})
    c2.call('GET',base+'/stocks');c2.call('GET',base+'/products',code='A0006')
    check(True,'B实时读取A授予的stock.read且拒绝product.read')
    owner.call('PUT',base+'/rbac/roles/'+role['code'],{'name':'Redis商品只读','permissions':['product.read']})
    c2.call('GET',base+'/stocks',code='A0006')
    check(True,'A撤回角色权限后B既有会话立即被拒绝')
    product=owner.call('POST',base+'/products',{'title':'Redis缓存验收签字笔'+suffix,'description':'本地跨实例展示缓存验收','categoryCode':'stationery','imageUrl':'','skus':[{'specKey':'黑色','priceCent':700}]})
    pid=product['productId'];sku=product['skus'][0]['skuId'];report['testData'].update(productId=pid,skuId=sku)
    owner.call('POST',base+'/stocks/'+sku+'/replenish',{'quantity':8},uuid.uuid4().hex)
    owner.call('POST',base+'/products/'+pid+'/publish',{'published':True})
    before=b2.call('GET','/products/'+pid)
    owner.call('PUT',base+'/products/'+pid+'/skus/'+sku+'/price',{'priceCent':800,'expectedVersion':before['version']})
    fresh=b2.call('GET','/products/'+pid)
    check(fresh['skus'][0]['priceCent']==800 and fresh['version']!=before['version'],'B展示已缓存商品时立即读取A修改后的价格版本')
    owner.call('POST',base+'/stocks/'+sku+'/replenish',{'quantity':3},uuid.uuid4().hex)
    check(b2.call('GET','/products/'+pid)['skus'][0]['available']==11,'B展示缓存不覆盖A补货后的实时库存')
    owner.call('POST',base+'/products/'+pid+'/publish',{'published':False})
    b2.call('GET','/products/'+pid,code='C0001')
    check(True,'A下架后B不能从展示缓存读取已下架商品')
    owner.call('DELETE',base+'/members/'+accounts['clerk']['userId'])
    c2.call('GET',base+'/stocks',code='A0006')
    check(True,'A撤销成员后B已登录会话权限实时失效')
    # Case-normalized account quota must be shared, even when each node sees only half the attempts.
    quota_clients=[s.Client(args.base_url),s.Client(args.secondary_base_url)]
    quota_name='quota_'+uuid.uuid4().hex[:16]
    report['quotaAttempts']=[]
    for client in quota_clients:client.csrf()
    for index in range(31):
        client=quota_clients[index%2]
        payload={'username':quota_name if index%2==0 else quota_name.upper(),'password':'synthetic-invalid-password'}
        request=urllib.request.Request(client.base+'/auth/login',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json',client.token['headerName']:client.token['token']},method='POST')
        try:response=client.opener.open(request,timeout=10)
        except urllib.error.HTTPError as error:response=error
        with response:
            body=json.load(response);retry=response.headers.get('Retry-After')
            report['quotaAttempts'].append({'attempt':index+1,'node':index%2,'http':response.status,'code':body.get('code'),'retryAfter':retry})
            if index<30:assert response.status==200 and body.get('code')=='A0002'
            else:assert response.status==429 and body.get('code')=='A0007' and int(retry)>0
    check(True,'跨实例共享规范化账号限额与Retry-After')
    report['status']='PASS'
except Exception as exc:
    report.update(status='FAILED',errorType=type(exc).__name__,safeError=str(exc) if isinstance(exc,AssertionError) else None);raise
finally:save()
print('Real local cross-instance checks passed:',len(report['checks']))
