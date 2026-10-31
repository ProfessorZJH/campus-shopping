package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecommendationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 导购纯规则：排名融合、跨商品规格配额、建议去重和库存约束。无外部依赖或跨领域类型。 */
public final class RecommendationPolicy {

    private RecommendationPolicy() {}

    public static List<String> fuse(List<String> lexical, List<String> semantic) {
        Map<String, Double> scores = new HashMap<>();
        for (var source : List.of(lexical, semantic)) {
            Set<String> seen = new HashSet<>();
            for (int rank = 0; rank < source.size(); rank++) {
                String id = source.get(rank);
                if (seen.add(id)) scores.merge(id, 1.0 / (61 + rank), Double::sum);
            }
        }
        return scores
            .entrySet()
            .stream()
            .sorted(Comparator.<Map.Entry<String, Double>>comparingDouble(Map.Entry::getValue).reversed().thenComparing(Map.Entry::getKey))
            .limit(200)
            .map(Map.Entry::getKey)
            .toList();
    }

    public static List<String> sampleSkus(List<List<String>> products) {
        List<String> result = new ArrayList<>();
        for (int position = 0; position < 20 && result.size() < 300; position++) {
            for (var skus : products) {
                if (position < skus.size()) result.add(skus.get(position));
                if (result.size() == 300) break;
            }
        }
        return List.copyOf(result);
    }

    public static List<ProposalItemVO> select(List<AiRecommendationVO> recommendations, List<ProposalItemVO> quotes, Map<String, Long> available) {
        return select(recommendations, quotes, available, "", List.of());
    }

    public static List<ProposalItemVO> select(
        List<AiRecommendationVO> recommendations,
        List<ProposalItemVO> quotes,
        Map<String, Long> available,
        String question,
        List<String> userHistory
    ) {
        var constraints = ConstraintSet.resolve(question, userHistory, quotes);
        if (constraints.clarification()) return List.of();
        var specs = constraints.specs();
        Map<String, ProposalItemVO> allowed = new HashMap<>();
        quotes.forEach(q -> allowed.put(q.skuId(), q));
        List<ProposalItemVO> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        long spent = 0;
        for (var recommendation : recommendations) {
            var quote = allowed.get(recommendation.skuId());
            if (
                quote == null ||
                !specs.accepts(quote.specKey()) ||
                quote.priceCent() <= 0 ||
                seen.contains(quote.skuId()) ||
                recommendation.quantity() < 1 ||
                recommendation.quantity() > 99 ||
                (constraints.requestedQuantity() != null && recommendation.quantity() != constraints.requestedQuantity()) ||
                (constraints.budgetCent() != null && quote.priceCent() > (constraints.budgetCent() - spent) / recommendation.quantity()) ||
                available.getOrDefault(quote.skuId(), 0L) < recommendation.quantity()
            ) continue;
            seen.add(quote.skuId());
            if (constraints.budgetCent() != null) spent += quote.priceCent() * recommendation.quantity();
            result.add(
                new ProposalItemVO(
                    quote.skuId(),
                    quote.merchantId(),
                    quote.title(),
                    quote.specKey(),
                    quote.priceCent(),
                    quote.quoteVersion(),
                    recommendation.quantity(),
                    quote.imageUrl()
                )
            );
            if (result.size() == (constraints.requestedQuantity() == null ? 3 : 1)) break;
        }
        return List.copyOf(result);
    }
}
