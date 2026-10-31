package cn.bugstack.ai.infrastructure.redis;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 显式连接，不借助 Starter 自动创建额外的连接工厂。 */
@Configuration
@ConditionalOnProperty(name = "campus.redis.enabled", havingValue = "true", matchIfMissing = true)
public class RedisInfrastructureConfig {

    @Bean(destroyMethod = "close")
    public RedisClients redisClients(
        @Value("${campus.redis.security-address:redis://127.0.0.1:6379}") String securityAddress,
        @Value("${campus.redis.cache-address:redis://127.0.0.1:6380}") String cacheAddress,
        @Value("${campus.redis.security-password:}") String securityPassword,
        @Value("${campus.redis.cache-password:}") String cachePassword,
        @Value("${campus.redis.security-username:}") String securityUsername,
        @Value("${campus.redis.cache-username:}") String cacheUsername,
        @Value("${campus.redis.namespace:cs:dev}") String namespace
    ) {
        if (!namespace.matches("[a-zA-Z0-9:_-]{3,80}")) throw new IllegalArgumentException("Redis namespace 无效");
        RedissonClient security = client(securityAddress, securityUsername, securityPassword);
        try {
            return new RedisClients(security, client(cacheAddress, cacheUsername, cachePassword), namespace);
        } catch (RuntimeException error) {
            security.shutdown();
            throw error;
        }
    }

    public static RedissonClient client(String address, String username, String password) {
        java.net.URI uri = java.net.URI.create(address);
        if (
            !java.util.Set.of("redis", "rediss").contains(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
        ) throw new IllegalArgumentException("Redis 地址须使用 redis/rediss，凭据单独配置");
        if ("redis".equals(uri.getScheme()) && !privateHost(uri.getHost())) throw new IllegalArgumentException("公网 Redis 必须使用 TLS");
        Config config = new Config();
        config.setLazyInitialization(true);
        config.setThreads(2).setNettyThreads(2);
        var server = config
            .useSingleServer()
            .setAddress(address)
            .setDatabase(0)
            .setConnectTimeout(800)
            .setTimeout(800)
            .setRetryAttempts(0)
            .setConnectionMinimumIdleSize(1)
            .setConnectionPoolSize(8)
            .setSubscriptionConnectionMinimumIdleSize(1)
            .setSubscriptionConnectionPoolSize(2);
        if (!username.isBlank()) server.setUsername(username);
        if (!password.isBlank()) server.setPassword(password);
        return Redisson.create(config);
    }

    private static boolean privateHost(String host) {
        if (
            java.util.Set.of("localhost", "redis-security", "redis-cache").contains(host) || host.endsWith(".internal") || host.endsWith(".svc.cluster.local")
        ) return true;
        try {
            var address = java.net.InetAddress.getByName(host);
            return address.isLoopbackAddress() || address.isSiteLocalAddress();
        } catch (java.net.UnknownHostException ignored) {
            return false;
        }
    }
}
