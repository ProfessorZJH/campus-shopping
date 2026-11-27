package cn.bugstack.ai.cases.catalog;

import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.domain.identity.model.valobj.RedisTelemetryVO;
import java.util.List;

/** 收藏、首页发现、关联推荐与 Redis 运行态遥测用例。 */
public interface IDiscoveryCase {
    record DiscoveryHomeSnapshot(
        List<String> hotKeywords,
        List<ProductReadModel> hotProducts,
        List<ProductReadModel> recommendedProducts,
        List<ProductReadModel> recentProducts,
        List<String> favoriteProductIds
    ) {}

    record ProductRecommendationsSnapshot(List<ProductReadModel> boughtTogether, List<ProductReadModel> sameStoreHot) {}

    boolean addFavorite(String actor, String productId);

    boolean removeFavorite(String actor, String productId);

    List<ProductReadModel> favorites(String actor);

    DiscoveryHomeSnapshot home(String actorOrNull);

    ProductRecommendationsSnapshot recommendations(String productId);

    RedisTelemetryVO redisTelemetry(String actor);
}
