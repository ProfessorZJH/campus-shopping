package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import java.util.*;

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
      .sorted(
        Comparator.<Map.Entry<String, Double>>comparingDouble(Map.Entry::getValue)
          .reversed()
          .thenComparing(Map.Entry::getKey)
      )
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

  public static List<ProposalItemVO> select(
    List<AiRecommendationVO> recommendations,
    List<ProposalItemVO> quotes,
    Map<String, Long> available
  ) {
    Map<String, ProposalItemVO> allowed = new HashMap<>();
    quotes.forEach(q -> allowed.put(q.skuId(), q));
    List<ProposalItemVO> result = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (var recommendation : recommendations) {
      var quote = allowed.get(recommendation.skuId());
      if (
        quote == null ||
        !seen.add(quote.skuId()) ||
        recommendation.quantity() < 1 ||
        recommendation.quantity() > 99 ||
        available.getOrDefault(quote.skuId(), 0L) < recommendation.quantity()
      ) continue;
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
      if (result.size() == 3) break;
    }
    return List.copyOf(result);
  }
}
