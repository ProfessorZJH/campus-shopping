package cn.bugstack.ai.domain.trading.model.valobj;

import java.time.Instant;

/** 售后申请和审核结果；业务分支统一检查枚举状态。 */
public record AfterSaleVO(String id, String orderId, String buyerId, String merchantId,
                          String status, String reason, String decisionReason, Instant createdAt) {
    public AfterSaleVO {
        AfterSaleStatusEnumVO.fromCode(status);
    }

    public AfterSaleStatusEnumVO statusEnum() {
        return AfterSaleStatusEnumVO.fromCode(status);
    }
}
