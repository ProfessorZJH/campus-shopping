package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 带商品版本的价格修改。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PriceRequestDTO {

  private Long priceCent;
  private Long expectedVersion;
}
