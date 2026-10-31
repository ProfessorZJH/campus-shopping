package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import cn.bugstack.ai.domain.shoppingai.service.SkuConstraintPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class SkuConstraintPolicyTest {

    @Test
    void sharedContractAndUntrustedRecommendations() throws Exception {
        var rows = new ObjectMapper().readTree(getClass().getResourceAsStream("/sku-contract.json"));
        for (var row : rows) {
            var mapper = new ObjectMapper();
            List<String> specs = mapper.convertValue(row.get("specs"), List.class);
            List<String> history = mapper.convertValue(row.get("history"), List.class);
            List<String> titles = mapper.convertValue(row.get("titles"), List.class);
            List<String> accepted = mapper.convertValue(row.get("accepted"), List.class);
            String question = row.get("question").asText();
            var constraints = SkuConstraintPolicy.resolve(question, history, specs, titles);
            assertEquals(accepted, specs.stream().filter(constraints::accepts).toList(), question);
            // 错误/旧Python可返回任意SKU，最终提案仍须遵守原文要求。
            var quotes = specs
                .stream()
                .map(s -> new ProposalItemVO(s, "m", titles.get(0), s, 100, 1, 1, null))
                .toList();
            var suggestions = specs
                .stream()
                .map(s -> new AiRecommendationVO(s, 1, "不可信模型文案"))
                .toList();
            var stock = new HashMap<String, Long>();
            specs.forEach(s -> stock.put(s, 10L));
            assertEquals(
                accepted,
                RecommendationPolicy.select(suggestions, quotes, stock, question, history).stream().map(ProposalItemVO::specKey).toList(),
                question
            );
        }
    }
}
