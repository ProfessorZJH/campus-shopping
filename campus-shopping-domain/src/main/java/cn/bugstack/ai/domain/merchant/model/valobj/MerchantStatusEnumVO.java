package cn.bugstack.ai.domain.merchant.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 商户经营状态；code 保持已有数据库和 HTTP 协议值。 */
public enum MerchantStatusEnumVO {
    ACTIVE("营业中"),
    SUSPENDED("暂停营业");

    private final String info;

    MerchantStatusEnumVO(String info) {
        this.info = info;
    }

    public String getCode() {
        return name();
    }

    public String getInfo() {
        return info;
    }

    public static MerchantStatusEnumVO fromCode(String code) {
        return EnumValues.stored(MerchantStatusEnumVO.class, code);
    }

    public static String filter(String code) {
        return EnumValues.filter(MerchantStatusEnumVO.class, code);
    }
}
