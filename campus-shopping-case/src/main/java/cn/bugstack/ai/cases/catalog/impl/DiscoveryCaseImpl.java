package cn.bugstack.ai.cases.catalog.impl;

import cn.bugstack.ai.cases.catalog.ICatalogQueryCase;
import cn.bugstack.ai.cases.catalog.IDiscoveryCase;
import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.domain.catalog.service.ICatalogReadService;
import cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort;
import cn.bugstack.ai.domain.identity.model.valobj.RedisTelemetryVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 发现页榜单、ItemCF 共购推荐、收藏夹与管理员 Redis 遥测编排。 */
@Service
public class DiscoveryCaseImpl implements IDiscoveryCase {

    private final ICatalogReadService catalogService;
    private final ICatalogQueryCase catalogQuery;
    private final IUserAccountService accounts;
    private final IAccessService access;

    @Autowired(required = false)
    private ICampusRedisPort redisHub;

    public DiscoveryCaseImpl(ICatalogReadService catalogService, ICatalogQueryCase catalogQuery, IUserAccountService accounts, IAccessService access) {
        this.catalogService = catalogService;
        this.catalogQuery = catalogQuery;
        this.accounts = accounts;
        this.access = access;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean addFavorite(String actor, String productId) {
        accounts.requireActive(actor);
        catalogQuery.detail(productId);
        catalogService.addFavorite(actor, productId);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean removeFavorite(String actor, String productId) {
        accounts.requireActive(actor);
        catalogService.removeFavorite(actor, productId);
        return false;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductReadModel> favorites(String actor) {
        accounts.requireActive(actor);
        List<String> ids = catalogService.favoriteProductIds(actor, 100);
        return catalogQuery.publicByIds(ids);
    }

    @Override
    @Transactional(readOnly = true)
    public DiscoveryHomeSnapshot home(String actorOrNull) {
        List<String> hotKeywords = redisHub == null ? List.of() : redisHub.topHotKeywords(10);
        List<String> hotIds = redisHub == null ? List.of() : redisHub.topSellingProductIds(8);
        List<ProductReadModel> hotProducts = new ArrayList<>(catalogQuery.publicByIds(hotIds));
        if (hotProducts.size() < 6) {
            Set<String> seen = new HashSet<>();
            hotProducts.forEach(p -> seen.add(p.product().getId()));
            for (ProductReadModel p : catalogQuery.publicPage(null, "", null, null, null, 1, 8, "SALES_DESC").items()) {
                if (seen.add(p.product().getId())) hotProducts.add(p);
                if (hotProducts.size() >= 8) break;
            }
        }
        List<String> favoriteIds = actorOrNull == null ? List.of() : catalogService.favoriteProductIds(actorOrNull, 100);
        List<String> recentIds = actorOrNull == null || redisHub == null ? List.of() : redisHub.recentFootprintProductIds(actorOrNull, 8);
        List<ProductReadModel> recentProducts = catalogQuery.publicByIds(recentIds);

        Set<String> recIds = new LinkedHashSet<>();
        if (redisHub != null) {
            List<String> seeds = new ArrayList<>();
            seeds.addAll(recentIds.stream().limit(4).toList());
            seeds.addAll(favoriteIds.stream().limit(4).toList());
            for (String seed : seeds) {
                for (String peer : redisHub.coPurchasedProductIds(seed, 4)) {
                    if (!seeds.contains(peer)) recIds.add(peer);
                    if (recIds.size() >= 8) break;
                }
                if (recIds.size() >= 8) break;
            }
        }
        List<ProductReadModel> recommended = new ArrayList<>(catalogQuery.publicByIds(new ArrayList<>(recIds)));
        if (recommended.size() < 6) {
            Set<String> seen = new HashSet<>();
            recommended.forEach(p -> seen.add(p.product().getId()));
            for (ProductReadModel p : catalogQuery.publicPage(null, "", null, null, null, 1, 8, "NEWEST").items()) {
                if (seen.add(p.product().getId())) recommended.add(p);
                if (recommended.size() >= 8) break;
            }
        }
        return new DiscoveryHomeSnapshot(hotKeywords, List.copyOf(hotProducts), List.copyOf(recommended), recentProducts, favoriteIds);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductRecommendationsSnapshot recommendations(String productId) {
        ProductReadModel target = catalogQuery.detail(productId);
        List<String> coIds =
            redisHub == null
                ? List.of()
                : redisHub
                      .coPurchasedProductIds(productId, 8)
                      .stream()
                      .filter(id -> !productId.equals(id))
                      .limit(6)
                      .toList();
        List<ProductReadModel> boughtTogether = catalogQuery.publicByIds(coIds);
        List<ProductReadModel> sameStoreHot = catalogQuery
            .publicPage(target.product().getMerchantId(), "", null, null, null, 1, 7, "SALES_DESC")
            .items()
            .stream()
            .filter(p -> !productId.equals(p.product().getId()))
            .limit(6)
            .toList();
        return new ProductRecommendationsSnapshot(boughtTogether, sameStoreHot);
    }

    @Override
    public RedisTelemetryVO redisTelemetry(String actor) {
        access.requireAdmin(actor);
        return redisHub != null ? redisHub.telemetry() : new RedisTelemetryVO(false, false, false, "disabled", 0, 0, 0, 0, 0, List.of(), List.of(), 0, 0);
    }
}
