package cn.bugstack.ai.domain.catalog.model.entity;

import java.time.*;
import java.util.*;

/** 商品聚合内的 SKU 实体快照。 */
public record ProductSkuEntity(String id, String specKey, long priceCent, String status, long version) {
    public ProductSkuEntity {
        cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO.fromCode(status);
    }

    public cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO state() {
        return cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO.fromCode(status);
    }
}
