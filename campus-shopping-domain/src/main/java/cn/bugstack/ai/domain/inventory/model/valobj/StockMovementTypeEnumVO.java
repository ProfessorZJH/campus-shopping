package cn.bugstack.ai.domain.inventory.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 库存流水类型；流水的业务键负责幂等核对。 */
public enum StockMovementTypeEnumVO {
    REPLENISH, RESERVE, RELEASE, CONSUME;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static StockMovementTypeEnumVO fromCode(String code) {
        for (StockMovementTypeEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.STOCK_STATE_INVALID);
    }
}
