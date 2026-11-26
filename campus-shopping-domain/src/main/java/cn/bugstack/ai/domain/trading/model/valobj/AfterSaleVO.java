package cn.bugstack.ai.domain.trading.model.valobj;

import java.time.*;

/** 退款申请及裁决状态。 */
public record AfterSaleVO(
    String id,
    String orderId,
    String buyerId,
    String merchantId,
    String status,
    String reason,
    String decisionReason,
    Instant createdAt,
    String evidenceImageUrl
) {
    public AfterSaleVO(String id, String orderId, String buyerId, String merchantId, String status, String reason, String decisionReason, Instant createdAt) {
        this(id, orderId, buyerId, merchantId, status, reason, decisionReason, createdAt, "");
    }

    public AfterSaleVO {
        AfterSaleStatusEnumVO.fromCode(status);
        evidenceImageUrl = evidenceImageUrl == null ? "" : evidenceImageUrl;
    }

    public AfterSaleStatusEnumVO state() {
        return AfterSaleStatusEnumVO.fromCode(status);
    }
}
