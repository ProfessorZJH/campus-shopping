package cn.bugstack.ai.cases.catalog;

import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductCreateEntity;
import cn.bugstack.ai.domain.inventory.model.valobj.StockMovementVO;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import java.util.List;

/** 商品与库存用例边界。 */
public interface ICatalogCase {
    ProductReadModel createView(String actor, String merchant, ProductCreateEntity command);
    ProductReadModel addSkuView(String actor, String merchant, String product, String spec, long price);
    ProductAggregate create(String actor, String merchant, ProductCreateEntity command);
    ProductAggregate addSku(String actor, String merchant, String product, String spec, long price);
    void price(String actor, String merchant, String product, String sku, long price, long version);
    void edit(String actor, String merchant, String product, String title, String description, String category, String image, long version);
    void publish(String actor, String merchant, String product, boolean published);
    void forceUnpublish(String actor, String product);
    void replenish(String actor, String merchant, String sku, int quantity, String key);
    List<StockVO> stocks(String actor, String merchant, int page, int size);
    List<StockVO> stocks(String actor, String merchant, int page, int size, String q);
    List<StockMovementVO> movements(String actor, String merchant, int page, int size);
    List<ProductAggregate> publicProducts(String merchant, String query, String category, int page, int size);
    ProductAggregate publicDetail(String id);
    List<ProductAggregate> managedProducts(String actor, String merchant, int page, int size);
    java.util.Map<String, cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO> stockOffers(String actor, String merchant, java.util.List<String> skuIds);
    long countStocks(String actor, String merchant);
    long countStocks(String actor, String merchant, String q);
    long countMovements(String actor, String merchant);
    long countPublicProducts(String merchant, String query, String category);

    List<ProductAggregate> publicProductsSorted(String merchant, String query, String category, int page, int size, String sort);

    List<ProductAggregate> managedProductsSorted(String actor, String merchant, String q, String category, String status, int page, int size, String sort);

    long countManagedProducts(String actor, String merchant);
    List<ProductAggregate> managedProductsFiltered(String actor, String merchant, String q, String category, String status, int page, int size);
    long countManagedProductsFiltered(String actor, String merchant, String q, String category, String status);
    long countAdminProducts(String actor, String merchant, String query);
    String image(String actor, String merchant, byte[] bytes);
    void category(String actor, String code, String name, boolean active);
    List<ProductAggregate> adminProducts(String actor, String merchant, String query, int page, int size);
}
