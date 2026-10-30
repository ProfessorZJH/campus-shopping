package cn.bugstack.ai.cases.catalog;

import cn.bugstack.ai.cases.catalog.model.ProductReadModel;
import cn.bugstack.ai.domain.catalog.model.entity.ProductCreateCommandEntity;

/** 商品、类目和补货的写用例；展示查询由 ICatalogQueryCase 提供。 */
public interface ICatalogCase {
    ProductReadModel createProduct(String actor, String merchant, ProductCreateCommandEntity command);
    ProductReadModel addSkuToProduct(String actor, String merchant, String product, String spec, long price);
    void changeSkuPrice(String actor, String merchant, String product, String sku, long price, long version);
    void editProduct(String actor, String merchant, String product, String title, String description, String category, String image, long version);
    void setProductPublished(String actor, String merchant, String product, boolean published);
    void forceUnpublishProduct(String actor, String product);
    void replenishStock(String actor, String merchant, String sku, int quantity, String key);
    String uploadProductImage(String actor, String merchant, byte[] bytes);
    void upsertCategory(String actor, String code, String name, boolean active);
}
