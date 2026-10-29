package cn.bugstack.ai.domain.identity.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 商户成员状态；code 保持已有数据库和 HTTP 协议值。 */
public enum MembershipStatusEnumVO {
    ACTIVE("有效"),
    REVOKED("已撤销");

    private final String info;

    MembershipStatusEnumVO(String info) {
        this.info = info;
    }

    public String getCode() {
        return name();
    }

    public String getInfo() {
        return info;
    }

    public static MembershipStatusEnumVO fromCode(String code) {
        return EnumValues.stored(MembershipStatusEnumVO.class, code);
    }

    public static String filter(String code) {
        return EnumValues.filter(MembershipStatusEnumVO.class, code);
    }
}
