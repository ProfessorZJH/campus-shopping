package cn.bugstack.ai.api.dto;

import java.time.Instant;
import lombok.*;

/** 当前会话轮次的安全运行状态；不返回内部租约令牌。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationTurnStatusResponseDTO {

    private String conversationId;
    private String status;
    private Instant cancelRequestedAt;
}
