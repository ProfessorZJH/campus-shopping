package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.infrastructure.adapter.repository.*;
import cn.bugstack.ai.infrastructure.dao.*;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.infrastructure.redis.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.redisson.client.codec.StringCodec;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.test.util.ReflectionTestUtils;

@EnabledIfEnvironmentVariable(named = "REDIS_TEST_ADDRESS", matches = ".+")
@EnabledIfEnvironmentVariable(named = "REDIS_TEST_CACHE_ADDRESS", matches = ".+")
class RedisCacheConcurrencyTest {

    private RedisClients clients;
    private DisplayCache cache;

    @BeforeEach
    void setup() {
        String security = System.getenv("REDIS_TEST_ADDRESS"),
            display = System.getenv("REDIS_TEST_CACHE_ADDRESS");
        RedisInfrastructureConfig.validateSeparateInstances(security, display);
        String password = System.getenv().getOrDefault("REDIS_TEST_PASSWORD", "");
        clients = new RedisClients(
            RedisInfrastructureConfig.client(security, "", password),
            RedisInfrastructureConfig.client(display, "", password),
            "cs:test:cache:" + UUID.randomUUID()
        );
        var beans = new DefaultListableBeanFactory();
        beans.registerSingleton("clients", clients);
        cache = new DisplayCache(beans.getBeanProvider(RedisClients.class), new ObjectMapper());
    }

    @AfterEach
    void close() {
        clients.close();
    }

    @Test
    void lateMerchantFillCannotPoisonCurrentVersion() throws Exception {
        var dao = mock(IMerchantDao.class);
        var repository = new MerchantRepository();
        ReflectionTestUtils.setField(repository, "dao", dao);
        ReflectionTestUtils.setField(repository, "cache", cache);
        var facts = new AtomicReference<>(MerchantPO.builder().status("ACTIVE").version(0L).build());
        when(dao.displayFacts("m")).thenAnswer(call -> facts.get());
        var read = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(dao.find("m", false)).thenAnswer(call -> {
            if (Thread.currentThread().getName().equals("old-reader")) {
                read.countDown();
                assertTrue(release.await(5, TimeUnit.SECONDS));
                return MerchantPO.builder().name("old").build();
            }
            return MerchantPO.builder().name("new").build();
        });
        var executor = Executors.newSingleThreadExecutor(r -> new Thread(r, "old-reader"));
        try {
            var late = executor.submit(() -> repository.publicDisplay("m"));
            assertTrue(read.await(5, TimeUnit.SECONDS));
            facts.set(MerchantPO.builder().status("ACTIVE").version(1L).build());
            assertEquals("new", repository.publicDisplay("m").name());
            release.countDown();
            assertEquals("old", late.get(5, TimeUnit.SECONDS).name());
            assertEquals("new", repository.publicDisplay("m").name());
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void corruptJsonRepairsWithTtlAndLateRepairPreservesConcurrentValue() throws Exception {
        var bucket = clients.cache().<String>getBucket(clients.namespace() + ":display:v1:broken", StringCodec.INSTANCE);
        var type = new TypeReference<String>() {};
        bucket.set("{broken", Duration.ofSeconds(30));
        assertEquals("repaired", cache.read("broken", 10, type, () -> "repaired"));
        assertEquals(
            "repaired",
            cache.read("broken", 10, type, () -> {
                throw new AssertionError("must hit repaired cache");
            })
        );
        assertTrue(bucket.remainTimeToLive() > 0);
        assertEquals(1, cache.failures());
        bucket.set("{broken-again", Duration.ofSeconds(30));
        var read = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newSingleThreadExecutor();
        try {
            var late = executor.submit(() ->
                cache.read("broken", 10, type, () -> {
                    read.countDown();
                    try {
                        assertTrue(release.await(5, TimeUnit.SECONDS));
                    } catch (InterruptedException e) {
                        throw new AssertionError(e);
                    }
                    return "late";
                })
            );
            assertTrue(read.await(5, TimeUnit.SECONDS));
            assertEquals("current", cache.read("broken", 10, type, () -> "current"));
            release.countDown();
            assertEquals("late", late.get(5, TimeUnit.SECONDS));
            assertEquals("current", cache.read("broken", 10, type, () -> "unexpected"));
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void conditionalDeletePreservesValueReplacedDuringParsing() throws Exception {
        var parsing = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var mapper = new ObjectMapper() {
            @Override
            public <T> T readValue(String content, TypeReference<T> type) throws com.fasterxml.jackson.core.JsonProcessingException {
                if (content.equals("{broken")) {
                    parsing.countDown();
                    try {
                        assertTrue(release.await(5, TimeUnit.SECONDS));
                    } catch (InterruptedException error) {
                        throw new AssertionError(error);
                    }
                }
                return super.readValue(content, type);
            }
        };
        var beans = new DefaultListableBeanFactory();
        beans.registerSingleton("clients", clients);
        var repairing = new DisplayCache(beans.getBeanProvider(RedisClients.class), mapper);
        var bucket = clients.cache().<String>getBucket(clients.namespace() + ":display:v1:race", StringCodec.INSTANCE);
        bucket.set("{broken", Duration.ofSeconds(30));
        var executor = Executors.newSingleThreadExecutor();
        try {
            var old = executor.submit(() -> repairing.read("race", 10, new TypeReference<String>() {}, () -> "old"));
            assertTrue(parsing.await(5, TimeUnit.SECONDS));
            bucket.set("\"current\"", Duration.ofSeconds(30));
            release.countDown();
            assertEquals("old", old.get(5, TimeUnit.SECONDS));
            assertEquals("current", repairing.read("race", 10, new TypeReference<String>() {}, () -> "unexpected"));
            assertTrue(bucket.remainTimeToLive() > 0);
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void categoriesAlwaysReadDatabaseAndSecurityFailureLeavesCacheUsable() {
        var dao = mock(ICatalogDao.class);
        var repository = new CatalogRepository();
        ReflectionTestUtils.setField(repository, "dao", dao);
        when(dao.categories()).thenReturn(
            List.of(CategoryPO.builder().code("c").name("old").active(true).build()),
            List.of(CategoryPO.builder().code("c").name("new").active(true).build())
        );
        assertEquals("old", repository.displayCategories().get(0).name());
        assertEquals("new", repository.displayCategories().get(0).name());
        clients.security().shutdown();
        assertEquals("cached", cache.read("isolated", 10, new TypeReference<String>() {}, () -> "cached"));
        assertEquals("cached", cache.read("isolated", 10, new TypeReference<String>() {}, () -> "fallback"));
    }
}
