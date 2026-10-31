package cn.bugstack.ai.domain.inventory.model.valobj;

import java.time.*;
import java.util.*;

/** 库存操作流水，只向获授权商户成员展示。 */
public record StockMovementVO(
  String id,
  String skuId,
  String type,
  int quantity,
  String bizKey,
  Instant createdAt
) {
  public StockMovementVO {
    StockMovementTypeEnumVO.fromCode(type);
  }

  public StockMovementTypeEnumVO state() {
    return StockMovementTypeEnumVO.fromCode(type);
  }
}
