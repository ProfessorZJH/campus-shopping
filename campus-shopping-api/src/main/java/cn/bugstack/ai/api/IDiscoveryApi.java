package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.List;

/** 收藏夹、发现榜单、关联推荐与平台 Redis 遥测接口契约。 */
public interface IDiscoveryApi {
    Response<FavoriteStatusResponseDTO> addFavorite(String productId, Principal principal);

    Response<FavoriteStatusResponseDTO> removeFavorite(String productId, Principal principal);

    Response<List<ProductResponseDTO>> favorites(Principal principal);

    Response<DiscoveryHomeResponseDTO> home(Principal principal);

    Response<ProductRecommendationsResponseDTO> recommendations(String productId);

    Response<RedisTelemetryResponseDTO> redisTelemetry(Principal principal);
}
