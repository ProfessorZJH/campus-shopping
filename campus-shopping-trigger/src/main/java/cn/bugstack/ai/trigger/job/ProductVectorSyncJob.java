package cn.bugstack.ai.trigger.job;

import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProductIndexVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 仅同步公开可售商品的向量索引，不以向量库作为价格、库存或权限真值。
 * 下游故障不阻塞订单作业，下次定时调度重试；日志不能包含商品正文、密钥或下游异常消息。
 */
@Component
@ConditionalOnProperty(name = "campus.ai.product-sync.enabled", havingValue = "true")
public class ProductVectorSyncJob {
    private static final Logger log = LoggerFactory.getLogger(ProductVectorSyncJob.class);
    private final ICatalogService catalog;
    private final IAiEnginePort ai;

    public ProductVectorSyncJob(ICatalogService catalog, IAiEnginePort ai) {
        this.catalog = catalog;
        this.ai = ai;
    }

    @Scheduled(
            initialDelayString = "${campus.ai.product-sync.initial-delay-ms:60000}",
            fixedDelayString = "${campus.ai.product-sync.period-ms:600000}")
    public void refresh() {
        int scanned = 0;
        int submitted = 0;
        try {
            for (int page = 1; page <= 1000; page++) {
                var products = catalog.search(null, "", null, true, page, 40);
                scanned += products.size();
                List<ProductIndexVO> batch = products.stream()
                        .filter(p -> p.getSkus().stream()
                                .anyMatch(s -> s.statusEnum() == SkuStatusEnumVO.ACTIVE))
                        .map(p -> new ProductIndexVO(
                                p.getId(), p.getMerchantId(), p.getTitle(), p.getDescription(),
                                p.getCategoryCode(), p.getSkus().stream()
                                        .filter(s -> s.statusEnum() == SkuStatusEnumVO.ACTIVE)
                                        .map(s -> s.specKey()).toList()))
                        .toList();

                // 返回 DISABLED、数量不符或下游异常都由 Port 报错；不得假装已写入。
                if (!batch.isEmpty()) {
                    ai.indexProducts(batch);
                    submitted += batch.size();
                }
                if (products.size() < 40) {
                    log.info("商品向量同步完成：扫描 {} 件，成功提交 {} 件", scanned, submitted);
                    return;
                }
            }
            log.warn("商品向量扫描达到页数上限，可能未覆盖全部商品：已扫描 {} 件，已提交 {} 件",
                    scanned, submitted);
        } catch (RuntimeException e) {
            // 不输出 e.getMessage() 或堆栈：下游异常可能包含凭据、HTTP 请求体等敏感内容。
            log.warn("商品向量同步失败，将在下一周期重试：已扫描 {} 件，已提交 {} 件，异常类型 {}",
                    scanned, submitted, e.getClass().getSimpleName());
        }
    }
}
