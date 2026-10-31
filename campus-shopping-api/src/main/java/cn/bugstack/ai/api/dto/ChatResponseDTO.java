package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 明确区分真实大模型、本地演示与故障降级。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponseDTO {

  private String conversationId;
  private String answer;
  private String mode;
  private String retrievalMode;
  private String warning;
  private List<CitationResponseDTO> citations;
  private ProposalResponseDTO proposal;
  private Long latencyMs;
}
