package cn.bugstack.ai.cases.catalog.impl;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.cases.catalog.ICatalogQueryCase;
import cn.bugstack.ai.cases.catalog.model.ProductPage;
import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.cases.catalog.model.StockPage;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.CategoryVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockMovementVO;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 每页批量读取商户与库存；同一个只读事务保持商品、库存和总数的一致快照。 */
@Service
@Transactional(readOnly = true)
public class CatalogQueryCaseImpl implements ICatalogQueryCase {

    private final ICatalogService catalogService;
    private final IInventoryService inventoryService;
    private final IMerchantService merchantService;
    private final IAccessService access;

    public CatalogQueryCaseImpl(ICatalogService catalogService, IInventoryService inventoryService, IMerchantService merchantService, IAccessService access) {
        this.catalogService = catalogService;
        this.inventoryService = inventoryService;
        this.merchantService = merchantService;
        this.access = access;
    }

    @Override
    public List<ProductReadModel> publicProducts(String merchant, String query, String category, int page, int size) {
        return views(catalogService.search(merchant, query, category, true, page, size));
    }

    @Override
    public ProductPage publicPage(String merchant, String query, String category, int page, int size, String sort) {
        List<ProductReadModel> items = views(catalogService.searchSorted(merchant, query, category, true, page, size, sort));
        return new ProductPage(items, catalogService.count(merchant, query, category, true));
    }

    @Override
    public ProductReadModel detail(String product) {
        ProductAggregate found = catalogService.findForDisplay(product);
        require(
            "PUBLISHED".equals(found.getStatus()) && "ACTIVE".equals(merchantService.find(found.getMerchantId()).status()),
            ResponseCode.PRODUCT_UNAVAILABLE
        );
        return views(List.of(found)).get(0);
    }

    @Override
    public List<ProductReadModel> managedProducts(String actor, String merchant, int page, int size) {
        access.requirePermission(actor, merchant, "product.read");
        return views(catalogService.search(merchant, "", null, false, page, size));
    }

    @Override
    public ProductPage managedPage(String actor, String merchant, String query, String category, String status, int page, int size, String sort) {
        access.requirePermission(actor, merchant, "product.read");
        List<ProductReadModel> items = views(catalogService.searchManagedSorted(merchant, query, category, status, page, size, sort));
        return new ProductPage(items, catalogService.countManaged(merchant, query, category, status));
    }

    @Override
    public List<ProductReadModel> adminProducts(String actor, String merchant, String query, int page, int size) {
        access.requireAdmin(actor);
        return views(catalogService.search(merchant, query, null, false, page, size));
    }

    @Override
    public ProductPage adminPage(String actor, String merchant, String query, int page, int size) {
        access.requireAdmin(actor);
        List<ProductReadModel> items = views(catalogService.search(merchant, query, null, false, page, size));
        return new ProductPage(items, catalogService.count(merchant, query, null, false));
    }

    @Override
    public List<CategoryVO> categories() {
        return catalogService.categories();
    }

    @Override
    public StockPage stockPage(String actor, String merchant, int page, int size, String query) {
        access.requirePermission(actor, merchant, "stock.read");
        List<StockVO> stocks = inventoryService.list(merchant, page, size, query);
        Map<String, SkuOfferVO> offers = stockOffers(actor, merchant, stocks.stream().map(StockVO::skuId).toList());
        return new StockPage(stocks, offers, inventoryService.countStocks(merchant, query));
    }

    @Override
    public List<StockVO> stockRows(String actor, String merchant, int page, int size) {
        access.requirePermission(actor, merchant, "stock.read");
        return inventoryService.list(merchant, page, size, "");
    }

    @Override
    public List<StockMovementVO> stockMovements(String actor, String merchant, int page, int size) {
        access.requirePermission(actor, merchant, "stock.read");
        return inventoryService.movements(merchant, page, size);
    }

    @Override
    public long countStockMovements(String actor, String merchant) {
        access.requirePermission(actor, merchant, "stock.read");
        return inventoryService.countMovements(merchant);
    }

    private Map<String, SkuOfferVO> stockOffers(String actor, String merchant, List<String> skuIds) {
        access.requirePermission(actor, merchant, "stock.read");
        if (skuIds.isEmpty()) return Map.of();
        return catalogService
            .offers(skuIds)
            .stream()
            .filter(offer -> merchant.equals(offer.merchantId()))
            .collect(Collectors.toMap(SkuOfferVO::skuId, offer -> offer));
    }

    private List<ProductReadModel> views(List<ProductAggregate> products) {
        if (products.isEmpty()) return List.of();
        List<String> skuIds = products
            .stream()
            .flatMap(product -> product.getSkus().stream())
            .map(ProductSkuEntity::id)
            .distinct()
            .toList();
        Map<String, StockVO> stocks = new HashMap<>();
        // 每页最多 100 件、每件 20 个 SKU；批次上限与库存查询能力保持一致。
        for (int start = 0; start < skuIds.size(); start += 500) {
            inventoryService.stocks(skuIds.subList(start, Math.min(start + 500, skuIds.size()))).forEach(stock -> stocks.put(stock.skuId(), stock));
        }
        Map<String, String> names = merchantService
            .findAll(products.stream().map(ProductAggregate::getMerchantId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(MerchantVO::id, MerchantVO::name));
        return products
            .stream()
            .map(product -> {
                String name = names.get(product.getMerchantId());
                if (name == null) throw new IllegalStateException("商品所属商户丢失");
                return ProductReadModel.from(product, name, stocks);
            })
            .toList();
    }
}
