"""Benchmark V2 共享分类学、商户字典、60个商品原型规格模式与80篇知识文档ID契约。

所有语料与场景均为公开合成测试材料，不代表真实用户日志或线上商户数据。
"""
from __future__ import annotations

MERCHANTS = [
    {"merchantId": "m0", "name": "松园便利超市", "status": "ACTIVE", "focus": "convenience"},
    {"merchantId": "m1", "name": "博雅文具书屋", "status": "ACTIVE", "focus": "stationery"},
    {"merchantId": "m2", "name": "沁园轻食水吧", "status": "ACTIVE", "focus": "food_beverage"},
    {"merchantId": "m3", "name": "极客数码工坊", "status": "ACTIVE", "focus": "digital"},
    {"merchantId": "m4", "name": "梅园宿管生活馆", "status": "ACTIVE", "focus": "dormitory"},
    {"merchantId": "m5", "name": "凌云体育装备店", "status": "ACTIVE", "focus": "sports"},
    {"merchantId": "m6", "name": "紫荆零食驿站", "status": "ACTIVE", "focus": "food_beverage"},
    {"merchantId": "m7", "name": "知行办公印务社", "status": "ACTIVE", "focus": "stationery"},
    {"merchantId": "m8", "name": "荷园夜宵能量站", "status": "ACTIVE", "focus": "convenience"},
    {"merchantId": "m9", "name": "停业清仓杂货铺", "status": "SUSPENDED", "focus": "mixed"},
]

ACTIVE_MERCHANT_IDS = [m["merchantId"] for m in MERCHANTS if m["status"] == "ACTIVE"]

APPLICATIONS = [
    {"applicationId": "app-v2-01", "merchantName": "竹园图文快印筹备店", "status": "SUBMITTED"},
    {"applicationId": "app-v2-02", "merchantName": "南区鲜果切盒筹备铺", "status": "SUBMITTED"},
]

CATEGORY_QUOTAS = {
    "exact-product-spec": {"total": 30, "dev": 12, "test": 18, "smoke": 2},
    "fuzzy-need-scenario": {"total": 40, "dev": 16, "test": 24, "smoke": 2},
    "budget-combo-constraint": {"total": 35, "dev": 14, "test": 21, "smoke": 2},
    "attribute-quantity-negation": {"total": 30, "dev": 12, "test": 18, "smoke": 2},
    "oos-discontinued-nomatch": {"total": 25, "dev": 10, "test": 15, "smoke": 2},
    "cross-merchant-compare": {"total": 20, "dev": 8, "test": 12, "smoke": 2},
    "public-knowledge-multievidence": {"total": 35, "dev": 14, "test": 21, "smoke": 2},
    "multiturn-clarification": {"total": 40, "dev": 16, "test": 24, "smoke": 2},
    "colloquial-typo-ambiguity": {"total": 25, "dev": 10, "test": 15, "smoke": 2},
    "knowledge-acl-privacy": {"total": 25, "dev": 10, "test": 15, "smoke": 2},
    "prompt-injection-hallucination": {"total": 25, "dev": 10, "test": 15, "smoke": 2},
    "proposal-safety-mutation": {"total": 30, "dev": 12, "test": 18, "smoke": 2},
}

# 60 个商品原型及规范化属性词表（每个 SKU 的 specKey 必须包含其 attributes 的全部值词元）
ARCHETYPES = {
    # 1. convenience (80 商品)
    "tissue_pack": {
        "category": "convenience", "label": "原生木浆抽纸", "siblings": ["wet_wipes"],
        "merchants": ["m0", "m4", "m8", "m9"],
        "attrs": {"pack": ["单包", "3包提装", "6包家庭装"], "ply": ["3层", "4层加厚"]},
    },
    "wet_wipes": {
        "category": "convenience", "label": "卫生清洁湿巾", "siblings": ["tissue_pack"],
        "merchants": ["m0", "m6", "m8"],
        "attrs": {"pack": ["10片便携装", "80片大包装"], "formula": ["75%酒精", "纯水无酒精"]},
    },
    "folding_umbrella": {
        "category": "convenience", "label": "黑胶晴雨折叠伞", "siblings": ["raincoat_poncho"],
        "merchants": ["m0", "m4", "m8"],
        "attrs": {"ribs": ["8骨轻便", "12骨抗风"], "color": ["藏青色", "雾霾蓝", "米白色"]},
    },
    "raincoat_poncho": {
        "category": "convenience", "label": "加厚连体骑行雨衣", "siblings": ["folding_umbrella"],
        "merchants": ["m0", "m5"],
        "attrs": {"size": ["均码", "加大书包位款"], "pack": ["单件装", "2件备用装"]},
    },
    "laundry_pods": {
        "category": "convenience", "label": "除菌酵素洗衣凝珠", "siblings": ["stain_pen"],
        "merchants": ["m0", "m4", "m9"],
        "attrs": {"pack": ["20颗盒装", "50颗家庭装"], "scent": ["白桃果香", "无香除螨"]},
    },
    "stain_pen": {
        "category": "convenience", "label": "便携去渍救急笔", "siblings": ["laundry_pods"],
        "merchants": ["m0", "m8"],
        "attrs": {"pack": ["9ml单支装", "9ml双支装"], "scent": ["微香型", "无味型"]},
    },
    "alkaline_battery": {
        "category": "convenience", "label": "无汞碱性电池", "siblings": ["power_strip"],
        "merchants": ["m0", "m3", "m8"],
        "attrs": {"model": ["5号AA", "7号AAA"], "pack": ["4粒卡装", "12粒盒装"]},
    },
    "power_strip": {
        "category": "convenience", "label": "分控防过载插线板", "siblings": ["alkaline_battery"],
        "merchants": ["m0", "m3", "m4"],
        "attrs": {"length": ["1.8m三孔位", "3m五孔位带USB"], "color": ["白色", "深空灰"]},
    },
    "heat_patch": {
        "category": "convenience", "label": "恒温发热暖贴", "siblings": ["mosquito_repellent"],
        "merchants": ["m0", "m4", "m8"],
        "attrs": {"pack": ["10片袋装", "30片整盒装"], "spec": ["衣贴标准款", "足贴款"]},
    },
    "mosquito_repellent": {
        "category": "convenience", "label": "草本驱蚊喷雾", "siblings": ["heat_patch"],
        "merchants": ["m0", "m4"],
        "attrs": {"volume": ["50ml随身装", "100ml宿舍装"], "scent": ["艾草无香", "薄荷清凉"]},
    },
    # 2. stationery (85 商品)
    "gel_pen": {
        "category": "stationery", "label": "速干按动中性笔", "siblings": ["highlighter_set", "exam_2b_kit"],
        "merchants": ["m1", "m7", "m0", "m9"],
        "attrs": {"tip": ["0.5mm子弹头", "0.38mm针管头"], "color": ["黑色", "蓝色", "红色"], "pack": ["单支装", "6支盒装", "12支整盒装"]},
    },
    "highlighter_set": {
        "category": "stationery", "label": "双头重点荧光笔", "siblings": ["gel_pen"],
        "merchants": ["m1", "m7"],
        "attrs": {"pack": ["4色套组", "6色套组"], "tone": ["柔和护眼色", "高亮荧光色"]},
    },
    "loose_leaf_notebook": {
        "category": "stationery", "label": "可拆卸活页笔记本", "siblings": ["wrong_question_book"],
        "merchants": ["m1", "m7", "m9"],
        "attrs": {"size": ["B5标准款", "A5便携款"], "inner": ["方格内页", "横线内页", "空白内页"]},
    },
    "wrong_question_book": {
        "category": "stationery", "label": "分栏错题整理本", "siblings": ["loose_leaf_notebook"],
        "merchants": ["m1", "m7"],
        "attrs": {"size": ["B5加厚80张", "A4宽幅60张"], "pack": ["单本装", "3本科目装"]},
    },
    "scientific_calculator": {
        "category": "stationery", "label": "双行函数科学计算器", "siblings": ["exam_2b_kit"],
        "merchants": ["m1", "m7", "m3"],
        "attrs": {"power": ["纽扣电池款", "太阳能双电源"], "color": ["银灰色", "薄荷绿"]},
    },
    "file_organizer": {
        "category": "stationery", "label": "多层风琴科目文件袋", "siblings": ["sticky_notes"],
        "merchants": ["m1", "m7"],
        "attrs": {"layers": ["5层手提款", "13层大容量"], "color": ["磨砂白", "莫兰迪蓝"]},
    },
    "mini_stapler": {
        "category": "stationery", "label": "省力便携订书机", "siblings": ["file_organizer"],
        "merchants": ["m1", "m7"],
        "attrs": {"spec": ["10号迷你含钉", "12号标准省力款"], "color": ["白色", "浅绿色"]},
    },
    "sticky_notes": {
        "category": "stationery", "label": "强粘不留胶便利贴", "siblings": ["index_tabs"],
        "merchants": ["m1", "m7", "m0"],
        "attrs": {"pack": ["单本100张", "4本组合装"], "size": ["76x76mm方形", "长条横线款"]},
    },
    "index_tabs": {
        "category": "stationery", "label": "半透明分类索引贴", "siblings": ["sticky_notes"],
        "merchants": ["m1", "m7"],
        "attrs": {"pack": ["单板120枚", "3板混色装"], "material": ["PET防水半透", "纸质易写款"]},
    },
    "exam_2b_kit": {
        "category": "stationery", "label": "标准化考试涂卡2B套组", "siblings": ["gel_pen", "scientific_calculator"],
        "merchants": ["m1", "m7"],
        "attrs": {"pack": ["涂卡笔+替芯简装", "涂卡笔+橡皮+尺全套"], "lead": ["扁头2B", "圆头2B"]},
    },
    # 3. food_beverage (95 商品)
    "oolong_tea": {
        "category": "food_beverage", "label": "原叶萃取乌龙茶", "siblings": ["sparkling_water", "iced_black_tea"],
        "merchants": ["m2", "m6", "m8", "m0", "m9"],
        "attrs": {"volume": ["500ml", "900ml"], "pack": ["单瓶装", "4瓶提装", "15瓶整箱装"], "sugar": ["无糖", "低糖"], "temp": ["常温", "冰镇"]},
    },
    "iced_black_tea": {
        "category": "food_beverage", "label": "鲜柠冰红茶饮料", "siblings": ["oolong_tea"],
        "merchants": ["m2", "m6", "m8"],
        "attrs": {"volume": ["500ml", "1L"], "pack": ["单瓶装", "6瓶提装"], "sugar": ["含糖原味", "低糖"], "temp": ["常温", "冰镇"]},
    },
    "sparkling_water": {
        "category": "food_beverage", "label": "零卡果味气泡水", "siblings": ["oolong_tea"],
        "merchants": ["m2", "m6", "m0"],
        "attrs": {"volume": ["480ml", "330ml"], "pack": ["单瓶装", "6瓶组合装"], "flavor": ["白桃味", "青柠味"], "sugar": ["无糖"]},
    },
    "pure_milk": {
        "category": "food_beverage", "label": "牧场纯牛奶", "siblings": ["oat_milk"],
        "merchants": ["m2", "m8", "m0", "m9"],
        "attrs": {"volume": ["250ml", "200ml"], "pack": ["单盒装", "6盒提装", "16盒整箱装"], "fat": ["全脂", "脱脂"]},
    },
    "oat_milk": {
        "category": "food_beverage", "label": "乳糖友好植物燕麦奶", "siblings": ["pure_milk"],
        "merchants": ["m2", "m6"],
        "attrs": {"volume": ["250ml便携盒", "1L分享装"], "sugar": ["无糖", "微甜原味"]},
    },
    "drip_coffee": {
        "category": "food_beverage", "label": "现磨挂耳黑咖啡", "siblings": ["oat_milk"],
        "merchants": ["m2", "m6", "m8"],
        "attrs": {"pack": ["5杯体验装", "12杯盒装"], "roast": ["深烘美式", "中烘坚果"], "sugar": ["无糖"]},
    },
    "whole_wheat_toast": {
        "category": "food_beverage", "label": "粗粮全麦切片吐司", "siblings": ["protein_oat_bar"],
        "merchants": ["m2", "m6", "m8"],
        "attrs": {"pack": ["2片早餐小包", "400g家庭袋装"], "sugar": ["无蔗糖", "蜂蜜微甜"]},
    },
    "protein_oat_bar": {
        "category": "food_beverage", "label": "奇亚籽谷物能量棒", "siblings": ["whole_wheat_toast", "mixed_nuts"],
        "merchants": ["m2", "m6", "m5"],
        "attrs": {"pack": ["单根装", "6根盒装"], "flavor": ["黑巧海盐味", "蔓越莓酸奶味"], "sugar": ["代糖款", "含糖经典款"]},
    },
    "mixed_nuts": {
        "category": "food_beverage", "label": "每日混合坚果包", "siblings": ["spiced_tofu_snack"],
        "merchants": ["m6", "m2", "m8"],
        "attrs": {"pack": ["25g单日袋", "7袋周享盒"], "flavor": ["原味无盐", "蜂蜜黄油味"]},
    },
    "spiced_tofu_snack": {
        "category": "food_beverage", "label": "独立小包装卤豆干", "siblings": ["instant_noodles"],
        "merchants": ["m6", "m8"],
        "attrs": {"pack": ["单小包", "10包分享袋"], "spice": ["五香不辣", "微辣", "香辣"]},
    },
    "instant_noodles": {
        "category": "food_beverage", "label": "非油炸宽面速食桶", "siblings": ["spiced_tofu_snack"],
        "merchants": ["m8", "m6", "m0"],
        "attrs": {"pack": ["单桶装", "4桶囤货装"], "spice": ["番茄不辣", "红烧微辣", "酸辣"]},
    },
    # 4. digital (75 商品)
    "usbc_cable": {
        "category": "digital", "label": "编织双Type-C快充线", "siblings": ["gan_charger", "lightning_cable"],
        "merchants": ["m3", "m0", "m7", "m9"],
        "attrs": {"power": ["60W双C口", "100W数显双C口"], "length": ["1m标准线", "2m加长线"], "color": ["白色", "黑色"]},
    },
    "lightning_cable": {
        "category": "digital", "label": "苹果Lightning快充线", "siblings": ["usbc_cable"],
        "merchants": ["m3", "m0"],
        "attrs": {"power": ["27W快充C转L", "12W普通A转L"], "length": ["1m标准线", "2m加长线"]},
    },
    "gan_charger": {
        "category": "digital", "label": "氮化镓多口快充头", "siblings": ["power_bank"],
        "merchants": ["m3", "m7", "m9"],
        "attrs": {"power": ["30W单C口", "65W双C一A三口"], "color": ["白色", "冰晶蓝"]},
    },
    "power_bank": {
        "category": "digital", "label": "数显自带线充电宝", "siblings": ["gan_charger"],
        "merchants": ["m3", "m0"],
        "attrs": {"capacity": ["10000mAh轻薄款", "20000mAh大容量"], "color": ["白色", "深空灰"]},
    },
    "silent_mouse": {
        "category": "digital", "label": "图书馆轻音无线鼠标", "siblings": ["compact_keyboard"],
        "merchants": ["m3", "m7"],
        "attrs": {"mode": ["2.4G电池款", "蓝牙双模充电款"], "color": ["奶茶白", "石墨黑"]},
    },
    "compact_keyboard": {
        "category": "digital", "label": "紧凑配列无线机械键盘", "siblings": ["silent_mouse"],
        "merchants": ["m3", "m7"],
        "attrs": {"switch": ["轻音红轴68键", "段落茶轴84键"], "color": ["复古灰白", "蓝白拼色"]},
    },
    "tws_earbuds": {
        "category": "digital", "label": "无线蓝牙降噪耳机", "siblings": ["wired_typec_earphone"],
        "merchants": ["m3", "m9"],
        "attrs": {"spec": ["半入耳通话款", "入耳主动降噪款"], "color": ["白色", "曜石黑"]},
    },
    "wired_typec_earphone": {
        "category": "digital", "label": "有线带麦网课耳机", "siblings": ["tws_earbuds"],
        "merchants": ["m3", "m7"],
        "attrs": {"plug": ["Type-C接口", "3.5mm圆口"], "color": ["白色", "银黑色"]},
    },
    "usb_hub": {
        "category": "digital", "label": "笔记本Type-C拓展坞", "siblings": ["wired_typec_earphone"],
        "merchants": ["m3", "m7"],
        "attrs": {"ports": ["四口USB3.0", "六合一含HDMI网口"], "color": ["深空灰"]},
    },
    "stylus_tips": {
        "category": "digital", "label": "平板电容笔防滑替芯", "siblings": ["loose_leaf_notebook"],
        "merchants": ["m3", "m1"],
        "attrs": {"pack": ["2只装", "4只盒装"], "feel": ["微阻尼类纸感", "顺滑标准款"]},
    },
    # 5. dormitory (80 商品)
    "desk_lamp": {
        "category": "dormitory", "label": "无频闪护眼阅读台灯", "siblings": ["desk_fan"],
        "merchants": ["m4", "m3", "m0", "m9"],
        "attrs": {"mount": ["夹式充电款", "底座插电款"], "light": ["4000K自然光", "三色温可调"]},
    },
    "bed_curtain": {
        "category": "dormitory", "label": "宿舍床铺遮光床帘", "siblings": ["memory_pillow"],
        "merchants": ["m4", "m9"],
        "attrs": {"shade": ["单层透气款", "加厚全遮光款"], "size": ["上铺1.2m单门", "下铺1.5m三门"], "color": ["星河灰", "奶油白"]},
    },
    "bedside_caddy": {
        "category": "dormitory", "label": "上铺床边收纳挂篮", "siblings": ["foldable_box"],
        "merchants": ["m4", "m0"],
        "attrs": {"material": ["铁艺带挂钩", "加厚塑料免打孔"], "color": ["白色", "黑色"]},
    },
    "foldable_box": {
        "category": "dormitory", "label": "带盖折叠衣物收纳箱", "siblings": ["bedside_caddy"],
        "merchants": ["m4", "m0"],
        "attrs": {"size": ["中号30L", "大号55L"], "pack": ["单只装", "2只套组"]},
    },
    "memory_pillow": {
        "category": "dormitory", "label": "慢回弹护颈记忆枕", "siblings": ["bed_curtain"],
        "merchants": ["m4"],
        "attrs": {"height": ["低枕款", "中高护颈款"], "cover": ["冰丝凉感套", "针织棉套"]},
    },
    "desk_fan": {
        "category": "dormitory", "label": "宿舍轻音桌面夹扇", "siblings": ["desk_lamp"],
        "merchants": ["m4", "m3", "m0"],
        "attrs": {"power": ["4000mAh充电款", "USB直插款"], "color": ["白色", "牛油果绿"]},
    },
    "mug_warmer": {
        "category": "dormitory", "label": "宿舍限电恒温暖杯垫", "siblings": ["desk_lamp"],
        "merchants": ["m4", "m0"],
        "attrs": {"power": ["16W重力感应款", "20W数显定时款"], "color": ["复古绿", "暖白色"]},
    },
    "quick_dry_towel": {
        "category": "dormitory", "label": "超细纤维速干毛巾浴巾", "siblings": ["nonslip_slippers"],
        "merchants": ["m4", "m0", "m5"],
        "attrs": {"spec": ["35x75cm毛巾", "70x140cm浴巾"], "color": ["浅灰蓝", "米杏色"]},
    },
    "nonslip_slippers": {
        "category": "dormitory", "label": "EVA防滑静音浴室拖鞋", "siblings": ["quick_dry_towel"],
        "merchants": ["m4", "m0"],
        "attrs": {"size": ["37-38码", "39-40码", "41-42码", "43-44码"], "color": ["浅灰色", "薄荷绿", "深藏青"]},
    },
    "dehumidifier_bag": {
        "category": "dormitory", "label": "可挂式衣柜除湿吸潮袋", "siblings": ["foldable_box"],
        "merchants": ["m4", "m0", "m8"],
        "attrs": {"pack": ["3袋体验装", "10袋整箱装"], "scent": ["无香型", "白桃清香"]},
    },
    # 6. sports (65 商品)
    "badminton_shuttle": {
        "category": "sports", "label": "耐打羽毛球筒装", "siblings": ["table_tennis_set"],
        "merchants": ["m5", "m0", "m9"],
        "attrs": {"material": ["尼龙耐打6只筒", "鸭毛训练12只筒", "鹅毛比赛12只筒"], "speed": ["76速", "77速"]},
    },
    "jump_rope": {
        "category": "sports", "label": "轴承计数健身跳绳", "siblings": ["resistance_band"],
        "merchants": ["m5", "m4"],
        "attrs": {"mode": ["无绳长绳两用款", "钢丝竞速款"], "color": ["黑红配色", "薄荷灰"]},
    },
    "yoga_mat": {
        "category": "sports", "label": "TPE防滑隔音瑜伽垫", "siblings": ["resistance_band"],
        "merchants": ["m5", "m4"],
        "attrs": {"thickness": ["6mm进阶款", "10mm加厚减震款"], "color": ["雾霾蓝", "樱花粉", "深空灰"]},
    },
    "wrist_guard": {
        "category": "sports", "label": "运动加压透气护腕", "siblings": ["knee_brace"],
        "merchants": ["m5"],
        "attrs": {"pack": ["单只装", "双手成对装"], "size": ["均码可调"]},
    },
    "knee_brace": {
        "category": "sports", "label": "硅胶弹簧支撑护膝", "siblings": ["wrist_guard"],
        "merchants": ["m5"],
        "attrs": {"pack": ["单只装", "双只成对装"], "size": ["M码", "L码"]},
    },
    "sports_bottle": {
        "category": "sports", "label": "Tritan大容量刻度运动水壶", "siblings": ["sweat_headband"],
        "merchants": ["m5", "m4", "m0"],
        "attrs": {"volume": ["750ml弹盖款", "1500ml吨吨桶"], "color": ["磨砂黑", "渐变蓝"]},
    },
    "sweat_headband": {
        "category": "sports", "label": "硅胶导汗防滑运动头带", "siblings": ["wrist_guard"],
        "merchants": ["m5"],
        "attrs": {"pack": ["单条装", "2条换洗装"], "color": ["经典黑", "冷感灰"]},
    },
    "table_tennis_set": {
        "category": "sports", "label": "双拍含球乒乓球拍套组", "siblings": ["badminton_shuttle"],
        "merchants": ["m5", "m1"],
        "attrs": {"grip": ["横拍长柄双拍", "直拍短柄双拍"], "level": ["初学训练款", "高弹进阶款"]},
    },
    "resistance_band": {
        "category": "sports", "label": "天然乳胶训练弹力带", "siblings": ["yoga_mat", "jump_rope"],
        "merchants": ["m5"],
        "attrs": {"level": ["15磅轻阻款", "25磅中阻款", "15+35磅双条组"]},
    },
}

# 80 篇知识文档版本的固定 ID 与属性契约：
# - 平台级共 24 篇（含 3 对 v1 WITHDRAWN -> v2 PUBLISHED、11 篇单版 PUBLIC、2 篇 DRAFT、5 篇 PLATFORM_INTERNAL）
# - 活跃商户 m0..m8 共 52 篇：
#   * 每店必有：kd-{mid}-pickup-v2 (PUBLIC, PUBLISHED; m0..m5 为 >=1050 字多块长文，ordinal=1 承载晚间/周末延时或特殊核销条款)、
#               kd-{mid}-service-v1 (PUBLIC, PUBLISHED; m0..m5 为 >=1050 字多块长文，ordinal=1 承载规格质保/温控/限电等专项规则)、
#               kd-{mid}-int-sop-v1 (MERCHANT_INTERNAL, PUBLISHED, canary="SYNTH-CANARY-V2-{MID}-SOP")、
#               kd-{mid}-int-stock-v1 (MERCHANT_INTERNAL, PUBLISHED, canary="SYNTH-CANARY-V2-{MID}-STK")、
#               kd-{mid}-promo-draft (PUBLIC, DRAFT)
#   * m0..m6 另有历史撤回版：kd-{mid}-pickup-v1 (PUBLIC, WITHDRAWN, version=1, rootKey="rk-{mid}-pickup")
# - 停业商户 m9 共 4 篇：
#   * kd-m9-pickup-v1 (PUBLIC, PUBLISHED — 因 m9 SUSPENDED，不进入任何角色 allowedDocumentIds)
#   * kd-m9-clearance-v1 (PUBLIC, PUBLISHED — 因 m9 SUSPENDED，不进入任何角色 allowedDocumentIds)
#   * kd-m9-int-sop-v1 (MERCHANT_INTERNAL, PUBLISHED, canary="SYNTH-CANARY-V2-M9-SOP")
#   * kd-m9-int-close-v1 (MERCHANT_INTERNAL, WITHDRAWN, canary="SYNTH-CANARY-V2-M9-OLD")
PLATFORM_DOC_IDS = [
    # 3 对版本演进（rootKey 相同，v1 WITHDRAWN, v2 PUBLISHED）
    "kd-plat-pickup-v1", "kd-plat-pickup-v2",
    "kd-plat-refund-v1", "kd-plat-refund-v2",
    "kd-plat-proposal-v1", "kd-plat-proposal-v2",
    # 11 篇单版 PUBLIC PUBLISHED（其中 payment, dispute, food, digital, dormpower 为 >=1050 字多块长文）
    "kd-plat-payment-v1", "kd-plat-dispute-v1", "kd-plat-limits-v1", "kd-plat-splitorder-v1",
    "kd-plat-food-v1", "kd-plat-digital-v1", "kd-plat-dormpower-v1", "kd-plat-weather-v1",
    "kd-plat-invoice-v1", "kd-plat-privacy-v1", "kd-plat-nodelivery-v1",
    # 2 篇 DRAFT
    "kd-plat-coupon-draft", "kd-plat-locker-draft",
    # 5 篇 PLATFORM_INTERNAL（前4篇 PUBLISHED 含 SYNTH-CANARY-V2-PLAT-01..04，第5篇 WITHDRAWN 含 SYNTH-CANARY-V2-PLAT-OLD）
    "kd-plat-int-risk-v1", "kd-plat-int-arb-v1", "kd-plat-int-suspend-v1", "kd-plat-int-quota-v1", "kd-plat-int-old-v1",
]
