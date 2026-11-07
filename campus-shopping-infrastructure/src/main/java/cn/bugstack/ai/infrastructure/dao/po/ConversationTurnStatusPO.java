package cn.bugstack.ai.infrastructure.dao.po;

import java.time.Instant;
import lombok.*;

/** 会话当前轮次状态的只读投影。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationTurnStatusPO {

    private String conversationId;
    private String status;
    private Instant cancelRequestedAt;
}
