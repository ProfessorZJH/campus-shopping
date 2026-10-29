package cn.bugstack.ai.test.commerce;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.trigger.job.ProductVectorSyncJob;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/** 真实调度方法回归：仅同步可售 SKU，异常后下周期仍可继续。 */
class ProductVectorSyncJobTest {
    private ProductAggregate product(int id, String skuStatus) {
        return new ProductAggregate("p" + id, "m1", "store", "商品 " + id,
                "", "snacks", "", "PUBLISHED", 0,
                List.of(new ProductSkuEntity("s" + id, "盒装", 300, skuStatus, 0)));
    }

    @Test
    void excludesInactiveSkuAndSendsOnlyPublicOffers() {
        ICatalogService catalog = mock(ICatalogService.class);
        IAiEnginePort ai = mock(IAiEnginePort.class);
        when(catalog.search(null, "", null, true, 1, 40))
                .thenReturn(List.of(product(1, "ACTIVE"), product(2, "INACTIVE")));

        new ProductVectorSyncJob(catalog, ai).refresh();

        verify(ai).indexProducts(argThat(batch ->
                batch.size() == 1
                        && "p1".equals(batch.get(0).productId())
                        && batch.get(0).specs().equals(List.of("盒装"))));
        verify(catalog).search(null, "", null, true, 1, 40);
        verifyNoMoreInteractions(ai);
    }

    @Test
    void traversesCatalogPagesWithoutSkippingFullPage() {
        ICatalogService catalog = mock(ICatalogService.class);
        IAiEnginePort ai = mock(IAiEnginePort.class);
        List<ProductAggregate> first = IntStream.range(0, 40)
                .mapToObj(n -> product(n, "ACTIVE")).toList();
        when(catalog.search(null, "", null, true, 1, 40)).thenReturn(first);
        when(catalog.search(null, "", null, true, 2, 40))
                .thenReturn(List.of(product(40, "ACTIVE")));

        new ProductVectorSyncJob(catalog, ai).refresh();

        verify(ai, times(2)).indexProducts(anyList());
        verify(catalog).search(null, "", null, true, 2, 40);
    }

    @Test
    void failureDoesNotCancelSubsequentScheduledRetry() {
        ICatalogService catalog = mock(ICatalogService.class);
        IAiEnginePort ai = mock(IAiEnginePort.class);
        when(catalog.search(null, "", null, true, 1, 40))
                .thenReturn(List.of(product(1, "ACTIVE")));
        doThrow(new IllegalStateException("private downstream error"))
                .doNothing().when(ai).indexProducts(anyList());

        ProductVectorSyncJob job = new ProductVectorSyncJob(catalog, ai);
        assertDoesNotThrow(job::refresh);
        assertDoesNotThrow(job::refresh);
        verify(ai, times(2)).indexProducts(anyList());
    }
}
