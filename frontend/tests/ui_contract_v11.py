#!/usr/bin/env python3
import shutil
"""Chromium + 真实 Vue：验证服务端 q/total/分页在前端正确使用。

HTTP 后端为显式契约替身，不代表 Java/MySQL 实际验收。
"""
import json
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
from ui_three_pages import render, ERRORS
from contract_ui import BackendContractDouble


class FilteredBackend(BackendContractDouble):
    def __init__(self):
        super().__init__()
        self.logged = True
        self.seen = []
        self.shops = [
            {'merchantId':'m%03d'%i,'name':('搜索目标商户' if i==120 else '默认商户%03d'%i),
             'category':'文具','status':'ACTIVE','storeId':'s%03d'%i,'storeName':'东校区', 'location':'一食堂'}
            for i in range(125)
        ]
        self.applications = [
            {'applicationId':'a%03d'%i,'merchantName':('搜索目标入驻' if i==110 else '普通申请%03d'%i),
             'category':'便利店','contactName':'申请人','storeName':'校内门店','status':'SUBMITTED'}
            for i in range(125)
        ]
        self.orders = [
            {'orderId':'order%03d'%i,'merchantId':'m1','merchantName':'测试商户',
             'status':'PENDING_PAYMENT','totalCent':1200,'items':[{'title':'测试考试笔' if i==119 else '普通商品'}],
             'createdAt':'2026-10-28T08:00:00Z'}
            for i in range(125)
        ]

    def handle(self, route):
        req = route.request
        parsed = urlparse(req.url)
        path = parsed.path.removeprefix('/api/v1')
        args = parse_qs(parsed.query)
        candidate = {'/admin/merchants/page', '/admin/merchant-applications/page',
                     '/admin/orders/page', '/merchants/m1/orders/page'}
        if req.method == 'GET' and path in candidate:
            term = args.get('q', [''])[0].lower()
            if path == '/admin/merchants/page':
                rows = [r for r in self.shops if term in (r['merchantId']+' '+r['name']).lower()]
            elif path == '/admin/merchant-applications/page':
                rows = [r for r in self.applications if term in (r['applicationId']+' '+r['merchantName']).lower()]
            else:
                rows = [r for r in self.orders if term in (r['orderId']+' '+r['items'][0]['title']).lower()]
            state = args.get('state',[''])[0]
            if state: rows = [r for r in rows if r['status']==state]
            page = int(args.get('page',['1'])[0]); size = int(args.get('size',['20'])[0]); total = len(rows)
            self.seen.append((path,term,page,size,total))
            result = {'items':rows[(page-1)*size:page*size], 'page':page,'size':size,
                      'total':total,'hasNext':page*size<total}
            route.fulfill(status=200, json=self.data(result))
            return
        return super().handle(route)


checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for path, term, result in [
        ('/admin/merchants','搜索目标商户','搜索目标商户'),
        ('/admin/applications','搜索目标入驻','搜索目标入驻'),
        ('/admin/orders','测试考试笔','测试考试笔'),
    ]:
        f = FilteredBackend()
        page = render(browser,path,False,(1448,900),f)
        expect(page.locator('.ops-table tbody tr')).to_have_count(12)
        page.locator('.ops-search input').fill(term)
        expect(page.locator('.ops-table tbody tr')).to_have_count(1,timeout=12000)
        assert result in page.locator('.ops-table').inner_text(),(path,result)
        assert f.seen[-1][1] == term.lower() and f.seen[-1][4] == 1, f.seen
        assert f.seen[-1][2] == 1
        checks.append(path+' 远端跨页搜索与准确 total')
        page.close()
    assert not ERRORS,ERRORS
    browser.close()
print('PASSED',len(checks),'UI SEARCH CONTRACT CHECKS',json.dumps(checks,ensure_ascii=False))
