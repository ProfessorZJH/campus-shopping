"""小样本可复现实验，不把本地字符向量的指标解释为真实模型效果。"""
import json,tempfile,time
from pathlib import Path
from app.config import Settings
from app.retrieval import KnowledgeStore
from .reports import new_run, write_json

def execute(output_dir=None):
    samples=[('pickup','自提政策','商品备货完成后到校园门店取货，自提凭证有效期20分钟，核销一次即失效。','自提凭证多久失效'),
      ('refund','退款规则','已支付尚未提货的订单可申请全额模拟退款。已核销商品本版不支持退货。','未提货可以退款吗'),
      ('fruit','苹果商品说明','红富士苹果为新鲜水果，售卖单位每袋五个，常温阴凉处储存。','苹果怎么保存'),
      ('pen','文具商品说明','黑色签字笔适合考试和日常书写，一盒十二支，不可擦。','考试黑色签字笔规格'),
      ('milk','牛奶商品说明','纯牛奶含乳制品，乳糖不耐受者请谨慎选择，开封后及时饮用。','乳糖不耐受能喝这种牛奶吗'),
      ('pay','付款规则','本系统仅演示模拟支付，不扣真实银行卡资金，不进行商户资金结算。','付款会扣银行卡钱吗'),
      ('close','订单超时规则','待支付订单十五分钟后自动关闭并释放预占库存。','未付款订单多久关闭'),
      ('member','店员规则','商户经营者可邀请已有账号成为店员，店员不能管理其他商户商品。','店员能修改其他商户商品吗')]
    with tempfile.TemporaryDirectory() as d:
        store=KnowledgeStore(Settings('evaluation-local-key-only-123456',str(Path(d)/'eval.db')))
        for id,title,text,_ in samples:store.index(id,title,text)
        details=[];latencies=[]
        for expected,_,_,q in samples:
            t=time.perf_counter();hits,mode=store.search(q,[s[0] for s in samples],5);latencies.append((time.perf_counter()-t)*1000)
            ids=list(dict.fromkeys(h['documentId'] for h in hits));details.append({'question':q,'expected':expected,'retrieved':ids,'hitAt1':bool(ids and ids[0]==expected),'hitAt5':expected in ids})
        report={'status':'EXECUTED_LOCAL_ONLY','sampleCount':len(samples),'retrievalMode':'BM25 + local character n-gram + RRF','realEmbeddingModelTested':False,'realLLMTested':False,'qdrantTested':False,'recallAt1':sum(x['hitAt1'] for x in details)/len(details),'recallAt5':sum(x['hitAt5'] for x in details)/len(details),'meanLatencyMs':sum(latencies)/len(latencies),'details':details,'limitation':'8条人工演示样本，不代表真实校园业务分布，也不是泛化性能承诺。'}
        store.close()
    output=new_run(output_dir)
    write_json(output/'legacy-demo.json',report)
    print(json.dumps({'output':str(output),'status':'EXECUTED_LOCAL_ONLY','sampleCount':8},ensure_ascii=False))
    return 0
