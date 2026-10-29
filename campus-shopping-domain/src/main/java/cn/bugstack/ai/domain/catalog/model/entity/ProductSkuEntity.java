package cn.bugstack.ai.domain.catalog.model.entity;

import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;

/** 商品聚合内的 SKU 实体快照；外部编码保持数据库原有字符串契约。 */
public record ProductSkuEntity(String id, String specKey, long priceCent, String status, long version) {
    public ProductSkuEntity {
        SkuStatusEnumVO.fromCode(status);
    }

    public SkuStatusEnumVO statusEnum() {
        return SkuStatusEnumVO.fromCode(status);
    }
}
