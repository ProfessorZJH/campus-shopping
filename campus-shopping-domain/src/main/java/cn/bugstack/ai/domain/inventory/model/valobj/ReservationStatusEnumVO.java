package cn.bugstack.ai.domain.inventory.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 库存预占生命周期；code 保持已有数据库和 HTTP 协议值。 */
public enum ReservationStatusEnumVO {
    RESERVED("已预占"),
    RELEASED("已释放"),
    CONSUMED("已消耗");

    private final String info;

    ReservationStatusEnumVO(String info) {
        this.info = info;
    }

    public String getCode() {
        return name();
    }

    public String getInfo() {
        return info;
    }

    public static ReservationStatusEnumVO fromCode(String code) {
        return EnumValues.stored(ReservationStatusEnumVO.class, code);
    }

    public static String filter(String code) {
        return EnumValues.filter(ReservationStatusEnumVO.class, code);
    }
}
