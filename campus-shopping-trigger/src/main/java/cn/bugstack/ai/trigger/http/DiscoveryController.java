package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.actor;

import cn.bugstack.ai.api.IDiscoveryApi;
import cn.bugstack.ai.api.dto.DiscoveryHomeResponseDTO;
import cn.bugstack.ai.api.dto.FavoriteStatusResponseDTO;
import cn.bugstack.ai.api.dto.ProductRecommendationsResponseDTO;
import cn.bugstack.ai.api.dto.ProductResponseDTO;
import cn.bugstack.ai.api.dto.RedisTelemetryResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.catalog.IDiscoveryCase;
import cn.bugstack.ai.domain.identity.model.valobj.RedisTelemetryVO;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.List;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 收藏夹、首页发现榜单、商品关联推荐与管理员 Redis 遥测 HTTP 入口。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class DiscoveryController implements IDiscoveryApi {

    @Resource
    private IDiscoveryCase discovery;

    @Override
    @PostMapping("/products/{productId}/favorite")
    public Response<FavoriteStatusResponseDTO> addFavorite(@PathVariable("productId") String productId, Principal principal) {
        return execute(() -> {
            boolean favorited = discovery.addFavorite(actor(principal), productId);
            return FavoriteStatusResponseDTO.builder().productId(productId).favorited(favorited).build();
        });
    }

    @Override
    @DeleteMapping("/products/{productId}/favorite")
    public Response<FavoriteStatusResponseDTO> removeFavorite(@PathVariable("productId") String productId, Principal principal) {
        return execute(() -> {
            boolean favorited = discovery.removeFavorite(actor(principal), productId);
            return FavoriteStatusResponseDTO.builder().productId(productId).favorited(favorited).build();
        });
    }

    @Override
    @GetMapping("/favorites")
    public Response<List<ProductResponseDTO>> favorites(Principal principal) {
        return execute(() -> discovery.favorites(actor(principal)).stream().map(ApiViews::product).toList());
    }

    @Override
    @GetMapping("/discovery/home")
    public Response<DiscoveryHomeResponseDTO> home(Principal principal) {
        return execute(() -> {
            String userId = principal == null ? null : principal.getName();
            var snap = discovery.home(userId);
            return DiscoveryHomeResponseDTO.builder()
                .hotKeywords(snap.hotKeywords())
                .hotProducts(snap.hotProducts().stream().map(ApiViews::product).toList())
                .recommendedProducts(snap.recommendedProducts().stream().map(ApiViews::product).toList())
                .recentProducts(snap.recentProducts().stream().map(ApiViews::product).toList())
                .favoriteProductIds(snap.favoriteProductIds())
                .build();
        });
    }

    @Override
    @GetMapping("/products/{productId}/recommendations")
    public Response<ProductRecommendationsResponseDTO> recommendations(@PathVariable("productId") String productId) {
        return execute(() -> {
            var snap = discovery.recommendations(productId);
            return ProductRecommendationsResponseDTO.builder()
                .boughtTogether(snap.boughtTogether().stream().map(ApiViews::product).toList())
                .sameStoreHot(snap.sameStoreHot().stream().map(ApiViews::product).toList())
                .build();
        });
    }

    @Override
    @GetMapping("/admin/redis-telemetry")
    public Response<RedisTelemetryResponseDTO> redisTelemetry(Principal principal) {
        return execute(() -> {
            RedisTelemetryVO vo = discovery.redisTelemetry(actor(principal));
            return RedisTelemetryResponseDTO.builder()
                .redisEnabled(vo.redisEnabled())
                .securityConnected(vo.securityConnected())
                .cacheConnected(vo.cacheConnected())
                .namespace(vo.namespace())
                .crawlerBlockedCount(vo.crawlerBlockedCount())
                .rateLimitedCount(vo.rateLimitedCount())
                .orderBrushBlockedCount(vo.orderBrushBlockedCount())
                .pinLockoutCount(vo.pinLockoutCount())
                .displayCacheFailures(vo.displayCacheFailures())
                .topHotKeywords(vo.topHotKeywords())
                .topSellingProductIds(vo.topSellingProductIds())
                .activeRealtimeSubscribers(vo.activeRealtimeSubscribers())
                .delayedExpiryQueueSize(vo.delayedExpiryQueueSize())
                .build();
        });
    }

    private <T> Response<T> execute(Supplier<T> action) {
        try {
            return ApiResponses.success(action.get());
        } catch (AppException e) {
            ControllerFailures.record(log, e);
            return ApiResponses.rejected(e);
        } catch (Exception e) {
            ControllerFailures.unexpected(log, e);
            return ApiResponses.unexpected();
        }
    }
}
