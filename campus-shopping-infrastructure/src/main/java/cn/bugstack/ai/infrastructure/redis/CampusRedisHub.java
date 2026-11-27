package cn.bugstack.ai.infrastructure.redis;

import cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort;
import cn.bugstack.ai.domain.identity.model.valobj.RedisTelemetryVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RAtomicLong;
import org.redisson.api.RBucket;
import org.redisson.api.RScoredSortedSet;
import org.redisson.api.RScript;
import org.redisson.api.RTopic;
import org.redisson.client.codec.StringCodec;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 双 Redis 7 支柱协同中心（兼容 Redis 3.2 与 Redis 7.4）：
 * - redis-security：取餐叫号序号、6 位核销码一次性原子消费、防爆破锁定、IP 惩戒封禁与防爬/防刷计数；
 * - redis-cache：校园热搜榜、热销榜、ItemCF 共购关联、用户最近浏览足迹、实时事件广播与定时任务游标。
 */
@Slf4j
@Component
public class CampusRedisHub implements ICampusRedisPort {

    private static final ZoneId CAMPUS_ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final String LUA_GET_AND_DEL = "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;";
    private static final int MAX_FOOTPRINTS = 30;
    private static final int PIN_MAX_FAILURES = 5;
    private static final int PIN_WINDOW_SECONDS = 300;
    private static final int PIN_LOCKOUT_SECONDS = 180;
    private static final int BAN_VIOLATION_THRESHOLD = 3;
    private static final int BAN_WINDOW_SECONDS = 60;
    private static final int BAN_DURATION_SECONDS = 300;

    private final ObjectProvider<RedisClients> clients;
    private final ObjectMapper mapper;
    private final ObjectProvider<DisplayCache> displayCache;

    // 单实例/无 Redis 降级与本地统计兜底
    private final ConcurrentHashMap<String, AtomicLong> localQueueSeq = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LocalEntry<String>> localPins = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LocalCounterWindow> localPinFailures = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> localPinLocks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LocalCounterWindow> localRateViolations = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> localIpBans = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Double> localHotwords = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Double> localSalesRank = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, Double>> localCoPurchase = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LinkedHashMap<String, Long>> localFootprints = new ConcurrentHashMap<>();
    private final CopyOnWriteArrayList<BiConsumer<String, Map<String, Object>>> localListeners = new CopyOnWriteArrayList<>();

    private final AtomicLong localCrawlerBlocked = new AtomicLong();
    private final AtomicLong localRateLimited = new AtomicLong();
    private final AtomicLong localOrderBrushBlocked = new AtomicLong();
    private final AtomicLong localPinLockout = new AtomicLong();
    private volatile String localExpiryCursor = "";
    private volatile LongSupplier delayedQueueSizeSupplier = () -> 0L;

    private final AtomicInteger topicListenerId = new AtomicInteger(-1);
    private volatile RTopic subscribedTopic;

    @Autowired
    public CampusRedisHub(ObjectProvider<RedisClients> clients, ObjectMapper mapper, ObjectProvider<DisplayCache> displayCache) {
        this.clients = clients;
        this.mapper = mapper;
        this.displayCache = displayCache;
    }

    public CampusRedisHub(ObjectProvider<RedisClients> clients, ObjectMapper mapper) {
        this(clients, mapper, null);
    }

    @PreDestroy
    public void shutdown() {
        int id = topicListenerId.getAndSet(-1);
        RTopic topic = subscribedTopic;
        if (id >= 0 && topic != null) {
            try {
                topic.removeListener(id);
            } catch (RuntimeException ignored) {}
        }
    }

    @Override
    public String nextPickupQueueCode(String storeId) {
        String day = LocalDate.now(CAMPUS_ZONE).format(DAY_FMT);
        String normalizedStore = storeId == null || storeId.isBlank() ? "default" : storeId;
        RedisClients redis = redis();
        long seq;
        if (redis != null) {
            try {
                RAtomicLong counter = redis.security().getAtomicLong(redis.namespace() + ":pickup:seq:" + normalizedStore + ":" + day);
                seq = counter.incrementAndGet();
                if (seq == 1L) counter.expire(Duration.ofHours(36));
                return formatQueueCode(seq);
            } catch (RuntimeException error) {
                log.warn("redis_pickup_seq_degraded store={} error={}", normalizedStore, error.getClass().getSimpleName());
            }
        }
        seq = localQueueSeq.computeIfAbsent(normalizedStore + ":" + day, k -> new AtomicLong()).incrementAndGet();
        return formatQueueCode(seq);
    }

    private String formatQueueCode(long seq) {
        long num = 100 + seq;
        return "A-" + String.format("%03d", num);
    }

    @Override
    public void storePickupPin(String merchantId, String pinCode, String orderId, String rawToken, long ttlSeconds) {
        if (merchantId == null || pinCode == null || orderId == null || rawToken == null) return;
        long effectiveTtl = Math.max(10, ttlSeconds);
        String payload = orderId + "|" + rawToken;
        String pinHash = Fingerprints.sha256(pinCode);
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RBucket<String> bucket = redis.security().getBucket(redis.namespace() + ":pickup:pin:" + merchantId + ":" + pinHash, StringCodec.INSTANCE);
                bucket.set(payload, Duration.ofSeconds(effectiveTtl));
                return;
            } catch (RuntimeException error) {
                log.warn("redis_pickup_pin_store_degraded error={}", error.getClass().getSimpleName());
            }
        }
        localPins.put(merchantId + ":" + pinHash, new LocalEntry<>(payload, System.currentTimeMillis() + effectiveTtl * 1000L));
    }

    @Override
    public String peekOrConsumePickupPin(String merchantId, String pinCode, boolean consume) {
        if (merchantId == null || pinCode == null || pinCode.isBlank()) return null;
        String pinHash = Fingerprints.sha256(pinCode);
        RedisClients redis = redis();
        if (redis != null) {
            String key = redis.namespace() + ":pickup:pin:" + merchantId + ":" + pinHash;
            try {
                if (consume) {
                    RScript script = redis.security().getScript(StringCodec.INSTANCE);
                    Object result = script.eval(RScript.Mode.READ_WRITE, LUA_GET_AND_DEL, RScript.ReturnType.VALUE, List.of(key));
                    return result == null ? null : result.toString();
                }
                RBucket<String> bucket = redis.security().getBucket(key, StringCodec.INSTANCE);
                return bucket.get();
            } catch (RuntimeException error) {
                log.warn("redis_pickup_pin_read_degraded error={}", error.getClass().getSimpleName());
            }
        }
        String localKey = merchantId + ":" + pinHash;
        LocalEntry<String> entry = consume ? localPins.remove(localKey) : localPins.get(localKey);
        if (entry == null || entry.expiresAt <= System.currentTimeMillis()) {
            localPins.remove(localKey);
            return null;
        }
        return entry.value;
    }

    @Override
    public void checkPinBruteForce(String merchantId, String actor) {
        String subject = Fingerprints.of(merchantId == null ? "" : merchantId, actor == null ? "" : actor);
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RBucket<String> lock = redis.security().getBucket(redis.namespace() + ":sec:pin:lock:" + subject, StringCodec.INSTANCE);
                if (lock.get() != null) {
                    throw new AppException(ResponseCode.AUTH_RATE_LIMITED.getCode(), "核销码连续错误次数过多，请3分钟后再试");
                }
                return;
            } catch (AppException e) {
                throw e;
            } catch (RuntimeException error) {
                log.warn("redis_pin_check_degraded error={}", error.getClass().getSimpleName());
            }
        }
        Long until = localPinLocks.get(subject);
        if (until != null && until > System.currentTimeMillis()) {
            throw new AppException(ResponseCode.AUTH_RATE_LIMITED.getCode(), "核销码连续错误次数过多，请3分钟后再试");
        }
        if (until != null) localPinLocks.remove(subject);
    }

    @Override
    public void recordPinFailure(String merchantId, String actor) {
        String subject = Fingerprints.of(merchantId == null ? "" : merchantId, actor == null ? "" : actor);
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RAtomicLong fails = redis.security().getAtomicLong(redis.namespace() + ":sec:pin:fail:" + subject);
                long count = fails.incrementAndGet();
                if (count == 1L) fails.expire(Duration.ofSeconds(PIN_WINDOW_SECONDS));
                if (count >= PIN_MAX_FAILURES) {
                    RBucket<String> lock = redis.security().getBucket(redis.namespace() + ":sec:pin:lock:" + subject, StringCodec.INSTANCE);
                    lock.set("1", Duration.ofSeconds(PIN_LOCKOUT_SECONDS));
                    incrementSecurityMetric(redis, "pinLockoutCount", localPinLockout);
                }
                return;
            } catch (RuntimeException error) {
                log.warn("redis_pin_fail_degraded error={}", error.getClass().getSimpleName());
            }
        }
        long now = System.currentTimeMillis();
        LocalCounterWindow win = localPinFailures.compute(subject, (k, old) ->
            old == null || old.until <= now ? new LocalCounterWindow(now + PIN_WINDOW_SECONDS * 1000L) : old
        );
        int count = win.count.incrementAndGet();
        if (count >= PIN_MAX_FAILURES) {
            localPinLocks.put(subject, now + PIN_LOCKOUT_SECONDS * 1000L);
            localPinLockout.incrementAndGet();
        }
    }

    @Override
    public boolean isIpBanned(String ip) {
        String subject = normalizeIp(ip);
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RBucket<String> ban = redis.security().getBucket(redis.namespace() + ":sec:ban:ip:" + subject, StringCodec.INSTANCE);
                return ban.get() != null;
            } catch (RuntimeException error) {
                log.warn("redis_ip_ban_check_degraded error={}", error.getClass().getSimpleName());
            }
        }
        Long until = localIpBans.get(subject);
        if (until != null && until > System.currentTimeMillis()) return true;
        if (until != null) localIpBans.remove(subject);
        return false;
    }

    @Override
    public long recordRateViolationAndMaybeBan(String ip) {
        String subject = normalizeIp(ip);
        RedisClients redis = redis();
        if (redis != null) {
            try {
                incrementSecurityMetric(redis, "rateLimitedCount", localRateLimited);
                RAtomicLong violations = redis.security().getAtomicLong(redis.namespace() + ":sec:rl:viol:" + subject);
                long count = violations.incrementAndGet();
                if (count == 1L) violations.expire(Duration.ofSeconds(BAN_WINDOW_SECONDS));
                if (count >= BAN_VIOLATION_THRESHOLD) {
                    RBucket<String> ban = redis.security().getBucket(redis.namespace() + ":sec:ban:ip:" + subject, StringCodec.INSTANCE);
                    ban.set("1", Duration.ofSeconds(BAN_DURATION_SECONDS));
                    return BAN_DURATION_SECONDS;
                }
                return 0L;
            } catch (RuntimeException error) {
                log.warn("redis_rate_viol_degraded error={}", error.getClass().getSimpleName());
            }
        }
        localRateLimited.incrementAndGet();
        long now = System.currentTimeMillis();
        LocalCounterWindow win = localRateViolations.compute(subject, (k, old) ->
            old == null || old.until <= now ? new LocalCounterWindow(now + BAN_WINDOW_SECONDS * 1000L) : old
        );
        if (win.count.incrementAndGet() >= BAN_VIOLATION_THRESHOLD) {
            localIpBans.put(subject, now + BAN_DURATION_SECONDS * 1000L);
            return BAN_DURATION_SECONDS;
        }
        return 0L;
    }

    @Override
    public void recordCrawlerBlocked(String ip) {
        RedisClients redis = redis();
        if (redis != null) {
            try {
                incrementSecurityMetric(redis, "crawlerBlockedCount", localCrawlerBlocked);
                return;
            } catch (RuntimeException error) {
                log.warn("redis_crawler_metric_degraded error={}", error.getClass().getSimpleName());
            }
        }
        localCrawlerBlocked.incrementAndGet();
    }

    @Override
    public void recordOrderBrushBlocked() {
        RedisClients redis = redis();
        if (redis != null) {
            try {
                incrementSecurityMetric(redis, "orderBrushBlockedCount", localOrderBrushBlocked);
                return;
            } catch (RuntimeException error) {
                log.warn("redis_brush_metric_degraded error={}", error.getClass().getSimpleName());
            }
        }
        localOrderBrushBlocked.incrementAndGet();
    }

    @Override
    public void recordOrderPaid(List<String> productIds, Map<String, String> categories, Map<String, Integer> quantities) {
        if (productIds == null || productIds.isEmpty()) return;
        List<String> distinct = productIds.stream().filter(Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) return;
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RScoredSortedSet<String> campusRank = redis.cache().getScoredSortedSet(redis.namespace() + ":rank:sales:campus", StringCodec.INSTANCE);
                for (String pid : distinct) {
                    int qty = Math.max(1, quantities == null ? 1 : quantities.getOrDefault(pid, 1));
                    campusRank.addScore(pid, qty);
                    String cat = categories == null ? null : categories.get(pid);
                    if (cat != null && !cat.isBlank()) {
                        RScoredSortedSet<String> catRank = redis.cache().getScoredSortedSet(redis.namespace() + ":rank:sales:cat:" + cat, StringCodec.INSTANCE);
                        catRank.addScore(pid, qty);
                    }
                }
                if (distinct.size() >= 2) {
                    for (int i = 0; i < distinct.size(); i++) {
                        String a = distinct.get(i);
                        RScoredSortedSet<String> coSet = redis.cache().getScoredSortedSet(redis.namespace() + ":rec:copurchase:" + a, StringCodec.INSTANCE);
                        for (int j = 0; j < distinct.size(); j++) {
                            if (i != j) coSet.addScore(distinct.get(j), 1.0);
                        }
                    }
                }
                return;
            } catch (RuntimeException error) {
                log.warn("redis_sales_rank_degraded error={}", error.getClass().getSimpleName());
            }
        }
        for (String pid : distinct) {
            int qty = Math.max(1, quantities == null ? 1 : quantities.getOrDefault(pid, 1));
            localSalesRank.merge(pid, (double) qty, Double::sum);
        }
        if (distinct.size() >= 2) {
            for (int i = 0; i < distinct.size(); i++) {
                String a = distinct.get(i);
                var peers = localCoPurchase.computeIfAbsent(a, k -> new ConcurrentHashMap<>());
                for (int j = 0; j < distinct.size(); j++) {
                    if (i != j) peers.merge(distinct.get(j), 1.0, Double::sum);
                }
            }
        }
    }

    @Override
    public void recordSearchKeyword(String keyword) {
        if (keyword == null) return;
        String clean = keyword.trim();
        if (clean.length() < 2 || clean.length() > 30) return;
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RScoredSortedSet<String> hotwords = redis.cache().getScoredSortedSet(redis.namespace() + ":rank:hotwords", StringCodec.INSTANCE);
                hotwords.addScore(clean, 1.0);
                return;
            } catch (RuntimeException error) {
                log.warn("redis_hotword_degraded error={}", error.getClass().getSimpleName());
            }
        }
        localHotwords.merge(clean, 1.0, Double::sum);
    }

    @Override
    public void recordFootprint(String userId, String productId) {
        if (userId == null || userId.isBlank() || productId == null || productId.isBlank()) return;
        long now = System.currentTimeMillis();
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RScoredSortedSet<String> set = redis.cache().getScoredSortedSet(redis.namespace() + ":footprint:" + userId, StringCodec.INSTANCE);
                set.add((double) now, productId);
                int size = set.size();
                if (size > MAX_FOOTPRINTS) {
                    set.removeRangeByRank(0, size - MAX_FOOTPRINTS - 1);
                }
                set.expire(Duration.ofDays(30));
                return;
            } catch (RuntimeException error) {
                log.warn("redis_footprint_degraded error={}", error.getClass().getSimpleName());
            }
        }
        LinkedHashMap<String, Long> map = localFootprints.computeIfAbsent(userId, k -> new LinkedHashMap<>());
        synchronized (map) {
            map.remove(productId);
            map.put(productId, now);
            while (map.size() > MAX_FOOTPRINTS) {
                String oldest = map.keySet().iterator().next();
                map.remove(oldest);
            }
        }
    }

    @Override
    public List<String> topHotKeywords(int limit) {
        int cap = Math.max(1, Math.min(limit, 50));
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RScoredSortedSet<String> set = redis.cache().getScoredSortedSet(redis.namespace() + ":rank:hotwords", StringCodec.INSTANCE);
                return List.copyOf(set.valueRangeReversed(0, cap - 1));
            } catch (RuntimeException error) {
                log.warn("redis_top_hotwords_degraded error={}", error.getClass().getSimpleName());
            }
        }
        return topFromLocalMap(localHotwords, cap);
    }

    @Override
    public List<String> topSellingProductIds(int limit) {
        int cap = Math.max(1, Math.min(limit, 50));
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RScoredSortedSet<String> set = redis.cache().getScoredSortedSet(redis.namespace() + ":rank:sales:campus", StringCodec.INSTANCE);
                return List.copyOf(set.valueRangeReversed(0, cap - 1));
            } catch (RuntimeException error) {
                log.warn("redis_top_selling_degraded error={}", error.getClass().getSimpleName());
            }
        }
        return topFromLocalMap(localSalesRank, cap);
    }

    @Override
    public List<String> coPurchasedProductIds(String productId, int limit) {
        if (productId == null || productId.isBlank()) return List.of();
        int cap = Math.max(1, Math.min(limit, 30));
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RScoredSortedSet<String> set = redis.cache().getScoredSortedSet(redis.namespace() + ":rec:copurchase:" + productId, StringCodec.INSTANCE);
                return List.copyOf(set.valueRangeReversed(0, cap - 1));
            } catch (RuntimeException error) {
                log.warn("redis_copurchase_degraded error={}", error.getClass().getSimpleName());
            }
        }
        var peers = localCoPurchase.get(productId);
        return peers == null ? List.of() : topFromLocalMap(peers, cap);
    }

    @Override
    public List<String> recentFootprintProductIds(String userId, int limit) {
        if (userId == null || userId.isBlank()) return List.of();
        int cap = Math.max(1, Math.min(limit, MAX_FOOTPRINTS));
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RScoredSortedSet<String> set = redis.cache().getScoredSortedSet(redis.namespace() + ":footprint:" + userId, StringCodec.INSTANCE);
                return List.copyOf(set.valueRangeReversed(0, cap - 1));
            } catch (RuntimeException error) {
                log.warn("redis_footprint_read_degraded error={}", error.getClass().getSimpleName());
            }
        }
        LinkedHashMap<String, Long> map = localFootprints.get(userId);
        if (map == null) return List.of();
        List<String> list;
        synchronized (map) {
            list = new ArrayList<>(map.keySet());
        }
        Collections.reverse(list);
        return list.size() <= cap ? List.copyOf(list) : List.copyOf(list.subList(0, cap));
    }

    @Override
    public void publishRealtimeEventAfterCommit(String channelKey, Map<String, Object> payload) {
        if (channelKey == null || channelKey.isBlank() || payload == null) return;
        Map<String, Object> safePayload = Map.copyOf(payload);
        Runnable task = () -> publishRealtimeNow(channelKey, safePayload);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        task.run();
                    }
                }
            );
        } else {
            task.run();
        }
    }

    private void publishRealtimeNow(String channelKey, Map<String, Object> payload) {
        RedisClients redis = redis();
        if (redis != null) {
            try {
                Map<String, Object> envelope = new LinkedHashMap<>();
                envelope.put("channelKey", channelKey);
                envelope.put("payload", payload);
                RTopic topic = redis.cache().getTopic(redis.namespace() + ":topic:rt", StringCodec.INSTANCE);
                long receivers = topic.publish(mapper.writeValueAsString(envelope));
                if (receivers > 0 || topicListenerId.get() >= 0) return;
            } catch (Exception error) {
                log.warn("redis_realtime_publish_degraded error={}", error.getClass().getSimpleName());
            }
        }
        dispatchLocal(channelKey, payload);
    }

    @Override
    public AutoCloseable subscribeRealtimeEvents(BiConsumer<String, Map<String, Object>> listener) {
        Objects.requireNonNull(listener);
        localListeners.add(listener);
        ensureTopicSubscribed();
        return () -> localListeners.remove(listener);
    }

    private void ensureTopicSubscribed() {
        if (topicListenerId.get() >= 0) return;
        RedisClients redis = redis();
        if (redis == null) return;
        synchronized (topicListenerId) {
            if (topicListenerId.get() >= 0) return;
            try {
                RTopic topic = redis.cache().getTopic(redis.namespace() + ":topic:rt", StringCodec.INSTANCE);
                int id = topic.addListener(String.class, (channel, msg) -> {
                    try {
                        Map<String, Object> envelope = mapper.readValue(msg, new TypeReference<>() {});
                        Object key = envelope.get("channelKey");
                        Object payloadObj = envelope.get("payload");
                        if (key instanceof String channelKey && payloadObj instanceof Map<?, ?> rawMap) {
                            Map<String, Object> payload = new LinkedHashMap<>();
                            rawMap.forEach((k, v) -> {
                                if (k != null) payload.put(k.toString(), v);
                            });
                            dispatchLocal(channelKey, payload);
                        }
                    } catch (Exception ignored) {}
                });
                subscribedTopic = topic;
                topicListenerId.set(id);
            } catch (RuntimeException error) {
                log.warn("redis_topic_subscribe_degraded error={}", error.getClass().getSimpleName());
            }
        }
    }

    private void dispatchLocal(String channelKey, Map<String, Object> payload) {
        for (var listener : localListeners) {
            try {
                listener.accept(channelKey, payload);
            } catch (RuntimeException ignored) {}
        }
    }

    @Override
    public String loadExpiryCursor() {
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RBucket<String> bucket = redis.cache().getBucket(redis.namespace() + ":coord:expiry-cursor", StringCodec.INSTANCE);
                String val = bucket.get();
                return val == null ? "" : val;
            } catch (RuntimeException ignored) {}
        }
        return localExpiryCursor;
    }

    @Override
    public void saveExpiryCursor(String cursor) {
        String val = cursor == null ? "" : cursor;
        localExpiryCursor = val;
        RedisClients redis = redis();
        if (redis != null) {
            try {
                RBucket<String> bucket = redis.cache().getBucket(redis.namespace() + ":coord:expiry-cursor", StringCodec.INSTANCE);
                bucket.set(val, Duration.ofHours(24));
            } catch (RuntimeException ignored) {}
        }
    }

    @Override
    public void setDelayedExpiryQueueSizeSupplier(LongSupplier supplier) {
        this.delayedQueueSizeSupplier = supplier == null ? () -> 0L : supplier;
    }

    @Override
    public RedisTelemetryVO telemetry() {
        RedisClients redis = redis();
        boolean enabled = redis != null;
        boolean securityConnected = false;
        boolean cacheConnected = false;
        String ns = enabled ? redis.namespace() : "disabled";
        if (redis != null) {
            securityConnected = ping(redis.security());
            cacheConnected = ping(redis.cache());
        }
        long crawlerBlocked = readSecurityMetric(redis, "crawlerBlockedCount", localCrawlerBlocked);
        long rateLimited = readSecurityMetric(redis, "rateLimitedCount", localRateLimited);
        long orderBrushBlocked = readSecurityMetric(redis, "orderBrushBlockedCount", localOrderBrushBlocked);
        long pinLockout = readSecurityMetric(redis, "pinLockoutCount", localPinLockout);
        DisplayCache dc = displayCache == null ? null : displayCache.getIfAvailable();
        long cacheFailures = dc == null ? 0L : dc.failures();
        long delaySize = 0L;
        try {
            delaySize = delayedQueueSizeSupplier.getAsLong();
        } catch (RuntimeException ignored) {}
        return new RedisTelemetryVO(
            enabled,
            securityConnected,
            cacheConnected,
            ns,
            crawlerBlocked,
            rateLimited,
            orderBrushBlocked,
            pinLockout,
            cacheFailures,
            topHotKeywords(10),
            topSellingProductIds(10),
            localListeners.size(),
            delaySize
        );
    }

    private boolean ping(org.redisson.api.RedissonClient client) {
        try {
            client.getBucket("__ping__:" + UUID.randomUUID(), StringCodec.INSTANCE).isExists();
            return true;
        } catch (RuntimeException error) {
            return false;
        }
    }

    private void incrementSecurityMetric(RedisClients redis, String name, AtomicLong fallback) {
        fallback.incrementAndGet();
        redis
            .security()
            .getAtomicLong(redis.namespace() + ":sec:metric:" + name)
            .incrementAndGet();
    }

    private long readSecurityMetric(RedisClients redis, String name, AtomicLong fallback) {
        if (redis != null) {
            try {
                return redis
                    .security()
                    .getAtomicLong(redis.namespace() + ":sec:metric:" + name)
                    .get();
            } catch (RuntimeException ignored) {}
        }
        return fallback.get();
    }

    private RedisClients redis() {
        return clients == null ? null : clients.getIfAvailable();
    }

    private String normalizeIp(String ip) {
        return ip == null || ip.isBlank() ? "unknown" : Fingerprints.of(ip.trim());
    }

    private List<String> topFromLocalMap(Map<String, Double> map, int limit) {
        return map
            .entrySet()
            .stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed().thenComparing(Map.Entry::getKey))
            .limit(limit)
            .map(Map.Entry::getKey)
            .toList();
    }

    private record LocalEntry<T>(T value, long expiresAt) {}

    private static final class LocalCounterWindow {

        final long until;
        final AtomicInteger count = new AtomicInteger();

        LocalCounterWindow(long until) {
            this.until = until;
        }
    }
}
