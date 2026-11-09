package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;

public record AgentToolInvocationVO(
    String id,
    String runId,
    String invocationKey,
    String toolName,
    String inputFingerprint,
    String status,
    AgentToolResultVO result,
    String errorCode,
    Instant createdAt,
    Instant completedAt
) {
    public AgentToolInvocationVO {
        require(id != null && !id.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(runId != null && !runId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(invocationKey != null && !invocationKey.isBlank() && invocationKey.length() <= 100, ResponseCode.ILLEGAL_PARAMETER);
        require(toolName != null && !toolName.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(inputFingerprint != null && !inputFingerprint.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(status != null && !status.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(createdAt != null, ResponseCode.ILLEGAL_PARAMETER);
    }

    public boolean completed() {
        return "COMPLETED".equals(status);
    }
}
