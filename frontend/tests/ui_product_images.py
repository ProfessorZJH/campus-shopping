#!/usr/bin/env python3
"""图片上传、预览、创建/修改商品及统一缺图：真实 Chromium + API 契约替身。
不代表已经执行 Java/MySQL 联调。
"""
import io
import re
from PIL import Image
from playwright.sync_api import sync_playwright,expect
from ui_three_pages import render,BackendContractDouble,ERRORS

def png_bytes():
    out=io.BytesIO();Image.new('RGB',(30,25),'#4acab8').save(out,format='PNG');return out.getvalue()

def set_file(page,buffer,filename='cover.png',mime='image/png'):
    page.locator('.merchant-modal input[type=file]').set_input_files({'name':filename,'mimeType':mime,'buffer':buffer})

checks=[]
with sync_playwright() as x:
    browser=x.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    # demo preview permits selection but cannot upload/save to backend
    demo=render(browser,'/merchant/products',True,(1448,1050))
    demo.get_by_role('button',name='新增商品').click()
    set_file(demo,png_bytes())
    expect(demo.locator('.merchant-modal .image-field-notice')).to_contain_text('仅本地预览')
    expect(demo.get_by_role('button',name='保存商品')).to_be_disabled()
    checks.append('design preview never uploads or saves')
    demo.locator('.merchant-modal-header').get_by_role('button',name='关闭').click()
    demo.close()

    fixture=BackendContractDouble();fixture.logged=True
    page=render(browser,'/merchant/products',False,(1448,1050),fixture)
    page.get_by_role('button',name='新增商品').click()
    # client rejects unsupported format and file >2MB without uploading
    set_file(page,b'<svg/>','unsafe.svg','image/svg+xml')
    expect(page.locator('.merchant-modal .image-field-error')).to_contain_text('JPG、PNG 或 GIF')
    expect(page.get_by_role('button',name='保存商品')).to_be_disabled()
    assert not fixture.uploaded_images
    checks.append('invalid type rejected before upload')
    set_file(page,b'X'*2000001,'large.png','image/png')
    expect(page.locator('.merchant-modal .image-field-error')).to_contain_text('2 MB')
    expect(page.get_by_role('button',name='保存商品')).to_be_disabled()
    assert not fixture.uploaded_images
    checks.append('oversized file rejected before upload')
    data=png_bytes()
    set_file(page,data)
    expect(page.locator('.merchant-modal .image-field-notice')).to_contain_text('上传成功')
    expect(page.get_by_role('button',name='保存商品')).to_be_enabled()
    assert fixture.uploaded_images[-1]['data']==data
    assert fixture.uploaded_images[-1]['contentType']=='image/png'
    assert fixture.writes[-1]['csrf'] and fixture.writes[-1]['path']=='/merchants/m1/images'
    checks.append('image bytes sent to authorized upload API with CSRF')
    page.locator('.merchant-modal input.admin-input').nth(0).fill('原创笔袋')
    page.locator('.merchant-modal input.admin-input').nth(1).fill('标准款')
    page.locator('.merchant-modal input.admin-input').nth(2).fill('12.50')
    page.get_by_role('button',name='保存商品').click()
    expect(page.locator('.product-table')).to_contain_text('原创笔袋')
    created=next(p for p in fixture.products if p['productId']=='p-created')
    assert created['imageUrl']=='/media/550e8400-e29b-41d4-a716-446655440000.png',created
    checks.append('product create persists uploaded imageUrl')
    # select created product and update hero image + title without losing original image reference
    page.locator('.product-table tbody tr').filter(has_text='原创笔袋').click()
    page.locator('.inspector-tabs').get_by_role('button',name='基本信息').click()
    expect(page.locator('.product-image-field')).to_have_count(1)
    page.locator('.inspector-body input[type=file]').set_input_files({'name':'edit.png','mimeType':'image/png','buffer':data})
    expect(page.locator('.inspector-body .image-field-notice')).to_contain_text('上传成功')
    page.locator('.inspector-body input.admin-input').first.fill('原创笔袋（新）')
    page.get_by_role('button',name='保存修改').click()
    expect(page.locator('.inspector-product')).to_contain_text('原创笔袋（新）')
    assert fixture.products[-1]['imageUrl']==created['imageUrl'] and fixture.products[-1]['version']==1
    checks.append('product edit stores imageUrl and uses expectedVersion')
    # Remove product image and persist empty URL
    page.locator('.inspector-tabs').get_by_role('button',name='基本信息').click()
    page.locator('.inspector-body').get_by_role('button',name='移除').click()
    page.get_by_role('button',name='保存修改').click()
    assert fixture.products[-1]['imageUrl']==''
    checks.append('remove image persists empty imageUrl')
    page.close()

    # Data with empty/broken image routes through a shared placeholder, rather than fake unrelated goods
    page=render(browser,'/',False,(430,932),fixture)
    expect(page.locator('.home-product')).to_have_count(6)
    expect(page.locator('.home-product img').first).to_have_attribute('src',re.compile(r'.*product-placeholder\.svg'))
    checks.append('home uses common no-image placeholder')
    page.close()
    page=render(browser,'/ai',False,(430,932),fixture)
    page.locator('.quick-prompts button').first.click()
    expect(page.locator('.rec-item')).to_have_count(1)
    expect(page.locator('.rec-item img').first).to_have_attribute('src',re.compile(r'.*product-placeholder\.svg'))
    checks.append('AI recommendation uses same product placeholder')
    page.close()
    # 验证同源 /media URL 实际能被 img 渲染，损坏链接转到本地占位。
    import io as _io
    from pathlib import Path
    photo=render(browser,'/',True,(430,932))
    photo.route('**/media/**',lambda route: route.fulfill(status=200,body=data,content_type='image/png') if route.request.url.endswith('550e8400-e29b-41d4-a716-446655440000.png') else route.fulfill(status=404,body=''))
    placeholder=Path(__file__).resolve().parents[1]/'public/images/product-placeholder.svg'
    photo.route('**/images/product-placeholder.svg',lambda route: route.fulfill(status=200,body=placeholder.read_bytes(),content_type='image/svg+xml'))
    photo.evaluate('''() => {const base=document.createElement('base');base.href='https://assets.fake/';document.head.prepend(base);M_services_store_js.store.products[0].imageUrl='/media/550e8400-e29b-41d4-a716-446655440000.png';}''')
    photo.wait_for_function("document.querySelector('.home-product img').naturalWidth===30")
    checks.append('published /media image loads as actual image in browser')
    photo.evaluate("M_services_store_js.store.products[0].imageUrl='/media/00000000-0000-0000-0000-000000000000.png'")
    photo.wait_for_function("document.querySelector('.home-product img').naturalWidth===320")
    expect(photo.locator('.home-product img').first).to_have_attribute('src','./images/product-placeholder.svg')
    checks.append('missing /media file falls back to placeholder')
    photo.close()
    assert not fixture.unhandled,fixture.unhandled
    assert not ERRORS,ERRORS
    browser.close()
print('PASSED',len(checks),'CHECKS',checks)
