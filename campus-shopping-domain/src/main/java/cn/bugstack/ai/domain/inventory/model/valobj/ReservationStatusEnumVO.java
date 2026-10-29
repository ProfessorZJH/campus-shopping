package cn.bugstack.ai.domain.inventory.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 库存预占状态：释放与消耗是互斥终态。 */
public enum ReservationStatusEnumVO {
    RESERVED, RELEASED, CONSUMED;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static ReservationStatusEnumVO fromCode(String code) {
        for (ReservationStatusEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.STOCK_STATE_INVALID);
    }
}
