package cn.bugstack.ai.cases.shoppingai.impl;

import cn.bugstack.ai.cases.shoppingai.model.ProposalView;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** 批量恢复历史提案的商品身份，并按当前公开读模型决定详情入口。 */
public final class ProposalViewAssembler {

    private static final int SKU_BATCH = 1000;
    private static final int PRODUCT_BATCH = 100;

    private ProposalViewAssembler() {}

    public static List<ProposalView> assemble(List<ProposalVO> proposals, ICatalogService catalog) {
        if (proposals == null || proposals.isEmpty()) return List.of();
        Objects.requireNonNull(catalog);

        List<ProposalItemVO> items = proposals
            .stream()
            .flatMap(p -> p.items().stream())
            .toList();
        Map<String, SkuOfferVO> offers = resolveOffers(items, catalog);
        Set<String> publicProducts = publicProducts(items, offers, catalog);
        return proposals
            .stream()
            .map(p -> view(p, offers, publicProducts))
            .toList();
    }

    private static Map<String, SkuOfferVO> resolveOffers(List<ProposalItemVO> items, ICatalogService catalog) {
        List<String> skuIds = items
            .stream()
            .map(ProposalItemVO::skuId)
            .filter(id -> id != null && !id.isBlank())
            .distinct()
            .sorted()
            .toList();
        Map<String, SkuOfferVO> result = new HashMap<>();
        for (int start = 0; start < skuIds.size(); start += SKU_BATCH) {
            List<String> batch = skuIds.subList(start, Math.min(start + SKU_BATCH, skuIds.size()));
            catalog.resolveOffers(batch).forEach(offer -> result.put(offer.skuId(), offer));
        }
        return result;
    }

    private static Set<String> publicProducts(List<ProposalItemVO> items, Map<String, SkuOfferVO> offers, ICatalogService catalog) {
        Set<String> ids = new HashSet<>();
        for (ProposalItemVO item : items) {
            SkuOfferVO offer = offers.get(item.skuId());
            String candidate = candidate(item, offer).productId();
            if (candidate != null) ids.add(candidate);
        }
        Set<String> result = new HashSet<>();
        List<String> sorted = ids.stream().sorted().toList();
        for (int start = 0; start < sorted.size(); start += PRODUCT_BATCH) {
            List<String> batch = sorted.subList(start, Math.min(start + PRODUCT_BATCH, sorted.size()));
            for (ProductAggregate product : catalog.recallByIds(batch)) result.add(product.getId());
        }
        return result;
    }

    private static ProposalView view(ProposalVO proposal, Map<String, SkuOfferVO> offers, Set<String> publicProducts) {
        List<ProposalView.ProposalItemView> items = new ArrayList<>();
        for (ProposalItemVO item : proposal.items()) {
            Resolution resolution = candidate(item, offers.get(item.skuId()));
            if (resolution.productId() == null) {
                items.add(new ProposalView.ProposalItemView(item, null, false, resolution.reason()));
            } else if (!publicProducts.contains(resolution.productId())) {
                items.add(new ProposalView.ProposalItemView(item, null, false, "PRODUCT_UNAVAILABLE"));
            } else {
                items.add(new ProposalView.ProposalItemView(item, resolution.productId(), true, null));
            }
        }
        return new ProposalView(proposal.id(), proposal.status(), items, proposal.expiresAt());
    }

    private static Resolution candidate(ProposalItemVO item, SkuOfferVO offer) {
        if (offer == null) return new Resolution(null, item.hasProductId() ? "SKU_UNAVAILABLE" : "LEGACY_ASSOCIATION_MISSING");
        if (!Objects.equals(item.merchantId(), offer.merchantId())) return new Resolution(null, "MERCHANT_MISMATCH");
        if (item.hasProductId() && !Objects.equals(item.productId(), offer.productId())) return new Resolution(null, "SKU_ASSOCIATION_CHANGED");
        return new Resolution(offer.productId(), null);
    }

    private record Resolution(String productId, String reason) {}
}
