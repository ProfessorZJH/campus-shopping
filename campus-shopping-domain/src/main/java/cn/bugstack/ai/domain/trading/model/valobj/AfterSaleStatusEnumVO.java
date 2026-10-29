package cn.bugstack.ai.domain.trading.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 售后申请与裁决状态，不等同于订单退款状态。 */
public enum AfterSaleStatusEnumVO {
    REQUESTED, REJECTED, DISPUTED, APPROVED;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static AfterSaleStatusEnumVO fromCode(String code) {
        for (AfterSaleStatusEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.REFUND_STATE_INVALID);
    }
}
