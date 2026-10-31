#!/usr/bin/env python3
"""在用户授权的本地 campus_shopping 库准备真实联调数据并验收导购事务。

所有业务写入经过 Java API；不清表、不使用替身。账号密码仅写 var/local-live。
"""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
import secrets
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('full_smoke', ROOT/'scripts/smoke-full.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    config = smoke.env_file(ROOT/'.env')
    directory = ROOT/'var/local-live'
    evidence = ROOT/'docs/testing/evidence/local-live'
    evidence.mkdir(parents=True, exist_ok=True)
    state_path = directory/'shopping-accounts.json'
    admin = smoke.Client('http://127.0.0.1:8091')
    admin.login(config['ADMIN_USERNAME'], config['ADMIN_PASSWORD'])
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding='utf-8'))
    else:
        state = {'suffix':uuid.uuid4().hex[:8], 'users':{}, 'merchant':None}
    users = {}
    for role in ('owner','buyer','other','clerk'):
        client = smoke.Client('http://127.0.0.1:8091')
        if role not in state['users']:
            username = 'live_'+role+'_'+state['suffix']
            password = secrets.token_urlsafe(24)
            user = client.call('POST','/auth/register',{'username':username,'password':password,
                               'displayName':'真实联调'+role})
            state['users'][role] = {'username':username,'password':password,'userId':user['userId']}
            state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
        account=state['users'][role]
        client.login(account['username'],account['password'])
        users[role]=client
    owner,buyer,other,clerk=(users[k] for k in ('owner','buyer','other','clerk'))
    if not state['merchant']:
        application=owner.call('POST','/merchant-applications',{
            'merchantName':'真实联调校园茶饮店','category':'food','contactName':'验收经营者',
            'contactPhone':'13800000000','storeName':'图书馆茶饮店','location':'图书馆一层真实验收柜台'},uuid.uuid4().hex)
        merchant=admin.call('POST','/admin/merchant-applications/'+application['applicationId']+'/review',
                            {'approved':True,'reason':'本地真实业务验收'})
        state['merchant']=merchant
        state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
    mid=state['merchant']['merchantId'];base='/merchants/'+mid
    if not state.get('clerkInvited'):
        invite=owner.call('POST',base+'/invitations',{'username':state['users']['clerk']['username']})
        clerk.call('POST','/invitations/'+invite['id']+'/accept',{})
        state['clerkInvited']=True
        state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
    result={'testType':'REAL_JAVA_MYSQL_AI','apiMockUsed':False,'database':'campus_shopping',
            'merchantId':mid,'status':'RUNNING','checks':[]}
    def check(condition,name,**details):
        result['checks'].append({'name':name,'status':'PASS' if condition else 'FAILED',**details})
        if not condition:result['status']='FAILED'
        (evidence/'shopping-api.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        if not condition:raise AssertionError(name)
        print(json.dumps({'check':name,'status':'PASS'},ensure_ascii=True),flush=True)
    if args.prepare_only:
        check(True,'real_accounts_merchant_and_clerk_prepared')
        result['status']='PREPARED'
        (evidence/'shopping-api.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        return
    if not state.get('product'):
        raise RuntimeError('请先完成浏览器创建商品，私有 state 中需要 product/skuId')
    product=state['product'];pid=product['productId'];sku=state['skuId']
    state['apiBaselinePrice']=600
    detail=buyer.call('GET','/products/'+pid)
    offer=next(s for s in detail['skus'] if s['skuId']==sku)
    if offer['priceCent']!=600:
        owner.call('PUT',base+'/products/'+pid+'/skus/'+sku+'/price',{'priceCent':600,'expectedVersion':detail['version']})
    if not state.get('publicDocument'):
        def document(visibility,title,content):
            kb=owner.call('POST','/knowledge/bases',{'merchantId':mid,'name':title,'visibility':visibility})
            doc=owner.call('POST','/knowledge/bases/'+kb['id']+'/documents',{
                'title':title,'filename':'rules.md','contentType':'text/markdown',
                'base64':base64.b64encode(content.encode()).decode()})
            check(doc['indexStatus']=='READY','document_index_'+visibility)
            owner.call('POST','/knowledge/documents/'+doc['id']+'/publish',{})
            return doc
        state['publicDocument']=document('PUBLIC','真实联调茶饮自提规则',
            '真实联调校园茶饮店的无糖乌龙茶每天09:00到21:00在图书馆一层真实验收柜台自提，付款后等待商户备货。')
        sentinel='LOCAL-PRIVATE-'+uuid.uuid4().hex
        state['privateSentinel']=sentinel
        state['privateDocument']=document('MERCHANT_INTERNAL','真实联调内部交接资料',sentinel)
        state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
    # 业务写入后等待 Java 周期任务将真实商品同步至真实 Milvus；查询不生成本地替代向量。
    import logging
    logging.getLogger('pymilvus').setLevel(logging.CRITICAL)
    from pymilvus import MilvusClient
    client=MilvusClient(uri=config['MILVUS_URI'],token=config['MILVUS_TOKEN'],timeout=10)
    try:
        for attempt in range(45):
            if client.has_collection(collection_name=config['MILVUS_PRODUCT_COLLECTION']):
                rows=client.query(collection_name=config['MILVUS_PRODUCT_COLLECTION'],
                    filter='id in '+json.dumps([pid]),output_fields=['id','model'],consistency_level='Strong')
                if rows:break
            time.sleep(2)
        else:raise AssertionError('Java product sync did not index the real product')
        check(rows[0]['model']==config['EMBEDDING_MODEL'],'java_scheduled_sync_real_product_to_milvus',productId=pid)
    finally:client.close()
    question='预算20元买两瓶真实联调无糖乌龙茶，几点自提？'
    def ask():
        reply=buyer.call('POST','/ai/chat',{'question':question})
        check(reply['mode']=='LLM','remote_llm_and_java_proposal',mode=reply['mode'],
              retrievalMode=reply['retrievalMode'],proposalId=(reply.get('proposal') or {}).get('id'))
        proposal=reply.get('proposal')
        check(bool(proposal and proposal['items']) and any(i['skuId']==sku and i['quantity']==2 for i in proposal['items']),
              'trusted_catalog_quantity_and_budget',proposal=proposal)
        check(sum(i['priceCent']*i['quantity'] for i in proposal['items'])<=2000,'java_proposal_total_within_budget')
        check(state['privateSentinel'] not in reply['answer'] and all(c['documentId']!=state['privateDocument']['id'] for c in reply['citations']),
              'java_knowledge_acl_no_private_document',citations=reply['citations'])
        return reply
    before=buyer.call('GET','/cart')
    def cart_quantities(items):
        # GET /cart 按实时商品返回价格、版本和 sellable，回滚检查只比较持久化行及数量。
        return sorted((i['merchantId'],i['skuId'],i['quantity']) for i in items)
    reply=ask();p=reply['proposal'];selected=[i['skuId'] for i in p['items']]
    other.call('POST','/ai/proposals/'+p['id']+'/confirm',{'selectedSkuIds':selected},code='G0001')
    check(True,'other_user_cannot_confirm_proposal')
    buyer.call('POST','/ai/proposals/'+p['id']+'/confirm',{'selectedSkuIds':selected})
    after=buyer.call('GET','/cart')
    old=next((i['quantity'] for i in before if i['skuId']==sku),0)
    check(next(i['quantity'] for i in after if i['skuId']==sku)==old+2,'confirmed_proposal_persists_cart_quantity',beforeQuantity=old,afterQuantity=old+2)
    buyer.call('POST','/ai/proposals/'+p['id']+'/confirm',{'selectedSkuIds':selected})
    check(after==buyer.call('GET','/cart'),'repeat_confirmation_idempotent')
    fresh=ask()['proposal']
    detail=buyer.call('GET','/products/'+pid)
    try:
        owner.call('PUT',base+'/products/'+pid+'/skus/'+sku+'/price',{'priceCent':650,'expectedVersion':detail['version']})
        buyer.call('POST','/ai/proposals/'+fresh['id']+'/confirm',{'selectedSkuIds':[sku]},code='C0002')
        check(cart_quantities(after)==cart_quantities(buyer.call('GET','/cart')),
              'price_changed_rejects_without_cart_mutation')
    finally:
        detail=buyer.call('GET','/products/'+pid)
        owner.call('PUT',base+'/products/'+pid+'/skus/'+sku+'/price',{'priceCent':600,'expectedVersion':detail['version']})
    fresh=ask()['proposal']
    detail=buyer.call('GET','/products/'+pid);current=next(s for s in detail['skus'] if s['skuId']==sku)
    hold=other.call('POST','/orders',{'merchantId':mid,'items':[{'skuId':sku,'quantity':current['available'],
         'expectedPriceCent':600,'expectedVersion':detail['version']}]},uuid.uuid4().hex)
    try:
        buyer.call('POST','/ai/proposals/'+fresh['id']+'/confirm',{'selectedSkuIds':[sku]},code='I0001')
        check(cart_quantities(after)==cart_quantities(buyer.call('GET','/cart')),
              'stock_reserved_after_answer_rejects_confirmation')
    finally:other.call('POST','/orders/'+hold['orderId']+'/cancel',{})
    owner.call('POST',base+'/products/'+pid+'/publish',{'published':False})
    try:
        buyer.call('POST','/ai/proposals/'+fresh['id']+'/confirm',{'selectedSkuIds':[sku]},code='C0001')
        check(cart_quantities(after)==cart_quantities(buyer.call('GET','/cart')),
              'unpublished_product_rejects_confirmation')
    finally:owner.call('POST',base+'/products/'+pid+'/publish',{'published':True})
    state['lastApiConversationId']=reply['conversationId']
    state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
    result['status']='PASS';result['httpRequests']=len(smoke.RESULTS)
    (evidence/'shopping-api.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Real Java/MySQL/AI transaction acceptance passed; private login data in var/local-live.',flush=True)


if __name__=='__main__':
    main()
