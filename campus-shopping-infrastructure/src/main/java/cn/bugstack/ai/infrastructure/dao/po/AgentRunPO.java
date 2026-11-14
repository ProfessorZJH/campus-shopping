package cn.bugstack.ai.infrastructure.dao.po;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Agent Run 持久化行；scope/tools 以受控 JSON 快照保存。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentRunPO {

    private String id;
    private String userId;
    private String idempotencyKey;
    private String capabilityTokenHash;
    private String conversationId;
    private String turnToken;
    private String scopeJson;
    private String toolsJson;
    private String status;
    private long version;
    private Instant createdAt;
    private Instant updatedAt;
}
