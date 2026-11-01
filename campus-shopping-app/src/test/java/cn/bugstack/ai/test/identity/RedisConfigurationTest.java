package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.infrastructure.redis.RedisInfrastructureConfig;
import org.junit.jupiter.api.Test;

class RedisConfigurationTest {

    @Test
    void startupRejectsSharedEndpointWhenIsolationIsRequiredAndAllowsDevelopment() {
        var runner = new org.springframework.boot.test.context.runner.ApplicationContextRunner()
            .withUserConfiguration(RedisInfrastructureConfig.class)
            .withPropertyValues("campus.redis.security-address=redis://127.0.0.1:6379", "campus.redis.cache-address=redis://127.0.0.1:6379");
        runner.withPropertyValues("campus.redis.require-separate-instances=true").run(context -> assertNotNull(context.getStartupFailure()));
        runner.withPropertyValues("campus.redis.require-separate-instances=false").run(context -> assertNull(context.getStartupFailure()));
    }

    @Test
    void rejectsSameEndpointIncludingAliasesAndAllowsSeparatePorts() {
        assertThrows(IllegalArgumentException.class, () ->
            RedisInfrastructureConfig.validateSeparateInstances("redis://127.0.0.1:6379", "rediss://127.0.0.1:6379")
        );
        assertThrows(IllegalArgumentException.class, () -> RedisInfrastructureConfig.validateSeparateInstances("redis://localhost", "redis://127.0.0.1:6379"));
        assertDoesNotThrow(() -> RedisInfrastructureConfig.validateSeparateInstances("redis://127.0.0.1:6379", "redis://127.0.0.1:6380"));
    }
}
