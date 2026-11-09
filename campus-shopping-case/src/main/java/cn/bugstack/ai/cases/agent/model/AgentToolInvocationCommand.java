package cn.bugstack.ai.cases.agent.model;

public record AgentToolInvocationCommand(
    String actor,
    String runId,
    String capabilityToken,
    String invocationKey,
    String toolName,
    String query,
    int limit,
    String merchantId,
    String state,
    int page,
    int size
) {
    /** M2 search_products compatibility constructor. */
    public AgentToolInvocationCommand(
        String actor,
        String runId,
        String capabilityToken,
        String invocationKey,
        String toolName,
        String query,
        int limit,
        String merchantId
    ) {
        this(actor, runId, capabilityToken, invocationKey, toolName, query, limit, merchantId, null, 1, 10);
    }

    /** Consumer read-only order constructor. */
    public static AgentToolInvocationCommand orders(
        String actor,
        String runId,
        String capabilityToken,
        String invocationKey,
        String state,
        int page,
        int size
    ) {
        return new AgentToolInvocationCommand(actor, runId, capabilityToken, invocationKey, "get_my_orders", null, 0, null, state, page, size);
    }

    /** Consumer read-only knowledge constructor. */
    public static AgentToolInvocationCommand knowledge(String actor, String runId, String capabilityToken, String invocationKey, String question) {
        return new AgentToolInvocationCommand(actor, runId, capabilityToken, invocationKey, "knowledge_qa", question, 0, null, null, 1, 10);
    }
}
