package cn.bugstack.ai.domain.fulfillment.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 自提状态机，禁止用原始字符串绕开单次核销规则。 */
public enum PickupStatusEnumVO {
    WAIT_PREP, PREPARING, READY, COMPLETED, CANCELED;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static PickupStatusEnumVO fromCode(String code) {
        for (PickupStatusEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.ORDER_STATE_INVALID);
    }
}
