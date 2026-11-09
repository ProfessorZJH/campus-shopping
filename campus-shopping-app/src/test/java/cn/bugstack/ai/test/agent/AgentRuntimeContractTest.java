package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeCommandVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStageVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeToolCallVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AgentRuntimeContractTest {

    @Test
    void immutableDomainContractCarriesStartAndNativeToolCallStates() {
        AgentScopeVO scope = new AgentScopeVO(
            "u-1",
            "consumer",
            null,
            Set.of(),
            Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
            "c-1",
            "turn-1",
            Instant.now().plusSeconds(600)
        );
        AgentRuntimeCommandVO command = new AgentRuntimeCommandVO(
            "run-1",
            "req-1",
            "capability",
            AgentRuntimeStageVO.START,
            "找茶",
            scope,
            Set.of("search_products"),
            null,
            List.of()
        );
        assertEquals(AgentRuntimeStageVO.START, command.stage());
        assertEquals("run-1", command.runId());

        AgentRuntimeResultVO result = new AgentRuntimeResultVO(
            "run-1",
            "req-1",
            AgentRuntimeStatusVO.TOOL_CALLS,
            "cont-1",
            List.of(new AgentRuntimeToolCallVO("call-1", "search_products", Map.of("query", "茶"))),
            null,
            "STUB",
            Map.of("total_tokens", 1),
            12,
            null
        );
        assertEquals(AgentRuntimeStatusVO.TOOL_CALLS, result.status());
        assertEquals("search_products", result.toolCalls().get(0).name());
    }

    @Test
    void runtimeToolCallPreservesExplicitNullOptionalArgument() {
        Map<String, Object> arguments = new LinkedHashMap<>();
        arguments.put("query", "tea");
        arguments.put("merchantId", null);

        AgentRuntimeToolCallVO call = new AgentRuntimeToolCallVO("call-1", "search_products", arguments);

        assertNull(call.arguments().get("merchantId"));
        org.junit.jupiter.api.Assertions.assertThrows(UnsupportedOperationException.class, () -> call.arguments().put("query", "coffee"));
    }
}
