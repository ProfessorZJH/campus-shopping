package cn.bugstack.ai.cases.agent.model;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;

/** 已由上层创建的受控 Run 的一次 Runtime 请求。 */
public record RunAgentCommand(String actor, String runId, String capabilityToken, String question, String requestId) {
    public RunAgentCommand {
        require(actor != null && !actor.isBlank() && actor.length() <= 64, ResponseCode.ILLEGAL_PARAMETER);
        require(runId != null && !runId.isBlank() && runId.length() <= 64, ResponseCode.ILLEGAL_PARAMETER);
        require(capabilityToken != null && !capabilityToken.isBlank(), ResponseCode.AUTH_FORBIDDEN);
        require(question != null && !question.isBlank() && question.length() <= 2000, ResponseCode.ILLEGAL_PARAMETER);
        require(requestId == null || (!requestId.isBlank() && requestId.length() <= 128), ResponseCode.ILLEGAL_PARAMETER);
    }
}
