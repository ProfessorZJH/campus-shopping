package cn.bugstack.ai.cases.agent;

import cn.bugstack.ai.cases.agent.model.AgentToolInvocationCommand;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;

public interface IAgentToolInvocationCase {
    AgentToolResultVO invoke(AgentToolInvocationCommand command);

    /**
     * Versioned envelope used by the Runtime continuation path. Existing M2
     * callers keep using {@link #invoke(AgentToolInvocationCommand)}.
     */
    default AgentToolInvocationResultVO invokeResult(AgentToolInvocationCommand command) {
        return new AgentToolInvocationResultVO(invoke(command));
    }
}
