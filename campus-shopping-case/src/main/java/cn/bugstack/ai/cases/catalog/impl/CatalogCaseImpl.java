package cn.bugstack.ai.cases.catalog.impl;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductCreateCommandEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 跨领域商品写用例；商品和新规格的库存初始化在同一事务内完成。 */
@Service
public class CatalogCaseImpl implements ICatalogCase {

    private final ICatalogService catalog;
    private final IInventoryService inventory;
    private final IMerchantService merchants;
    private final IAccessService access;

    public CatalogCaseImpl(ICatalogService catalog, IInventoryService inventory, IMerchantService merchants, IAccessService access) {
        this.catalog = catalog;
        this.inventory = inventory;
        this.merchants = merchants;
        this.access = access;
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ProductReadModel createProduct(String actor, String merchant, ProductCreateCommandEntity command) {
        access.requirePermission(actor, merchant, "product.write");
        MerchantVO owner = merchants.requireActiveForNewTrade(merchant);
        ProductAggregate product = catalog.create(merchant, owner.storeId(), command);
        for (var sku : product.getSkus()) inventory.initialize(merchant, owner.storeId(), sku.id());
        // 新建库存已知为零；复用事务内取得的商户，提交后不再为响应额外查库。
        return ProductReadModel.from(product, owner.name(), Map.of());
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public ProductReadModel addSkuToProduct(String actor, String merchant, String productId, String spec, long price) {
        access.requirePermission(actor, merchant, "product.write");
        MerchantVO owner = merchants.requireActiveForNewTrade(merchant);
        ProductAggregate product = catalog.addSku(merchant, productId, spec, price);
        for (var sku : product.getSkus()) inventory.initialize(merchant, owner.storeId(), sku.id());
        Map<String, StockVO> stocks = inventory
            .stocks(
                product
                    .getSkus()
                    .stream()
                    .map(sku -> sku.id())
                    .toList()
            )
            .stream()
            .collect(java.util.stream.Collectors.toMap(StockVO::skuId, stock -> stock));
        // 旧规格的库存也属于写操作响应；读取失败会使整个新增规格事务回滚。
        return ProductReadModel.from(product, owner.name(), stocks);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void changeSkuPrice(String actor, String merchant, String product, String sku, long price, long version) {
        access.requirePermission(actor, merchant, "product.write");
        merchants.requireActiveForNewTrade(merchant);
        catalog.changePrice(merchant, product, sku, price, version);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void editProduct(String actor, String merchant, String product, String title, String desc, String category, String image, long version) {
        access.requirePermission(actor, merchant, "product.write");
        merchants.requireActiveForNewTrade(merchant);
        catalog.edit(merchant, product, title, desc, category, image, version);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void setProductPublished(String actor, String merchant, String product, boolean published) {
        access.requirePermission(actor, merchant, "product.write");
        if (published) merchants.requireActiveForNewTrade(merchant);
        catalog.publish(merchant, product, published);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void forceUnpublishProduct(String actor, String product) {
        access.requireAdmin(actor);
        catalog.forceUnpublish(product);
        access.audit(actor, "PRODUCT_FORCE_UNPUBLISH", product, null, "平台下架商品");
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void replenishStock(String actor, String merchant, String sku, int quantity, String key) {
        access.requirePermission(actor, merchant, "stock.replenish");
        MerchantVO owner = merchants.requireActiveForNewTrade(merchant);
        SkuOfferVO offer = catalog.offersForUpdate(List.of(sku)).get(0);
        require(offer.merchantId().equals(merchant) && offer.storeId().equals(owner.storeId()), ResponseCode.AUTH_FORBIDDEN);
        inventory.replenish(merchant, owner.storeId(), sku, quantity, key);
    }

    @Override
    public String uploadProductImage(String actor, String merchant, byte[] bytes) {
        access.requirePermission(actor, merchant, "product.write");
        require("ACTIVE".equals(merchants.find(merchant).status()), ResponseCode.MERCHANT_SUSPENDED);
        return catalog.storeImage(bytes);
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void upsertCategory(String actor, String code, String name, boolean active) {
        access.requireAdmin(actor);
        catalog.category(code, name, active);
        access.audit(actor, "CATEGORY_CHANGED", code, null, "维护平台商品类目");
    }
}
