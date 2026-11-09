package cn.bugstack.ai.cases.agent;

import cn.bugstack.ai.cases.agent.model.AgentToolInvocationCommand;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;

public interface IAgentToolInvocationCase {
    AgentToolResultVO invoke(AgentToolInvocationCommand command);
}
