package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 新增规格，金额单位为分。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkuRequestDTO {

  private String specKey;
  private Long priceCent;
}
