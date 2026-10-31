package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 一次仅提交一个商户的商品。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutRequestDTO {

  private String merchantId;
  private List<CheckoutItemDTO> items;
}
