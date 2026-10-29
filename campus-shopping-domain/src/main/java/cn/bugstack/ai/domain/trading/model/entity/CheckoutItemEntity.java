package cn.bugstack.ai.domain.trading.model.entity;
import java.util.*;
import java.time.*;
/** 下单时消费者确认的价格与版本；不作为成交事实来源。 */
public record CheckoutItemEntity(String skuId, int quantity, long expectedPriceCent, long expectedVersion) {}
