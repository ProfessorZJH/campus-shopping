package cn.bugstack.ai.api.dto;

import java.util.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleResponseDTO {

  private String code;
  private String name;
  private Set<String> permissions;
  private Boolean builtin;
}
