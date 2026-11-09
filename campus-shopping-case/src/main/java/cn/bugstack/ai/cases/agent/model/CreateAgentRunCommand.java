package cn.bugstack.ai.cases.agent.model;

import java.util.Set;

public record CreateAgentRunCommand(
    String actor,
    String conversationId,
    String turnToken,
    String idempotencyKey,
    String merchantId,
    Set<String> allowedTools
) {
    public CreateAgentRunCommand {
        allowedTools = Set.copyOf(allowedTools == null ? Set.of("search_products") : allowedTools);
    }
}
