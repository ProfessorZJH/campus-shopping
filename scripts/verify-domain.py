#!/usr/bin/env python3
"""无三方依赖时编译并运行生产纯领域类，不替代完整 Maven/数据库测试。"""
from pathlib import Path
import subprocess
import tempfile
import json
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parent.parent
BASE='src/main/java/cn/bugstack/ai/'
files=[
 'campus-shopping-types/'+BASE+'enums/ResponseCode.java'
]
# 源码清单固定，避免无意把测试替身当生产实现。
files=['campus-shopping-types/'+BASE+'types/'+p for p in ['enums/ResponseCode.java','exception/AppException.java','common/Checks.java','common/Fingerprints.java']]
files += ['campus-shopping-domain/'+BASE+'domain/'+p for p in [
 'catalog/model/entity/ProductSkuEntity.java','catalog/model/aggregate/ProductAggregate.java',
 'inventory/model/aggregate/StockBalanceAggregate.java','trading/model/entity/OrderItemEntity.java','trading/model/aggregate/OrderAggregate.java',
 'fulfillment/model/valobj/PickupVO.java','fulfillment/model/aggregate/PickupAggregate.java','shoppingai/model/aggregate/ProposalAggregate.java']]
# 枚举属于纯领域生产源码；编译脚本必须包含聚合/VO 新增的类型依赖。
files += ['campus-shopping-domain/'+BASE+'domain/'+p for p in [
  'catalog/model/valobj/ProductStatusEnumVO.java',
  'catalog/model/valobj/SkuStatusEnumVO.java',
  'trading/model/valobj/OrderStatusEnumVO.java',
  'fulfillment/model/valobj/PickupStatusEnumVO.java',
  'shoppingai/model/valobj/ProposalStatusEnumVO.java',
  'inventory/model/valobj/ReservationStatusEnumVO.java',
  'inventory/model/valobj/StockMovementTypeEnumVO.java',
  'trading/model/valobj/AfterSaleStatusEnumVO.java',
  'merchant/model/valobj/MerchantStatusEnumVO.java'
]]
files += ['scripts/verification/DomainRulesCheck.java']
with tempfile.TemporaryDirectory(prefix='campus-domain-') as out:
    subprocess.run(['javac','-encoding','UTF-8','--release','17','-d',out,*[str(ROOT/f) for f in files]],check=True)
    result=subprocess.run(['java','-cp',out,'DomainRulesCheck'],check=True,text=True,capture_output=True)
    print(result.stdout)
    target=ROOT/'docs/testing/evidence/domain-rules.txt';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(result.stdout,encoding='utf-8')
    checks=[l[5:] for l in result.stdout.splitlines() if l.startswith('PASS ')]
    (target.with_suffix('.json')).write_text(json.dumps({'timestamp':datetime.now(timezone.utc).isoformat(),'javaTarget':17,'productionSourcesCompiled':len(files)-1,'passedChecks':len(checks),'checks':checks,'randomizedInventoryOperations':5000,'mavenTested':False,'databaseTested':False,'frameworkStubsUsed':False},ensure_ascii=False,indent=2),encoding='utf-8')
