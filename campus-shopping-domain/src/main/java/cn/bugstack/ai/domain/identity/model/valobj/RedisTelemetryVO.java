package cn.bugstack.ai.domain.identity.model.valobj;

import java.util.List;

/** 双 Redis 运行态遥测快照（仅平台管理员可见，不含任何凭据或用户隐私）。 */
public record RedisTelemetryVO(
    boolean redisEnabled,
    boolean securityConnected,
    boolean cacheConnected,
    String namespace,
    long crawlerBlockedCount,
    long rateLimitedCount,
    long orderBrushBlockedCount,
    long pinLockoutCount,
    long displayCacheFailures,
    List<String> topHotKeywords,
    List<String> topSellingProductIds,
    int activeRealtimeSubscribers,
    long delayedExpiryQueueSize
) {}
