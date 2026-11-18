package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.infrastructure.adapter.repository.AiResourceRepository;
import cn.bugstack.ai.infrastructure.redis.RedisClients;
import cn.bugstack.ai.types.exception.AppException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.redisson.api.RPermitExpirableSemaphore;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;

class AiResourceRepositoryTest {

    @Test
    void recoversWhenRedisSemaphoreKeyDisappearsWithoutBreakingCapacityExhaustion() throws Exception {
        RedissonClient security = mock(RedissonClient.class);
        RedissonClient cache = mock(RedissonClient.class);
        RPermitExpirableSemaphore semaphore = mock(RPermitExpirableSemaphore.class);
        when(security.getPermitExpirableSemaphore("cs:test:ai:admission:v1")).thenReturn(semaphore);

        var beans = new DefaultListableBeanFactory();
        beans.registerSingleton("clients", new RedisClients(security, cache, "cs:test"));
        var repository = new AiResourceRepository(beans.getBeanProvider(RedisClients.class), 2);

        // 1. Initial call initializes permits once and acquires normally.
        when(semaphore.trySetPermits(2)).thenReturn(true);
        when(semaphore.tryAcquire(0, 180, TimeUnit.SECONDS)).thenReturn("permit-1");
        try (var permit = repository.acquire()) {
            assertNotNull(permit);
        }
        verify(semaphore).tryRelease("permit-1");

        // 2. Genuine capacity exhaustion: key still exists (trySetPermits=false) and availablePermits=0 -> AI0001.
        reset(semaphore);
        when(semaphore.tryAcquire(0, 180, TimeUnit.SECONDS)).thenReturn(null);
        when(semaphore.trySetPermits(2)).thenReturn(false);
        when(semaphore.availablePermits()).thenReturn(0);
        AppException exhausted = assertThrows(AppException.class, repository::acquire);
        assertEquals("AI0001", exhausted.getCode());
        verify(semaphore, times(1)).tryAcquire(0, 180, TimeUnit.SECONDS);

        // 3. Redis key evicted/restarted: first tryAcquire returns null, trySetPermits=true re-seeds key, retry succeeds.
        reset(semaphore);
        when(semaphore.tryAcquire(0, 180, TimeUnit.SECONDS)).thenReturn(null, "permit-recovered");
        when(semaphore.trySetPermits(2)).thenReturn(true);
        try (var permit = repository.acquire()) {
            assertNotNull(permit);
        }
        verify(semaphore, times(2)).tryAcquire(0, 180, TimeUnit.SECONDS);
        verify(semaphore).tryRelease("permit-recovered");
    }
}
