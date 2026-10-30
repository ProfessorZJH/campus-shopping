package cn.bugstack.ai.test.commerce;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.trigger.job.ProductVectorSyncJob;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductVectorSyncJobTest {

    private ProductAggregate product(String id, String status) {
        return new ProductAggregate(
            id,
            "merchant",
            "store",
            "测试商品",
            "",
            "daily",
            "",
            status,
            0,
            List.of(new ProductSkuEntity("sku-" + id, "默认", 100, "ACTIVE", 0))
        );
    }

    @Test
    void scansUnpublishedCatalogAndDeletesOnlyIdsRejectedByLiveCatalog() {
        var catalog = mock(ICatalogService.class);
        var ai = mock(IAiEnginePort.class);
        when(catalog.search(null, "", null, false, 1, 40)).thenReturn(List.of(product("live", "PUBLISHED"), product("offline", "UNPUBLISHED")));
        when(catalog.recallByIds(List.of("live", "offline"))).thenReturn(List.of(product("live", "PUBLISHED")));
        new ProductVectorSyncJob(catalog, ai).refresh();
        verify(ai).indexProducts(argThat(items -> items.size() == 1 && items.get(0).productId().equals("live")));
        verify(ai).deleteProducts(List.of("offline"));
    }

    @Test
    void catalogFailureNeverDeletesUnconfirmedIdsAndNextScanCanRetry() {
        var catalog = mock(ICatalogService.class);
        var ai = mock(IAiEnginePort.class);
        when(catalog.search(null, "", null, false, 1, 40))
            .thenThrow(new IllegalStateException("dependency detail"))
            .thenReturn(List.of(product("offline", "UNPUBLISHED")));
        when(catalog.recallByIds(List.of("offline"))).thenReturn(List.of());
        var job = new ProductVectorSyncJob(catalog, ai);
        job.refresh();
        verifyNoInteractions(ai);
        job.refresh();
        verify(ai).deleteProducts(List.of("offline"));
    }

    @Test
    void downstreamFailureDoesNotAdvanceSuccessAndRetryRecovers() {
        var catalog = mock(ICatalogService.class);
        var ai = mock(IAiEnginePort.class);
        when(catalog.search(null, "", null, false, 1, 40)).thenReturn(List.of(product("live", "PUBLISHED")));
        when(catalog.recallByIds(List.of("live"))).thenReturn(List.of(product("live", "PUBLISHED")));
        doThrow(new cn.bugstack.ai.types.exception.AppException(cn.bugstack.ai.types.enums.ResponseCode.AI_UNAVAILABLE))
            .doNothing()
            .when(ai)
            .indexProducts(anyList());
        var job = new ProductVectorSyncJob(catalog, ai);
        job.refresh();
        org.junit.jupiter.api.Assertions.assertNull(job.lastSuccess());
        org.junit.jupiter.api.Assertions.assertNotNull(job.lastFailure());
        job.refresh();
        org.junit.jupiter.api.Assertions.assertNotNull(job.lastSuccess());
        org.junit.jupiter.api.Assertions.assertNull(job.lastFailure());
    }
}
