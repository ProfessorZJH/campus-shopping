package cn.bugstack.ai.cases.catalog.impl;

import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.cases.catalog.ICatalogQueryCase;
import cn.bugstack.ai.cases.catalog.model.ProductPage;
import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.cases.catalog.model.StockPage;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.model.valobj.CategoryVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
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

    private final ICatalogCase catalogCase;
    private final ICatalogService catalogService;
    private final IInventoryService inventoryService;
    private final IMerchantService merchantService;

    public CatalogQueryCaseImpl(
        ICatalogCase catalogCase,
        ICatalogService catalogService,
        IInventoryService inventoryService,
        IMerchantService merchantService
    ) {
        this.catalogCase = catalogCase;
        this.catalogService = catalogService;
        this.inventoryService = inventoryService;
        this.merchantService = merchantService;
    }

    @Override
    public List<ProductReadModel> publicProducts(String merchant, String query, String category, int page, int size) {
        return views(catalogCase.publicProducts(merchant, query, category, page, size));
    }

    @Override
    public ProductPage publicPage(String merchant, String query, String category, int page, int size, String sort) {
        List<ProductReadModel> items = views(catalogCase.publicProductsSorted(merchant, query, category, page, size, sort));
        return new ProductPage(items, catalogCase.countPublicProducts(merchant, query, category));
    }

    @Override
    public ProductReadModel detail(String product) {
        return views(List.of(catalogCase.publicDetail(product))).get(0);
    }

    @Override
    public List<ProductReadModel> managedProducts(String actor, String merchant, int page, int size) {
        return views(catalogCase.managedProducts(actor, merchant, page, size));
    }

    @Override
    public ProductPage managedPage(String actor, String merchant, String query, String category, String status, int page, int size, String sort) {
        List<ProductReadModel> items = views(catalogCase.managedProductsSorted(actor, merchant, query, category, status, page, size, sort));
        return new ProductPage(items, catalogCase.countManagedProductsFiltered(actor, merchant, query, category, status));
    }

    @Override
    public List<ProductReadModel> adminProducts(String actor, String merchant, String query, int page, int size) {
        return views(catalogCase.adminProducts(actor, merchant, query, page, size));
    }

    @Override
    public ProductPage adminPage(String actor, String merchant, String query, int page, int size) {
        List<ProductReadModel> items = views(catalogCase.adminProducts(actor, merchant, query, page, size));
        return new ProductPage(items, catalogCase.countAdminProducts(actor, merchant, query));
    }

    @Override
    public List<CategoryVO> categories() {
        return catalogService.categories();
    }

    @Override
    public StockPage stockPage(String actor, String merchant, int page, int size, String query) {
        List<StockVO> stocks = catalogCase.stocks(actor, merchant, page, size, query);
        Map<String, SkuOfferVO> offers = catalogCase.stockOffers(actor, merchant, stocks.stream().map(StockVO::skuId).toList());
        return new StockPage(stocks, offers, catalogCase.countStocks(actor, merchant, query));
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
