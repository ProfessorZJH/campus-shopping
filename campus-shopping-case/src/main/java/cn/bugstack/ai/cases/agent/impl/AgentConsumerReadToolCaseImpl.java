package cn.bugstack.ai.cases.agent.impl;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

import cn.bugstack.ai.cases.agent.IAgentConsumerReadToolCase;
import cn.bugstack.ai.cases.shoppingai.IKnowledgeCase;
import cn.bugstack.ai.cases.shoppingai.impl.EvidenceAssembler;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.model.OrderPage;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeCitationVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentOrderItemSummaryVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentOrderSummaryVO;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiAnswerVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecallVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Duration;
import java.util.List;
import org.springframework.stereotype.Service;

/** 消费者只读工具的 Java 裁决层；模型只提供回答候选，权限和订单事实由 Java 重新读取。 */
@Service
public class AgentConsumerReadToolCaseImpl implements IAgentConsumerReadToolCase {

    private final IUserAccountService accounts;
    private final IKnowledgeCase knowledge;
    private final IAiEnginePort engine;
    private final KnowledgeEgressPolicy egress;
    private final EvidenceAssembler evidence;
    private final IOrderQueryCase orders;

    public AgentConsumerReadToolCaseImpl(
        IUserAccountService accounts,
        IKnowledgeCase knowledge,
        IAiEnginePort engine,
        KnowledgeEgressPolicy egress,
        IOrderQueryCase orders
    ) {
        this.accounts = accounts;
        this.knowledge = knowledge;
        this.engine = engine;
        this.egress = egress;
        this.evidence = new EvidenceAssembler(knowledge);
        this.orders = orders;
    }

    @Override
    public AgentKnowledgeQaResultVO knowledgeQa(String actor, AgentKnowledgeQaRequestVO request) {
        String user = text(actor, "用户", 64);
        require(request != null, ResponseCode.ILLEGAL_PARAMETER);
        accounts.requireActive(user);
        long started = System.nanoTime();

        List<KnowledgeScopeVO> readable = knowledge.readableScope(user);
        require(!readable.isEmpty(), ResponseCode.KNOWLEDGE_NOT_READY);
        String fingerprint = scope(readable);
        AiRecallVO recall = engine.recall(request.question(), List.of());
        List<String> allowed = readable.stream().map(KnowledgeScopeVO::id).toList();
        List<String> external = readable
            .stream()
            .filter(document -> egress.allows(document.visibility(), document.baseId(), document.merchantId()))
            .map(KnowledgeScopeVO::id)
            .toList();
        AiQueryEntity query = new AiQueryEntity(
            request.question(),
            allowed,
            List.of(),
            List.of(),
            recall.query(),
            List.of(),
            external
        );
        AiAnswerVO answer = engine.query(query);
        require(answer != null, ResponseCode.AI_UNAVAILABLE);

        List<KnowledgeScopeVO> current = knowledge.readableScope(user);
        require(fingerprint.equals(scope(current)), ResponseCode.KNOWLEDGE_NOT_READY);
        List<AiCitationVO> verified = evidence.verifyOutput(user, answer.citations() == null ? List.of() : answer.citations(), current);
        List<AgentKnowledgeCitationVO> citations = verified.stream().map(this::citation).toList();
        return new AgentKnowledgeQaResultVO(
            AgentKnowledgeQaRequestVO.TOOL,
            AgentKnowledgeQaRequestVO.VERSION,
            true,
            request.question(),
            answer.answer(),
            answer.mode(),
            answer.retrievalMode(),
            answer.warning(),
            citations,
            Duration.ofNanos(System.nanoTime() - started).toMillis()
        );
    }

    @Override
    public AgentMyOrdersResultVO myOrders(String actor, AgentMyOrdersRequestVO request) {
        String user = text(actor, "用户", 64);
        require(request != null, ResponseCode.ILLEGAL_PARAMETER);
        accounts.requireActive(user);
        OrderPage page = orders.mine(user, request.state(), request.page(), request.size());
        List<AgentOrderSummaryVO> summaries = page.items().stream().map(order -> summary(user, order)).toList();
        return new AgentMyOrdersResultVO(
            AgentMyOrdersRequestVO.TOOL,
            AgentMyOrdersRequestVO.VERSION,
            true,
            request.state(),
            request.page(),
            request.size(),
            page.total(),
            summaries
        );
    }

    private AgentKnowledgeCitationVO citation(AiCitationVO citation) {
        return new AgentKnowledgeCitationVO(citation.documentId(), citation.title(), citation.snippet(), citation.score());
    }

    private AgentOrderSummaryVO summary(String actor, OrderReadModel order) {
        require(order != null, ResponseCode.STATE_CONFLICT);
        require(actor.equals(order.buyerId()), ResponseCode.AUTH_FORBIDDEN);
        List<AgentOrderItemSummaryVO> items = order.items().stream().map(this::item).toList();
        return new AgentOrderSummaryVO(order.orderId(), order.status(), order.totalCent(), order.createdAt(), order.merchantName(), items);
    }

    private AgentOrderItemSummaryVO item(OrderItemEntity item) {
        require(item != null, ResponseCode.STATE_CONFLICT);
        return new AgentOrderItemSummaryVO(item.skuId(), item.title(), item.specKey(), item.unitPriceCent(), item.quantity());
    }

    private String scope(List<KnowledgeScopeVO> documents) {
        return Fingerprints.of(documents.stream().map(KnowledgeScopeVO::id).sorted().toArray());
    }
}
