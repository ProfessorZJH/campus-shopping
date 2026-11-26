#!/usr/bin/env python3
"""为本地开发/演示环境初始化真实商业密度的校园门店、多图商品、知识库、评价、Redis 热榜与近7日订单波形。

严格只允许针对本地回环地址执行；通过真实 HTTP 接口写入，不伪造未校验业务状态。
"""
from __future__ import annotations

import argparse
import base64
import importlib.util
import json
import os
import secrets
import time
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "frontend" / "public" / "images"

spec = importlib.util.spec_from_file_location("smoke_full", ROOT / "scripts" / "smoke-full.py")
smoke_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke_mod)


def upload_asset(client, merchant_id: str, filename: str, *, store: bool = False) -> str:
    raw = (IMAGES / filename).read_bytes()
    mime = "image/png" if filename.endswith(".png") else ("image/webp" if filename.endswith(".webp") else "image/jpeg")
    endpoint = f"/merchants/{merchant_id}/store/images" if store else f"/merchants/{merchant_id}/images"
    res = client.call(
        "POST",
        endpoint,
        {
            "filename": filename,
            "contentType": mime,
            "base64": base64.b64encode(raw).decode("ascii"),
        },
    )
    return res["url"]


def seed_showcase(base_url: str, admin_user: str, admin_pwd: str, *, db_conn=None) -> dict:
    if urllib.parse.urlsplit(base_url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("仅允许对本地隔离或开发服务执行演示数据初始化")

    admin = smoke_mod.Client(base_url)
    admin.login(admin_user, admin_pwd)

    categories = [
        ("drink", "茶饮冲调"),
        ("food", "零食速食"),
        ("fruit", "鲜切水果"),
        ("stationery", "文具考试"),
        ("daily", "宿舍日用"),
        ("digital", "学习数码"),
    ]
    for code, name in categories:
        admin.call("POST", "/admin/categories", {"code": code, "name": name, "active": True})

    suffix = secrets.token_hex(3)
    owner_user = f"campus_owner_{suffix}"
    owner_pwd = "ShowcaseOwner!" + secrets.token_hex(8)
    owner2_user = f"library_owner_{suffix}"
    owner2_pwd = "ShowcaseOwner2!" + secrets.token_hex(8)
    owner3_user = f"dorm_owner_{suffix}"
    owner3_pwd = "ShowcaseOwner3!" + secrets.token_hex(8)
    owner4_user = f"fruit_owner_{suffix}"
    owner4_pwd = "ShowcaseOwner4!" + secrets.token_hex(8)
    buyer_user = f"campus_buyer_{suffix}"
    buyer_pwd = "ShowcaseBuyer!" + secrets.token_hex(8)
    buyer2_user = f"campus_mate_{suffix}"
    buyer2_pwd = "ShowcaseMate!" + secrets.token_hex(8)

    def reg_login(username: str, password: str, display: str):
        cli = smoke_mod.Client(base_url)
        cli.call("POST", "/auth/register", {"username": username, "password": password, "displayName": display})
        cli.login(username, password)
        return cli

    owner1 = reg_login(owner_user, owner_pwd, "林店长·学一优选")
    owner2 = reg_login(owner2_user, owner2_pwd, "周店长·图书馆书咖")
    owner3 = reg_login(owner3_user, owner3_pwd, "陈店长·北苑便利仓")
    owner4 = reg_login(owner4_user, owner4_pwd, "苏店长·南区鲜果屋")
    buyer = reg_login(buyer_user, buyer_pwd, "计科23级·张同学")
    buyer2 = reg_login(buyer2_user, buyer2_pwd, "信工22级·李同学")

    def open_store(cli, *, name, category, contact, store_name, location, desc, hours, banner_file):
        app_res = cli.call(
            "POST",
            "/merchant-applications",
            {
                "merchantName": name,
                "category": category,
                "contactName": contact,
                "contactPhone": "13800001111",
                "storeName": store_name,
                "location": location,
            },
            key=uuid.uuid4().hex,
        )
        m = admin.call(
            "POST",
            f"/admin/merchant-applications/{app_res['applicationId']}/review",
            {"approved": True, "reason": "资质齐全，校内门店场地核验通过"},
        )
        mid = m["merchantId"]
        banner_url = upload_asset(cli, mid, banner_file, store=True)
        cli.call(
            "PUT",
            f"/merchants/{mid}/profile",
            {
                "name": name,
                "storeName": store_name,
                "location": location,
                "description": desc,
                "businessHours": hours,
                "imageUrl": banner_url,
            },
        )
        return mid

    mid1 = open_store(
        owner1,
        name="学一校园优选店",
        category="茶饮轻食",
        contact="林店长",
        store_name="学一食堂东侧自提店",
        location="学一食堂一层东侧 102 柜台",
        desc="服务教学楼与学一生活区，精选零糖原叶茶饮、鲜牛奶与课间轻食补给，下单备餐后 3 分钟极速凭码取餐。",
        hours="每日 08:00-22:30",
        banner_file="store-campus-hub.jpg",
    )
    mid2 = open_store(
        owner2,
        name="图书馆文具咖啡屋",
        category="咖啡文创",
        contact="周店长",
        store_name="图书馆南门连廊自提窗",
        location="主图书馆一层南门 08 号窗口",
        desc="专注考研与期末备考场景：现萃冰拿铁、冷萃美式、速干考试笔与活页错题本一站配齐，静音取餐不扰自习。",
        hours="每日 07:30-22:00",
        banner_file="store-library-cafe.jpg",
    )
    mid3 = open_store(
        owner3,
        name="北苑宿舍24h便利仓",
        category="零食百货",
        contact="陈店长",
        store_name="北苑4号楼生活自提站",
        location="北苑学生公寓4栋一层大厅东侧",
        desc="覆盖夜宵豚骨泡面、混合坚果零食、本色竹浆抽纸、护眼台灯与降噪耳机，宿舍楼下随时顺路自提。",
        hours="每日 07:00-23:50",
        banner_file="store-dorm-mart.jpg",
    )
    mid4 = open_store(
        owner4,
        name="南区鲜果切切屋",
        category="鲜果酸奶",
        contact="苏店长",
        store_name="南区活动中心鲜果站",
        location="南区学生活动中心一层西侧 03 柜",
        desc="每日清晨校内冷链直达，现切草莓芒果双拼果杯、阳光甜橙与高蛋白希腊酸奶碗，新鲜不过夜。",
        hours="每日 08:30-22:00",
        banner_file="store-fruit-bar.jpg",
    )

    # Create 1 upcoming seasonal draft item FIRST so published flagship products stay at top of NEWEST sort
    draft_url = upload_asset(owner1, mid1, "prod-iced-latte.jpg")
    owner1.call(
        "POST",
        f"/merchants/{mid1}/products",
        {
            "title": "桂花酒酿冰萃拿铁（新品筹备）",
            "description": "秋季限定低度桂花风味燕麦拿铁，正在内测杯型配方",
            "categoryCode": "drink",
            "imageUrl": draft_url,
            "imageUrls": [draft_url],
            "skus": [{"specKey": "450ml 标准冰杯", "priceCent": 1480}],
        },
    )

    # Default home catalog sorts by created_at DESC (last inserted appears first).
    # Insert 10 secondary items first (interleaved across stores), then 12 flagship hero items
    # with 12 distinct prod-*.jpg primary covers interleaved across all 4 stores and 6 categories,
    # guaranteeing ZERO duplicate primary cover photos in the top 12 on Home page 1.
    product_specs = [
        # Secondary items (page 2-3, interleaved across stores and covers)
        (owner4, mid4, "orange", "赣南冰糖脐橙鲜切水果盒", "去皮分瓣免动手，清甜爆汁高维C，追剧刷题不脏手。", "fruit", ["prod-fruit-cup.jpg"], [{"specKey": "280g 免剥果肉盒", "priceCent": 1090}, {"specKey": "整果 4粒装（约1kg）", "priceCent": 1580}]),
        (owner1, mid1, "oatbar", "高蛋白黑巧燕麦能量棒零食", "高膳食纤维零反式脂肪，独立小包装塞进书包，大课间与晚自习抗饿零食首选。", "food", ["prod-campus-snacks.jpg", "prod-fresh-milk.jpg"], [{"specKey": "黑巧海盐 4支装", "priceCent": 1190}, {"specKey": "混合莓果 8支盒装", "priceCent": 2190}]),
        (owner2, mid2, "notebook", "高克重护眼米黄方格活页笔记本", "100g道林护眼纸双面书写不洇墨，高数推导与专业课框架整理必备文具。", "stationery", ["prod-gel-pens.jpg"], [{"specKey": "B5 方格 80张", "priceCent": 880}, {"specKey": "A4 康奈尔 2本装", "priceCent": 1890}]),
        (owner3, mid3, "beefnoodle", "红烧劲道半干鲜面速食泡面碗", "非油炸蒸煮面饼久泡爽滑劲道，配秘制红烧牛肉浇头包，夜宵解馋。", "food", ["prod-instant-noodles.jpg"], [{"specKey": "145g 大满贯碗装", "priceCent": 890}, {"specKey": "2碗夜宵搭档装", "priceCent": 1680}]),
        (owner1, mid1, "jasmine", "冷泡茉莉雪芽绿茶", "横县双瓣茉莉七次窨制，零糖清香不涩口，适合午后提神。", "drink", ["prod-oolong-tea.jpg"], [{"specKey": "500ml 单瓶", "priceCent": 580}, {"specKey": "500ml×2 双瓶", "priceCent": 1080}]),
        (owner3, mid3, "cable", "轻量透气头戴式自习室隔音蓝牙耳机", "蛋白皮记忆棉耳罩久戴不压眼镜，支持蓝牙5.4与有线双模连接，网课听力与宿舍追剧高性价比之选。", "digital", ["prod-headphones.jpg"], [{"specKey": "奶油白·轻音标准版", "priceCent": 8900}, {"specKey": "深空灰·双麦通话版", "priceCent": 10900}]),
        (owner4, mid4, "yogurt", "蓝莓坚果厚切希腊酸奶水果碗", "3倍浓缩滤乳清厚酸奶铺满新鲜蓝莓、香蕉片与烤燕麦脆，低卡代餐饱腹感强。", "fruit", ["prod-fruit-cup.jpg", "prod-campus-snacks.jpg"], [{"specKey": "260g 轻体代餐碗", "priceCent": 1690}]),
        (owner3, mid3, "wetwipes", "EDI纯水弱酸便携消毒湿纸巾", "食堂就餐前擦手与图书馆桌面清洁必备，温和无酒精不伤手。", "daily", ["prod-soft-tissues.jpg"], [{"specKey": "20抽×4包 随身装", "priceCent": 790}, {"specKey": "80抽×3包 大容量带盖", "priceCent": 1590}]),
        (owner2, mid2, "highlighter", "莫兰迪柔和双头荧光标记笔文具", "温和低饱和度不遮挡字迹，文献精读与重点背诵分色清晰。", "stationery", ["prod-gel-pens.jpg"], [{"specKey": "盐系6色套装", "priceCent": 1150}]),
        (owner3, mid3, "milk2", "高钙低脂晚安纯牛奶整箱", "低脂肪高钙配方，睡前温热一杯助眠无负担，宿舍床底整箱常备。", "drink", ["prod-fresh-milk.jpg"], [{"specKey": "200ml×6盒 周享提", "priceCent": 2280}, {"specKey": "200ml×12盒 整箱装", "priceCent": 4290}]),
        # Top-12 flagship showcase items (12 unique primary studio photos; last item renders as Home #1)
        (owner3, mid3, "tissue", "原生竹浆4层加厚柔韧本色抽纸巾", "无荧光增白剂湿水不易破，擦汗卸妆桌面清洁一包搞定，宿舍整提纸巾常备。", "daily", ["prod-soft-tissues.jpg"], [{"specKey": "100抽×3包 体验提", "priceCent": 890}, {"specKey": "100抽×8包 整提实惠装", "priceCent": 1990}]),
        (owner1, mid1, "water", "长白山天然饮用矿泉水", "偏硅酸型天然弱碱矿泉水，球场运动补水与宿舍整提囤货高性价比之选。", "drink", ["prod-mineral-water.jpg"], [{"specKey": "550ml 单瓶", "priceCent": 200}, {"specKey": "550ml×6 宿舍提装", "priceCent": 1000}]),
        (owner2, mid2, "coffee", "12h低温冰萃美式黑咖啡", "0糖0脂高倍咖啡因顺滑慢萃，期末周刷题与早八困倦急救提神。", "drink", ["prod-cold-brew.jpg", "prod-iced-latte.jpg"], [{"specKey": "330ml 冰萃瓶", "priceCent": 1290}, {"specKey": "2瓶复习续命装", "priceCent": 2380}]),
        (owner3, mid3, "nuts", "每日坚果海苔脆综合学习零食包", "巴旦木、腰果、核桃仁配慢烤芝麻海苔脆，非油炸低负担高脑力补给零食。", "food", ["prod-campus-snacks.jpg", "prod-instant-noodles.jpg"], [{"specKey": "120g 锁鲜自封袋", "priceCent": 1480}, {"specKey": "25g×7日周享装", "priceCent": 2490}]),
        (owner3, mid3, "lamp", "国AA级全光谱充插两用护眼学习台灯", "RG0豁免级防蓝光无频闪，内置4000mAh电池宿舍熄灯不断电，三档色温触控调节。", "daily", ["prod-desk-lamp.jpg", "prod-headphones.jpg"], [{"specKey": "象牙白·长续航版", "priceCent": 4500}, {"specKey": "星耀银·超大灯头旗舰版", "priceCent": 5900}]),
        (owner1, mid1, "milk", "牧场低温鲜纯牛奶", "生牛乳巴氏杀菌保留活性免疫球蛋白，每100ml含3.6g优质乳蛋白，早八课前营养满格。", "drink", ["prod-fresh-milk.jpg", "prod-campus-snacks.jpg"], [{"specKey": "250ml 早餐瓶", "priceCent": 480}, {"specKey": "950ml 家庭装", "priceCent": 1580}]),
        (owner2, mid2, "pen", "考试速干0.5mm黑色中性笔文具套装", "日本进口碳素墨水秒干不脏卷面，软胶护指久写不累，附赠康奈尔B5错题活页本。", "stationery", ["prod-gel-pens.jpg"], [{"specKey": "3支速干笔+B5活页本", "priceCent": 1280}, {"specKey": "黑色子弹头 6支盒装", "priceCent": 990}]),
        (owner3, mid3, "noodles", "日式浓汤豚骨叉烧泡面杯面", "熬制猪骨浓白高汤搭配大片冻干叉烧与溏心卤蛋，宿舍深夜赶论文5分钟热汤治愈夜宵。", "food", ["prod-instant-noodles.jpg", "prod-campus-snacks.jpg"], [{"specKey": "浓汤豚骨大杯 115g", "priceCent": 750}, {"specKey": "番茄肥牛+豚骨 双杯组合", "priceCent": 1390}, {"specKey": "宿舍囤货 4杯箱装", "priceCent": 2680}]),
        (owner3, mid3, "headphones", "42dB深度主动降噪蓝牙自习耳机", "双馈ANC主动降噪隔绝键盘与走廊嘈杂，45小时续航+双设备无缝切换，沉浸考研利器。", "digital", ["prod-headphones.jpg", "prod-desk-lamp.jpg"], [{"specKey": "云岩米白", "priceCent": 15900}, {"specKey": "星际深灰", "priceCent": 15900}]),
        (owner1, mid1, "tea", "无糖原叶乌龙茶", "0糖0脂0卡福建高山铁观音冷泡原叶萃取，清爽回甘解腻，图书馆复习与饭后解渴常备。", "drink", ["prod-oolong-tea.jpg", "prod-mineral-water.jpg"], [{"specKey": "500ml 冰镇单瓶", "priceCent": 600}, {"specKey": "500ml×3 连包", "priceCent": 1650}, {"specKey": "1.5L 宿舍分享瓶", "priceCent": 1200}]),
        (owner4, mid4, "fruit", "当晨现切草莓奇异果缤纷水果杯", "红颜草莓、绿心奇异果、台农芒果与蓝莓四拼冷链鲜切，附独立果叉，课间维C补给站。", "fruit", ["prod-fruit-cup.jpg", "prod-fresh-milk.jpg"], [{"specKey": "300g 单人活力杯", "priceCent": 1490}, {"specKey": "500g 双人分享桶", "priceCent": 2290}]),
        (owner2, mid2, "latte", "生椰燕麦冰拿铁咖啡", "埃塞俄比亚中深烘意式浓缩碰撞植物燕麦奶，乳糖不耐受友好，丝滑醇厚不反酸。", "drink", ["prod-iced-latte.jpg", "prod-cold-brew.jpg"], [{"specKey": "中杯 360ml 少冰", "priceCent": 1390}, {"specKey": "大杯 480ml 标准冰", "priceCent": 1650}]),
    ]

    products = {}
    ordered_product_ids: list[str] = []
    for cli, mid, key, title, desc, cat, img_files, skus in product_specs:
        urls = [upload_asset(cli, mid, fn) for fn in img_files]
        p = cli.call(
            "POST",
            f"/merchants/{mid}/products",
            {"title": title, "description": desc, "categoryCode": cat, "imageUrl": urls[0], "imageUrls": urls, "skus": skus},
        )
        for s in p["skus"]:
            cli.call("POST", f"/merchants/{mid}/stocks/{s['skuId']}/replenish", {"quantity": 60}, key=uuid.uuid4().hex)
        cli.call("POST", f"/merchants/{mid}/products/{p['productId']}/publish", {"published": True})
        products[key] = p
        ordered_product_ids.append(p["productId"])
        time.sleep(0.015)

    # Public + internal knowledge documents
    kb_pub = owner1.call("POST", "/knowledge/bases", {"merchantId": mid1, "name": "门店公开自提与售后说明", "visibility": "PUBLIC"})
    doc_pub = owner1.call(
        "POST",
        f"/knowledge/bases/{kb_pub['id']}/documents",
        {
            "title": "自提时间与售后规则",
            "filename": "pickup.md",
            "contentType": "text/markdown",
            "base64": base64.b64encode(
                "学一食堂东侧自提店每天08:00至22:30营业，付款并备餐完成后凭门店取餐号（如A-101）及6位数字取件码或动态二维码到一层东侧102柜台核销取货；支持大课间与午休预约自提；已支付未提货订单支持整单退款，商户驳回后可申请平台介入（最多3轮）。".encode("utf-8")
            ).decode("ascii"),
        },
    )
    owner1.call("POST", f"/knowledge/documents/{doc_pub['id']}/publish", {})

    kb_pub2 = owner2.call("POST", "/knowledge/bases", {"merchantId": mid2, "name": "图书馆书咖取餐须知", "visibility": "PUBLIC"})
    doc_pub2 = owner2.call(
        "POST",
        f"/knowledge/bases/{kb_pub2['id']}/documents",
        {
            "title": "图书馆静音取餐与冰度定制说明",
            "filename": "library_cafe.md",
            "contentType": "text/markdown",
            "base64": base64.b64encode(
                "图书馆南门连廊自提窗每日07:30至22:00营业，所有咖啡饮品支持备注少冰、去冰或换燕麦奶；取餐位于馆外南门08号窗口，无需刷入馆闸机。".encode("utf-8")
            ).decode("ascii"),
        },
    )
    owner2.call("POST", f"/knowledge/documents/{doc_pub2['id']}/publish", {})

    kb_priv = owner1.call("POST", "/knowledge/bases", {"merchantId": mid1, "name": "门店内部交接手册", "visibility": "MERCHANT_INTERNAL"})
    doc_priv = owner1.call(
        "POST",
        f"/knowledge/bases/{kb_priv['id']}/documents",
        {
            "title": "内部盘点与冷链巡检记录",
            "filename": "internal.md",
            "contentType": "text/markdown",
            "base64": base64.b64encode("仅限本店员工查看：每日闭店前复核冷链温控与次日鲜奶补货单。".encode("utf-8")).decode("ascii"),
        },
    )
    owner1.call("POST", f"/knowledge/documents/{doc_priv['id']}/publish", {})

    def place_and_complete(cli_buyer, cli_owner, mid, items_spec, *, remark="少冰 · 需要吸管", slot="IMMEDIATE", channel="WECHAT_PAY", review_payload=None):
        order_items = []
        for pkey, qty in items_spec:
            d = cli_buyer.call("GET", f"/products/{products[pkey]['productId']}")
            s = d["skus"][0]
            order_items.append({"skuId": s["skuId"], "quantity": qty, "expectedPriceCent": s["priceCent"], "expectedVersion": d["version"]})
        created = cli_buyer.call(
            "POST",
            "/orders",
            {"merchantId": mid, "items": order_items, "buyerRemark": remark, "pickupSlot": slot},
            key=uuid.uuid4().hex,
        )
        oid = created["orderId"]
        cli_buyer.call("POST", f"/orders/{oid}/pay?channel={channel}", {})
        cli_owner.call("POST", f"/merchants/{mid}/orders/{oid}/prepare", {})
        cli_owner.call("POST", f"/merchants/{mid}/orders/{oid}/ready", {})
        tok = cli_buyer.call("POST", f"/orders/{oid}/pickup-token", {})
        verify_code = tok.get("pinCode") or tok["token"]
        cli_owner.call("POST", f"/merchants/{mid}/orders/{oid}/verify", {"token": verify_code})
        if review_payload:
            try:
                cli_buyer.call("POST", f"/orders/{oid}/reviews", review_payload)
            except Exception:
                pass
        return oid

    # Seed realistic multi-store completed orders + reviews + co-purchase pairs!
    historical_plan = [
        # (days_ago, buyer_cli, owner_cli, mid, items, channel, review)
        (6, buyer2, owner1, mid1, [("tea", 2), ("oatbar", 1)], "WECHAT_PAY", {"rating": 5, "tags": "无糖好喝,出餐神速", "content": "冰镇乌龙茶特别解渴，配黑巧能量棒刚好当下午茶！"}),
        (6, buyer, owner3, mid3, [("noodles", 1), ("tissue", 1)], "ALIPAY", {"rating": 5, "tags": "夜宵救星,分量实在", "content": "赶实验报告到十一点，下楼两分钟就拿到豚骨泡面和抽纸，太方便了。"}),
        (5, buyer2, owner2, mid2, [("latte", 1), ("pen", 1)], "CAMPUS_CARD", {"rating": 5, "tags": "图书馆续命,顺滑好写", "content": "南门连廊窗口取餐不用出馆，生椰燕麦拿铁很香，速干笔刷真题不蹭手。"}),
        (5, buyer, owner1, mid1, [("milk", 2)], "WECHAT_PAY", {"rating": 5, "tags": "日期新鲜,早八必备", "content": "低温鲜奶冰冰凉凉，早八路过食堂东侧顺手就能提走。"}),
        (5, buyer2, owner4, mid4, [("fruit", 1)], "WECHAT_PAY", {"rating": 5, "tags": "果肉清甜,包装严实", "content": "草莓和芒果都很甜，没有烂果，叉子独立包装很卫生。"}),
        (4, buyer, owner2, mid2, [("coffee", 1), ("notebook", 1)], "WECHAT_PAY", {"rating": 5, "tags": "提神神器,纸张厚实", "content": "冷萃美式一点不酸涩，B5方格本写高数完全不透墨。"}),
        (4, buyer2, owner3, mid3, [("nuts", 1), ("wetwipes", 1)], "ALIPAY", {"rating": 5, "tags": "健康低卡,性价比高", "content": "坚果海苔脆很酥脆，自习室嘴馋吃几口没有负担。"}),
        (4, buyer, owner1, mid1, [("tea", 1), ("milk", 1)], "CAMPUS_CARD", None),
        (3, buyer2, owner1, mid1, [("jasmine", 2), ("oatbar", 1)], "WECHAT_PAY", None),
        (3, buyer, owner3, mid3, [("lamp", 1)], "WECHAT_PAY", {"rating": 5, "tags": "柔和不刺眼,续航给力", "content": "宿舍11点熄灯后开中档看书完全够用，光线很柔和不晃室友。"}),
        (3, buyer2, owner4, mid4, [("yogurt", 1), ("orange", 1)], "ALIPAY", {"rating": 5, "tags": "低卡饱腹,酸甜适口", "content": "希腊酸奶特别浓稠，配免剥脐橙太适合晚饭轻食了！"}),
        (2, buyer, owner1, mid1, [("tea", 2), ("water", 1)], "WECHAT_PAY", None),
        (2, buyer2, owner2, mid2, [("latte", 2), ("highlighter", 1)], "WECHAT_PAY", None),
        (2, buyer, owner3, mid3, [("noodles", 2), ("nuts", 1)], "CAMPUS_CARD", None),
        (2, buyer2, owner1, mid1, [("milk", 1), ("oatbar", 1)], "WECHAT_PAY", None),
        (1, buyer, owner2, mid2, [("coffee", 1), ("pen", 1)], "ALIPAY", None),
        (1, buyer2, owner3, mid3, [("headphones", 1), ("cable", 1)], "WECHAT_PAY", {"rating": 5, "tags": "降噪惊艳,考研利器", "content": "戴上瞬间隔绝走廊脚步声，耳罩很软戴一下午也不夹头！"}),
        (1, buyer, owner4, mid4, [("fruit", 2)], "WECHAT_PAY", None),
        (1, buyer2, owner1, mid1, [("tea", 3)], "WECHAT_PAY", None),
        (0, buyer2, owner2, mid2, [("latte", 1)], "WECHAT_PAY", None),
        (0, buyer2, owner3, mid3, [("tissue", 2), ("beefnoodle", 1)], "ALIPAY", None),
    ]

    dated_orders: list[tuple[str, int]] = []
    oid_done = ""
    for days_ago, b_cli, o_cli, m_id, items_spec, ch, rev in historical_plan:
        oid = place_and_complete(b_cli, o_cli, m_id, items_spec, slot="12:00-12:30 午休自提" if days_ago % 2 else "IMMEDIATE", channel=ch, review_payload=rev)
        dated_orders.append((oid, days_ago))
        if m_id == mid1:
            oid_done = oid

    # Active READY order for buyer (shows boarding-pass SVG QR + 6-digit PIN + A-xxx call code!)
    d_fruit = buyer.call("GET", f"/products/{products['tea']['productId']}")
    s_fruit = d_fruit["skus"][0]
    oid_ready = buyer.call(
        "POST",
        "/orders",
        {
            "merchantId": mid1,
            "items": [{"skuId": s_fruit["skuId"], "quantity": 2, "expectedPriceCent": s_fruit["priceCent"], "expectedVersion": d_fruit["version"]}],
            "buyerRemark": "冰镇 · 需要纸袋",
            "pickupSlot": "12:00-12:30 午休自提",
        },
        key=uuid.uuid4().hex,
    )["orderId"]
    buyer.call("POST", f"/orders/{oid_ready}/pay?channel=WECHAT_PAY", {})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_ready}/prepare", {})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_ready}/ready", {})

    # Active PENDING_PAYMENT order for buyer (shows 3-channel Campus Cashier & live 15m countdown!)
    d_latte = buyer.call("GET", f"/products/{products['latte']['productId']}")
    s_latte = d_latte["skus"][0]
    oid_pending = buyer.call(
        "POST",
        "/orders",
        {
            "merchantId": mid2,
            "items": [{"skuId": s_latte["skuId"], "quantity": 1, "expectedPriceCent": s_latte["priceCent"], "expectedVersion": d_latte["version"]}],
            "buyerRemark": "少冰 · 换燕麦奶",
            "pickupSlot": "10:00-10:20 大课间",
        },
        key=uuid.uuid4().hex,
    )["orderId"]

    # Active DISPUTED order for Admin Disputes console
    d_water = buyer2.call("GET", f"/products/{products['water']['productId']}")
    s_water = d_water["skus"][0]
    oid_disp = buyer2.call(
        "POST",
        "/orders",
        {
            "merchantId": mid1,
            "items": [{"skuId": s_water["skuId"], "quantity": 2, "expectedPriceCent": s_water["priceCent"], "expectedVersion": d_water["version"]}],
            "buyerRemark": "放自提架",
            "pickupSlot": "IMMEDIATE",
        },
        key=uuid.uuid4().hex,
    )["orderId"]
    buyer2.call("POST", f"/orders/{oid_disp}/pay?channel=ALIPAY", {})
    buyer2.call("POST", f"/orders/{oid_disp}/refunds", {"reason": "临时调课赶往西区实验室，无法回学一自提申请退款"})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_disp}/refund-decision", {"approved": False, "reason": "饮品已分拣装箱摆上自提冷柜"})
    buyer2.call("POST", f"/orders/{oid_disp}/appeal", {})

    # Warm up Favorites, Footprints, and Redis Hotwords via real HTTP calls!
    for fav_key in ("tea", "latte", "noodles", "fruit"):
        try:
            buyer.call("POST", f"/products/{products[fav_key]['productId']}/favorite", {})
        except Exception:
            pass
    for browse_key in ("headphones", "lamp", "pen", "nuts", "milk", "tea"):
        buyer.call("GET", f"/products/{products[browse_key]['productId']}")
    for kw, freq in [("乌龙茶", 5), ("泡面", 4), ("纯牛奶", 4), ("咖啡", 3), ("零食", 3), ("水果", 2), ("文具", 2), ("纸巾", 2)]:
        for _ in range(freq):
            buyer.call("GET", f"/products/page?q={urllib.parse.quote(kw)}&page=1&size=8")

    # Backdate historical completed orders across the past 7 days & stamp deterministic product created_at order on isolated showcase MySQL!
    if db_conn is not None:
        now_utc = datetime.now(timezone.utc)
        with db_conn.cursor() as cur:
            total_products = len(ordered_product_ids)
            for idx, pid in enumerate(ordered_product_ids):
                pts = (now_utc - timedelta(minutes=(total_products - idx))).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                cur.execute("UPDATE cat_product SET created_at=%s WHERE id=%s", (pts, pid))
            for idx, (oid, days_ago) in enumerate(dated_orders):
                if days_ago <= 0:
                    continue
                ts = (now_utc - timedelta(days=days_ago, hours=(idx % 5))).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                cur.execute("UPDATE trd_order SET created_at=%s WHERE id=%s", (ts, oid))
                cur.execute("UPDATE trd_payment SET created_at=%s WHERE order_id=%s", (ts, oid))
                cur.execute("UPDATE trd_order_event SET event_time=%s WHERE order_id=%s", (ts, oid))

    return {
        "merchants": {"main": mid1, "library": mid2, "dorm": mid3, "fruit": mid4},
        "products": {k: v["productId"] for k, v in products.items()},
        "orders": {"completed": oid_done, "ready": oid_ready, "pending": oid_pending, "disputed": oid_disp},
        "accounts": {"owner": owner_user, "ownerPwd": owner_pwd, "buyer": buyer_user, "buyerPwd": buyer_pwd},
        "publicDocId": doc_pub["id"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8091")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    args = parser.parse_args()

    env = smoke_mod.env_file(args.env_file)
    admin_user = os.getenv("ADMIN_USERNAME") or env.get("ADMIN_USERNAME")
    admin_pwd = os.getenv("ADMIN_PASSWORD") or env.get("ADMIN_PASSWORD")
    if not admin_user or not admin_pwd:
        raise SystemExit("缺少 ADMIN_USERNAME / ADMIN_PASSWORD")
    summary = seed_showcase(args.base_url, admin_user, admin_pwd)
    redacted = {k: v for k, v in summary.items() if k != "accounts"}
    print(json.dumps(redacted, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
