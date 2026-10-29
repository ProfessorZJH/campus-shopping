package cn.bugstack.ai.domain.inventory.model.valobj;
import java.util.*;
import java.time.*;
/** 按订单与 SKU 唯一的预占记录。 */
public record ReservationVO(String orderId, String storeId, String skuId, int quantity, String status) {}
