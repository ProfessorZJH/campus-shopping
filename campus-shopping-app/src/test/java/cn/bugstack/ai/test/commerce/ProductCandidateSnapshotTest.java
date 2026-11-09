package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductCandidateSnapshot;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductCandidateSnapshotTest {

    @Test
    void keepsOnlyActiveSkuIdsAndDoesNotShareAggregateState() {
        var product = new ProductAggregate(
            "product",
            "merchant",
            "store",
            "商品",
            "说明",
            "stationery",
            "",
            "PUBLISHED",
            1,
            List.of(
                new ProductSkuEntity("active-1", "标准", 100, "ACTIVE", 1),
                new ProductSkuEntity("inactive", "旧规格", 90, "INACTIVE", 1),
                new ProductSkuEntity("active-2", "大号", 120, "ACTIVE", 1)
            )
        );

        var snapshot = ProductCandidateSnapshot.from(product);

        assertEquals("product", snapshot.productId());
        assertEquals(List.of("active-1", "active-2"), snapshot.activeSkuIds());
        assertThrows(UnsupportedOperationException.class, () -> snapshot.activeSkuIds().clear());

        product.addSku(new ProductSkuEntity("active-3", "加大", 150, "ACTIVE", 1));
        assertEquals(List.of("active-1", "active-2"), snapshot.activeSkuIds());
    }
}
