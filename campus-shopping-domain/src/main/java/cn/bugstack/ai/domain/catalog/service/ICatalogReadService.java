package cn.bugstack.ai.domain.catalog.service;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.valobj.CategoryVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import java.util.List;

/** Catalog 查询能力；不包含商品写入、锁定报价、AI 召回或索引同步。 */
public interface ICatalogReadService {
    ProductAggregate findForDisplay(String id);

    List<ProductAggregate> search(String merchant, String query, String category, boolean publicOnly, int page, int size);

    List<ProductAggregate> search(String merchant, String query, String category, boolean publicOnly, int page, int size, Long minPriceCent, Long maxPriceCent);

    long count(String merchant, String query, String category, boolean publicOnly);

    long count(String merchant, String query, String category, boolean publicOnly, Long minPriceCent, Long maxPriceCent);

    List<ProductAggregate> searchSorted(String merchant, String query, String category, boolean publicOnly, int page, int size, String sort);

    List<ProductAggregate> searchSorted(
        String merchant,
        String query,
        String category,
        boolean publicOnly,
        int page,
        int size,
        String sort,
        Long minPriceCent,
        Long maxPriceCent
    );

    List<ProductAggregate> searchManagedSorted(String merchant, String query, String category, String status, int page, int size, String sort);

    List<ProductAggregate> searchManaged(String merchant, String query, String category, String status, int page, int size);

    long countManaged(String merchant, String query, String category, String status);

    /** 展示与校验使用普通报价；不在读取阶段锁定 SKU。 */
    List<SkuOfferVO> offers(List<String> skuIds);

    List<CategoryVO> categories();
}
