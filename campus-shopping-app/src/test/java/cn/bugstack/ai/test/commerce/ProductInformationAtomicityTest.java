package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.types.exception.AppException;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 校验较后字段失败时，聚合不能遗留较前字段的半更新。 */
class ProductInformationAtomicityTest {

    private ProductAggregate product() {
        return new ProductAggregate(
            "p",
            "m",
            "s",
            "原名称",
            "原描述",
            "stationery",
            "/media/abc.png",
            "DRAFT",
            7,
            List.of(new ProductSkuEntity("sku", "默认", 100, "ACTIVE", 0))
        );
    }

    @Test
    void invalidDescriptionCategoryOrImageLeavesEveryFieldUntouched() {
        ProductAggregate product = product();
        List<Runnable> changes = List.of(
            () -> product.changeInfo("新名称", "x".repeat(5001), "daily", "", 7),
            () -> product.changeInfo("新名称", "新描述", " ", "", 7),
            () -> product.changeInfo("新名称", "新描述", "daily", "https://example.invalid/image.png", 7),
            () -> product.changeInfo("新名称", "新描述", "daily", "", 6)
        );
        for (Runnable change : changes) {
            assertThrows(AppException.class, change::run);
            assertEquals("原名称", product.getTitle());
            assertEquals("原描述", product.getDescription());
            assertEquals("stationery", product.getCategoryCode());
            assertEquals("/media/abc.png", product.getImageUrl());
            assertEquals(7, product.getVersion());
        }
        product.changeInfo(" 新名称 ", " 新描述 ", "daily", "", 7);
        assertEquals("新名称", product.getTitle());
        assertEquals("新描述", product.getDescription());
        assertEquals("daily", product.getCategoryCode());
        assertEquals("", product.getImageUrl());
    }
}
