#!/usr/bin/env python3
"""预编译同源 Vue 模板。运行时无需 CDN、npm 下载或 unsafe-eval。
依赖：Python playwright 与本机 Chromium；本仓库已包含生成后的 render.js。
"""
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'campus-shopping-app/src/main/resources/static/assets'

def build():
    template = (ROOT / 'frontend/app.template.html').read_text(encoding='utf-8')
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    with sync_playwright() as p:
        options = {'headless': True, 'args': ['--no-sandbox']}
        if executable: options['executable_path'] = executable
        browser = p.chromium.launch(**options)
        page = browser.new_page()
        page.add_script_tag(path=str(ASSETS / 'vue.global.prod.js'))
        rendered = page.evaluate('t => Vue.compile(t, {hoistStatic:false, cacheHandlers:false}).toString()', template)
        browser.close()
    # 禁用静态提升，确保函数外没有遗漏的闭包常量。
    if '_hoisted_' in rendered:
        raise RuntimeError('编译结果包含外部提升常量，拒绝生成不完整渲染函数')
    target = ASSETS / 'render.js'
    target.write_text('/* 由 scripts/build-frontend.py 从中文界面模板生成，请勿手动编辑。 */\nvar _Vue = Vue;\nwindow.CampusRender = ' + rendered + ';\n', encoding='utf-8')
    print(f'Vue模板预编译成功: {target.relative_to(ROOT)} ({target.stat().st_size} bytes)')

if __name__ == '__main__':
    build()