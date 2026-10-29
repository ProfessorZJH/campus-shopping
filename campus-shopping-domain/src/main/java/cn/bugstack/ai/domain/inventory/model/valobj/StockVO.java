package cn.bugstack.ai.domain.inventory.model.valobj;
import java.util.*;
import java.time.*;
/** 库存只读视图；可售量等于实物量减预占量。 */
public record StockVO(String merchantId, String storeId, String skuId, long onHand, long reserved, long version) {}
