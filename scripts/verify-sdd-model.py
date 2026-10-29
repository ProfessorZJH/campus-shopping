#!/usr/bin/env python3
"""SDD-02：无 Maven 依赖的 Java 17 读模型校验 + 图片快照 SQL 链路静态检查。"""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / 'campus-shopping-api/src/main/java/cn/bugstack/ai/api/dto/PageResponseDTO.java'
ORDER = ROOT / 'campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/trading/model/entity/OrderItemEntity.java'
PROPOSAL = ROOT / 'campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/shoppingai/model/valobj/ProposalItemVO.java'
RUNNER = ROOT / 'scripts/verification/SddReadModelCheck.java'

checks = {
    'new schema': ('docs/dev-ops/mysql/sql/00_r1_schema.sql', 'image_url VARCHAR(255) NOT NULL DEFAULT'),
    'app schema': ('campus-shopping-app/src/main/resources/schema.sql', 'image_url VARCHAR(255) NOT NULL DEFAULT'),
    'upgrade migration': ('docs/database/migrations/V20261028_01__order_item_image_snapshot.sql', "COLUMN_NAME='image_url'"),
    'insert SQL': ('campus-shopping-app/src/main/resources/mybatis/mapper/itradingdao_mapper.xml', 'INSERT INTO trd_order_item(order_id,sku_id,title,spec_key,image_url'),
    'checkout snapshot': ('campus-shopping-case/src/main/java/cn/bugstack/ai/cases/trading/impl/CheckoutCaseImpl.java', 'o.imageUrl()'),
    'order DTO': ('campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/ApiViews.java', '.imageUrl(i.imageUrl())'),
    'cart DTO': ('campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/CartController.java', '.imageUrl(offer.imageUrl())'),
    'AI proposal': ('campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/ShoppingAiCaseImpl.java', 'o.imageUrl()'),
}
for label, (file, token) in checks.items():
    assert token in (ROOT / file).read_text(encoding='utf-8'), f'{label}: {token} missing'
orders = (ROOT / 'frontend/src/pages/Orders.js').read_text(encoding='utf-8')
assert 'coverSku' not in orders, '订单不得从当前 Catalog 回查历史图片'
with tempfile.TemporaryDirectory(prefix='sdd-read-model-') as dest:
    subprocess.run(['javac', '--release', '17', '-encoding', 'UTF-8', '-d', dest,
                    str(API), str(ORDER), str(PROPOSAL), str(RUNNER)], check=True)
    subprocess.run(['java', '-cp', dest, 'SddReadModelCheck'], check=True)
print(f'SDD_SQL_AND_MAPPING_CHECKS={len(checks) + 1}')
print('说明：这里只检查纯 Java 读模型和 SQL 文本，非 Spring/MySQL 联调')
