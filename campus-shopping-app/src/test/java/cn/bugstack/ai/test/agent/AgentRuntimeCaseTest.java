package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.bugstack.ai.cases.agent.IAgentRuntimeCase;
import cn.bugstack.ai.cases.agent.IAgentToolInvocationCase;
import cn.bugstack.ai.cases.agent.impl.AgentRunCaseImpl;
import cn.bugstack.ai.cases.agent.impl.AgentRuntimeCaseImpl;
import cn.bugstack.ai.cases.agent.model.AgentRuntimeReceipt;
import cn.bugstack.ai.cases.agent.model.RunAgentCommand;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAgentRuntimePort;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeCommandVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeToolCallVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;
import cn.bugstack.ai.types.common.Fingerprints;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AgentRuntimeCaseTest {

    private static final Instant NOW = Instant.parse("2026-11-10T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void executesToolThroughJavaAndContinuesOutsideAnyLongTransaction() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        AgentRunVO run = run();
        AgentRunVO running = run().running(NOW.plusSeconds(1));
        when(repository.find("run-1")).thenReturn(run, run, running, running, running, running, running);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(repository.update(any(), any())).thenReturn(true);

        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, accounts, mock(IAccessService.class), clock);
        IAgentRuntimePort runtime = mock(IAgentRuntimePort.class);
        AgentRuntimeToolCallVO call = new AgentRuntimeToolCallVO("call-1", "search_products", Map.of("query", "茶", "limit", 5));
        AgentRuntimeResultVO toolCalls = new AgentRuntimeResultVO("run-1", "req-1", AgentRuntimeStatusVO.TOOL_CALLS, "cont-1", List.of(call), null, "STUB", Map.of(), 12, null);
        AgentRuntimeResultVO finalAnswer = new AgentRuntimeResultVO("run-1", "req-2", AgentRuntimeStatusVO.FINAL, "cont-1", List.of(), "已找到", "STUB", Map.of(), 12, null);
        when(runtime.run(any(AgentRuntimeCommandVO.class))).thenReturn(toolCalls, finalAnswer);
        IAgentToolInvocationCase tools = mock(IAgentToolInvocationCase.class);
        when(tools.invoke(any())).thenReturn(new AgentToolResultVO("search_products", "1.0", true, List.of()));

        IAgentRuntimeCase runtimeCase = new AgentRuntimeCaseImpl(runs, repository, tools, runtime, clock);
        AgentRuntimeReceipt receipt = runtimeCase.run(new RunAgentCommand("buyer", "run-1", "capability", "找茶", "req-1"));

        assertEquals(AgentRuntimeStatusVO.FINAL, receipt.status());
        assertEquals("已找到", receipt.answer());
        assertEquals(2, receipt.rounds());
        verify(tools).invoke(any());
        verify(runtime, org.mockito.Mockito.times(2)).run(any(AgentRuntimeCommandVO.class));
    }

    @Test
    void rejectsToolArgumentsThatWouldEscapeTheRegisteredContract() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        AgentRunVO running = run().running(NOW.plusSeconds(1));
        when(repository.find("run-1")).thenReturn(run(), run(), running, running);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(repository.update(any(), any())).thenReturn(true);
        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, accounts, mock(IAccessService.class), clock);
        IAgentRuntimePort runtime = mock(IAgentRuntimePort.class);
        when(runtime.run(any())).thenReturn(new AgentRuntimeResultVO(
            "run-1", "req-1", AgentRuntimeStatusVO.TOOL_CALLS, "cont-1",
            List.of(new AgentRuntimeToolCallVO("call-1", "search_products", Map.of("query", "茶", "limit", 999))),
            null, "STUB", Map.of(), 12, null
        ));
        IAgentToolInvocationCase tools = mock(IAgentToolInvocationCase.class);
        AgentRuntimeCaseImpl runtimeCase = new AgentRuntimeCaseImpl(runs, repository, tools, runtime, clock);

        org.junit.jupiter.api.Assertions.assertThrows(
            cn.bugstack.ai.types.exception.AppException.class,
            () -> runtimeCase.run(new RunAgentCommand("buyer", "run-1", "capability", "找茶", "req-1"))
        );
        verify(tools, org.mockito.Mockito.never()).invoke(any());
    }

    @Test
    void rejectsExpiredLeaseBeforeCallingRuntimeOrTools() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        when(repository.find("run-1")).thenReturn(run());
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.minusSeconds(1));
        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, mock(IUserAccountService.class), mock(IAccessService.class), clock);
        IAgentRuntimePort runtime = mock(IAgentRuntimePort.class);
        IAgentToolInvocationCase tools = mock(IAgentToolInvocationCase.class);
        AgentRuntimeCaseImpl runtimeCase = new AgentRuntimeCaseImpl(runs, repository, tools, runtime, clock);

        org.junit.jupiter.api.Assertions.assertThrows(
            cn.bugstack.ai.types.exception.AppException.class,
            () -> runtimeCase.run(new RunAgentCommand("buyer", "run-1", "capability", "找茶", "req-1"))
        );
        verify(runtime, org.mockito.Mockito.never()).run(any());
        verify(tools, org.mockito.Mockito.never()).invoke(any());
    }

    private AgentRunVO run() {
        var scope = new AgentScopeVO(
            "buyer", AgentScopeVO.CONSUMER, null, Set.of("merchant-1"), Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
            "conversation", "turn-token", NOW.plusSeconds(600)
        );
        return new AgentRunVO("run-1", "buyer", "request-1", Fingerprints.sha256("capability"), scope,
            Set.of("search_products"), AgentRunStatusVO.CREATED, NOW, NOW, 0);
    }
}
