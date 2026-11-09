package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import cn.bugstack.ai.cases.agent.impl.AgentRunCaseImpl;
import cn.bugstack.ai.cases.agent.model.CreateAgentRunCommand;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolRegistry;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AgentToolRegistryTest {

    private static final Instant NOW = Instant.parse("2026-11-10T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void keepsM2EnabledByDefaultAndVersionsNewContractsWithoutEnablingThem() {
        assertTrue(AgentToolRegistry.enabled(AgentToolRegistry.SEARCH_PRODUCTS, false));
        assertFalse(AgentToolRegistry.enabled(AgentToolRegistry.KNOWLEDGE_QA, false));
        assertFalse(AgentToolRegistry.enabled(AgentToolRegistry.GET_MY_ORDERS, false));
        assertTrue(AgentToolRegistry.enabled(AgentToolRegistry.KNOWLEDGE_QA, true));
        assertEquals("1.0", AgentToolRegistry.version(AgentToolRegistry.KNOWLEDGE_QA));
        assertEquals("1.0", AgentToolRegistry.version(AgentToolRegistry.GET_MY_ORDERS));
    }

    @Test
    void defaultRunGateRejectsNewToolsBeforePythonRuntimeRollout() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, mock(IUserAccountService.class), mock(IAccessService.class), clock);

        AppException error = assertThrows(AppException.class, () ->
            runs.create(new CreateAgentRunCommand("buyer", "conversation", "turn-token", "request-1", null, Set.of(AgentToolRegistry.KNOWLEDGE_QA)))
        );

        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), error.getCode());
    }

    @Test
    void explicitGateCanCreateAReadOnlyRunWithBothVersionedConsumerTools() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IAccessService access = mock(IAccessService.class);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(access.memberships("buyer")).thenReturn(List.of(new MembershipVO("merchant-1", "buyer", "OWNER", "ACTIVE")));
        when(repository.findByIdempotency("buyer", "request-1")).thenReturn(null);
        when(repository.insert(any(AgentRunVO.class))).thenReturn(true);
        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, mock(IUserAccountService.class), access, clock, true);

        var receipt = runs.create(
            new CreateAgentRunCommand(
                "buyer",
                "conversation",
                "turn-token",
                "request-1",
                null,
                Set.of(AgentToolRegistry.KNOWLEDGE_QA, AgentToolRegistry.GET_MY_ORDERS)
            )
        );

        ArgumentCaptor<AgentRunVO> created = ArgumentCaptor.forClass(AgentRunVO.class);
        org.mockito.Mockito.verify(repository).insert(created.capture());
        assertEquals(Set.of(AgentToolRegistry.KNOWLEDGE_QA, AgentToolRegistry.GET_MY_ORDERS), created.getValue().allowedTools());
        assertTrue(receipt.runId() != null && !receipt.runId().isBlank());
    }
}
