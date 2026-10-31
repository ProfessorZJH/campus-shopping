package cn.bugstack.ai.domain.fulfillment.model.valobj;

import java.time.*;
import java.util.*;

/** 自提任务；只存凭证摘要，不在商户列表暴露给无权用户。 */
public record PickupVO(
  String id,
  String orderId,
  String merchantId,
  String storeId,
  String buyerId,
  String status,
  String credentialHash,
  Instant expiresAt
) {
  public PickupVO {
    PickupStatusEnumVO.fromCode(status);
  }

  public PickupStatusEnumVO state() {
    return PickupStatusEnumVO.fromCode(status);
  }
}
