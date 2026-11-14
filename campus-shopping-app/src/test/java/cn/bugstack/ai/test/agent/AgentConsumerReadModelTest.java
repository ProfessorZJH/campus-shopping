package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentKnowledgeQaResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersRequestVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentMyOrdersResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentOrderItemSummaryVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentOrderSummaryVO;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class AgentConsumerReadModelTest {

    @Test
    void requestModelsRejectEmptyLongAndOutOfRangeValues() {
        assertThrows(AppException.class, () -> new AgentKnowledgeQaRequestVO(""));
        assertThrows(AppException.class, () -> new AgentKnowledgeQaRequestVO("x".repeat(1001)));
        assertThrows(AppException.class, () -> new AgentMyOrdersRequestVO("UNKNOWN", 1, 10));
        assertThrows(AppException.class, () -> new AgentMyOrdersRequestVO(null, 0, 10));
        assertThrows(AppException.class, () -> new AgentMyOrdersRequestVO(null, 1, 21));
    }

    @Test
    void resultsAreReadOnlyVersionedAndDefensivelyCopied() {
        AgentOrderItemSummaryVO item = new AgentOrderItemSummaryVO("sku-1", "笔记本", "黑色", 1000, 1);
        AgentOrderSummaryVO order = new AgentOrderSummaryVO("order-1", "PAID", 1000, Instant.parse("2026-11-10T00:00:00Z"), "商户", List.of(item));
        List<AgentOrderSummaryVO> source = new ArrayList<>(List.of(order));
        AgentMyOrdersResultVO result = new AgentMyOrdersResultVO("get_my_orders", "1.0", true, "PAID", 1, 10, 1, source);
        source.clear();

        assertEquals(1, result.items().size());
        assertThrows(UnsupportedOperationException.class, () -> result.items().add(order));
        assertThrows(AppException.class, () ->
            new AgentKnowledgeQaResultVO("knowledge_qa", "1.0", false, "问题", "回答", "REAL", "VECTOR", null, List.of(), 1)
        );
    }
}
