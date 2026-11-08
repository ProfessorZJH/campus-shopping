package cn.bugstack.ai.cases.shoppingai.impl;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiOfferVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecallVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.SemanticProductRankVO;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** 只负责把召回结果解析为经过 Java 事实复核的候选快照，不负责会话或事务编排。 */
final class CandidateResolver {

    private static final Logger log = LoggerFactory.getLogger(CandidateResolver.class);

    private final IAiEnginePort engine;
    private final ICatalogService catalog;
    private final IInventoryService inventory;

    CandidateResolver(IAiEnginePort engine, ICatalogService catalog, IInventoryService inventory) {
        this.engine = engine;
        this.catalog = catalog;
        this.inventory = inventory;
    }

    CandidateSnapshot resolve(String question, AiRecallVO recall, ProposalVO prior) {
        // 词面召回 + 可选 Milvus 语义召回：RRF 合并，商品状态仍须重新由 MySQL 校验。
        List<ProductAggregate> lexical = catalog.recall(recall.terms(), 200);
        List<SemanticProductRankVO> semanticRanks = List.of();
        try {
            semanticRanks = engine.semanticProductRanks(recall.query(), 80);
        } catch (AppException e) {
            if (!ResponseCode.AI_UNAVAILABLE.getCode().equals(e.getCode())) throw e;
            log.warn("商品语义召回降级 diagnostic={}", cn.bugstack.ai.types.common.FailureDiagnostics.describe(e));
        }
        List<String> semanticIds = semanticRanks.stream().map(SemanticProductRankVO::productId).toList();
        List<ProductAggregate> semantic = catalog.recallByIds(semanticIds);
        Map<String, ProductAggregate> byProduct = new HashMap<>();
        lexical.forEach(p -> byProduct.put(p.getId(), p));
        semantic.forEach(p -> byProduct.put(p.getId(), p));
        Set<String> semanticProductIds = semantic.stream().map(ProductAggregate::getId).collect(Collectors.toSet());
        Map<String, Integer> semanticRankByProduct = new LinkedHashMap<>();
        for (SemanticProductRankVO rank : semanticRanks) semanticRankByProduct.putIfAbsent(rank.productId(), rank.rank());
        List<ProductAggregate> products = RecommendationPolicy.fuse(
                lexical.stream().map(ProductAggregate::getId).toList(),
                semanticRankByProduct
        )
                .stream()
                .filter(byProduct::containsKey)
                .map(byProduct::get)
                .toList();
        List<String> ids = RecommendationPolicy.sampleSkus(
                products.stream()
                        .map(
                                p -> p
                                        .getSkus()
                                        .stream()
                                        .filter(s -> s.state() == SkuStatusEnumVO.ACTIVE)
                                        .map(s -> s.id())
                                        .toList()
                        )
                        .toList()
        );
        List<SkuOfferVO> offers = catalog.availableOffers(ids);
        Map<String, StockVO> stocks = inventory.stocks(ids).stream().collect(Collectors.toMap(StockVO::skuId, Function.identity()));
        List<AiOfferVO> candidates = offers
                .stream()
                .map(
                        o -> {
                            StockVO stock = stocks.get(o.skuId());
                            return new AiOfferVO(
                                    o.skuId(),
                                    o.merchantId(),
                                    o.title(),
                                    o.specKey(),
                                    o.description(),
                                    o.priceCent(),
                                    stock == null ? 0 : stock.onHand() - stock.reserved()
                            );
                        }
                )
                .filter(o -> o.available() > 0)
                .toList();

        Set<String> excludedSkuIds = new HashSet<>();
        long cheaperThan = Long.MAX_VALUE;
        if (prior != null && question.matches(".*(?:换一个|换一款|还有别的|类似的).*")) {
            prior.items().forEach(item -> excludedSkuIds.add(item.skuId()));
        }
        if (prior != null && question.matches(".*(?:便宜点|便宜一些|更便宜).*")) {
            for (ProposalItemVO item : prior.items()) cheaperThan = Math.min(cheaperThan, item.priceCent());
        }
        final long cheaperLimit = cheaperThan;
        candidates = candidates.stream().filter(o -> !excludedSkuIds.contains(o.skuId()) && o.priceCent() < cheaperLimit).toList();
        Set<String> candidateIds = candidates.stream().map(AiOfferVO::skuId).collect(Collectors.toSet());
        offers = offers.stream().filter(o -> candidateIds.contains(o.skuId())).toList();

        List<String> semanticSkuIds = semanticSkuOrder(offers, semanticRanks, semanticProductIds);
        List<ProposalItemVO> quotes = offers
                .stream()
                .map(o -> new ProposalItemVO(o.skuId(), o.merchantId(), o.title(), o.specKey(), o.priceCent(), o.version(), 1, o.imageUrl(), o.productId()))
                .toList();
        Map<String, Long> available = new HashMap<>();
        stocks.forEach((id, stock) -> available.put(id, stock.onHand() - stock.reserved()));
        return new CandidateSnapshot(candidates, quotes, available, semanticSkuIds);
    }

    /** 语义候选按商品轮询，避免单个商品的多个 SKU 挤占前 12 个候选。 */
    private List<String> semanticSkuOrder(List<SkuOfferVO> offers, List<SemanticProductRankVO> ranks, Set<String> semanticProductIds) {
        Map<String, Integer> rankByProduct = ranks
                .stream()
                .collect(Collectors.toMap(SemanticProductRankVO::productId, SemanticProductRankVO::rank, Math::min));
        Map<String, List<SkuOfferVO>> byProduct = offers
                .stream()
                .filter(o -> semanticProductIds.contains(o.productId()))
                .sorted(Comparator.comparing(SkuOfferVO::skuId))
                .collect(Collectors.groupingBy(SkuOfferVO::productId, LinkedHashMap::new, Collectors.toList()));
        List<String> productOrder = byProduct
                .keySet()
                .stream()
                .sorted(Comparator.comparingInt((String id) -> rankByProduct.getOrDefault(id, Integer.MAX_VALUE)).thenComparing(id -> id))
                .toList();
        List<String> result = new ArrayList<>();
        for (int offset = 0; ; offset++) {
            boolean added = false;
            for (String productId : productOrder) {
                List<SkuOfferVO> productOffers = byProduct.get(productId);
                if (offset < productOffers.size()) {
                    result.add(productOffers.get(offset).skuId());
                    added = true;
                }
            }
            if (!added) return List.copyOf(result);
        }
    }

    record CandidateSnapshot(List<AiOfferVO> candidates, List<ProposalItemVO> quotes, Map<String, Long> available, List<String> semanticSkuIds) {
        CandidateSnapshot {
            candidates = List.copyOf(candidates);
            quotes = List.copyOf(quotes);
            available = Map.copyOf(available);
            semanticSkuIds = List.copyOf(semanticSkuIds);
        }
    }
}
