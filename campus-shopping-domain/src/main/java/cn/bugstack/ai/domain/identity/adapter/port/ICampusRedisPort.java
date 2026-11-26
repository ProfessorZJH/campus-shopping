package cn.bugstack.ai.domain.identity.adapter.port;

import cn.bugstack.ai.domain.identity.model.valobj.RedisTelemetryVO;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;

/** 双 Redis（安全实例 + 展示/榜单/实时事件缓存实例）协同端口。 */
public interface ICampusRedisPort {
    String nextPickupQueueCode(String storeId);

    void storePickupPin(String merchantId, String pinCode, String orderId, String rawToken, long ttlSeconds);

    /** 返回 "orderId|rawToken"；consume=true 时通过 Lua 原子 GET+DEL。 */
    String peekOrConsumePickupPin(String merchantId, String pinCode, boolean consume);

    void checkPinBruteForce(String merchantId, String actor);

    void recordPinFailure(String merchantId, String actor);

    boolean isIpBanned(String ip);

    /** 记录限流触发，60s 内累计 >= 3 次则封禁 IP 300s 并返回封禁秒数，否则返回 0。 */
    long recordRateViolationAndMaybeBan(String ip);

    void recordCrawlerBlocked(String ip);

    void recordOrderBrushBlocked();

    void recordOrderPaid(List<String> productIds, Map<String, String> categories, Map<String, Integer> quantities);

    void recordSearchKeyword(String keyword);

    void recordFootprint(String userId, String productId);

    List<String> topHotKeywords(int limit);

    List<String> topSellingProductIds(int limit);

    List<String> coPurchasedProductIds(String productId, int limit);

    List<String> recentFootprintProductIds(String userId, int limit);

    void publishRealtimeEventAfterCommit(String channelKey, Map<String, Object> payload);

    AutoCloseable subscribeRealtimeEvents(BiConsumer<String, Map<String, Object>> listener);

    String loadExpiryCursor();

    void saveExpiryCursor(String cursor);

    void setDelayedExpiryQueueSizeSupplier(java.util.function.LongSupplier supplier);

    RedisTelemetryVO telemetry();
}
