package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.infrastructure.adapter.repository.*;
import cn.bugstack.ai.infrastructure.redis.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.transaction.support.*;

@EnabledIfEnvironmentVariable(named = "REDIS_TEST_ADDRESS", matches = ".+")
class RedisInfrastructureIntegrationTest {

    @Test
    void sharedQuotaPermitsLocksAndCacheCommit() throws Exception {
        String address = System.getenv("REDIS_TEST_ADDRESS"),
            password = System.getenv().getOrDefault("REDIS_TEST_PASSWORD", "");
        try (
            var clients = new RedisClients(
                RedisInfrastructureConfig.client(address, "", password),
                RedisInfrastructureConfig.client(address, "", password),
                "cs:test:" + UUID.randomUUID()
            )
        ) {
            var beans = new DefaultListableBeanFactory();
            beans.registerSingleton("clients", clients);
            var provider = beans.getBeanProvider(RedisClients.class);
            var a = new RequestQuotaRepository(provider);
            var b = new RequestQuotaRepository(provider);
            assertEquals(0, a.acquire("test", "same", 2, 1));
            assertEquals(0, b.acquire("test", "same", 2, 1));
            assertTrue(a.acquire("test", "same", 2, 1) > 0);
            Thread.sleep(1100);
            assertEquals(0, b.acquire("test", "same", 2, 1));
            var resources = new AiResourceRepository(provider, 1);
            try (var permit = resources.acquire()) {
                assertThrows(cn.bugstack.ai.types.exception.AppException.class, resources::acquire);
            }
            try (var permit = resources.acquire()) {
                assertNotNull(permit);
            }
            var expired = clients.security().getPermitExpirableSemaphore(clients.namespace() + ":expires");
            expired.trySetPermits(1);
            assertNotNull(expired.tryAcquire(0, 100, TimeUnit.MILLISECONDS));
            Thread.sleep(150);
            assertNotNull(expired.tryAcquire(0, 100, TimeUnit.MILLISECONDS));
            expired.expire(Duration.ofSeconds(2));
            var entered = new CountDownLatch(1);
            var release = new CountDownLatch(1);
            var executor = Executors.newSingleThreadExecutor();
            try {
                var task = executor.submit(() ->
                    resources.coordinateProductSync(() -> {
                        entered.countDown();
                        try {
                            release.await(5, TimeUnit.SECONDS);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                        }
                    })
                );
                assertTrue(entered.await(3, TimeUnit.SECONDS));
                assertFalse(resources.coordinateProductSync(() -> fail("duplicate task")));
                release.countDown();
                assertTrue(task.get(5, TimeUnit.SECONDS));
            } finally {
                release.countDown();
                executor.shutdownNow();
            }
            var cache = new DisplayCache(provider, new ObjectMapper());
            var count = new AtomicInteger();
            var type = new TypeReference<String>() {};
            assertEquals(
                "old",
                cache.read("item", 2, type, () -> {
                    count.incrementAndGet();
                    return "old";
                })
            );
            assertEquals("old", cache.read("item", 2, type, () -> "new"));
            TransactionSynchronizationManager.initSynchronization();
            try {
                cache.evictAfterCommit("item");
                assertEquals("old", cache.read("item", 2, type, () -> "new"));
            } finally {
                TransactionSynchronizationManager.clearSynchronization();
            }
            assertEquals("old", cache.read("item", 2, type, () -> "new"));
            TransactionSynchronizationManager.initSynchronization();
            try {
                cache.evictAfterCommit("item");
                for (var sync : TransactionSynchronizationManager.getSynchronizations()) sync.afterCommit();
            } finally {
                TransactionSynchronizationManager.clearSynchronization();
            }
            assertEquals("new", cache.read("item", 2, type, () -> "new"));
            assertEquals(1, count.get());
            clients.cache().shutdown();
            assertEquals("fallback", cache.read("down", 2, type, () -> "fallback"));
            assertTrue(cache.failures() > 0);
            // Every created limiter expires naturally; clean only exact owned keys lacking TTL.
            clients
                .security()
                .getPermitExpirableSemaphore(clients.namespace() + ":ai:admission:v1")
                .delete();
            clients.security().shutdown();
            assertThrows(RuntimeException.class, () -> a.acquire("test", "same", 2, 1));
            assertThrows(cn.bugstack.ai.types.exception.AppException.class, resources::acquire);
            assertFalse(resources.coordinateProductSync(() -> fail("Redis outage must skip job")));
        }
    }
}
