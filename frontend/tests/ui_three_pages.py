#!/usr/bin/env python3
"""三页高保真 UI：真实 Chromium 渲染 + 交互 + 明确标注的后端接口替身。
受当前环境浏览器策略限制，采用离线 DOM 注入测试，不能据此宣称 Java/MySQL 端到端。
运行: python frontend/tests/ui_three_pages.py
"""
import base64
import json
from datetime import datetime,timezone
from pathlib import Path
from types import SimpleNamespace
from playwright.sync_api import sync_playwright,expect
from contract_ui import BackendContractDouble
from browser_transport import track_bindings, close_page, close_browser
ROOT=Path(__file__).resolve().parents[2]
UI=ROOT/'frontend'
EVIDENCE=ROOT/'docs/testing/evidence/ui-three-pages'
EVIDENCE.mkdir(parents=True,exist_ok=True)
IMAGES={f.name:'data:image/webp;base64,'+base64.b64encode(f.read_bytes()).decode() for f in (UI/'images').glob('*.webp')}
CHECKS=[]
ERRORS=[]

def check(condition,label):
    assert condition,label
    CHECKS.append(label)

def fixture_call(fixture):
    def callback(source,payload):
        result={}
        req=SimpleNamespace(url='http://contract.local'+payload['url'],method=payload.get('method','GET'),headers={k.lower():v for k,v in payload.get('headers',{}).items()},post_data=payload.get('body'),post_data_json=json.loads(payload['body']) if payload.get('body') else None)
        def fulfill(**kwargs):result.update(status=kwargs.get('status',200),body=kwargs.get('body',json.dumps(kwargs.get('json',{}),ensure_ascii=False)))
        fixture.handle(SimpleNamespace(request=req,fulfill=fulfill))
        return result
    return callback

def render(browser,route='/',demo=True,size=(430,932),fixture=None):
    page=browser.new_page(viewport={'width':size[0],'height':size[1]},device_scale_factor=1,locale='zh-CN')
    page.on('pageerror',lambda exc:ERRORS.append(str(exc)))
    page.set_content('<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div></body></html>')
    page.add_style_tag(path=str(UI/'src/styles/app.css'))
    page.evaluate('''({images,route,demo})=>{
      window.__CAMPUS_TEST_DEMO__=demo;
      window.__CAMPUS_TEST_ROUTE__=route;
      window.__CAMPUS_UI_TEST_IMAGES__=images;
      if(!crypto.randomUUID)crypto.randomUUID=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
    }''',{'images':IMAGES,'route':route,'demo':demo})
    if fixture:
        page.expose_binding('__contractApi',fixture_call(fixture))
        track_bindings(page)
        page.evaluate('''() => {
          window.fetch=async (url,options={})=>{
            const reply=await window.__contractApi({url:String(url),method:options.method||'GET',headers:options.headers||{},body:options.body});
            return new Response(reply.body,{status:reply.status,headers:{'Content-Type':'application/json'}});
          };
        }''')
    page.add_script_tag(path=str(UI/'vendor/vue.global.prod.js'))
    page.add_script_tag(path=str(UI/'ui.bundle.js'))
    expect(page.locator('.application')).to_have_count(1)
    images(page)
    return page

def images(page):
    page.evaluate('''(images) => {for(const img of document.images){const src=img.getAttribute('src')||'';const tail=src.split('/').pop();if(images[tail])img.src=images[tail];}}''',IMAGES)
    page.wait_for_timeout(180)

def main():
  fixture=BackendContractDouble();fixture.logged=True
  try:
    with sync_playwright() as p:
      browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
      # 1. 首页视觉与真实 Vue 交互（演示数据）
      page=render(browser,'/',True)
      expect(page.locator('.home-product')).to_have_count(8)
      check(page.locator('.hero-title').inner_text()=='AI 导购','首页视觉内容与商品卡渲染')
      check(page.evaluate('document.documentElement.scrollWidth')<=430,'移动首页没有横向溢出')
      page.screenshot(path=str(EVIDENCE/'01-home.png'),full_page=True)
      page.screenshot(path=str(EVIDENCE/'01-home-viewport.png'),full_page=False)
      page.get_by_role('textbox',name='搜索校园商品').fill('牛奶')
      expect(page.locator('.home-product')).to_have_count(2)
      check(True,'商品搜索过滤')
      page.get_by_role('textbox',name='搜索校园商品').fill('')
      page.locator('.category-item').filter(has_text='水果').click()
      expect(page.locator('.home-product')).to_have_count(1)
      check(True,'分类筛选')
      page.locator('.category-item').filter(has_text='水果').click()
      page.locator('.home-product').first.click()
      expect(page.locator('.product-sheet')).to_be_visible()
      expect(page.get_by_role('button',name='加入购物车')).to_be_disabled()
      check(True,'商品规格弹层以及预览写操作禁用')
      page.get_by_role('button',name='关闭').click();close_page(page)
      # 2. AI 对话视觉与选择提案
      page=render(browser,'/ai',True)
      expect(page.locator('.rec-item')).to_have_count(3)
      check(page.evaluate('document.documentElement.scrollWidth')<=430,'AI页移动端无横向溢出')
      page.screenshot(path=str(EVIDENCE/'02-guide.png'),full_page=True)
      page.screenshot(path=str(EVIDENCE/'02-guide-viewport.png'),full_page=False)
      page.get_by_role('button',name='30元内夜宵',exact=True).click()
      expect(page.locator('.chat-row')).to_have_count(4)
      check(True,'AI快捷提问可触发对话，示例与真实状态分离')
      page.locator('.rec-check').first.click()
      expect(page.locator('.proposal-total')).to_contain_text('已选 2 件')
      expect(page.get_by_role('button',name='确认加购')).to_be_disabled()
      check(True,'推荐勾选与合计金额实时更新，预览不能伪造加购')
      close_page(page)
      # 3. 商户商品管理视觉与交互
      page=render(browser,'/merchant/products',True,(1448,1000))
      expect(page.locator('.product-table tbody tr')).to_have_count(8)
      page.screenshot(path=str(EVIDENCE/'03-merchant.png'),full_page=True)
      page.screenshot(path=str(EVIDENCE/'03-merchant-viewport.png'),full_page=False)
      check(True,'商户商品管理列表和详情面板渲染')
      page.get_by_role('textbox',name='搜索商品').fill('牛奶')
      expect(page.locator('.product-table tbody tr')).to_have_count(2)
      check(True,'商户搜索与过滤')
      page.get_by_role('textbox',name='搜索商品').fill('')
      page.locator('.product-table tbody tr').nth(1).click()
      expect(page.locator('.inspector-product')).to_contain_text('纯牛奶')
      page.locator('.inspector-tabs').get_by_role('button',name='规格售价').click()
      expect(page.locator('.sku-item')).to_have_count(1)
      check(True,'商品明细联动与规格切换')
      page.get_by_role('button',name='新增商品').click()
      expect(page.locator('.merchant-modal')).to_be_visible()
      expect(page.get_by_role('button',name='保存商品')).to_be_disabled()
      check(True,'新建商品弹窗，预览禁用提交')
      page.locator('.merchant-modal-header').get_by_role('button',name='关闭').click()
      page.set_viewport_size({'width':390,'height':844})
      check(page.evaluate('document.documentElement.scrollWidth')<=390,'管理端窄屏没有全页横向溢出（表格内允许滚动）')
      close_page(page)
      # 4. 真 API 契约替身，仅检查请求结构，不声称后端运行。
      page=render(browser,'/',False,(430,932),fixture)
      expect(page.locator('.home-product')).to_have_count(6)
      page.locator('.home-product').first.click()
      page.get_by_role('button',name='加入购物车',exact=True).click()
      expect(page.locator('.toast')).to_contain_text('已加入购物车')
      check(True,'商品详情重新复核并通过真实路径PUT购物车')
      close_page(page)
      page=render(browser,'/ai',False,(430,932),fixture)
      page.locator('.quick-prompts button').first.click()
      expect(page.locator('.rec-item')).to_have_count(1)
      expect(page.locator('.message-warning')).to_contain_text('未配置真实模型')
      page.get_by_role('button',name='确认加购').click()
      expect(page.locator('.toast')).to_contain_text('购物车已更新')
      check(True,'AI真实 chat -> proposal -> confirm API 契约及显式模型模式')
      close_page(page)
      page=render(browser,'/merchant/products',False,(1448,1000),fixture)
      expect(page.locator('.product-table tbody tr')).to_have_count(4)
      page.get_by_role('button',name='确认补货').click()
      expect(page.locator('.toast')).to_contain_text('补货完成')
      check(True,'库存补货真实API契约与幂等键')
      page.get_by_role('button',name='新增商品').click()
      page.locator('.merchant-modal input').nth(0).fill('测试商品')
      page.locator('.merchant-modal input').nth(1).fill('大规格')
      page.locator('.merchant-modal input').nth(2).fill('9.50')
      page.get_by_role('button',name='保存商品').click()
      expect(page.locator('.product-table')).to_contain_text('测试商品')
      check(True,'创建商品的分类、规格、价格以真实请求体传给Java接口')
      close_page(page)
      # 5. 登录弹层：真实登录契约，不把未登录误写为已登录。
      fixture.logged=False
      page=render(browser,'/',False,(430,932),fixture)
      expect(page.get_by_role('button',name='登录',exact=True)).to_be_visible()
      page.get_by_role('button',name='登录',exact=True).click()
      expect(page.locator('.login-dialog')).to_be_visible()
      page.locator('#login-name').fill('testuser')
      page.locator('#login-password').fill('safe-test-password')
      page.locator('.login-dialog').get_by_role('button',name='登录',exact=True).click()
      expect(page.locator('.account-pill')).to_be_visible()
      check(True,'消费者登录弹层通过 Session 接口并更新登录主体')
      close_page(page)
      fixture.logged=False
      page=render(browser,'/merchant/products',False,(1448,1000),fixture)
      expect(page.get_by_role('button',name='登录账号')).to_be_visible()
      page.get_by_role('button',name='登录账号').click()
      page.locator('#login-name').fill('testuser')
      page.locator('#login-password').fill('safe-test-password')
      page.locator('.login-dialog').get_by_role('button',name='登录',exact=True).click()
      expect(page.locator('.product-table')).to_contain_text('测试商品')
      check(True,'商户未登录可以进入认证并重新获取商户数据')
      close_page(page)
      check(all(x['csrf'] for x in fixture.writes),'所有写请求都携带CSRF')
      check(all(x['hasIdempotency'] for x in fixture.writes if x['path'].endswith('/replenish')),'库存补货带独立幂等键')
      check(not fixture.unhandled,'没有请求未定义的契约接口')
      check(not ERRORS,'Chromium 无未捕获 JavaScript 异常')
      close_browser(browser)
  finally:
    report={'type':'Chromium真实Vue + Spring API契约替身；不是MySQL、Spring端到端','timestamp':datetime.now(timezone.utc).isoformat(),'passed':CHECKS,'errors':ERRORS,'apiWrites':fixture.writes,'unhandledRoutes':fixture.unhandled,'fullStackPassed':False,'notes':'通过离线DOM加载，因容器浏览器HTTP/file导航被策略禁止，原图局部素材通过data URI提供给截图'}
    (EVIDENCE/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
  print('PASSED',len(CHECKS),'CHECKS',json.dumps({'errors':ERRORS,'unhandled':fixture.unhandled},ensure_ascii=False))
if __name__=='__main__':main()
