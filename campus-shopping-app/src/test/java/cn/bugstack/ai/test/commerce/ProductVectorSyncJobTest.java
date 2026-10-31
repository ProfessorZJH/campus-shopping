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
        when(catalog.scanIdsAfter("", 40)).thenReturn(List.of("live", "offline"));
        when(catalog.recallByIds(List.of("live", "offline"))).thenReturn(List.of(product("live", "PUBLISHED")));
        job(catalog, ai).refresh();
        verify(ai).indexProducts(argThat(items -> items.size() == 1 && items.get(0).productId().equals("live")));
        verify(ai).deleteProducts(List.of("offline"));
    }

    @Test
    void catalogFailureNeverDeletesUnconfirmedIdsAndNextScanCanRetry() {
        var catalog = mock(ICatalogService.class);
        var ai = mock(IAiEnginePort.class);
        when(catalog.scanIdsAfter("", 40)).thenThrow(new IllegalStateException("dependency detail")).thenReturn(List.of("offline"));
        when(catalog.recallByIds(List.of("offline"))).thenReturn(List.of());
        var job = job(catalog, ai);
        job.refresh();
        verifyNoInteractions(ai);
        job.refresh();
        verify(ai).deleteProducts(List.of("offline"));
    }

    @Test
    void downstreamFailureDoesNotAdvanceSuccessAndRetryRecovers() {
        var catalog = mock(ICatalogService.class);
        var ai = mock(IAiEnginePort.class);
        when(catalog.scanIdsAfter("", 40)).thenReturn(List.of("live"));
        when(catalog.recallByIds(List.of("live"))).thenReturn(List.of(product("live", "PUBLISHED")));
        doThrow(new cn.bugstack.ai.types.exception.AppException(cn.bugstack.ai.types.enums.ResponseCode.AI_UNAVAILABLE))
            .doNothing()
            .when(ai)
            .indexProducts(anyList());
        var job = job(catalog, ai);
        job.refresh();
        org.junit.jupiter.api.Assertions.assertNull(job.lastSuccess());
        org.junit.jupiter.api.Assertions.assertNotNull(job.lastFailure());
        job.refresh();
        org.junit.jupiter.api.Assertions.assertNotNull(job.lastSuccess());
        org.junit.jupiter.api.Assertions.assertNull(job.lastFailure());
    }

    private ProductVectorSyncJob job(ICatalogService catalog, IAiEnginePort ai) {
        var job = new ProductVectorSyncJob(catalog, ai);
        org.springframework.test.util.ReflectionTestUtils.setField(job, "resources", resources());
        return job;
    }

    private cn.bugstack.ai.domain.shoppingai.adapter.repository.IAiResourceRepository resources() {
        var resources = mock(cn.bugstack.ai.domain.shoppingai.adapter.repository.IAiResourceRepository.class);
        var cursor = new java.util.concurrent.atomic.AtomicReference<>("");
        when(resources.productSyncCursor()).thenAnswer(call -> cursor.get());
        doAnswer(call -> {
            cursor.set(call.getArgument(0));
            return null;
        })
            .when(resources)
            .saveProductSyncCursor(anyString());
        when(resources.coordinateProductSync(any())).thenAnswer(call -> {
            ((Runnable) call.getArgument(0)).run();
            return true;
        });
        return resources;
    }

    @Test
    void resumesBeyondFortyThousandAcrossJobRestartsAndReplaysFailedBatch() {
        var catalog = mock(ICatalogService.class);
        var ai = mock(IAiEnginePort.class);
        var resources = resources();
        when(catalog.scanIdsAfter(anyString(), eq(40))).thenAnswer(call -> {
            String after = call.getArgument(0);
            int start = after.isEmpty() ? 0 : Integer.parseInt(after.substring(1)) + 1;
            return java.util.stream.IntStream.range(start, Math.min(start + 40, 40001))
                .mapToObj(i -> "p" + String.format("%06d", i))
                .toList();
        });
        when(catalog.recallByIds(anyList())).thenAnswer(call ->
            ((List<String>) call.getArgument(0))
                .stream()
                .map(id -> product(id, "PUBLISHED"))
                .toList()
        );
        doThrow(new IllegalStateException("controlled failure")).doNothing().when(ai).indexProducts(anyList());
        var failed = new ProductVectorSyncJob(catalog, ai);
        org.springframework.test.util.ReflectionTestUtils.setField(failed, "resources", resources);
        failed.refresh();
        org.junit.jupiter.api.Assertions.assertEquals("", resources.productSyncCursor());
        for (int run = 0; run < 11; run++) {
            var restarted = new ProductVectorSyncJob(catalog, ai);
            org.springframework.test.util.ReflectionTestUtils.setField(restarted, "resources", resources);
            restarted.refresh();
        }
        verify(ai).indexProducts(argThat(items -> items.stream().anyMatch(p -> p.productId().equals("p040000"))));
        org.junit.jupiter.api.Assertions.assertEquals("", resources.productSyncCursor());
        verify(catalog, never()).search(any(), anyString(), any(), anyBoolean(), anyInt(), anyInt());
    }
}
