package cn.bugstack.ai.domain.catalog.service;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductCreateCommandEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.*;
import java.util.*;

/** 商品业务能力；跨域权限和库存初始化由 Case 协作。 */
public interface ICatalogService {
    List<String> scanIdsAfter(String after, int limit);
    ProductAggregate create(String merchant, String store, ProductCreateCommandEntity c);
    ProductAggregate findForDisplay(String id);
    ProductAggregate find(String id);
    ProductAggregate addSku(String merchant, String product, String spec, long price);
    void changePrice(String merchant, String product, String sku, long price, long expectedVersion);
    void edit(String merchant, String product, String title, String desc, String category, String image, long expectedVersion);
    void publish(String merchant, String product, boolean onShelf);
    void forceUnpublish(String product);
    List<ProductAggregate> search(String merchant, String query, String category, boolean publicOnly, int page, int size);
    /** 仅供 AI 使用：在全部公开商品中先按关键词召回，非按创建时间截取首页。 */
    List<ProductAggregate> recall(List<String> terms, int limit);
    /** 仅获取仍公开销售的商品，拒绝使用向量索引中的过时业务状态。 */
    List<ProductAggregate> recallByIds(List<String> ids);
    long count(String merchant, String query, String category, boolean publicOnly);

    List<ProductAggregate> searchSorted(String merchant, String query, String category, boolean publicOnly, int page, int size, String sort);

    List<ProductAggregate> searchManagedSorted(String merchant, String query, String category, String status, int page, int size, String sort);

    List<ProductAggregate> searchManaged(String merchant, String query, String category, String status, int page, int size);
    long countManaged(String merchant, String query, String category, String status);
    /** 展示与校验使用普通报价；不在读取阶段锁定 SKU。 */
    List<SkuOfferVO> offers(List<String> skuIds);
    /** 仅返回当前可销售报价。 */
    List<SkuOfferVO> saleOffers(List<String> skuIds);
    /** 事务内锁定并验证可销售报价，用于结算与提案确认。 */
    List<SkuOfferVO> saleOffersForUpdate(List<String> skuIds);
    /** 事务内锁定 SKU 报价，用于补货授权核对。 */
    List<SkuOfferVO> offersForUpdate(List<String> skuIds);
    List<SkuOfferVO> availableOffers(List<String> ids);
    List<CategoryVO> categories();
    void category(String code, String name, boolean active);
    String storeImage(byte[] bytes);
}
