package cn.bugstack.ai.infrastructure.gateway.dto;

import java.util.List;
import java.util.Map;
import java.util.Set;
import com.fasterxml.jackson.annotation.JsonInclude;

/** 内部 Runtime 协议 DTO；只在 infrastructure 与 Python 服务之间使用。 */
public final class AgentRuntimeDTO {
    private AgentRuntimeDTO() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ToolResult(String callId, String name, Map<String, Object> result, String errorCode) {}

    public record Command(
        String protocolVersion,
        String runId,
        String requestId,
        String phase,
        String question,
        Scope scope,
        List<ToolDefinition> allowedTools,
        String continuationId,
        List<ToolResult> toolResults
    ) {}

    public record ToolDefinition(String name, String description, Map<String, Object> parameters, boolean readOnly) {}

    public record Scope(
        String userId,
        String identityKind,
        String identityId,
        Set<String> authorizedMerchantIds,
        Set<String> permissions,
        String conversationId,
        String turnToken,
        double turnExpiresAt
    ) {}

    public record ToolCall(String callId, String name, Map<String, Object> arguments) {}

    public record Result(
        String protocolVersion,
        String runId,
        String requestId,
        String status,
        String continuationId,
        List<ToolCall> toolCalls,
        String answer,
        String evidenceStatus,
        Map<String, Integer> usage,
        long durationMs,
        String errorCode
    ) {}
}
