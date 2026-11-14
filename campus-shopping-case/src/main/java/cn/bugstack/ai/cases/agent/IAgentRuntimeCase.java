package cn.bugstack.ai.cases.agent;

import cn.bugstack.ai.cases.agent.model.AgentRuntimeReceipt;
import cn.bugstack.ai.cases.agent.model.RunAgentCommand;

/** 受控 Runtime 编排入口；不映射为公开用户 HTTP 路由。 */
public interface IAgentRuntimeCase {
    AgentRuntimeReceipt run(RunAgentCommand command);
}
