package cn.bugstack.ai.domain.catalog.model.entity;
import java.util.*;
import java.time.*;
/** 商品聚合内的 SKU 实体快照。 */
public record ProductSkuEntity(String id, String specKey, long priceCent, String status, long version) {}
