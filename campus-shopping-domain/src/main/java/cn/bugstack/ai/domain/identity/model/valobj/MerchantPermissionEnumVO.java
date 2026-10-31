package cn.bugstack.ai.domain.identity.model.valobj;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.Set;

/** 固定权限字典；自定义角色只是这些权限的集合，角色编码仍为动态业务数据。 */
public enum MerchantPermissionEnumVO {
  DASHBOARD_READ("dashboard.read", "经营统计", true, "order.read"),
  PRODUCT_READ("product.read", "查看商品", true, null),
  PRODUCT_WRITE("product.write", "管理商品及价格", true, "product.read"),
  STOCK_READ("stock.read", "查看库存与流水", true, null),
  STOCK_REPLENISH("stock.replenish", "补货", true, "stock.read"),
  ORDER_READ("order.read", "查看订单", true, null),
  ORDER_PREPARE("order.prepare", "备货", true, "order.read"),
  PICKUP_VERIFY("pickup.verify", "自提核销", true, "order.read"),
  AFTERSALE_READ("aftersale.read", "查看售后", true, null),
  AFTERSALE_REVIEW("aftersale.review", "审核售后", true, "aftersale.read"),
  KNOWLEDGE_READ("knowledge.read", "读取知识库", true, null),
  KNOWLEDGE_MANAGE("knowledge.manage", "管理知识库", true, "knowledge.read"),
  TEAM_MANAGE("team.manage", "邀请和撤销成员", false, null),
  STORE_MANAGE("store.manage", "修改门店资料", false, null),
  ROLE_MANAGE("role.manage", "角色与权限管理", false, null);

  private final String code;
  private final String label;
  private final boolean grantable;
  private final String prerequisite;

  MerchantPermissionEnumVO(String code, String label, boolean grantable, String prerequisite) {
    this.code = code;
    this.label = label;
    this.grantable = grantable;
    this.prerequisite = prerequisite;
  }

  public String getCode() {
    return code;
  }

  public String getLabel() {
    return label;
  }

  public boolean isGrantable() {
    return grantable;
  }

  public String prerequisite() {
    return prerequisite;
  }

  public static MerchantPermissionEnumVO find(String code) {
    for (var value : values()) if (value.code.equals(code)) return value;
    return null;
  }

  public static Set<String> validateGrant(Set<String> permissions) {
    require(
      permissions != null && !permissions.isEmpty() && permissions.size() <= 12,
      ResponseCode.ILLEGAL_PARAMETER
    );
    for (String code : permissions) {
      var permission = find(code);
      require(permission != null && permission.grantable, ResponseCode.ILLEGAL_PARAMETER);
      require(
        permission.prerequisite == null || permissions.contains(permission.prerequisite),
        ResponseCode.ILLEGAL_PARAMETER
      );
    }
    return Set.copyOf(permissions);
  }
}
