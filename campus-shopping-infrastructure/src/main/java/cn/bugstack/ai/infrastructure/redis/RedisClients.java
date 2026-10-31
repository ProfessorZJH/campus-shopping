package cn.bugstack.ai.infrastructure.redis;

import org.redisson.api.RedissonClient;

/** 安全状态与可丢弃缓存各用一个客户端，配置不得混淆。 */
public record RedisClients(
  RedissonClient security,
  RedissonClient cache,
  String namespace
) implements AutoCloseable {
  @Override
  public void close() {
    cache.shutdown();
    security.shutdown();
  }
}
