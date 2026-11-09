package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.bugstack.ai.cases.agent.impl.AgentConsumerReadToolCaseImpl;
import cn.bugstack.ai.cases.shoppingai.IKnowledgeCase;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.model.OrderPage;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiAnswerVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecallVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class AgentConsumerReadToolCaseTest {

    private static final Instant NOW = Instant.parse("2026-11-10T00:00:00Z");

    @Test
    void knowledgeQaRechecksScopeAndOnlyReturnsVerifiedCitations() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IKnowledgeCase knowledge = mock(IKnowledgeCase.class);
        IAiEnginePort engine = mock(IAiEnginePort.class);
        IOrderQueryCase orders = mock(IOrderQueryCase.class);
        KnowledgeScopeVO scope = new KnowledgeScopeVO("doc-1", "校园 FAQ", "PUBLIC", "base-1", null);
        KnowledgeDocumentVO document = new KnowledgeDocumentVO(
            "doc-1",
            "root-1",
            "base-1",
            "校园 FAQ",
            null,
            "PUBLIC",
            1,
            "PUBLISHED",
            "READY",
            "退货规则说明",
            null,
            NOW
        );
        when(knowledge.readableScope("buyer")).thenReturn(List.of(scope), List.of(scope));
        when(engine.recall("退货规则", List.of())).thenReturn(new AiRecallVO("退货规则", List.of("退货")));
        when(engine.query(any())).thenReturn(
            new AiAnswerVO(
                "退货规则说明",
                "REAL",
                "VECTOR",
                "退货规则",
                null,
                List.of(new AiCitationVO("doc-1", "chunk-1", "校园 FAQ", "退货规则说明", 0.9)),
                List.of(),
                8
            )
        );
        when(knowledge.citationDocuments("buyer", List.of("doc-1"))).thenReturn(List.of(document));

        AgentConsumerReadToolCaseImpl read = new AgentConsumerReadToolCaseImpl(accounts, knowledge, engine, new KnowledgeEgressPolicy("", ""), orders);

        var result = read.knowledgeQa("buyer", new AgentKnowledgeQaRequestVO("退货规则"));

        assertEquals("退货规则说明", result.answer());
        assertEquals(1, result.citations().size());
        assertEquals("doc-1", result.citations().get(0).documentId());
        verify(engine).query(any());
        verify(knowledge).citationDocuments("buyer", List.of("doc-1"));
    }

    @Test
    void knowledgeQaFailsWhenScopeChangesDuringModelCall() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IKnowledgeCase knowledge = mock(IKnowledgeCase.class);
        IAiEnginePort engine = mock(IAiEnginePort.class);
        KnowledgeScopeVO scope = new KnowledgeScopeVO("doc-1", "校园 FAQ", "PUBLIC", "base-1", null);
        when(knowledge.readableScope("buyer")).thenReturn(List.of(scope), List.of());
        when(engine.recall("问题", List.of())).thenReturn(new AiRecallVO("问题", List.of()));
        when(engine.query(any())).thenReturn(new AiAnswerVO("回答", "REAL", "VECTOR", "问题", null, List.of(), List.of(), 1));

        AgentConsumerReadToolCaseImpl read = new AgentConsumerReadToolCaseImpl(
            accounts,
            knowledge,
            engine,
            new KnowledgeEgressPolicy("", ""),
            mock(IOrderQueryCase.class)
        );

        AppException error = assertThrows(AppException.class, () -> read.knowledgeQa("buyer", new AgentKnowledgeQaRequestVO("问题")));
        assertEquals(ResponseCode.KNOWLEDGE_NOT_READY.getCode(), error.getCode());
    }

    @Test
    void knowledgeQaRejectsCitationOutsideTheCurrentScope() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IKnowledgeCase knowledge = mock(IKnowledgeCase.class);
        IAiEnginePort engine = mock(IAiEnginePort.class);
        KnowledgeScopeVO scope = new KnowledgeScopeVO("doc-1", "校园 FAQ", "PUBLIC", "base-1", null);
        when(knowledge.readableScope("buyer")).thenReturn(List.of(scope), List.of(scope));
        when(engine.recall("问题", List.of())).thenReturn(new AiRecallVO("问题", List.of()));
        when(engine.query(any())).thenReturn(
            new AiAnswerVO("回答", "REAL", "VECTOR", "问题", null, List.of(new AiCitationVO("doc-2", "chunk-2", "越权", "越权内容", 0.9)), List.of(), 1)
        );
        AgentConsumerReadToolCaseImpl read = new AgentConsumerReadToolCaseImpl(
            accounts,
            knowledge,
            engine,
            new KnowledgeEgressPolicy("", ""),
            mock(IOrderQueryCase.class)
        );

        AppException error = assertThrows(AppException.class, () -> read.knowledgeQa("buyer", new AgentKnowledgeQaRequestVO("问题")));
        assertEquals(ResponseCode.KNOWLEDGE_NOT_READY.getCode(), error.getCode());
    }

    @Test
    void knowledgeQaPropagatesAiUnavailableWithoutInventingAnswer() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IKnowledgeCase knowledge = mock(IKnowledgeCase.class);
        IAiEnginePort engine = mock(IAiEnginePort.class);
        when(knowledge.readableScope("buyer")).thenReturn(List.of(new KnowledgeScopeVO("doc-1", "校园 FAQ", "PUBLIC", "base-1", null)));
        when(engine.recall("问题", List.of())).thenReturn(new AiRecallVO("问题", List.of()));
        when(engine.query(any())).thenThrow(new AppException(ResponseCode.AI_UNAVAILABLE));
        AgentConsumerReadToolCaseImpl read = new AgentConsumerReadToolCaseImpl(
            accounts,
            knowledge,
            engine,
            new KnowledgeEgressPolicy("", ""),
            mock(IOrderQueryCase.class)
        );

        AppException error = assertThrows(AppException.class, () -> read.knowledgeQa("buyer", new AgentKnowledgeQaRequestVO("问题")));
        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), error.getCode());
    }

    @Test
    void myOrdersAlwaysUsesActorBuyerAndReturnsNarrowSummary() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IOrderQueryCase orders = mock(IOrderQueryCase.class);
        OrderAggregate aggregate = new OrderAggregate(
            "order-1",
            "buyer",
            "merchant-1",
            "store-1",
            List.of(new OrderItemEntity("sku-1", "笔记本", "黑色", 1000, 2, "/private-image")),
            "PAID",
            NOW.plusSeconds(600),
            NOW
        );
        when(orders.mine("buyer", "PAID", 2, 5)).thenReturn(new OrderPage(List.of(new OrderReadModel(aggregate, "商户一", null, null)), 1));

        AgentConsumerReadToolCaseImpl read = new AgentConsumerReadToolCaseImpl(
            accounts,
            mock(IKnowledgeCase.class),
            mock(IAiEnginePort.class),
            new KnowledgeEgressPolicy("", ""),
            orders
        );

        var result = read.myOrders("buyer", new AgentMyOrdersRequestVO("PAID", 2, 5));

        assertEquals(1, result.items().size());
        assertEquals("order-1", result.items().get(0).orderId());
        assertEquals("商户一", result.items().get(0).merchantName());
        assertEquals(2, result.items().get(0).items().get(0).quantity());
        verify(orders).mine(eq("buyer"), eq("PAID"), eq(2), eq(5));
    }

    @Test
    void myOrdersSupportsEmptyPageWithoutInventingFacts() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IOrderQueryCase orders = mock(IOrderQueryCase.class);
        when(orders.mine("buyer", "", 1, 10)).thenReturn(new OrderPage(List.of(), 0));
        AgentConsumerReadToolCaseImpl read = new AgentConsumerReadToolCaseImpl(
            accounts,
            mock(IKnowledgeCase.class),
            mock(IAiEnginePort.class),
            new KnowledgeEgressPolicy("", ""),
            orders
        );

        var result = read.myOrders("buyer", new AgentMyOrdersRequestVO(null, 1, 10));

        assertEquals(0, result.total());
        assertEquals(List.of(), result.items());
        verify(orders).mine("buyer", "", 1, 10);
    }

    @Test
    void myOrdersRejectsAReadModelBelongingToAnotherBuyer() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IOrderQueryCase orders = mock(IOrderQueryCase.class);
        OrderAggregate aggregate = new OrderAggregate(
            "order-1",
            "other-buyer",
            "merchant-1",
            "store-1",
            List.of(new OrderItemEntity("sku-1", "笔记本", "黑色", 1000, 1)),
            "PAID",
            NOW.plusSeconds(600),
            NOW
        );
        when(orders.mine("buyer", "", 1, 5)).thenReturn(new OrderPage(List.of(new OrderReadModel(aggregate, "商户一", null, null)), 1));
        AgentConsumerReadToolCaseImpl read = new AgentConsumerReadToolCaseImpl(
            accounts,
            mock(IKnowledgeCase.class),
            mock(IAiEnginePort.class),
            new KnowledgeEgressPolicy("", ""),
            orders
        );

        AppException error = assertThrows(AppException.class, () -> read.myOrders("buyer", new AgentMyOrdersRequestVO(null, 1, 5)));
        assertEquals(ResponseCode.AUTH_FORBIDDEN.getCode(), error.getCode());
    }
}
