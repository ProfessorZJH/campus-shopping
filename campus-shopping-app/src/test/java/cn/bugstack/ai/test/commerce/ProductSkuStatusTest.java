package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.types.exception.AppException;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductSkuStatusTest {

    private ProductAggregate product() {
        return new ProductAggregate(
            "p",
            "m",
            "store",
            "笔",
            "",
            "stationery",
            "",
            "PUBLISHED",
            4,
            List.of(new ProductSkuEntity("a", "黑", 100, "ACTIVE", 2), new ProductSkuEntity("b", "蓝", 100, "ACTIVE", 3))
        );
    }

    @Test
    void staleMutationAndUnknownSkuPreserveAggregate() {
        var p = product();
        var before = p.getSkus();
        assertEquals("G0002", assertThrows(AppException.class, () -> p.changeSkuStatus("a", false, 3)).getCode());
        assertEquals("G0001", assertThrows(AppException.class, () -> p.changeSkuStatus("unknown", false, 4)).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> p.changeSkuStatus("a", false, -1)).getCode());
        assertEquals(before, p.getSkus());
    }

    @Test
    void replayDoesNotChangeAnySkuVersion() {
        var p = product();
        assertTrue(p.changeSkuStatus("a", false, 4));
        assertEquals(3, p.getSkus().get(0).version());
        assertEquals(3, p.getSkus().get(1).version());
        var before = p.getSkus();
        assertFalse(p.changeSkuStatus("a", false, 0));
        assertEquals(before, p.getSkus());
    }

    @Test
    void lastActiveSkuRequiresWholeProductUnpublishedFirst() {
        var p = product();
        p.changeSkuStatus("a", false, 4);
        assertEquals("C0001", assertThrows(AppException.class, () -> p.changeSkuStatus("b", false, 4)).getCode());
        assertEquals("ACTIVE", p.getSkus().get(1).status());
        p.unpublish();
        assertTrue(p.changeSkuStatus("b", false, 4));
        assertEquals("C0001", assertThrows(AppException.class, p::publish).getCode());
        p.changeSkuStatus("a", true, 4);
        p.publish();
        assertEquals("PUBLISHED", p.getStatus());
    }
}
