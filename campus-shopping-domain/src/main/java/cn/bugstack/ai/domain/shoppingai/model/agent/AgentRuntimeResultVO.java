package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;
import java.util.Map;

public record AgentRuntimeResultVO(
    String runId,
    String requestId,
    AgentRuntimeStatusVO status,
    String continuationId,
    List<AgentRuntimeToolCallVO> toolCalls,
    String answer,
    String evidenceStatus,
    Map<String, Integer> usage,
    long durationMs,
    String errorCode
) {
    public AgentRuntimeResultVO {
        require(runId != null && !runId.isBlank(), ResponseCode.AI_UNAVAILABLE);
        require(requestId != null && !requestId.isBlank(), ResponseCode.AI_UNAVAILABLE);
        require(status != null, ResponseCode.AI_UNAVAILABLE);
        toolCalls = List.copyOf(toolCalls == null ? List.of() : toolCalls);
        usage = Map.copyOf(usage == null ? Map.of() : usage);
        require(durationMs >= 0 && durationMs <= 120_000, ResponseCode.AI_UNAVAILABLE);
        if (status == AgentRuntimeStatusVO.TOOL_CALLS) require(!toolCalls.isEmpty() && continuationId != null, ResponseCode.AI_UNAVAILABLE);
        if (status == AgentRuntimeStatusVO.FINAL) require(answer != null && !answer.isBlank(), ResponseCode.AI_UNAVAILABLE);
        if (status == AgentRuntimeStatusVO.FAILED) require(errorCode != null && !errorCode.isBlank(), ResponseCode.AI_UNAVAILABLE);
    }
}
