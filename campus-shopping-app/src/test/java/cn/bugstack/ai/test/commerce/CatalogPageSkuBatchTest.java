package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.trigger.http.CatalogController;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** 商品分页最多100件、每件最多20 SKU；不能将最多2000个SKU一次交给1000上限的库存查询。 */
class CatalogPageSkuBatchTest {

    @Test
    void legalPageWith1020SkusGetsEveryInventorySnapshotWithoutExceedingDomainLimit() {
        var products = new ArrayList<ProductAggregate>();
        for (int product = 0; product < 51; product++) {
            var skus = new ArrayList<ProductSkuEntity>();
            for (int sku = 0; sku < 20; sku++) {
                String id = "sku-" + product + "-" + sku;
                skus.add(new ProductSkuEntity(id, "规格" + sku, 1200, "ACTIVE", 0));
            }
            products.add(new ProductAggregate("p-" + product, "m1", "store1", "商品" + product, "", "stationery", "", "PUBLISHED", 0, skus));
        }
        var c = new CatalogController();
        var useCase = mock(ICatalogCase.class);
        var catalog = mock(ICatalogService.class);
        var merchants = mock(IMerchantService.class);
        var inventory = mock(IInventoryService.class);
        ReflectionTestUtils.setField(c, "catalogCase", useCase);
        ReflectionTestUtils.setField(c, "catalog", catalog);
        ReflectionTestUtils.setField(c, "merchants", merchants);
        ReflectionTestUtils.setField(c, "inventory", inventory);
        when(useCase.publicProductsSorted(null, "", null, 1, 100, "NEWEST")).thenReturn(products);
        when(useCase.countPublicProducts(null, "", null)).thenReturn(51L);
        when(merchants.find("m1")).thenReturn(new MerchantVO("m1", null, "测试商户", "文具", "ACTIVE", "store1", "测试店", "校园"));
        when(inventory.stocks(anyList())).thenAnswer(invocation -> {
            List<String> ids = invocation.getArgument(0);
            if (ids.size() > 1000) throw new IllegalArgumentException("库存查询不得超过1000 SKU");
            return ids
                .stream()
                .map(id -> new StockVO("m1", "store1", id, 7L, 2L, 0L))
                .toList();
        });

        var response = c.productPage(null, "", null, 1, 100, "NEWEST");
        assertEquals("0000", response.getCode());
        assertNotNull(response.getData());
        assertEquals(51, response.getData().items().size());
        assertEquals(51L, response.getData().total());
        for (var product : response.getData().items()) {
            assertEquals(20, product.getSkus().size());
            assertTrue(
                product
                    .getSkus()
                    .stream()
                    .allMatch(s -> s.getAvailable() == 5)
            );
        }
        var captured = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(inventory, times(3)).stocks(captured.capture());
        var batches = captured.getAllValues();
        assertEquals(List.of(500, 500, 20), batches.stream().map(List::size).toList());
        assertEquals(1020, batches.stream().flatMap(List::stream).distinct().count());
    }
}
