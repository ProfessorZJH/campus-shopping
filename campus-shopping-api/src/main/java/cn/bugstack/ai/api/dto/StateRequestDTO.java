package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 平台经营状态变更。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StateRequestDTO {

  private Boolean active;
  private String reason;
}
