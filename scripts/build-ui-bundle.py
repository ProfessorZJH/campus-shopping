#!/usr/bin/env python3
"""离线将多页面 Vue 组件预编译为同源 JavaScript，不需要网络和 npm。
源文件仍然是 frontend/src 下的可维护模块，可另使用 Vite 开发。
"""
import re
import posixpath
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
UI=ROOT/'frontend'
SRC=UI/'src'
MODULES=['services/demo.js','services/api.js','services/store.js','services/pages-demo.js','services/page-utils.js','components/Icon.js','components/ProductImage.js','components/ProductImageField.js','components/AuthDialog.js','components/ConsumerShell.js','components/BackofficeShell.js','pages/Home.js','pages/Guide.js','pages/Merchant.js','pages/ProductDetail.js','pages/Shop.js','pages/Cart.js','pages/Orders.js','pages/Account.js','pages/MerchantOps.js','pages/Knowledge.js','pages/Platform.js','pages/RoleManager.js']
MOD={path:'M_'+re.sub(r'[^a-zA-Z0-9_]', '_', path) for path in MODULES+['main.js']}
IMPORT=re.compile(r'^import\s+(.+?)\s+from\s+[\'\"]([^\'\"]+)[\'\"];?\s*$',re.M)

def transformed(path,text):
    prefix=[]
    def replace_import(match):
        name,relative=match.groups()
        target=posixpath.normpath(posixpath.join(posixpath.dirname(path),relative))
        if target not in MOD:raise ValueError(f'未知导入 {path}: {target}')
        local='const '+name+' = '+MOD[target] if name.startswith('{') else 'const '+name+' = '+MOD[target]+'.default'
        prefix.append(local+';')
        return ''
    text=IMPORT.sub(replace_import,text)
    exports=[]
    for pat in [r'^export\s+const\s+([a-zA-Z_$][\w$]*)',r'^export\s+async\s+function\s+([a-zA-Z_$][\w$]*)',r'^export\s+function\s+([a-zA-Z_$][\w$]*)']:
        exports.extend(re.findall(pat,text,re.M))
    text=re.sub(r'^export\s+(?=(?:const|async function|function)\s+)', '',text,flags=re.M)
    if re.search(r'^export\s+default\b',text,re.M):
        exports.append('default:__default')
        text=re.sub(r'^export\s+default\b','const __default =',text,count=1,flags=re.M)
    return '\n'.join(prefix)+'\n'+text, exports

def module_js(path,compile_mode=False,render=None):
    source=(SRC/path).read_text('utf-8')
    code,exports=transformed(path,source)
    if path=='main.js' and compile_mode:
        code=code.split('const app=createApp(App);')[0]
        exports=['App']
    if path=='main.js' and render:
        code=code.replace('const app=createApp(App);','App.render='+render+';\nconst app=createApp(App);')
    mapping=','.join(exports)
    if not compile_mode and path=='main.js':mapping=''
    return f'const {MOD[path]} = (()=>{{\n{code}\nreturn {{{mapping}}};\n}})();\n'

def build():
    modules='var _Vue = Vue;\n'+'\n'.join(module_js(path) for path in MODULES)
    stages=modules+'\n'+module_js('main.js',compile_mode=True)
    intermediate=UI/'_ui_compiler_stage.tmp.js'
    intermediate.write_text(stages,encoding='utf-8')
    path='/usr/bin/chromium'
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(headless=True,executable_path=path,args=['--no-sandbox'])
            page=b.new_page()
            page.set_content('<html><body></body></html>')
            page.add_script_tag(path=str(UI/'vendor/vue.global.prod.js'))
            page.add_script_tag(path=str(intermediate))
            compiled=page.evaluate('''() => {
                const parts=[M_components_ProductImage_js.default,M_components_ProductImageField_js.default,M_components_AuthDialog_js.default,M_components_ConsumerShell_js.default,M_components_BackofficeShell_js.default,M_pages_Home_js.default,M_pages_Guide_js.default,M_pages_Merchant_js.default,M_pages_ProductDetail_js.default,M_pages_Shop_js.default,M_pages_Cart_js.default,M_pages_Orders_js.default,M_pages_Account_js.default,M_pages_MerchantOps_js.default,M_pages_Knowledge_js.default,M_pages_Platform_js.default,M_pages_RoleManager_js.default,M_main_js.App];
                return parts.map(c=>Vue.compile(c.template,{hoistStatic:false,cacheHandlers:false}).toString());
            }''')
            b.close()
    finally:
        intermediate.unlink(missing_ok=True)
    assignments='\n'.join(f'{obj}.render={fn};' for obj,fn in zip(['M_components_ProductImage_js.default','M_components_ProductImageField_js.default','M_components_AuthDialog_js.default','M_components_ConsumerShell_js.default','M_components_BackofficeShell_js.default','M_pages_Home_js.default','M_pages_Guide_js.default','M_pages_Merchant_js.default','M_pages_ProductDetail_js.default','M_pages_Shop_js.default','M_pages_Cart_js.default','M_pages_Orders_js.default','M_pages_Account_js.default','M_pages_MerchantOps_js.default','M_pages_Knowledge_js.default','M_pages_Platform_js.default','M_pages_RoleManager_js.default'],compiled[:-1]))
    bundle='/* 本脚本由 scripts/build-ui-bundle.py 预编译，无需 unsafe-eval。 */\n'+modules+'\n'+assignments+'\n'+module_js('main.js',render=compiled[-1])
    output=UI/'ui.bundle.js'
    output.write_text(bundle,encoding='utf-8')
    (UI/'offline.html').write_text('''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>青柠校园 · Campus Market</title><link rel="stylesheet" href="./src/styles/app.css"></head><body><div id="app"></div><script src="./vendor/vue.global.prod.js"></script><script src="./ui.bundle.js"></script></body></html>''',encoding='utf-8')
    print('预编译成功',output.name,output.stat().st_size,f'字节；{len(compiled)}个模板（含根组件），不依赖npm')
if __name__=='__main__':build()
