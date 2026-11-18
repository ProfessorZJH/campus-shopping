package cn.bugstack.ai.cases.agent;

import cn.bugstack.ai.cases.agent.model.AgentRunReceipt;
import cn.bugstack.ai.cases.agent.model.CreateAgentRunCommand;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;

public interface IAgentRunCase {
    AgentRunReceipt create(CreateAgentRunCommand command);
    AgentRunReceipt start(String actor, String runId, String capabilityToken);
    AgentRunReceipt complete(String actor, String runId, String capabilityToken);
    AgentRunReceipt fail(String actor, String runId, String capabilityToken);
    AgentRunVO usable(String actor, String runId, String capabilityToken);
}
