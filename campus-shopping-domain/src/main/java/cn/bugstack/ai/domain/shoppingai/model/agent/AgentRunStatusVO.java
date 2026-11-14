package cn.bugstack.ai.domain.shoppingai.model.agent;

public enum AgentRunStatusVO {
    CREATED,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELLED;

    public boolean terminal() {
        return this == COMPLETED || this == FAILED || this == CANCELLED;
    }
}
