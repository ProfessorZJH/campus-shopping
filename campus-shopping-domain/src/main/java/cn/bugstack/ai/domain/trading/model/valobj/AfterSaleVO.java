package cn.bugstack.ai.domain.trading.model.valobj;

import java.time.*;
import java.util.*;

/** 退款申请及裁决状态。 */
public record AfterSaleVO(
  String id,
  String orderId,
  String buyerId,
  String merchantId,
  String status,
  String reason,
  String decisionReason,
  Instant createdAt
) {
  public AfterSaleVO {
    AfterSaleStatusEnumVO.fromCode(status);
  }

  public AfterSaleStatusEnumVO state() {
    return AfterSaleStatusEnumVO.fromCode(status);
  }
}
