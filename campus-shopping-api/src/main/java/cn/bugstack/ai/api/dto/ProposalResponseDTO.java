package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 用户自己的导购提案。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProposalResponseDTO {

  private String id;
  private String status;
  private List<ProposalItemResponseDTO> items;
  private Instant expiresAt;
}
