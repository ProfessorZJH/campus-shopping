package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 库存变动审计流水。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockMovementPO {

  private String id;
  private String merchantId;
  private String storeId;
  private String skuId;
  private String type;
  private Integer quantity;
  private String bizKey;
  private Instant createdAt;
}
