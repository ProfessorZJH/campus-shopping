package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository;
import cn.bugstack.ai.infrastructure.redis.RedisClients;
import cn.bugstack.ai.types.common.Fingerprints;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import org.redisson.api.RateType;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Repository;

/** Redis 故障直接传播；本地计数只用于显式关闭 Redis 的单实例模式。 */
@Repository
public class RequestQuotaRepository implements IRequestQuotaRepository {

    private final ObjectProvider<RedisClients> clients;
    private final ConcurrentHashMap<String, Window> local = new ConcurrentHashMap<>();

    public RequestQuotaRepository(ObjectProvider<RedisClients> clients) {
        this.clients = clients;
    }

    public long acquire(String policy, String subject, int permits, int seconds) {
        if (!policy.matches("[a-z0-9-]{1,40}") || subject == null || permits < 1 || seconds < 1) throw new IllegalArgumentException("限流契约无效");
        String name = policy + ":" + permits + ":" + seconds + ":" + Fingerprints.of(subject);
        RedisClients redis = clients.getIfAvailable();
        if (redis != null) {
            var limiter = redis.security().getRateLimiter(redis.namespace() + ":rl:v1:" + name);
            limiter.trySetRate(RateType.OVERALL, permits, Duration.ofSeconds(seconds), Duration.ofSeconds(Math.max(600, seconds * 2L)));
            return limiter.tryAcquire() ? 0 : seconds;
        }
        long now = System.currentTimeMillis();
        if (local.size() >= 10000) {
            local.entrySet().removeIf(e -> e.getValue().until <= now);
            if (!local.containsKey(name) && local.size() >= 10000) return seconds;
        }
        Window window = local.compute(name, (key, old) -> old == null || old.until <= now ? new Window(now + seconds * 1000L) : old);
        synchronized (window) {
            return ++window.count <= permits ? 0 : Math.max(1, (window.until - now + 999) / 1000);
        }
    }

    private static final class Window {

        final long until;
        int count;

        Window(long until) {
            this.until = until;
        }
    }
}
