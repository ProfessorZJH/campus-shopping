package cn.bugstack.ai.domain.catalog.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 商品发布状态；code 保持已有数据库和 HTTP 协议值。 */
public enum ProductStatusEnumVO {
    DRAFT("草稿"),
    PUBLISHED("已上架"),
    UNPUBLISHED("已下架");

    private final String info;

    ProductStatusEnumVO(String info) {
        this.info = info;
    }

    public String getCode() {
        return name();
    }

    public String getInfo() {
        return info;
    }

    public static ProductStatusEnumVO fromCode(String code) {
        return EnumValues.stored(ProductStatusEnumVO.class, code);
    }

    public static String filter(String code) {
        return EnumValues.filter(ProductStatusEnumVO.class, code);
    }
}
