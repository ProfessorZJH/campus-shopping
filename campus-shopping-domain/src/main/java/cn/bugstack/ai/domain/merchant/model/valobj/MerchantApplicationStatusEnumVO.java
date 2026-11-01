package cn.bugstack.ai.domain.merchant.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 商户入驻申请的审核状态值对象。 */
public enum MerchantApplicationStatusEnumVO {
    SUBMITTED,
    APPROVED,
    REJECTED;

    public static String filter(String code) {
        return EnumValues.filter(MerchantApplicationStatusEnumVO.class, code);
    }
}
