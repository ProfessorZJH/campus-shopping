package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAiResourceRepository;
import cn.bugstack.ai.infrastructure.redis.RedisClients;
import cn.bugstack.ai.types.common.FailureDiagnostics;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

/** 许可约束 Java 准入；Python 的实际执行容量仍须在执行结束前保持占用。 */
@Slf4j
@Repository
public class AiResourceRepository implements IAiResourceRepository {

    private final ObjectProvider<RedisClients> clients;
    private final int permits;

    public AiResourceRepository(ObjectProvider<RedisClients> clients, @Value("${campus.ai.max-admitted:4}") int permits) {
        if (permits < 1 || permits > 32) throw new IllegalArgumentException("AI 准入容量须为1至32");
        this.clients = clients;
        this.permits = permits;
    }

    public Permit acquire() {
        RedisClients redis = clients.getIfAvailable();
        if (redis == null) return () -> {};
        try {
            var semaphore = redis.security().getPermitExpirableSemaphore(redis.namespace() + ":ai:admission:v1");
            semaphore.trySetPermits(permits);
            String id = semaphore.tryAcquire(0, 180, TimeUnit.SECONDS);
            if (id == null) throw new AppException(ResponseCode.AI_UNAVAILABLE);
            return () -> {
                try {
                    semaphore.tryRelease(id);
                } catch (RuntimeException error) {
                    log.warn("ai_permit_release_failed diagnostic={}", FailureDiagnostics.describe(error));
                }
            };
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new AppException(ResponseCode.AI_UNAVAILABLE);
        } catch (RuntimeException error) {
            if (error instanceof AppException business) throw business;
            log.warn("ai_admission_unavailable diagnostic={}", FailureDiagnostics.describe(error));
            throw new AppException(ResponseCode.AI_UNAVAILABLE);
        }
    }

    public boolean coordinateProductSync(Runnable task) {
        RedisClients redis = clients.getIfAvailable();
        if (redis == null) {
            task.run();
            return true;
        }
        var lock = redis.security().getLock(redis.namespace() + ":lock:product-vector-sync");
        boolean acquired;
        try {
            acquired = lock.tryLock();
        } catch (RuntimeException error) {
            log.warn("product_sync_lock_unavailable diagnostic={}", FailureDiagnostics.describe(error));
            return false;
        }
        if (!acquired) return false;
        try {
            task.run();
            return true;
        } finally {
            try {
                if (lock.isHeldByCurrentThread()) lock.unlock();
            } catch (RuntimeException error) {
                log.warn("product_sync_unlock_failed diagnostic={}", FailureDiagnostics.describe(error));
            }
        }
    }
}
