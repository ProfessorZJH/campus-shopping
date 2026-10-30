package cn.bugstack.ai.trigger.job;

import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProductIndexVO;
import java.util.HashSet;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 周期核对所有商品（含下架商品），实时复核公开状态后增量写入或删除索引。 */
@Slf4j
@Component
@ConditionalOnProperty(name = "campus.ai.product-sync.enabled", havingValue = "true")
public class ProductVectorSyncJob {

    private volatile java.time.Instant lastSuccess;
    private volatile java.time.Instant lastFailure;

    public java.time.Instant lastSuccess() {
        return lastSuccess;
    }

    public java.time.Instant lastFailure() {
        return lastFailure;
    }

    private final ICatalogService catalog;
    private final IAiEnginePort ai;
    private final AtomicLong failures = new AtomicLong();

    public ProductVectorSyncJob(ICatalogService catalog, IAiEnginePort ai) {
        this.catalog = catalog;
        this.ai = ai;
    }

    @Scheduled(initialDelayString = "${campus.ai.product-sync.initial-delay-ms:60000}", fixedDelayString = "${campus.ai.product-sync.period-ms:600000}")
    public void refresh() {
        long started = System.nanoTime();
        String previous = MDC.get("requestId");
        MDC.put("requestId", UUID.randomUUID().toString());
        int scanned = 0;
        try {
            for (int page = 1; page <= 1000; page++) {
                // 当前商品业务只做上下架，不物理删除目录行；全目录扫描也覆盖失效索引。
                var all = catalog.search(null, "", null, false, page, 40);
                var ids = all
                    .stream()
                    .map(product -> product.getId())
                    .toList();
                var active = catalog.recallByIds(ids);
                var liveIds = new HashSet<>(
                    active
                        .stream()
                        .map(product -> product.getId())
                        .toList()
                );
                var stale = ids
                    .stream()
                    .filter(id -> !liveIds.contains(id))
                    .toList();
                var batch = active
                    .stream()
                    .map(product ->
                        new ProductIndexVO(
                            product.getId(),
                            product.getMerchantId(),
                            product.getTitle(),
                            product.getDescription(),
                            product.getCategoryCode(),
                            product
                                .getSkus()
                                .stream()
                                .filter(sku -> "ACTIVE".equals(sku.status()))
                                .map(sku -> sku.specKey())
                                .toList()
                        )
                    )
                    .toList();
                if (!batch.isEmpty()) ai.indexProducts(batch);
                if (!stale.isEmpty()) ai.deleteProducts(stale);
                scanned += all.size();
                if (all.size() < 40) {
                    lastSuccess = java.time.Instant.now();
                    lastFailure = null;
                    log.info("product_vector_sync_completed scanned={} duration_ms={}", scanned, (System.nanoTime() - started) / 1_000_000);
                    return;
                }
            }
            throw new IllegalStateException("Product sync scan capacity exceeded");
        } catch (RuntimeException error) {
            lastFailure = java.time.Instant.now();
            // 不打印下游异常正文，避免 URL、密钥或商品内容进入日志。
            log.error(
                "product_vector_sync_failed scanned={} diagnostic={} failure_total={} duration_ms={} last_success={}",
                scanned,
                cn.bugstack.ai.types.common.FailureDiagnostics.describe(error),
                failures.incrementAndGet(),
                (System.nanoTime() - started) / 1_000_000,
                lastSuccess
            );
        } finally {
            if (previous == null) MDC.remove("requestId");
            else MDC.put("requestId", previous);
        }
    }
}
