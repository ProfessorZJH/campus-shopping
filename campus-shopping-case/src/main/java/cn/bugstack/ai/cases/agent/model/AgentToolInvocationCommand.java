package cn.bugstack.ai.cases.agent.model;

public record AgentToolInvocationCommand(
    String actor,
    String runId,
    String capabilityToken,
    String invocationKey,
    String toolName,
    String query,
    int limit,
    String merchantId
) {}
