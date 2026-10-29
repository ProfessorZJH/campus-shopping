package cn.bugstack.ai.domain.catalog.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** SKU 销售状态；商品上架不代表所有 SKU 都可售。 */
public enum SkuStatusEnumVO {
    ACTIVE, INACTIVE;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static SkuStatusEnumVO fromCode(String code) {
        for (SkuStatusEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.PRODUCT_UNAVAILABLE);
    }
}
