package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;

/** Java 生成的 Runtime turn 命令；不依赖 HTTP 或序列化框架。 */
public record AgentRuntimeCommandVO(
    String runId,
    String requestId,
    String capabilityToken,
    AgentRuntimeStageVO stage,
    String question,
    AgentScopeVO scope,
    java.util.Set<String> allowedTools,
    String continuationId,
    List<AgentRuntimeToolResultVO> toolResults
) {
    public AgentRuntimeCommandVO {
        require(runId != null && !runId.isBlank() && runId.length() <= 64, ResponseCode.ILLEGAL_PARAMETER);
        require(requestId != null && !requestId.isBlank() && requestId.length() <= 128, ResponseCode.ILLEGAL_PARAMETER);
        require(capabilityToken != null && !capabilityToken.isBlank(), ResponseCode.AUTH_FORBIDDEN);
        require(stage != null && scope != null, ResponseCode.ILLEGAL_PARAMETER);
        require(stage == AgentRuntimeStageVO.CONTINUE || (question != null && !question.isBlank()), ResponseCode.ILLEGAL_PARAMETER);
        if (question != null) require(question.length() <= 2000, ResponseCode.REQUEST_TOO_LARGE);
        allowedTools = java.util.Set.copyOf(allowedTools == null ? java.util.Set.of() : allowedTools);
        require(!allowedTools.isEmpty() && allowedTools.stream().allMatch(AgentToolRegistry::contains), ResponseCode.AUTH_FORBIDDEN);
        require(
            stage == AgentRuntimeStageVO.START ? continuationId == null : continuationId != null && !continuationId.isBlank(),
            ResponseCode.ILLEGAL_PARAMETER
        );
        toolResults = List.copyOf(toolResults == null ? List.of() : toolResults);
        require(toolResults.size() <= 8, ResponseCode.REQUEST_TOO_LARGE);
    }
}
