"""商品语义候选回到 Java/MySQL 事实层的窄 Port 契约。

M1 只验证该边界和过滤规则；真实 Port 需要后续 Java Agent Gateway/现有 Catalog
查询能力接入，不在本模块内复制价格、库存或权限规则。
"""
from __future__ import annotations

from typing import Any, Mapping, Protocol

from pydantic import BaseModel, ConfigDict, Field

from .agent_contract import AgentScope


class CatalogFactSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    productId: str = Field(min_length=1, max_length=64)
    merchantId: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=100)
    skuId: str = Field(min_length=1, max_length=64)
    priceCent: int = Field(gt=0, le=100000000)
    available: int = Field(ge=0)
    published: bool
    merchantEligible: bool


class JavaCatalogFactPort(Protocol):
    def read_current_product_facts(self, product_ids: list[str], scope: AgentScope) -> list[Mapping[str, Any]]: ...


def revalidate_product_candidates(
    product_ids: list[str],
    scope: AgentScope,
    port: JavaCatalogFactPort,
) -> list[dict[str, Any]]:
    """只把 Java 返回且当前可售的商品转成已验证候选。

    价格、库存、经营资格和权限判断由 Port 所在的 Java/MySQL 领域能力完成；
    Python 仅消费结构化结果并做最低限度的形状校验。
    """

    scope.assert_active()
    if not product_ids:
        return []
    rows = port.read_current_product_facts(list(dict.fromkeys(product_ids)), scope)
    by_id: dict[str, CatalogFactSnapshot] = {}
    for row in rows:
        fact = CatalogFactSnapshot.model_validate(row, strict=True)
        if fact.productId not in by_id:
            by_id[fact.productId] = fact
    result = []
    for product_id in product_ids:
        fact = by_id.get(product_id)
        if fact is None or not fact.published or not fact.merchantEligible or fact.available <= 0:
            continue
        result.append(
            {
                "productId": fact.productId,
                "merchantId": fact.merchantId,
                "title": fact.title,
                "source": "MILVUS_CANDIDATE",
                "verified": True,
            }
        )
    return result
