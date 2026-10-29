package cn.bugstack.ai.domain.trading.model.valobj;
import java.util.*;
import java.time.*;
/** 购物车条目；加购不预占库存。 */
public record CartItemVO(String userId, String merchantId, String skuId, int quantity) {}
