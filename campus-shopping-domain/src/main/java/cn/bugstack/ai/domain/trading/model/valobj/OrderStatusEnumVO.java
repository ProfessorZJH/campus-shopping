package cn.bugstack.ai.domain.trading.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 订单状态只允许聚合根的业务行为转换。 */
public enum OrderStatusEnumVO {
    PENDING_PAYMENT, PAID, COMPLETED, CANCELED, REFUNDED;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static OrderStatusEnumVO fromCode(String code) {
        for (OrderStatusEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.ORDER_STATE_INVALID);
    }
}
