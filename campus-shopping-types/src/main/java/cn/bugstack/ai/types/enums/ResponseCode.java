package cn.bugstack.ai.types.enums;

/** 集中业务码；错误响应保留 code/info/data，HTTP 层与业务层语义分开。 */
public enum ResponseCode {
  SUCCESS("0000", "成功"),
  UN_ERROR("0001", "系统暂不可用"),
  ILLEGAL_PARAMETER("0002", "非法参数"),
  AUTH_USERNAME_EXISTS("A0001", "用户名已被注册"),
  AUTH_BAD_CREDENTIALS("A0002", "用户名或密码错误"),
  AUTH_ACCOUNT_DISABLED("A0003", "账号已停用"),
  AUTH_UNAUTHENTICATED("A0004", "请先登录"),
  AUTH_CSRF_INVALID("A0005", "安全令牌无效，请刷新后重试"),
  AUTH_FORBIDDEN("A0006", "无权执行此操作"),
  AUTH_RATE_LIMITED("A0007", "请求过于频繁，请稍后再试"),
  NOT_FOUND("G0001", "资源不存在或不可访问"),
  STATE_CONFLICT("G0002", "状态已经变化，请刷新后重试"),
  REQUEST_CONFLICT("G0003", "同一请求键不能用于不同内容"),
  REQUEST_TOO_LARGE("G0004", "请求体超过允许大小"),
  METHOD_NOT_ALLOWED("G0005", "请求方法不支持"),
  MEDIA_TYPE_UNSUPPORTED("G0006", "请求内容类型不支持"),
  MEDIA_TYPE_NOT_ACCEPTABLE("G0007", "响应内容类型不支持"),
  MERCHANT_REQUEST_CONFLICT("M0001", "幂等键已用于另一份申请"),
  MERCHANT_ALREADY_REVIEWED("M0002", "申请已经审核，不能重复处理"),
  MERCHANT_SELF_REVIEW_FORBIDDEN("M0003", "申请人不能审核自己的入驻申请"),
  MERCHANT_SUSPENDED("M0004", "商户当前暂停经营"),
  MERCHANT_PROFILE_INCOMPLETE("M0005", "申请资料不完整，不能开通门店"),
  MERCHANT_ROLE_NAME_EXISTS("M0006", "本商户已存在同名角色"),
  PRODUCT_UNAVAILABLE("C0001", "商品已下架或规格不可售"),
  PRICE_CHANGED("C0002", "商品价格或版本已变化，请重新确认"),
  SKU_DUPLICATE("C0003", "商品规格重复"),
  STOCK_NOT_ENOUGH("I0001", "可售库存不足"),
  STOCK_STATE_INVALID("I0002", "库存预占状态冲突"),
  ORDER_STATE_INVALID("T0001", "订单当前状态不允许此操作"),
  ORDER_EXPIRED("T0002", "订单已超过付款期限"),
  ORDER_MIXED_MERCHANT("T0003", "一次只能结算一个商户"),
  REFUND_STATE_INVALID("T0004", "售后状态不允许此操作"),
  CART_QUANTITY_LIMIT("T0005", "同一规格最多可加入99件，请调整购物车数量"),
  CART_LINE_LIMIT("T0006", "购物车已满，请先清理部分商品"),
  PICKUP_INVALID("F0001", "自提凭证无效或过期"),
  PICKUP_NOT_READY("F0002", "商品尚未备货完成"),
  PICKUP_STATE_INVALID("F0003", "自提任务当前状态不允许此操作"),
  AI_UNAVAILABLE("AI0001", "智能服务暂不可用，普通购物不受影响"),
  PROPOSAL_EXPIRED("AI0002", "推荐建议已过期，请重新生成"),
  KNOWLEDGE_NOT_READY("AI0003", "知识索引尚未就绪"),
  UPLOAD_INVALID("AI0004", "文件格式、大小或内容不符合要求");

  private final String code;
  private final String info;

  ResponseCode(String code, String info) {
    this.code = code;
    this.info = info;
  }

  public String getCode() {
    return code;
  }

  public String getInfo() {
    return info;
  }

  /** 兼容旧 String 构造入口，同时禁止未登记的对外业务码。 */
  public static ResponseCode fromCode(String code) {
    for (ResponseCode value : values()) if (value.code.equals(code)) return value;
    throw new IllegalArgumentException("未登记的响应码");
  }

  public boolean isOperationalFailure() {
    return this == UN_ERROR || this == AI_UNAVAILABLE;
  }
}
