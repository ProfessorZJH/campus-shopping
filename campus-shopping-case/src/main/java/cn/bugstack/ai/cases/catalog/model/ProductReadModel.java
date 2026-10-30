package cn.bugstack.ai.cases.catalog.model;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** 商品展示所需的完整快照；商户名和各 SKU 库存由用例统一取得。 */
public record ProductReadModel(ProductAggregate product, String merchantName, Map<String, Long> availableBySku) {
    public ProductReadModel {
        Objects.requireNonNull(product);
        Objects.requireNonNull(merchantName);
        if (merchantName.isBlank()) throw new IllegalArgumentException("商品所属商户名称不能为空");
        availableBySku = Map.copyOf(availableBySku);
        for (var sku : product.getSkus()) {
            if (!availableBySku.containsKey(sku.id())) throw new IllegalArgumentException("商品 SKU 缺少可用库存");
        }
    }

    public static ProductReadModel from(ProductAggregate product, String merchantName, Map<String, StockVO> stocks) {
        Map<String, Long> available = product
            .getSkus()
            .stream()
            .collect(
                Collectors.toUnmodifiableMap(
                    sku -> sku.id(),
                    sku -> {
                        StockVO stock = stocks.get(sku.id());
                        return stock == null ? 0L : stock.onHand() - stock.reserved();
                    }
                )
            );
        return new ProductReadModel(product, merchantName, available);
    }
}
