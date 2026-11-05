#!/usr/bin/env python3
"""图片上传、预览、创建/修改商品及统一缺图：真实 Chromium + API 契约替身。
不代表已经执行 Java/MySQL 联调。
"""
import re
import shutil
import struct
import zlib
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_three_pages import render,BackendContractDouble,ERRORS

def png_bytes():
    def chunk(kind, payload):
        return (struct.pack('>I', len(payload)) + kind + payload
                + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff))
    header = struct.pack('>IIBBBBB', 30, 25, 8, 2, 0, 0, 0)
    pixels = (b'\x00' + b'\x4a\xca\xb8' * 30) * 25
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
            + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b''))

def set_file(page,buffer,filename='cover.png',mime='image/png'):
    page.locator('.merchant-modal input[type=file]').set_input_files({'name':filename,'mimeType':mime,'buffer':buffer})

checks=[]
with sync_playwright() as x:
    browser=x.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    # demo preview permits selection but cannot upload/save to backend
    demo=render(browser,'/merchant/products',True,(1448,1050))
    demo.evaluate("() => { window.__imageRequests=0; window.fetch=()=>{window.__imageRequests++; return Promise.reject(new Error('unexpected request'));}; }")
    demo.get_by_role('button',name='新增商品').click()
    set_file(demo,png_bytes())
    expect(demo.locator('.merchant-modal .image-field-notice')).to_contain_text('仅本地预览')
    expect(demo.locator('.merchant-modal .product-image-tile img')).to_have_attribute('src',re.compile(r'^blob:'))
    demo.locator('.merchant-modal input[type=file]').set_input_files([
        {'name':f'{i}.png','mimeType':'image/png','buffer':png_bytes()} for i in range(7)
    ])
    expect(demo.locator('.merchant-modal .product-image-tile')).to_have_count(8)
    expect(demo.locator('.merchant-modal input[type=file]')).to_be_disabled()
    expect(demo.get_by_role('button',name='保存商品')).to_be_disabled()
    assert demo.evaluate('window.__imageRequests')==0
    checks.append('design preview uses local images, enforces eight-image limit and never uploads or saves')
    demo.locator('.merchant-modal-header').get_by_role('button',name='关闭').click()
    demo.close()

    empty_fixture=BackendContractDouble();empty_fixture.logged=True
    empty_page=render(browser,'/merchant/products',False,(1448,1050),empty_fixture)
    empty_page.get_by_role('button',name='新增商品').click()
    empty_page.locator('.merchant-modal input.admin-input').nth(0).fill('无图商品')
    empty_page.locator('.merchant-modal input.admin-input').nth(1).fill('标准款')
    empty_page.locator('.merchant-modal input.admin-input').nth(2).fill('3.00')
    set_file(empty_page,b'<svg/>','unsafe.svg','image/svg+xml')
    expect(empty_page.get_by_role('button',name='保存商品')).to_be_disabled()
    empty_page.get_by_role('button',name='放弃本次图片选择').click()
    expect(empty_page.locator('.merchant-modal input.admin-input').nth(0)).to_have_value('无图商品')
    expect(empty_page.get_by_role('button',name='保存商品')).to_be_enabled()
    empty_page.get_by_role('button',name='保存商品').click()
    expect(empty_page.locator('.product-table')).to_contain_text('无图商品')
    empty_created=next(p for p in empty_fixture.products if p['productId']=='p-created')
    assert empty_created['imageUrl']=='' and empty_created['images']==[] and not empty_fixture.uploaded_images
    assert not empty_fixture.unhandled
    checks.append('invalid image can be explicitly abandoned without losing the product form')
    empty_page.close()

    # 逐文件失败与重试：混合选择保留成功项，失败项单独阻断保存并可重试/移除
    partial_fixture=BackendContractDouble();partial_fixture.logged=True
    placeholder_svg=Path(__file__).resolve().parents[1]/'public/images/product-placeholder.svg'
    def partial_routes(p):
        p.route('**/media/**',lambda route: route.fulfill(status=200,body=png_bytes(),content_type='image/png'))
        p.route('**/images/product-placeholder.svg',lambda route: route.fulfill(status=200,body=placeholder_svg.read_bytes(),content_type='image/svg+xml'))
    partial=render(browser,'/merchant/products',False,(1448,1050),partial_fixture,routes=partial_routes,base='https://assets.fake/')
    partial.get_by_role('button',name='新增商品').click()
    partial.evaluate('''() => {window.__imagePosts=0;const send=window.fetch;window.fetch=async (url,options={})=>{
        const isImage=String(url).endsWith('/images')&&(options.method||'GET')==='POST';
        if(isImage&&++window.__imagePosts===2)return new Response(JSON.stringify({code:'G0001',info:'图片上传失败'}),{status:500,headers:{'Content-Type':'application/json'}});
        return send(url,options);
    };}''')
    partial.locator('.merchant-modal input[type=file]').set_input_files([
        {'name':'ok.png','mimeType':'image/png','buffer':png_bytes()},
        {'name':'retry.png','mimeType':'image/png','buffer':png_bytes()},
        {'name':'bad.svg','mimeType':'image/svg+xml','buffer':b'<svg/>'},
    ])
    expect(partial.locator('.merchant-modal .product-image-tile')).to_have_count(1)
    expect(partial.locator('.merchant-modal .product-image-failures .product-image-failure')).to_have_count(2)
    expect(partial.locator('.merchant-modal .image-field-error')).to_contain_text('retry.png')
    expect(partial.locator('.merchant-modal .image-field-error')).to_contain_text('JPG、PNG 或 GIF')
    expect(partial.get_by_role('button',name='保存商品')).to_be_disabled()
    assert len(partial_fixture.uploaded_images)==1
    # 该夹具离线提供 /media 图片，成功项必须真实渲染才能用于目视审查。
    partial.wait_for_function("() => {const img=document.querySelector('.merchant-modal .product-image-tile img');return !!img && img.naturalWidth>0;}")
    assert partial.evaluate("document.querySelector('.merchant-modal .product-image-tile img').naturalWidth")>0
    checks.append('successful image in the failure-list fixture renders a real PNG')
    verify_dir=Path(__file__).resolve().parents[2]/'var/verify'
    verify_dir.mkdir(parents=True,exist_ok=True)
    partial.screenshot(path=str(verify_dir/'ui-product-image-partial-failure.png'))
    checks.append('mixed selection keeps the successful image while invalid and failed files stay listed')
    partial.get_by_role('button',name='重试图片retry.png').click()
    expect(partial.locator('.merchant-modal .product-image-tile')).to_have_count(2)
    expect(partial.locator('.merchant-modal .product-image-failures .product-image-failure')).to_have_count(1)
    expect(partial.get_by_role('button',name='保存商品')).to_be_disabled()
    assert len(partial_fixture.uploaded_images)==2
    assert partial.evaluate('window.__imagePosts')==3
    checks.append('single-item retry uploads only the failed file and keeps the remaining failure blocking save')
    partial.get_by_role('button',name='移除失败图片bad.svg').click()
    expect(partial.locator('.merchant-modal .product-image-failures')).to_have_count(0)
    expect(partial.get_by_role('button',name='保存商品')).to_be_enabled()
    checks.append('removing the last failure re-enables saving and keeps both successful images')
    # 同一批重复的 name+size+type 只上传一次，并给出可移除的明确失败项
    before_duplicate=len(partial_fixture.uploaded_images)
    partial.locator('.merchant-modal input[type=file]').set_input_files([
        {'name':'dup.png','mimeType':'image/png','buffer':png_bytes()},
        {'name':'dup.png','mimeType':'image/png','buffer':png_bytes()},
    ])
    expect(partial.locator('.merchant-modal .product-image-failures .product-image-failure')).to_have_count(1)
    expect(partial.locator('.merchant-modal .product-image-failures')).to_contain_text('重复')
    expect(partial.get_by_role('button',name='保存商品')).to_be_disabled()
    assert len(partial_fixture.uploaded_images)==before_duplicate+1
    partial.get_by_role('button',name='移除失败图片dup.png').click()
    expect(partial.get_by_role('button',name='保存商品')).to_be_enabled()
    checks.append('identical files in one batch are uploaded once and reported as a removable duplicate')
    assert not partial_fixture.unhandled,partial_fixture.unhandled
    partial.close()

    fixture=BackendContractDouble();fixture.logged=True
    page=render(browser,'/merchant/products',False,(1448,1050),fixture)
    page.evaluate('''() => {const send=window.fetch;window.__productSaves=0;window.fetch=async (url,options={})=>{
        const reply=await send(url,options);
        if(options.method==='PUT'&&String(url).endsWith('/products/p-created'))window.__productSaves++;
        return reply;
    };}''')
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
    # 新选一张合法图片不能被旧失败抹除：图片入表单，但旧失败仍阻断保存。
    set_file(page,data)
    expect(page.locator('.merchant-modal .product-image-tile')).to_have_count(1)
    expect(page.locator('.merchant-modal .image-field-error')).to_contain_text('JPG、PNG 或 GIF')
    expect(page.get_by_role('button',name='保存商品')).to_be_disabled()
    assert len(fixture.uploaded_images)==1
    checks.append('a later valid selection keeps earlier unresolved failures blocking save')
    page.get_by_role('button',name='放弃本次图片选择').click()
    expect(page.locator('.merchant-modal .product-image-failures')).to_have_count(0)
    expect(page.get_by_role('button',name='保存商品')).to_be_enabled()
    checks.append('explicit abandon clears the failures and keeps the uploaded image')
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
    first=created['imageUrl'];assert first=='/media/550e8400-e29b-41d4-a716-446655440000.png',created
    assert [image['url'] for image in created['images']]==[first]
    checks.append('product create persists uploaded imageUrl and image list')
    # select created product and update hero image + title without losing original image reference
    page.locator('.product-table tbody tr').filter(has_text='原创笔袋').click()
    page.locator('.inspector-tabs').get_by_role('button',name='基本信息').click()
    expect(page.locator('.product-image-list-field')).to_have_count(1)
    page.locator('.inspector-body input[type=file]').set_input_files({'name':'edit.png','mimeType':'image/png','buffer':data})
    expect(page.locator('.inspector-body .image-field-notice')).to_contain_text('上传成功')
    page.locator('.inspector-body input.admin-input').first.fill('原创笔袋（新）')
    page.get_by_role('button',name='保存修改').click()
    expect(page.locator('.inspector-product')).to_contain_text('原创笔袋（新）')
    second='/media/550e8400-e29b-41d4-a716-446655440001.png'
    assert fixture.products[-1]['imageUrl']==first and fixture.products[-1]['version']==1
    assert [image['url'] for image in fixture.products[-1]['images']]==[first,second]
    checks.append('product edit appends the second image and uses expectedVersion')
    page.locator('.inspector-body').get_by_role('button',name='右移商品图片1').click()
    page.get_by_role('button',name='保存修改').click()
    page.wait_for_function('window.__productSaves>=2')
    expect(page.get_by_role('button',name='保存修改')).to_be_enabled()
    assert fixture.products[-1]['imageUrl']==second
    assert [image['url'] for image in fixture.products[-1]['images']]==[second,first]
    checks.append('reordering images updates the saved primary image')
    # Remove product image and persist empty URL
    page.locator('.inspector-tabs').get_by_role('button',name='基本信息').click()
    page.locator('.inspector-body').get_by_role('button',name='移除商品图片1').click()
    page.locator('.inspector-body').get_by_role('button',name='移除商品图片1').click()
    expect(page.locator('.inspector-body .product-image-tile')).to_have_count(0)
    page.get_by_role('button',name='保存修改').click()
    page.wait_for_function('window.__productSaves>=3')
    expect(page.get_by_role('button',name='保存修改')).to_be_enabled()
    expect(page.locator('.inspector-product img')).to_have_attribute('src','./images/product-placeholder.svg')
    assert fixture.products[-1]['imageUrl']=='' and fixture.products[-1]['images']==[]
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
    fixture.products[0]['imageUrl']=''
    photo=render(browser,'/',False,(430,932),fixture)
    photo.route('**/media/**',lambda route: route.fulfill(status=200,body=data,content_type='image/png') if route.request.url.endswith('550e8400-e29b-41d4-a716-446655440000.png') else route.fulfill(status=404,body=''))
    placeholder=Path(__file__).resolve().parents[1]/'public/images/product-placeholder.svg'
    photo.route('**/images/product-placeholder.svg',lambda route: route.fulfill(status=200,body=placeholder.read_bytes(),content_type='image/svg+xml'))
    photo.evaluate("() => {const base=document.createElement('base');base.href='https://assets.fake/';document.head.prepend(base);}")
    fixture.products[0]['imageUrl']=first
    photo.get_by_role('textbox',name='搜索校园商品').fill('书写顺滑中性笔')
    photo.get_by_role('textbox',name='搜索校园商品').press('Enter')
    photo.wait_for_function("document.querySelector('.home-product img').naturalWidth===30")
    checks.append('published /media image loads as actual image in browser')
    fixture.products[0]['imageUrl']='/media/00000000-0000-0000-0000-000000000000.png'
    photo.get_by_role('textbox',name='搜索校园商品').fill('书写顺滑')
    photo.get_by_role('textbox',name='搜索校园商品').press('Enter')
    photo.wait_for_function("document.querySelector('.home-product img').naturalWidth===320")
    expect(photo.locator('.home-product img').first).to_have_attribute('src','./images/product-placeholder.svg')
    checks.append('missing /media file falls back to placeholder')
    photo.close()
    assert not fixture.unhandled,fixture.unhandled
    assert not ERRORS,ERRORS
    browser.close()
print('PASSED',len(checks),'CHECKS',checks)
