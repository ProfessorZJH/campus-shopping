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
    when(catalog.search(null, "", null, false, 1, 40)).thenReturn(
      List.of(product("live", "PUBLISHED"), product("offline", "UNPUBLISHED"))
    );
    when(catalog.recallByIds(List.of("live", "offline"))).thenReturn(
      List.of(product("live", "PUBLISHED"))
    );
    job(catalog, ai).refresh();
    verify(ai).indexProducts(
      argThat(items -> items.size() == 1 && items.get(0).productId().equals("live"))
    );
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
    var job = job(catalog, ai);
    job.refresh();
    verifyNoInteractions(ai);
    job.refresh();
    verify(ai).deleteProducts(List.of("offline"));
  }

  private ProductVectorSyncJob job(ICatalogService catalog, IAiEnginePort ai) {
    var job = new ProductVectorSyncJob(catalog, ai);
    org.springframework.test.util.ReflectionTestUtils.setField(
      job,
      "resources",
      new cn.bugstack.ai.infrastructure.adapter.repository.AiResourceRepository(
        new org.springframework.beans.factory.support.DefaultListableBeanFactory().getBeanProvider(
          cn.bugstack.ai.infrastructure.redis.RedisClients.class
        ),
        4
      )
    );
    return job;
  }
}
