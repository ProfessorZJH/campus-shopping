#!/usr/bin/env python3
"""本地校园商城高质感演示数据初始化脚本（仅允许 localhost/127.0.0.1）。

通过真实 HTTP API 写入 3 家校园门店（含完整简介/营业时间/门店图）、7 款高清影棚实拍多规格商品
+ 1 款草稿商品、公开/内部知识文档以及典型订单（已完成 / 待自提 / 售后争议），用于本地体验、
答辩演示或论文第 4 章真实截图。不输出任何凭据。
"""
from __future__ import annotations

import argparse
import base64
import importlib.util
import json
import os
import secrets
import urllib.parse
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "frontend" / "public" / "images"


def load_smoke_client():
    spec = importlib.util.spec_from_file_location("full_smoke", ROOT / "scripts/smoke-full.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def upload_asset(client, merchant_id: str, filename: str, *, store: bool = False) -> str:
    path = IMG_DIR / filename
    raw = path.read_bytes()
    content_type = "image/jpeg" if filename.endswith(".jpg") else "image/png"
    endpoint = f"/merchants/{merchant_id}/store/images" if store else f"/merchants/{merchant_id}/images"
    res = client.call(
        "POST",
        endpoint,
        {"filename": filename, "contentType": content_type, "base64": base64.b64encode(raw).decode("ascii")},
    )
    return res["url"]


def seed_showcase(base_url: str, admin_user: str, admin_pwd: str) -> dict:
    if urllib.parse.urlsplit(base_url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("仅允许对本地隔离或开发服务执行演示数据初始化")

    smoke_mod = load_smoke_client()
    admin = smoke_mod.Client(base_url)
    admin.login(admin_user, admin_pwd)

    for code, name in [
        ("drink", "校园饮品"),
        ("food", "零食速食"),
        ("fruit", "鲜切水果"),
        ("stationery", "考试文具"),
        ("daily", "宿舍百货"),
        ("digital", "数码配件"),
    ]:
        admin.call("POST", "/admin/categories", {"code": code, "name": name, "active": True})

    suffix = secrets.token_hex(3)
    owner_user = f"campus_owner_{suffix}"
    owner_pwd = "ShowcaseOwner!" + secrets.token_hex(8)
    owner2_user = f"library_owner_{suffix}"
    owner2_pwd = "ShowcaseOwner2!" + secrets.token_hex(8)
    owner3_user = f"dorm_owner_{suffix}"
    owner3_pwd = "ShowcaseOwner3!" + secrets.token_hex(8)
    buyer_user = f"campus_buyer_{suffix}"
    buyer_pwd = "ShowcaseBuyer!" + secrets.token_hex(8)

    def reg_login(username: str, password: str, display: str):
        cli = smoke_mod.Client(base_url)
        cli.call("POST", "/auth/register", {"username": username, "password": password, "displayName": display})
        cli.login(username, password)
        return cli

    owner1 = reg_login(owner_user, owner_pwd, "学一门店店长")
    owner2 = reg_login(owner2_user, owner2_pwd, "图书馆书吧店长")
    owner3 = reg_login(owner3_user, owner3_pwd, "北苑生活馆店长")
    buyer = reg_login(buyer_user, buyer_pwd, "校园体验同学")

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
            {"approved": True, "reason": "演示校园门店入驻审核通过"},
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
        category="便利零售",
        contact="林店长",
        store_name="学一食堂东侧自提店",
        location="学一食堂一层东侧 102 柜台",
        desc="服务教学楼与学一生活区，精选零糖茶饮、鲜切果杯与日常补给，下单备货后 3 分钟极速到柜自提。",
        hours="每日 08:00-22:30",
        banner_file="store-campus-hub.jpg",
    )
    mid2 = open_store(
        owner2,
        name="图书馆文具咖啡屋",
        category="文具饮品",
        contact="周店长",
        store_name="图书馆南门连廊自提窗",
        location="主图书馆一层南门 08 号窗口",
        desc="专注复习备考场景：手冲冷萃咖啡、顺滑考试用笔与笔记耗材一站配齐，安静自提不打扰阅览。",
        hours="每日 07:30-22:00",
        banner_file="store-campus-hub.jpg",
    )
    mid3 = open_store(
        owner3,
        name="北苑宿舍生活馆",
        category="宿舍百货",
        contact="陈店长",
        store_name="北苑4号楼生活自提站",
        location="北苑学生公寓4栋一层大厅东侧",
        desc="覆盖护眼学习台灯、降噪耳机等宿舍高频数码与生活好物，支持当晚下课顺路自提。",
        hours="每日 08:30-23:00",
        banner_file="store-campus-hub.jpg",
    )

    product_specs = [
        (owner1, mid1, "tea", "无糖乌龙茶", "零糖清爽解腻原叶萃取茶饮，图书馆熬夜复习与课间解渴首选", "drink", "prod-oolong-tea.jpg", [{"specKey": "500ml 单瓶", "priceCent": 600}, {"specKey": "1500ml 分享装", "priceCent": 1200}]),
        (owner1, mid1, "water", "天然饮用矿泉水", "长白山弱碱性天然饮用矿泉水，运动补水与宿舍常备", "drink", "prod-mineral-water.jpg", [{"specKey": "550ml 单瓶", "priceCent": 200}, {"specKey": "6瓶宿舍提装", "priceCent": 1000}]),
        (owner1, mid1, "fruit", "每日鲜切什锦水果杯", "当晨现切草莓、奇异果、芒果与蓝莓冷链保鲜，课间轻食维C补给", "fruit", "prod-fruit-cup.jpg", [{"specKey": "300g 标准杯", "priceCent": 1490}, {"specKey": "500g 分享杯", "priceCent": 2290}]),
        (owner2, mid2, "coffee", "冰萃美式冷萃咖啡", "12小时低温慢萃阿拉比卡原豆，零糖顺滑提神不苦涩", "drink", "prod-cold-brew.jpg", [{"specKey": "330ml 冰萃瓶", "priceCent": 1350}, {"specKey": "2瓶复习套装", "priceCent": 2500}]),
        (owner2, mid2, "pen", "考试速干黑色签字笔套装", "0.5mm 顺滑速干子弹头中性笔（3支装）配 B5 康奈尔活页复习本", "stationery", "prod-gel-pens.jpg", [{"specKey": "3支笔+B5本", "priceCent": 1280}, {"specKey": "单购3支黑色笔", "priceCent": 690}]),
        (owner3, mid3, "lamp", "国AA级护眼折叠学习台灯", "无频闪全光谱三档调光，USB 充插两用，宿舍断电也能安心复习", "daily", "prod-desk-lamp.jpg", [{"specKey": "象牙白·充电版", "priceCent": 4500}, {"specKey": "星耀银·旗舰版", "priceCent": 5900}]),
        (owner3, mid3, "headphones", "无线主动降噪自习耳机", "40dB 深度降噪、45小时超长续航，图书馆与宿舍沉浸学习搭档", "digital", "prod-headphones.jpg", [{"specKey": "米白金", "priceCent": 15900}, {"specKey": "深空灰", "priceCent": 15900}]),
    ]

    products = {}
    for cli, mid, key, title, desc, cat, img_file, skus in product_specs:
        url = upload_asset(cli, mid, img_file)
        p = cli.call(
            "POST",
            f"/merchants/{mid}/products",
            {"title": title, "description": desc, "categoryCode": cat, "imageUrl": url, "imageUrls": [url], "skus": skus},
        )
        for s in p["skus"]:
            cli.call("POST", f"/merchants/{mid}/stocks/{s['skuId']}/replenish", {"quantity": 36}, key=uuid.uuid4().hex)
        cli.call("POST", f"/merchants/{mid}/products/{p['productId']}/publish", {"published": True})
        products[key] = p

    # Draft product for Merchant DRAFT filter demo
    draft_url = upload_asset(owner1, mid1, "prod-gel-pens.jpg")
    owner1.call(
        "POST",
        f"/merchants/{mid1}/products",
        {
            "title": "草稿测试笔记本",
            "description": "尚未上架的新学期限量网格笔记本",
            "categoryCode": "stationery",
            "imageUrl": draft_url,
            "imageUrls": [draft_url],
            "skus": [{"specKey": "B5横线", "priceCent": 900}],
        },
    )

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
                "学一食堂东侧自提店每天08:00至22:30营业，付款并备货完成后凭动态自提码到一层东侧102柜台核销取货；已支付未提货订单支持整单模拟退款，商户驳回后可申请平台介入（最多3轮）。".encode("utf-8")
            ).decode("ascii"),
        },
    )
    owner1.call("POST", f"/knowledge/documents/{doc_pub['id']}/publish", {})

    kb_priv = owner1.call("POST", "/knowledge/bases", {"merchantId": mid1, "name": "门店内部交接手册", "visibility": "MERCHANT_INTERNAL"})
    doc_priv = owner1.call(
        "POST",
        f"/knowledge/bases/{kb_priv['id']}/documents",
        {
            "title": "内部盘点与冷链巡检记录",
            "filename": "internal.md",
            "contentType": "text/markdown",
            "base64": base64.b64encode("仅限本店员工查看：每日闭店前复核冷链温控与次日补货单。".encode("utf-8")).decode("ascii"),
        },
    )
    owner1.call("POST", f"/knowledge/documents/{doc_priv['id']}/publish", {})

    # Seed 3 realistic orders for dashboard SVG charts + pickup card + admin disputes
    def place_order(mid, product_key, qty=1):
        d = buyer.call("GET", f"/products/{products[product_key]['productId']}")
        s = d["skus"][0]
        return buyer.call(
            "POST",
            "/orders",
            {"merchantId": mid, "items": [{"skuId": s["skuId"], "quantity": qty, "expectedPriceCent": s["priceCent"], "expectedVersion": d["version"]}]},
            key=uuid.uuid4().hex,
        )["orderId"]

    # 1) Completed order (populates dashboard GMV & top products SVG chart!)
    oid_done = place_order(mid1, "tea", 2)
    buyer.call("POST", f"/orders/{oid_done}/pay", {})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_done}/prepare", {})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_done}/ready", {})
    tok = buyer.call("POST", f"/orders/{oid_done}/pickup-token", {})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_done}/verify", {"token": tok["token"]})

    # 2) Ready-for-pickup order (for Orders boarding-pass pickup card!)
    oid_ready = place_order(mid1, "fruit", 1)
    buyer.call("POST", f"/orders/{oid_ready}/pay", {})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_ready}/prepare", {})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_ready}/ready", {})

    # 3) Active disputed order (for Admin Disputes console!)
    oid_disp = place_order(mid1, "water", 2)
    buyer.call("POST", f"/orders/{oid_disp}/pay", {})
    buyer.call("POST", f"/orders/{oid_disp}/refunds", {"reason": "临时课程变动未提货申请退款"})
    owner1.call("POST", f"/merchants/{mid1}/orders/{oid_disp}/refund-decision", {"approved": False, "reason": "商品已开始备货"})
    buyer.call("POST", f"/orders/{oid_disp}/appeal", {})

    return {
        "merchants": {"main": mid1, "library": mid2, "dorm": mid3},
        "products": {k: v["productId"] for k, v in products.items()},
        "orders": {"completed": oid_done, "ready": oid_ready, "disputed": oid_disp},
        "accounts": {"owner": owner_user, "ownerPwd": owner_pwd, "buyer": buyer_user, "buyerPwd": buyer_pwd},
        "publicDocId": doc_pub["id"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8091")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    args = parser.parse_args()
    smoke_mod = load_smoke_client()
    env = smoke_mod.env_file(args.env_file)
    admin_user = os.getenv("ADMIN_USERNAME") or env.get("ADMIN_USERNAME")
    admin_pwd = os.getenv("ADMIN_PASSWORD") or env.get("ADMIN_PASSWORD")
    if not admin_user or not admin_pwd:
        raise SystemExit("缺少 ADMIN_USERNAME / ADMIN_PASSWORD")
    summary = seed_showcase(args.base_url, admin_user, admin_pwd)
    redacted = {k: v for k, v in summary.items() if k != "accounts"}
    redacted["demoUsernames"] = {"owner": summary["accounts"]["owner"], "buyer": summary["accounts"]["buyer"]}
    print(json.dumps(redacted, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
