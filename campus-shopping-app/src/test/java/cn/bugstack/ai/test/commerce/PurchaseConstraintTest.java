package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;

class PurchaseConstraintTest {

    @Test
    void sharedBudgetQuantityAndFollowupContract() throws Exception {
        var mapper = new ObjectMapper();
        for (var row : mapper.readTree(getClass().getResourceAsStream("/purchase-contract.json"))) {
            var constraints = ConstraintSet.resolve(row.get("question").asText(), mapper.convertValue(row.get("history"), List.class), List.of());
            assertEquals(row.get("budgetCent").isNull() ? null : row.get("budgetCent").longValue(), constraints.budgetCent(), row.toString());
            assertEquals(row.get("quantity").isNull() ? null : row.get("quantity").intValue(), constraints.requestedQuantity(), row.toString());
            assertEquals(row.get("clarify").asBoolean(), constraints.clarification(), row.toString());
        }
    }

    @Test
    void finalProposalCannotExceedCumulativeBudgetOrRequestedQuantity() {
        var quotes = List.of(new ProposalItemVO("s1", "m", "签字笔", "标准装", 600, 1, 1), new ProposalItemVO("s2", "m", "签字笔", "标准装", 600, 1, 1));
        var recommendations = List.of(new AiRecommendationVO("s1", 1, ""), new AiRecommendationVO("s2", 1, ""));
        var stocks = Map.of("s1", 99L, "s2", 99L);
        assertEquals(1, RecommendationPolicy.select(recommendations, quotes, stocks, "预算10元买签字笔", List.of()).size());
        assertTrue(RecommendationPolicy.select(recommendations, quotes, stocks, "我要两支签字笔", List.of()).isEmpty());
        var two = List.of(new AiRecommendationVO("s1", 2, ""));
        assertTrue(RecommendationPolicy.select(two, quotes, stocks, "预算10元要两支签字笔", List.of()).isEmpty());
        assertEquals(2, RecommendationPolicy.select(two, quotes, stocks, "预算20元要两支签字笔", List.of()).get(0).quantity());
        var huge = List.of(new ProposalItemVO("s1", "m", "签字笔", "标准装", Long.MAX_VALUE, 1, 1));
        assertTrue(RecommendationPolicy.select(two, huge, stocks, "预算100元", List.of()).isEmpty());
    }

    @Test
    void unverifiedAnswerCannotClaimPaymentOrRefund() {
        String safe = ShoppingAnswerPolicy.evidenceAnswer(List.of(new AiCitationVO("doc", "c", "退款规则", "请在订单页申请售后", 1)));
        assertTrue(safe.contains("申请售后"));
        assertFalse(safe.contains("已付款"));
        assertTrue(ShoppingAnswerPolicy.evidenceAnswer(List.of()).contains("未执行"));
    }
}
