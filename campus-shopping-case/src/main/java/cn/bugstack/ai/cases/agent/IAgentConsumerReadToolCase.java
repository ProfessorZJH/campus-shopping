package cn.bugstack.ai.cases.agent;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersResultVO;

/** 消费者 Agent 只读用例；不暴露 HTTP，也不包含购物车、订单或支付写操作。 */
public interface IAgentConsumerReadToolCase {
    AgentKnowledgeQaResultVO knowledgeQa(String actor, AgentKnowledgeQaRequestVO request);

    AgentMyOrdersResultVO myOrders(String actor, AgentMyOrdersRequestVO request);
}
