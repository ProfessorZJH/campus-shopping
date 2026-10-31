from browser_transport import track_bindings, close_page, close_browser
#!/usr/bin/env python3
"""RBAC browser acceptance using the delivered compiled Vue UI and an explicit HTTP contract double.
NOT a Java/Spring/MySQL integration test. Run: python frontend/tests/ui_rbac_regression.py
"""
import copy
import json
import re
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from ui_fix_regression import TwoMerchantBackend, browser_page, ERRORS

PERMS={'dashboard.read':'经营统计','product.read':'查看商品','product.write':'管理商品及价格',
       'stock.read':'查看库存与流水','stock.replenish':'补货','order.read':'查看订单',
       'order.prepare':'备货','pickup.verify':'自提核销','aftersale.read':'查看售后',
       'aftersale.review':'审核售后','knowledge.read':'读取知识库','knowledge.manage':'管理知识库',
       'team.manage':'邀请和撤销成员','store.manage':'修改门店资料','role.manage':'角色与权限管理'}
BUILTIN=[{'code':'OWNER','name':'经营者','permissions':list(PERMS),'builtin':True},
         {'code':'CLERK','name':'店员','permissions':['product.read','stock.read','stock.replenish','order.read','order.prepare','pickup.verify'],'builtin':True}]
PROTECTED={'team.manage','store.manage','role.manage'}

class RoleBackend(TwoMerchantBackend):
    def __init__(self):
        super().__init__()
        self.custom={'m1':[],'m2':[]}
        self.members.append({'merchantId':'m1','userId':'u2','role':'CLERK','status':'ACTIVE'})
        self.user['userId']='u1'
        self.role_seq=0
        self.denied=[]
    def grants(self,m):
        if m['role']=='OWNER':return list(PERMS)
        if m['role']=='CLERK':return BUILTIN[1]['permissions']
        return next((r['permissions'] for r in self.custom[m['merchantId']] if r['code']==m['role']),[])
    def answer(self,route,value,code='0000',info='成功'):
        route.fulfill(status=200,json=self.data(value,code,info))
    def handle(self,route):
        request=route.request
        path=urlparse(request.url).path.removeprefix('/api/v1')
        method=request.method
        actor=self.user['userId']
        member=lambda mid: next((m for m in self.members if m['userId']==actor and m['merchantId']==mid and m['status']=='ACTIVE'),None)
        if path=='/workspace':
            mine=[m for m in self.members if m['userId']==actor and m['status']=='ACTIVE']
            mids={m['merchantId'] for m in mine}
            return self.answer(route,{'platformAdmin':actor=='u1','memberships':copy.deepcopy(mine),
                'merchantPermissions':{m['merchantId']:self.grants(m) for m in mine},
                'merchants':[s for s in self.shops if s['merchantId'] in mids]})
        r=re.fullmatch(r'/merchants/(m[12])/rbac(?:/(.*))?',path)
        if r:
            mid,rest=r.groups()
            if member(mid) is None or member(mid)['role']!='OWNER':
                self.denied.append((method,path))
                return self.answer(route,None,'A0003','无权限')
            if rest=='permissions' and method=='GET':
                return self.answer(route,[{'code':k,'label':v,'grantable':k not in PROTECTED} for k,v in PERMS.items()])
            if rest=='roles' and method=='GET':
                return self.answer(route,copy.deepcopy(BUILTIN+self.custom[mid]))
            if rest=='roles' and method=='POST':
                body=request.post_data_json
                self.role_seq+=1;code='R'+str(self.role_seq).zfill(12)
                new={'code':code,'name':body['name'],'permissions':body['permissions'],'builtin':False}
                self.custom[mid].append(new)
                return self.answer(route,copy.deepcopy(new))
            found=re.fullmatch(r'roles/(R[a-z0-9]{12})',rest or '')
            if found:
                code=found.group(1);item=next((x for x in self.custom[mid] if x['code']==code),None)
                if item is None:return self.answer(route,None,'G0001','不存在')
                if method=='PUT':
                    payload=request.post_data_json;item.update(name=payload['name'],permissions=payload['permissions']);return self.answer(route,copy.deepcopy(item))
                if method=='DELETE':
                    if any(m['role']==code and m['merchantId']==mid and m['status']=='ACTIVE' for m in self.members):return self.answer(route,None,'S0001','角色已有成员')
                    self.custom[mid].remove(item);return self.answer(route,None)
            change=re.fullmatch(r'members/(u\d+)/role',rest or '')
            if change and method=='PUT':
                target=next((m for m in self.members if m['userId']==change.group(1) and m['merchantId']==mid),None)
                if target is None or target['role']=='OWNER':return self.answer(route,None,'A0003','无权限')
                target['role']=request.post_data_json['roleCode'];return self.answer(route,None)
            return self.answer(route,None,'G0001','无对应操作')
        if re.fullmatch(r'/merchants/m[12]/members',path) and method=='GET':
            mid=path.split('/')[2]
            if member(mid) is None or member(mid)['role']!='OWNER':return self.answer(route,None,'A0003','无权限')
            return self.answer(route,[m.copy() for m in self.members if m['merchantId']==mid])
        if path=='/ai/conversations' and method=='GET':
            return self.answer(route,[{'id':'conversation-'+actor,'title':'只有'+actor+'的历史会话','createdAt':'2026-10-28T08:00:00Z'}])
        msg=re.fullmatch(r'/ai/conversations/(conversation-u\d+)/(messages|proposals)',path)
        if msg:
            conversation,kind=msg.groups()
            if conversation!='conversation-'+actor:return self.answer(route,None,'A0006','无权查看会话')
            return self.answer(route,[{'id':'msg-'+actor,'role':'assistant','content':actor+' 的私有 AI 回答'}] if kind=='messages' else [])
        if path=='/knowledge/bases' and method=='GET':
            allowed=[m['merchantId'] for m in self.members if m['userId']==actor and m['status']=='ACTIVE' and 'knowledge.read' in self.grants(m)]
            return self.answer(route,[b for b in self.bases if b['merchantId'] in allowed])
        return super().handle(route)

def check(cond,text):
    assert cond,text
    return text

def main():
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        f=RoleBackend()
        page=browser_page(browser,'/merchant/roles',f)
        expect(page.locator('.rbac-role')).to_have_count(2,timeout=15000)
        checks.append('Owner 可打开角色管理，默认 OWNER/CLERK 两个内置角色')
        expect(page.locator('.rbac-editor input[type=checkbox]:disabled')).to_have_count(15)
        checks.append('默认 Owner 权限只读、不可直接修改')
        page.get_by_role('button',name='新增自定义角色').click()
        page.locator('.rbac-editor input.admin-input').fill('商品运营')
        lock=page.locator('label.rbac-permission[data-permission="role.manage"]')
        assert lock.locator('input').is_disabled()
        role_grant=page.locator('label.rbac-permission[data-permission="product.write"]')
        role_grant.locator('input').check()
        assert page.locator('label.rbac-permission[data-permission="product.read"]').locator('input').is_checked()
        checks.append('新建角色时写入权限自动依赖读取权限，治理权限不可授予')
        page.get_by_role('button',name='保存角色').click()
        expect(page.locator('.rbac-role')).to_have_count(3,timeout=10000)
        assert f.custom['m1'][0]['permissions'] == ['product.read','order.read','product.write'] or set(f.custom['m1'][0]['permissions'])=={'product.read','order.read','product.write'}
        code=f.custom['m1'][0]['code']
        checks.append('新增角色已调用 RBAC POST，后端返回结果与界面一致')
        # Save role edit and verify changed permissions persist in contract double.
        page.locator('label.rbac-permission[data-permission="knowledge.read"]').locator('input').check()
        page.get_by_role('button',name='保存角色').click()
        expect(page.locator('.rbac-role')).to_have_count(3)
        checks.append(check('knowledge.read' in f.custom['m1'][0]['permissions'],'角色权限更新通过 PUT 生效'))
        # A given role cannot be reused in another merchant.
        page.locator('.topbar-merchant-select select').select_option('m2')
        expect(page.locator('.rbac-role')).to_have_count(2)
        checks.append(check(not f.custom['m2'],'m2 不会继承 m1 自定义角色'))
        page.locator('.topbar-merchant-select select').select_option('m1')
        expect(page.locator('.rbac-role')).to_have_count(3)
        close_page(page)
        # The owner changes a staff member's role, UI and endpoint use the same role code.
        page=browser_page(browser,'/merchant/team',f)
        expect(page.locator('.ops-list-line')).to_have_count(2,timeout=15000)
        page.locator('.ops-list-line').filter(has_text='u2').locator('select').select_option(code)
        page.wait_for_function("() => !!document.querySelector('.toast') && document.querySelector('.toast').textContent.includes('操作成功')")
        checks.append(check(next(m for m in f.members if m['userId']=='u2')['role']==code,'Owner 在店员管理中为成员分配自定义角色'))
        close_page(page)
        # Re-login as staff; live workspace yields custom grants, not Owner rights.
        f.user={'userId':'u2','username':'staff002','displayName':'商品运营','status':'ACTIVE'}
        page=browser_page(browser,'/merchant/products',f)
        expect(page.locator('.product-table tbody tr')).to_have_count(4,timeout=15000)
        nav=page.locator('.merchant-nav').inner_text()
        assert '角色权限' not in nav and '店员管理' not in nav and '门店设置' not in nav
        assert '商品管理' in nav and '库存管理' not in nav
        checks.append('自定义角色的前端导航严格按返回权限展示，不能访问 Owner 专属入口')
        page.evaluate("location.hash='/merchant/roles'")
        expect(page.locator('.access-denied')).to_contain_text('无权管理角色')
        checks.append('店员直接进入角色管理 URL 被页面级权限校验阻止')
        close_page(page)
        # One merchant's custom staff cannot read another merchant's internal knowledge.
        f.bases=[{'id':'kb-m1','merchantId':'m1','name':'m1 资料','visibility':'MERCHANT_INTERNAL'},
                 {'id':'kb-m2','merchantId':'m2','name':'m2 资料','visibility':'MERCHANT_INTERNAL'}]
        page=browser_page(browser,'/merchant/knowledge',f)
        expect(page.locator('.kb-base')).to_have_count(1,timeout=15000)
        assert 'm1 资料' in page.locator('.kb-list').inner_text() and 'm2 资料' not in page.locator('.kb-list').inner_text()
        checks.append('m1 自定义知识只读角色不能看到 m2 内部知识库')
        close_page(page)
        # AI history belongs to the authenticated user, not a cached merchant/account view.
        page=browser_page(browser,'/ai',f)
        page.locator('.ai-history-head button').click()
        expect(page.locator('.ai-history-list button')).to_have_count(1,timeout=15000)
        assert '只有u2的历史会话' in page.locator('.ai-history-list').inner_text()
        assert '只有u1' not in page.locator('.ai-history-list').inner_text()
        page.locator('.ai-history-list button').first.click()
        expect(page.locator('.chat-thread')).to_contain_text('u2 的私有 AI 回答')
        checks.append('AI 历史会话按登录主体读取，u2 不会获取 u1 的私有会话')
        close_page(page)
        f.user={'userId':'u1','username':'owner001','displayName':'经营者','status':'ACTIVE'}
        page=browser_page(browser,'/ai',f)
        page.locator('.ai-history-head button').click()
        expect(page.locator('.ai-history-list')).to_contain_text('只有u1的历史会话',timeout=15000)
        page.locator('.ai-history-list button').first.click()
        expect(page.locator('.chat-thread')).to_contain_text('u1 的私有 AI 回答')
        # Logout on the same Vue page must clear the local chat content immediately.
        page.locator('.account-pill').click()
        expect(page.locator('.home-product')).to_have_count(6,timeout=15000)
        expect(page.locator('body')).not_to_contain_text('u1 的私有 AI 回答',timeout=10000)
        checks.append('同一 AI 页面退出登录后清空上一账号的私有回答')
        close_page(page)
        # A read-only inventory role must see movements without gaining replenishment controls.
        f.logged=True
        f.user={'userId':'u2','username':'staff002','displayName':'库存查看员','status':'ACTIVE'}
        read_role='R000000000999'
        f.custom['m1'].append({'code':read_role,'name':'库存查看员','permissions':['stock.read'],'builtin':False})
        next(m for m in f.members if m['userId']=='u2' and m['merchantId']=='m1')['role']=read_role
        page=browser_page(browser,'/merchant/inventory',f)
        expect(page.locator('.ops-card.ops-sideform')).to_contain_text('库存流水',timeout=15000)
        expect(page.locator('.ops-card.ops-sideform .ops-list-line')).to_have_count(1,timeout=15000)
        assert page.get_by_role('button',name='确认补货').count()==0
        checks.append('仅 stock.read 的角色可查看库存流水但没有补货操作')
        close_page(page)
        # An /admin URL does not imply platform privileges.
        page=browser_page(browser,'/admin/knowledge',f)
        expect(page.locator('.access-denied')).to_contain_text('没有知识库查看权限',timeout=15000)
        assert page.get_by_role('button',name='新建知识库').count()==0
        checks.append('非平台管理员直接打开平台知识库 URL 时显示无权限且无管理操作')
        close_page(page)
        assert not ERRORS,ERRORS
        close_browser(browser)
    print('PASSED',len(checks),'RBAC BROWSER CONTRACT CHECKS',json.dumps(checks,ensure_ascii=False))

if __name__=='__main__':main()
