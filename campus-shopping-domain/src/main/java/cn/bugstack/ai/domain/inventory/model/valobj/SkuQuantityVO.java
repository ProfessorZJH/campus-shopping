package cn.bugstack.ai.domain.inventory.model.valobj;

import java.time.*;
import java.util.*;

/** 库存命令只使用 SKU 标识和数量。 */
public record SkuQuantityVO(String skuId, int quantity) {}
