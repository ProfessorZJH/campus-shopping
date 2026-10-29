package cn.bugstack.ai.domain.catalog.adapter.repository;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.valobj.*;
import java.util.List;

/** 商品聚合持久化；跨领域只读投影由 ICatalogQueryRepository 承担。 */
public interface ICatalogRepository {
    ProductAggregate find(String id, boolean lock);
    void insert(ProductAggregate product);
    void save(ProductAggregate product);
    List<SkuOfferVO> offers(List<String> ids, boolean lock);
    List<CategoryVO> categories();
    void category(String code, String name, boolean active);
}
