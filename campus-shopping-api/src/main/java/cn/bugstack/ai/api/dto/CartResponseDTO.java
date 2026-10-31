package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 购物车实时展示，失效商品仍允许移除。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartResponseDTO {

  private String merchantId;
  private String merchantName;
  private String skuId;
  private String title;
  private String specKey;
  private String imageUrl;
  private Long priceCent;
  private Long quoteVersion;
  private Integer quantity;
  private Long available;
  private Boolean sellable;
}
