from browser_transport import track_bindings, close_page, close_browser
#!/usr/bin/env python3
"""真实 Chromium + Vue 表单限制回归；后端为显式接口替身，非全栈验收。"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from playwright.sync_api import sync_playwright, expect
from ui_three_pages import render, BackendContractDouble, ERRORS

ROOT = Path(__file__).resolve().parents[2]
SCHEMAS = json.loads((ROOT/'docs/api/openapi.json').read_text('utf-8'))['components']['schemas']
OUTPUT = ROOT/'docs/testing/evidence/audit-20261029/frontend.json'


def main():
    checks = []
    try:
        with sync_playwright() as p:
            options = {'headless': True, 'args': ['--no-sandbox']}
            executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
            if executable:
                options['executable_path'] = executable
            browser = p.chromium.launch(**options)
            fixture = BackendContractDouble()
            page = render(browser, '/', False, fixture=fixture)
            page.locator('.header-login').click()
            expect(page.locator('#login-name')).to_have_attribute('maxlength',
                str(SCHEMAS['RegisterRequestDTO']['properties']['username']['maxLength']))
            page.locator('.login-switch').click()
            expect(page.locator('#login-display')).to_have_attribute('maxlength',
                str(SCHEMAS['RegisterRequestDTO']['properties']['displayName']['maxLength']))
            page.locator('#login-display').fill('测'*50)
            assert len(page.locator('#login-display').input_value()) == 50
            checks.append('username 32 and display name 50 match OpenAPI in compiled Vue')
            close_page(page)
            fixture.logged = True
            page = render(browser, '/apply', False, fixture=fixture)
            expect(page.get_by_label('联系人', exact=True)).to_have_attribute('maxlength',
                str(SCHEMAS['SubmitMerchantApplicationRequestDTO']['properties']['contactName']['maxLength']))
            checks.append('merchant contact name limited to database/API length 50')
            close_page(page)
            page = render(browser, '/admin/categories', False, (1448, 1000), fixture)
            for index, field in enumerate(('code', 'name')):
                expect(page.locator('.ops-sideform input').nth(index)).to_have_attribute('maxlength',
                    str(SCHEMAS['CategoryRequestDTO']['properties'][field]['maxLength']))
            checks.append('category code 32 and name 50 match OpenAPI')
            close_page(page)
            assert not ERRORS, ERRORS
            subprocess.run([sys.executable, str(ROOT/'scripts/build-ui-bundle.py'), '--check'], cwd=ROOT, check=True)
            checks.append('Spring static and editable frontend artifacts match')
            close_browser(browser)
    finally:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps({'status': 'PASS' if len(checks) == 4 and not ERRORS else 'FAIL',
            'testType': 'REAL_CHROMIUM_WITH_EXPLICIT_API_DOUBLE', 'checks': checks,
            'browserErrors': ERRORS, 'realJavaMySqlTested': False}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('PASS', len(checks), 'frontend audit checks')


if __name__ == '__main__':
    main()
