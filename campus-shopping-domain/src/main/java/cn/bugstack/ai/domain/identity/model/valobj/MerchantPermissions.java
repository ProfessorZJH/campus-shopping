package cn.bugstack.ai.domain.identity.model.valobj;

import java.util.*;

/** 商户权限白名单；角色可自定义，但不可声明任意服务端权限。 */
public final class MerchantPermissions {

    private MerchantPermissions() {}

    public static final String DASHBOARD_READ = MerchantPermissionEnumVO.DASHBOARD_READ.getCode(),
        PRODUCT_READ = MerchantPermissionEnumVO.PRODUCT_READ.getCode(),
        PRODUCT_WRITE = MerchantPermissionEnumVO.PRODUCT_WRITE.getCode(),
        STOCK_READ = MerchantPermissionEnumVO.STOCK_READ.getCode(),
        STOCK_REPLENISH = MerchantPermissionEnumVO.STOCK_REPLENISH.getCode(),
        ORDER_READ = MerchantPermissionEnumVO.ORDER_READ.getCode(),
        ORDER_PREPARE = MerchantPermissionEnumVO.ORDER_PREPARE.getCode(),
        PICKUP_VERIFY = MerchantPermissionEnumVO.PICKUP_VERIFY.getCode(),
        AFTERSALE_READ = MerchantPermissionEnumVO.AFTERSALE_READ.getCode(),
        AFTERSALE_REVIEW = MerchantPermissionEnumVO.AFTERSALE_REVIEW.getCode(),
        KNOWLEDGE_READ = MerchantPermissionEnumVO.KNOWLEDGE_READ.getCode(),
        KNOWLEDGE_MANAGE = MerchantPermissionEnumVO.KNOWLEDGE_MANAGE.getCode(),
        TEAM_MANAGE = MerchantPermissionEnumVO.TEAM_MANAGE.getCode(),
        STORE_MANAGE = MerchantPermissionEnumVO.STORE_MANAGE.getCode(),
        ROLE_MANAGE = MerchantPermissionEnumVO.ROLE_MANAGE.getCode();
    /** 权限分组固定，前端从服务器获取，不重复写一份权限列表。 */
    public static final Map<String, String> LABELS = java.util.Arrays.stream(MerchantPermissionEnumVO.values()).collect(
        java.util.stream.Collectors.toUnmodifiableMap(MerchantPermissionEnumVO::getCode, MerchantPermissionEnumVO::getLabel)
    );
    /** 权限治理与关键身份授予只能 Owner 完成，不能通过自定义角色再转授权。 */
    public static final Set<String> PROTECTED = Set.of(TEAM_MANAGE, STORE_MANAGE, ROLE_MANAGE);
    public static final Set<String> CLERK = Set.of(PRODUCT_READ, STOCK_READ, STOCK_REPLENISH, ORDER_READ, ORDER_PREPARE, PICKUP_VERIFY);
    public static final Set<String> OWNER = Set.copyOf(LABELS.keySet());

    public static boolean isGrantable(String code) {
        var value = MerchantPermissionEnumVO.find(code);
        return value != null && value.isGrantable();
    }
}
