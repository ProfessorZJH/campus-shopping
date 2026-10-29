package cn.bugstack.ai.domain.trading.model.valobj;
import java.util.*;
import java.time.*;
/** 退款申请及裁决状态。 */
public record AfterSaleVO(String id, String orderId, String buyerId, String merchantId, String status, String reason, String decisionReason, Instant createdAt) {}
