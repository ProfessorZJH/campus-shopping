package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 购物车数据，不承担库存预占。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartItemPO {

  private String userId;
  private String merchantId;
  private String skuId;
  private Integer quantity;
}
