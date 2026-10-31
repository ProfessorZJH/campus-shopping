package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 成交时的不可变商品快照。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemResponseDTO {

  private String skuId;
  private String title;
  private String specKey;
  private String imageUrl;
  private Long unitPriceCent;
  private Integer quantity;
}
