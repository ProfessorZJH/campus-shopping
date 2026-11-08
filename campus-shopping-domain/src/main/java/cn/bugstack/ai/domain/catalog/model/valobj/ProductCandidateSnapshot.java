package cn.bugstack.ai.domain.catalog.model.valobj;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import java.util.List;
import java.util.Objects;

/** ShoppingAI 候选查询快照；只包含候选融合和 SKU 采样所需的公开事实。 */
public record ProductCandidateSnapshot(String productId, List<String> activeSkuIds) {
    public ProductCandidateSnapshot {
        if (productId == null || productId.isBlank()) throw new IllegalArgumentException("候选商品ID不能为空");
        Objects.requireNonNull(activeSkuIds);
        activeSkuIds = List.copyOf(activeSkuIds);
    }

    public static ProductCandidateSnapshot from(ProductAggregate product) {
        Objects.requireNonNull(product);
        return new ProductCandidateSnapshot(
            product.getId(),
            product
                .getSkus()
                .stream()
                .filter(sku -> "ACTIVE".equals(sku.status()))
                .map(sku -> sku.id())
                .toList()
        );
    }
}
