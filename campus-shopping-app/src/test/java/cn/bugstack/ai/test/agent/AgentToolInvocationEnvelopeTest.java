package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.bugstack.ai.cases.agent.IAgentConsumerReadToolCase;
import cn.bugstack.ai.cases.agent.impl.AgentRunCaseImpl;
import cn.bugstack.ai.cases.agent.impl.AgentToolInvocationCaseImpl;
import cn.bugstack.ai.cases.agent.model.AgentToolInvocationCommand;
import cn.bugstack.ai.domain.catalog.service.ICatalogCandidateQuery;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentOrderItemSummaryVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentOrderSummaryVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolRegistry;
import cn.bugstack.ai.types.common.Fingerprints;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AgentToolInvocationEnvelopeTest {

    private static final Instant NOW = Instant.parse("2026-11-10T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void dispatchesKnowledgeWithVersionedEnvelopeAndPreservesExplicitNullWarning() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        IAgentConsumerReadToolCase consumer = mock(IAgentConsumerReadToolCase.class);
        AgentRunVO run = run(Set.of(AgentToolRegistry.KNOWLEDGE_QA));
        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, accounts, mock(IAccessService.class), clock);
        when(repository.find("run-1")).thenReturn(run);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(repository.invocation("run-1", "call-1")).thenReturn(null);
        when(repository.claimInvocation(any())).thenReturn(true);
        when(repository.completeInvocationEnvelope(eq("run-1"), eq("call-1"), any(), any(), any())).thenReturn(true);
        AgentKnowledgeQaResultVO answer = new AgentKnowledgeQaResultVO(
            "knowledge_qa", "1.0", true, "question", "answer", "ANSWER", "REAL", null, List.of(), 8
        );
        when(consumer.knowledgeQa(eq("buyer"), any())).thenReturn(answer);

        AgentToolInvocationCaseImpl tools = new AgentToolInvocationCaseImpl(
            repository,
            runs,
            mock(ICatalogCandidateQuery.class),
            mock(IInventoryService.class),
            mock(IMerchantService.class),
            accounts,
            clock,
            consumer,
            true
        );

        AgentToolInvocationResultVO result = tools.invokeResult(
            AgentToolInvocationCommand.knowledge("buyer", "run-1", "capability", "call-1", "question")
        );

        assertEquals("knowledge_qa", result.tool());
        assertTrue(result.runtimePayload().containsKey("warning"));
        assertNull(result.runtimePayload().get("warning"));
        verify(repository).completeInvocationEnvelope(eq("run-1"), eq("call-1"), any(), eq(result), any());
    }

    @Test
    void dispatchesOwnOrdersAndReplaysEnvelopeWithoutRepeatingQuery() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        IAgentConsumerReadToolCase consumer = mock(IAgentConsumerReadToolCase.class);
        AgentRunVO run = run(Set.of(AgentToolRegistry.GET_MY_ORDERS));
        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, accounts, mock(IAccessService.class), clock);
        when(repository.find("run-1")).thenReturn(run);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(repository.invocation("run-1", "call-2")).thenReturn(null);
        when(repository.claimInvocation(any())).thenReturn(true);
        when(repository.completeInvocationEnvelope(eq("run-1"), eq("call-2"), any(), any(), any())).thenReturn(true);
        AgentMyOrdersResultVO orders = new AgentMyOrdersResultVO(
            "get_my_orders", "1.0", true, "PAID", 1, 10, 1,
            List.of(new AgentOrderSummaryVO(
                "order-1", "PAID", 1200, NOW, "merchant",
                List.of(new AgentOrderItemSummaryVO("sku-1", "pen", "black", 1200, 1))
            ))
        );
        when(consumer.myOrders(eq("buyer"), any())).thenReturn(orders);

        AgentToolInvocationCaseImpl tools = new AgentToolInvocationCaseImpl(
            repository,
            runs,
            mock(ICatalogCandidateQuery.class),
            mock(IInventoryService.class),
            mock(IMerchantService.class),
            accounts,
            clock,
            consumer,
            true
        );
        AgentToolInvocationCommand command = AgentToolInvocationCommand.orders("buyer", "run-1", "capability", "call-2", "PAID", 1, 10);
        AgentToolInvocationResultVO result = tools.invokeResult(command);

        String fingerprint = Fingerprints.of("get_my_orders", "1.0", "PAID", 1, 10);
        when(repository.invocation("run-1", "call-2")).thenReturn(
            new cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationVO(
                "invocation-1", "run-1", "call-2", "get_my_orders", fingerprint, "COMPLETED", result, null, NOW, NOW
            )
        );
        AgentToolInvocationResultVO replay = tools.invokeResult(command);

        assertEquals(result, replay);
        verify(consumer).myOrders(eq("buyer"), any());
    }

    private AgentRunVO run(Set<String> tools) {
        AgentScopeVO scope = new AgentScopeVO(
            "buyer", AgentScopeVO.CONSUMER, null, Set.of(), Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
            "conversation", "turn-token", NOW.plusSeconds(600)
        );
        return new AgentRunVO("run-1", "buyer", "request-1", Fingerprints.sha256("capability"), scope, tools, AgentRunStatusVO.RUNNING, NOW, NOW, 0);
    }
}
