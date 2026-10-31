package cn.bugstack.ai.infrastructure.redis;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.redisson.client.codec.StringCodec;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.*;

/** 仅显式展示投影可调用；JSON 类型由调用者固定，缓存故障不覆盖数据库提交结果。 */
@Slf4j
@Component
public class DisplayCache {

  private final ObjectProvider<RedisClients> clients;
  private final ObjectMapper mapper;
  private final AtomicLong failures = new AtomicLong();

  public DisplayCache(ObjectProvider<RedisClients> clients, ObjectMapper mapper) {
    this.clients = clients;
    this.mapper = mapper;
  }

  public <T> T read(String key, int seconds, TypeReference<T> type, Supplier<T> loader) {
    RedisClients redis = clients.getIfAvailable();
    if (redis == null) return loader.get();
    var bucket = redis
      .cache()
      .<String>getBucket(redis.namespace() + ":display:v1:" + key, StringCodec.INSTANCE);
    try {
      String data = bucket.get();
      if (data != null) return mapper.readValue(data, type);
    } catch (Exception error) {
      diagnostic();
      return loader.get();
    }
    T value = loader.get();
    if (value != null) try {
      bucket.set(
        mapper.writeValueAsString(value),
        Duration.ofSeconds(seconds + ThreadLocalRandom.current().nextInt(Math.max(1, seconds / 5)))
      );
    } catch (Exception error) {
      diagnostic();
    }
    return value;
  }

  public void evictAfterCommit(String key) {
    Runnable action = () -> {
      RedisClients redis = clients.getIfAvailable();
      if (redis != null) try {
        redis
          .cache()
          .getBucket(redis.namespace() + ":display:v1:" + key)
          .delete();
      } catch (RuntimeException error) {
        diagnostic();
      }
    };
    if (
      TransactionSynchronizationManager.isSynchronizationActive()
    ) TransactionSynchronizationManager.registerSynchronization(
      new TransactionSynchronization() {
        @Override
        public void afterCommit() {
          action.run();
        }
      }
    );
    else action.run();
  }

  public long failures() {
    return failures.get();
  }

  private void diagnostic() {
    long count = failures.incrementAndGet();
    if (count == 1 || count % 100 == 0) log.warn("display_cache_degraded failure_total={}", count);
  }
}
