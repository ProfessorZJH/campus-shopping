package cn.bugstack.ai.domain.identity.model.valobj;

import java.util.*;

/** 商户权限白名单；角色可自定义，但不可声明任意服务端权限。 */
public final class MerchantPermissions {
    private MerchantPermissions() {}
    public static final String DASHBOARD_READ="dashboard.read", PRODUCT_READ="product.read", PRODUCT_WRITE="product.write",
            STOCK_READ="stock.read", STOCK_REPLENISH="stock.replenish", ORDER_READ="order.read",
            ORDER_PREPARE="order.prepare", PICKUP_VERIFY="pickup.verify", AFTERSALE_READ="aftersale.read",
            AFTERSALE_REVIEW="aftersale.review", KNOWLEDGE_READ="knowledge.read", KNOWLEDGE_MANAGE="knowledge.manage",
            TEAM_MANAGE="team.manage", STORE_MANAGE="store.manage", ROLE_MANAGE="role.manage";
    /** 权限分组固定，前端从服务器获取，不重复写一份权限列表。 */
    public static final Map<String,String> LABELS=Map.ofEntries(
            Map.entry(DASHBOARD_READ,"经营统计"),Map.entry(PRODUCT_READ,"查看商品"),Map.entry(PRODUCT_WRITE,"管理商品及价格"),
            Map.entry(STOCK_READ,"查看库存与流水"),Map.entry(STOCK_REPLENISH,"补货"),Map.entry(ORDER_READ,"查看订单"),
            Map.entry(ORDER_PREPARE,"备货"),Map.entry(PICKUP_VERIFY,"自提核销"),
            Map.entry(AFTERSALE_READ,"查看售后"),Map.entry(AFTERSALE_REVIEW,"审核售后"),
            Map.entry(KNOWLEDGE_READ,"读取知识库"),Map.entry(KNOWLEDGE_MANAGE,"管理知识库"),
            Map.entry(TEAM_MANAGE,"邀请和撤销成员"),Map.entry(STORE_MANAGE,"修改门店资料"),Map.entry(ROLE_MANAGE,"角色与权限管理"));
    /** 权限治理与关键身份授予只能 Owner 完成，不能通过自定义角色再转授权。 */
    public static final Set<String> PROTECTED=Set.of(TEAM_MANAGE,STORE_MANAGE,ROLE_MANAGE);
    public static final Set<String> CLERK=Set.of(PRODUCT_READ,STOCK_READ,STOCK_REPLENISH,ORDER_READ,ORDER_PREPARE,PICKUP_VERIFY);
    public static final Set<String> OWNER=Set.copyOf(LABELS.keySet());
    public static boolean isGrantable(String code){return LABELS.containsKey(code)&&!PROTECTED.contains(code);}
}
