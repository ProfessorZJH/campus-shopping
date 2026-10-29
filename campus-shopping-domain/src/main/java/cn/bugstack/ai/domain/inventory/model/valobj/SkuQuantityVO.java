package cn.bugstack.ai.domain.inventory.model.valobj;
import java.util.*;
import java.time.*;
/** 库存命令只使用 SKU 标识和数量。 */
public record SkuQuantityVO(String skuId, int quantity) {}
