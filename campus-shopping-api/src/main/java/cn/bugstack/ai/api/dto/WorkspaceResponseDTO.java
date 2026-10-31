package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 登录后可访问的工作台入口，不是客户端可声明的权限。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceResponseDTO {

  private Boolean platformAdmin;
  private java.util.Map<String, java.util.Set<String>> merchantPermissions;
  private List<MembershipResponseDTO> memberships;
  private List<MerchantResponseDTO> merchants;
}
