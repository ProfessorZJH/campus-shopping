package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 明确区分真实大模型、本地演示与故障降级。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
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
