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
    AgentToolInvocationResultVO result,
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

    /** Compatibility constructor for the M2 search_products persistence shape. */
    public AgentToolInvocationVO(
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
        this(
            id,
            runId,
            invocationKey,
            toolName,
            inputFingerprint,
            status,
            result == null ? null : new AgentToolInvocationResultVO(result),
            errorCode,
            createdAt,
            completedAt
        );
    }

    public boolean completed() {
        return "COMPLETED".equals(status);
    }
}
