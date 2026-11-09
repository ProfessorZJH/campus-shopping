package cn.bugstack.ai.domain.shoppingai.adapter.port;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationVO;

/** Python Agent Runtime 适配边界；本切片只定义窄 Port，不新增公开 HTTP 路由。 */
public interface IAgentRuntimePort {
    AgentToolInvocationVO run(AgentRunVO run, String question);
}
