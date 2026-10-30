package cn.bugstack.ai.domain.identity.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 店员邀请状态；code 保持已有数据库和 HTTP 协议值。 */
public enum InvitationStatusEnumVO {
    PENDING("待接受"),
    ACCEPTED("已接受"),
    CANCELED("已取消");

    private final String info;

    InvitationStatusEnumVO(String info) {
        this.info = info;
    }

    public String getCode() {
        return name();
    }

    public String getInfo() {
        return info;
    }

    public static InvitationStatusEnumVO fromCode(String code) {
        return EnumValues.stored(InvitationStatusEnumVO.class, code);
    }

    public static String filter(String code) {
        return EnumValues.filter(InvitationStatusEnumVO.class, code);
    }
}
