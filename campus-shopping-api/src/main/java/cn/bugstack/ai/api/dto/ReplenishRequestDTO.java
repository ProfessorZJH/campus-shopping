package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 库存补货数量。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReplenishRequestDTO {

  private Integer quantity;
}
