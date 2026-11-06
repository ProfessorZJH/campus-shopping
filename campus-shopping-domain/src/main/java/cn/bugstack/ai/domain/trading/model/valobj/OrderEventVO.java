package cn.bugstack.ai.domain.trading.model.valobj;

import java.time.Instant;

/** 订单/售后只追加事件；时间与角色是实际写入事实，不由展示层推测。 */
public record OrderEventVO(String id, String orderId, String afterSaleId, String type, Instant occurredAt, String actorId, String actorRole, String reason) {}
