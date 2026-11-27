package cn.bugstack.ai.trigger.job;

import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.domain.trading.service.IOrderExpiryCoordinator;
import cn.bugstack.ai.domain.trading.service.IOrderQueryService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 每条候选在独立用例事务中重新检查截止时间和状态，多个实例重复扫描仍安全；配置 Redis 时额外加分布式锁减少争抢。 */
@Slf4j
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "campus.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class OrderExpiryJob {

    @Resource
    private IOrderQueryService trading;

    @Resource
    private IOrderLifecycleCase lifecycle;

    @Autowired(required = false)
    private IOrderExpiryCoordinator coordinator;

    @Autowired(required = false)
    private cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort redisHub;

    private String cursor = "";
    private final java.util.concurrent.atomic.AtomicLong failures = new java.util.concurrent.atomic.AtomicLong();
    private final java.util.concurrent.atomic.AtomicLong scans = new java.util.concurrent.atomic.AtomicLong();

    public long failures() {
        return failures.get();
    }

    @Scheduled(fixedDelayString = "${campus.order.expiry-scan-ms:15000}")
    public synchronized void closeExpired() {
        if (coordinator == null) {
            scanOnce();
        } else {
            coordinator.coordinateExpiryScan(this::scanOnce);
        }
    }

    private void scanOnce() {
        try {
            var oldest = trading.oldestExpired();
            // 有逾期积压时逐轮记录，保证监控能及时发现持续增长；无积压时每 100 轮采样一次。
            long scanNumber = scans.incrementAndGet();
            if (oldest != null || scanNumber % 100 == 1) {
                log.info(
                    "order_expiry_scan oldest_overdue_seconds={} failure_total={}",
                    oldest == null ? 0 : Math.max(0, java.time.Duration.between(oldest, java.time.Instant.now()).toSeconds()),
                    failures.get()
                );
            }
            if (redisHub != null && (cursor == null || cursor.isEmpty())) {
                String saved = redisHub.loadExpiryCursor();
                if (saved != null && !saved.isEmpty()) cursor = saved;
            }
            // 每轮最多2000笔；游标跨轮保留，失败旧单不会长期占据第一页。重启可安全重扫。
            for (int batch = 0; batch < 20; batch++) {
                var ids = trading.expiredAfter(cursor, 100);
                for (String id : ids) {
                    try {
                        lifecycle.expire(id);
                    } catch (Exception error) {
                        failures.incrementAndGet();
                        log.warn("order_expiry_failed diagnostic={}", cn.bugstack.ai.types.common.FailureDiagnostics.describe(error));
                    }
                    cursor = id;
                }
                if (redisHub != null) redisHub.saveExpiryCursor(cursor);
                if (ids.size() < 100) {
                    cursor = "";
                    if (redisHub != null) redisHub.saveExpiryCursor("");
                    return;
                }
            }
        } catch (Exception error) {
            failures.incrementAndGet();
            log.error("order_expiry_scan_failed diagnostic={}", cn.bugstack.ai.types.common.FailureDiagnostics.describe(error));
        }
    }
}
