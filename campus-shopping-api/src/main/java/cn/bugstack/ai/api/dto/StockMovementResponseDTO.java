package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 库存操作流水。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockMovementResponseDTO {

  private String id;
  private String skuId;
  private String type;
  private Integer quantity;
  private String bizKey;
  private Instant createdAt;
}
