package cn.bugstack.ai.domain.catalog.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 商品发布状态，库存可售量由库存领域独立判定。 */
public enum ProductStatusEnumVO {
    DRAFT, PUBLISHED, UNPUBLISHED;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static ProductStatusEnumVO fromCode(String code) {
        for (ProductStatusEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.STATE_CONFLICT);
    }
}
