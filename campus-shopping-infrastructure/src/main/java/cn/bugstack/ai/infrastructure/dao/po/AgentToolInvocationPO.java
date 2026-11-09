package cn.bugstack.ai.infrastructure.dao.po;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Agent 工具调用幂等记录；输入正文不落库，只保存不可逆指纹。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentToolInvocationPO {

    private String id;
    private String runId;
    private String invocationKey;
    private String toolName;
    private String inputFingerprint;
    private String status;
    private String inputJson;
    private String outputJson;
    private String errorCode;
    private Instant createdAt;
    private Instant completedAt;
}
