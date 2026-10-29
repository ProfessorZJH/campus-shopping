package cn.bugstack.ai.domain.merchant.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 商户经营状态：停用只阻止新交易，不直接取消已付款履约。 */
public enum MerchantStatusEnumVO {
    ACTIVE, SUSPENDED;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static MerchantStatusEnumVO fromCode(String code) {
        for (MerchantStatusEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.MERCHANT_SUSPENDED);
    }
}
