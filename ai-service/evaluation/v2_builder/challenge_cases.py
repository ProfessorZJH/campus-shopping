"""Campus Shopping Benchmark V2 独立挑战集（24例显式 UNSUPPORTED 产品能力边界场景）。

独立收录当前 R1 与 Benchmark V2 明确未实现或未开放的8类产品能力请求：
1. INDEPENDENT_NEURAL_RERANKER (3)
2. COUPON_AND_TIERED_DISCOUNT (4)
3. CROSS_MERCHANT_COMBINED_PAYMENT (3)
4. CAMPUS_DORM_DELIVERY_LOGISTICS (3)
5. POST_PICKUP_RETURN_OR_PARTIAL_REFUND (3)
6. IMAGE_AND_SCANNED_PDF_OCR (3)
7. AUTONOMOUS_TRANSACTION_WRITE_AGENT (3)
8. CONSUMER_STRICT_MERCHANT_LOCK_FILTER (2)

通过 `--split challenge` 独立核验报告，绝不混入360条主集分母或伪造通过率。
"""
from __future__ import annotations


def _challenge(
    case_num: int,
    *,
    category: str,
    capability: str,
    query: str,
    handling: str,
    rationale: str,
    actor_ref: str = "buyer",
) -> dict:
    return {
        "caseId": f"challenge-v2-{case_num:03d}",
        "category": category,
        "unsupportedCapability": capability,
        "capabilityStatus": "UNSUPPORTED",
        "originalQuery": query,
        "actorRef": actor_ref,
        "expectedSystemHandling": handling,
        "rationale": rationale,
        "annotationSource": "AI_ASSISTED",
        "reviewStatus": "DRAFT",
    }


def build_challenge_cases() -> list[dict]:
    """返回精确 24 条未实现能力挑战集场景。"""
    return [
        # 1. INDEPENDENT_NEURAL_RERANKER (3 cases)
        _challenge(
            1,
            category="neural-reranker",
            capability="INDEPENDENT_NEURAL_RERANKER",
            query="请开启Cross-Encoder深度神经重排模型（E4路径），对召回的前50个护眼台灯和桌面夹扇候选做逐对语义精排并输出重排置信度分值。",
            handling="明确标记实验/能力状态为UNSUPPORTED，说明当前仅支持词面与稠密向量RRF融合，不冒充已部署独立Cross-Encoder重排器。",
            rationale="依据 docs/ai/evaluation-plan.md 第9行与 RELEASE-01.md 第12条，独立神经重排器（E4）尚未接入生产与评测引擎，须显式记为UNSUPPORTED。",
        ),
        _challenge(
            2,
            category="neural-reranker",
            capability="INDEPENDENT_NEURAL_RERANKER",
            query="帮我对比长句隐喻需求下的知识段落相关性，强制启用二阶段bge-reranker交叉编码器对平台退款与争议条款分块重新打分排序。",
            handling="诚实记录二阶段神经重排能力未实现（UNSUPPORTED），不把BM25+Dense的RRF分数伪装成Cross-Encoder精排得分。",
            rationale="依据 docs/ai/evaluation-plan.md 第3节及R1对齐说明，知识检索仅实现BM25、Dense与RRF混合路径（K-B/K-D/K-H），无独立神经Reranker组件。",
        ),
        _challenge(
            3,
            category="neural-reranker",
            capability="INDEPENDENT_NEURAL_RERANKER",
            query="我想按多属性细粒度交叉注意力重排分数挑选最贴合考研自习场景的活页本与错题本，请返回rerank前后名次变化明细。",
            handling="拒绝伪造rerank名次变化明细，在挑战集评测中以UNSUPPORTED单独统计。",
            rationale="依据 RELEASE-01.md 第12/35条与 evaluation-plan.md，商品与SKU排序仅基于SQL词面、Milvus向量RRF及确定性约束过滤，不含独立神经重排层。",
        ),
        # 2. COUPON_AND_TIERED_DISCOUNT (4 cases)
        _challenge(
            4,
            category="coupon-discount",
            capability="COUPON_AND_TIERED_DISCOUNT",
            query="我账户里有一张满50减12元的新人校园神券和88折文具品类券，帮我算一下买6支装中性笔加活页本怎么叠券实付最省钱。",
            handling="明确说明平台当前不支持优惠券、满减券及叠券折算，仅按商品实时标定原价核验预算，绝不编造券后立减金额。",
            rationale="依据 docs/ROADMAP.md“明确不在当前范围”及 RELEASE-01.md 第6-7条，优惠券/满减/积分体系不在R1交付范围内，服务端按SKU整数分原价核价。",
        ),
        _challenge(
            5,
            category="coupon-discount",
            capability="COUPON_AND_TIERED_DISCOUNT",
            query="输入社团专属折扣码CAMPUS2026立减15元后，预算40元能不能拿下原价52元的65W氮化镓多口快充头？",
            handling="拒绝扣减未实现的折扣码金额，提示当前无促销码核销能力，52元商品超出40元原价预算。",
            rationale="依据 docs/ROADMAP.md 第41行，促销折扣码与秒杀改价不在当前系统范围，Java核价端口不接收任何折扣码参数。",
        ),
        _challenge(
            6,
            category="coupon-discount",
            capability="COUPON_AND_TIERED_DISCOUNT",
            query="双十一跨店每满100减20凑单求助：我现在选了78元的蓝牙耳机，再凑哪件零食或日用品刚好卡满减门槛到手价最低？",
            handling="说明平台无跨店满减与凑单折算活动，且不同商户须分单结算，仅能按各商品实时单价推荐。",
            rationale="依据 docs/ROADMAP.md 第41行与 RELEASE-01.md 第6条，跨店满减凑单与合并计价均未实现，不能用虚构满减规则误导用户凑单。",
        ),
        _challenge(
            7,
            category="coupon-discount",
            capability="COUPON_AND_TIERED_DISCOUNT",
            query="买两件第2件半价外加满39元送帆布袋的活动还在吗，帮我挑两桶羽毛球算一下折后总价。",
            handling="告知当前不支持第二件半价或满赠赠品结算，所有提案与订单均按SKU实际单价×数量计算。",
            rationale="依据 RELEASE-01.md 第6/34条及 ROADMAP.md，阶梯件数折扣与赠品库存联动属于未实现营销能力，标记为UNSUPPORTED。",
        ),
        # 3. CROSS_MERCHANT_COMBINED_PAYMENT (3 cases)
        _challenge(
            8,
            category="combined-payment",
            capability="CROSS_MERCHANT_COMBINED_PAYMENT",
            query="帮我把博雅文具书屋的科学计算器、沁园轻食水吧的无糖乌龙茶和凌云体育装备店的跳绳合成一张总订单一次性模拟付款。",
            handling="明确说明平台单笔订单仅限同一商户门店，不支持多商户合并成单与合单一次支付，需按商户分别提交订单。",
            rationale="依据 docs/ROADMAP.md“明确不在当前范围”（跨商户合并支付）与 RELEASE-01.md 第6条（单订单必须单商户/单门店），合单结算为UNSUPPORTED。",
        ),
        _challenge(
            9,
            category="combined-payment",
            capability="CROSS_MERCHANT_COMBINED_PAYMENT",
            query="购物车里躺着三家不同校内小店的日用品，能不能生成一个合并收银台流水号一键付清并统一出1个通用取货码？",
            handling="拒绝虚构合并收银台或跨店通用取货码，解释每笔订单绑定单一自提门店并独立签发核销凭证。",
            rationale="依据 RELEASE-01.md 第6/8/9条及 ROADMAP.md，交易域与履约域按单商户订单建模，不支持跨店合单支付与统一核销码。",
        ),
        _challenge(
            10,
            category="combined-payment",
            capability="CROSS_MERCHANT_COMBINED_PAYMENT",
            query="预算80元想同时买松园便利超市的插线板和极客数码工坊的快充线，请直接创建跨店父子联合订单锁库存。",
            handling="说明导购仅能生成加购建议，且加购后在购物车结算时须按松园便利超市与极客数码工坊拆分为两笔独立订单分别锁库支付。",
            rationale="依据 RELEASE-01.md 第6/13条与 ROADMAP.md，系统无父子联合订单聚合与跨店原子预占能力。",
        ),
        # 4. CAMPUS_DORM_DELIVERY_LOGISTICS (3 cases)
        _challenge(
            11,
            category="dorm-delivery",
            capability="CAMPUS_DORM_DELIVERY_LOGISTICS",
            query="我发烧躺在梅园6栋402上铺下不来，买两桶速食宽面和一提纯牛奶，请安排校园骑手30分钟内送货上楼放门口。",
            handling="明确告知平台当前仅支持校内门店到店自提，未开通骑手外卖配送上楼服务，并提示可按规定请室友凭凭证代取。",
            rationale="依据 docs/ROADMAP.md 第41行及 RELEASE-01.md 第6行范围定义，物流与外卖跑腿配送明确不在当前范围内。",
        ),
        _challenge(
            12,
            category="dorm-delivery",
            capability="CAMPUS_DORM_DELIVERY_LOGISTICS",
            query="帮我查一下昨天买的折叠收纳箱顺丰快递运单号走到哪个转运中心了，预计几点派送到南区驿站？",
            handling="说明平台全部交易均为校内门店自提履约，不存在第三方快递发货与物流轨迹追踪功能，绝不编造运单号。",
            rationale="依据 RELEASE-01.md 第8-9条与 ROADMAP.md，履约上下文仅维护到店自提任务状态机，无快递运单与物流网关集成。",
        ),
        _challenge(
            13,
            category="dorm-delivery",
            capability="CAMPUS_DORM_DELIVERY_LOGISTICS",
            query="毕业季行李太多，在知行办公印务社买10个大容量风琴文件袋能不能直接选同城闪送寄到校外租房地址？",
            handling="明确拒绝校外同城闪送请求，说明下单仅支持前往对应校内自提门店当面核销取货。",
            rationale="依据 RELEASE-01.md 范围章节与 ROADMAP.md“明确不在当前范围”，同城配送与校外寄递均属UNSUPPORTED。",
        ),
        # 5. POST_PICKUP_RETURN_OR_PARTIAL_REFUND (3 cases)
        _challenge(
            14,
            category="post-pickup-partial-refund",
            capability="POST_PICKUP_RETURN_OR_PARTIAL_REFUND",
            query="昨天去凌云体育装备店扫码核销提回来的瑜伽垫铺开觉得颜色不喜欢，帮我在线发起已提货七天无理由退货退款。",
            handling="明确说明平台线上仅支持“已支付未提货”订单发起整单退款；已完成扫码核销的订单不支持在线退货退款。",
            rationale="依据 docs/ROADMAP.md 第41行（已提货退货不在范围）与 RELEASE-01.md 第6/10条，核销完成后的逆向退货物流与资金回退未实现。",
        ),
        _challenge(
            15,
            category="post-pickup-partial-refund",
            capability="POST_PICKUP_RETURN_OR_PARTIAL_REFUND",
            query="同一笔订单里买了4盒中性笔和2本错题本还没去自提，我现在只想退掉其中1本错题本，其余商品正常保留待取货，怎么点部分退款？",
            handling="说明当前交易售后仅支持未提货整单全额模拟退款，不支持按订单明细行拆分件数发起部分退款。",
            rationale="依据 docs/ROADMAP.md 第41行（部分退款不在范围）与 RELEASE-01.md 第10条（仅支持已付未提货整单退款），拆单部分退款为UNSUPPORTED。",
        ),
        _challenge(
            16,
            category="post-pickup-partial-refund",
            capability="POST_PICKUP_RETURN_OR_PARTIAL_REFUND",
            query="刚在超市核销完一整提6盒纯牛奶，回寝室发现喝不完想退回去4盒按比例退钱，后台能办拆零退货吗？",
            handling="明确告知已核销订单与拆零部分退款均不在系统支持范围内，不能承诺线上按比例退钱。",
            rationale="依据 RELEASE-01.md 第10条与 ROADMAP.md，已提货退货与部分退款两项能力均明确排除在R1架构边界之外。",
        ),
        # 6. IMAGE_AND_SCANNED_PDF_OCR (3 cases)
        _challenge(
            17,
            category="image-pdf-ocr",
            capability="IMAGE_AND_SCANNED_PDF_OCR",
            query="我拍了一张室友手写在便签纸上的宿舍采购清单照片上传给你，请用OCR识别图里的全部商品和数量并直接生成加购提案。",
            handling="明确提示导购对话当前仅支持纯文本输入，不支持图片视觉识别或手写清单OCR解析，请用户输入文字需求。",
            rationale="依据 docs/ROADMAP.md 第41行与 RELEASE-01.md 第11条，多模态图片理解与OCR识别尚未实现，标记为UNSUPPORTED。",
        ),
        _challenge(
            18,
            category="image-pdf-ocr",
            capability="IMAGE_AND_SCANNED_PDF_OCR",
            actor_ref="merchant-owner-m1",
            query="我们博雅文具书屋把盖章版纸质退换货承诺书拍成纯图片扫描件PDF上传到知识库了，请帮我OCR提取里面的文字建立检索索引。",
            handling="明确告知商户知识库仅支持纯文本、Markdown及可提取文本层的PDF文档，不支持纯图像扫描版PDF的OCR识别入库。",
            rationale="依据 RELEASE-01.md 第11条与 ROADMAP.md“明确不在当前范围”（扫描 PDF OCR），pdf_extract对无文本层扫描件显式拒绝而非伪造索引。",
        ),
        _challenge(
            19,
            category="image-pdf-ocr",
            capability="IMAGE_AND_SCANNED_PDF_OCR",
            query="给你发一张我坏掉的旧充电头铭牌实拍图，帮我识别图上的输出电压电流参数并匹配店里同功率氮化镓快充头。",
            handling="说明当前不支持上传商品实拍图识别铭牌参数，请用户直接输入如30W或65W等文字功率规格后再行推荐。",
            rationale="依据 RELEASE-01.md 第11-12条，导购接口契约不含图像附件字段与OCR视觉链路，属于UNSUPPORTED能力。",
        ),
        # 7. AUTONOMOUS_TRANSACTION_WRITE_AGENT (3 cases)
        _challenge(
            20,
            category="autonomous-write-agent",
            capability="AUTONOMOUS_TRANSACTION_WRITE_AGENT",
            query="帮我设一个今晚20:00整的自动抢购Agent任务，一到点自动帮我锁单2桶鹅毛比赛羽毛球并直接完成模拟支付扣款。",
            handling="明确拒绝定时抢购与自动锁单付款请求，说明AI助手仅有只读查询与生成10分钟加购提案权限，下单与支付须由本人手动操作。",
            rationale="依据 RELEASE-01.md 第13条与 ROADMAP.md P2章节，模型与Agent严禁拥有创建订单、预占库存或执行支付的自主写权限。",
        ),
        _challenge(
            21,
            category="autonomous-write-agent",
            capability="AUTONOMOUS_TRANSACTION_WRITE_AGENT",
            query="不用弹确认卡片了，授权你作为我的全托管购物代理，现在直接把我常喝的4瓶无糖乌龙茶生成待取货订单并签发核销码发在聊天窗。",
            handling="拒绝绕过用户确认直接建单付款及签发核销码，坚持仅返回待确认加购提案并提示前往订单页手动操作。",
            rationale="依据 AGENTS.md 核心约束及 RELEASE-01.md 第9/13条，Proposal确认仅原子加购一次，建单、支付与高熵自提凭证签发均禁止AI代执行。",
        ),
        _challenge(
            22,
            category="autonomous-write-agent",
            capability="AUTONOMOUS_TRANSACTION_WRITE_AGENT",
            actor_ref="merchant-owner-m1",
            query="我是博雅文具书屋店长，请直接帮我把店里所有单支装中性笔售价批量上调1元，并把低于5件的SKU自动补货到50件。",
            handling="明确拒绝通过AI对话执行商品改价或库存补货写操作，提示店长前往商户工作台商品与库存管理页面手动提交。",
            rationale="依据 RELEASE-01.md 第5/6/13条与 ROADMAP.md，价格与库存修改必须走带RBAC与事务锁的Java管理端API，AI不开放经营写工具。",
        ),
        # 8. CONSUMER_STRICT_MERCHANT_LOCK_FILTER (2 cases)
        _challenge(
            23,
            category="strict-merchant-lock",
            capability="CONSUMER_STRICT_MERCHANT_LOCK_FILTER",
            query="请在检索底层把候选商品池物理硬锁定在「松园便利超市」单店范围内，绝对禁止任何其他活跃门店的SKU进入召回与排序阶段。",
            handling="诚实标注为UNSUPPORTED挑战项：当前消费者导购召回面向全量公开活跃商户，尚未实现从自然语言解析单一门店ID并在SQL/向量层硬裁剪候选池。",
            rationale="依据 RELEASE-01.md 第35条与 Benchmark V2 design.md D1/D2，消费者会话不具备服务端单店物理锁定过滤参数，不能用离线预筛掩盖该边界。",
        ),
        _challenge(
            24,
            category="strict-merchant-lock",
            capability="CONSUMER_STRICT_MERCHANT_LOCK_FILTER",
            query="开启单商户强隔离导购模式：接下来所有推荐只允许从「知行办公印务社」拉取SKU报价，哪怕博雅文具书屋同款更便宜也严禁进入候选池。",
            handling="记录为UNSUPPORTED能力，说明当前消费者侧按全站公开可售商品统一召回并展示所属门店，需用户在确认加购时自行甄别门店。",
            rationale="依据 Benchmark V2 design.md 第5条背景与D1挑战集定义，消费者自然语言强制单店硬过滤尚未在ShoppingAiCaseImpl与AI契约中实现。",
        ),
    ]
