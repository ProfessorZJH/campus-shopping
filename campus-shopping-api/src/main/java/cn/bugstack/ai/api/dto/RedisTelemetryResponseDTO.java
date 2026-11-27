package cn.bugstack.ai.api.dto;

import java.util.List;
import lombok.*;

/** 双 Redis 7 支柱运行态遥测（仅平台管理员可见）。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RedisTelemetryResponseDTO {

    private Boolean redisEnabled;
    private Boolean securityConnected;
    private Boolean cacheConnected;
    private String namespace;
    private Long crawlerBlockedCount;
    private Long rateLimitedCount;
    private Long orderBrushBlockedCount;
    private Long pinLockoutCount;
    private Long displayCacheFailures;
    private List<String> topHotKeywords;
    private List<String> topSellingProductIds;
    private Integer activeRealtimeSubscribers;
    private Long delayedExpiryQueueSize;
}
