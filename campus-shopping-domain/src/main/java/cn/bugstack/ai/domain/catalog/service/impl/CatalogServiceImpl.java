package cn.bugstack.ai.domain.catalog.service.impl;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogQueryRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductCreateCommandEntity;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.CategoryVO;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductSortEnumVO;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductStatusEnumVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * 售价、规格与发布规则，不越过仓储直接访问数据表。
 */
@Service
public class CatalogServiceImpl implements ICatalogService {

    private final ICatalogRepository repository;
    private final IProductImageRepository images;
    private final ICatalogQueryRepository queries;

    public CatalogServiceImpl(ICatalogRepository repository, ICatalogQueryRepository queries, IProductImageRepository images) {
        this.repository = repository;
        this.queries = queries;
        this.images = images;
    }

    public List<ProductAggregate> recall(List<String> terms, int limit) {
        require(terms != null && terms.size() <= 8 && limit >= 1 && limit <= 200, ResponseCode.ILLEGAL_PARAMETER);
        for (String term : terms)
            require(term != null && term.length() >= 2 && term.length() <= 20 && term.matches("[\\p{L}\\p{N}_-]+"), ResponseCode.ILLEGAL_PARAMETER);
        return terms.isEmpty() ? search(null, "", null, true, 1, 30) : queries.recall(terms, limit);
    }

    public List<ProductAggregate> recallByIds(List<String> ids) {
        require(
            ids != null && ids.size() <= 100 && ids.stream().allMatch(id -> id != null && id.length() > 0 && id.length() <= 64),
            ResponseCode.ILLEGAL_PARAMETER
        );
        return ids.isEmpty() ? List.of() : queries.publicByIds(ids.stream().distinct().toList());
    }

    public ProductAggregate create(String merchant, String store, ProductCreateCommandEntity c) {
        require(c != null && c.skus() != null && !c.skus().isEmpty(), ResponseCode.ILLEGAL_PARAMETER);
        validCategory(c.categoryCode());
        List<ProductSkuEntity> skus = c
            .skus()
            .stream()
            .map(s -> new ProductSkuEntity(UUID.randomUUID().toString(), s.specKey(), s.priceCent(), SkuStatusEnumVO.ACTIVE.getCode(), 0))
            .toList();
        ProductAggregate p = new ProductAggregate(
            UUID.randomUUID().toString(),
            merchant,
            store,
            c.title(),
            c.description(),
            c.categoryCode(),
            c.imageUrl(),
            ProductStatusEnumVO.DRAFT.getCode(),
            0,
            skus
        );
        repository.insert(p);
        return p;
    }

    public ProductAggregate findForDisplay(String id) {
        ProductAggregate p = repository.findForDisplay(id);
        require(p != null, ResponseCode.NOT_FOUND);
        return p;
    }

    public ProductAggregate find(String id) {
        ProductAggregate p = repository.find(id, false);
        require(p != null, ResponseCode.NOT_FOUND);
        return p;
    }

    private ProductAggregate owned(String merchant, String id) {
        ProductAggregate p = repository.find(id, true);
        require(p != null, ResponseCode.NOT_FOUND);
        p.requireOwner(merchant);
        return p;
    }

    public ProductAggregate addSku(String merchant, String id, String spec, long price) {
        ProductAggregate p = owned(merchant, id);
        p.addSku(new ProductSkuEntity(UUID.randomUUID().toString(), spec, price, SkuStatusEnumVO.ACTIVE.getCode(), 0));
        repository.save(p);
        return repository.find(id, false);
    }

    public void changePrice(String merchant, String id, String sku, long price, long expected) {
        ProductAggregate p = owned(merchant, id);
        p.changePrice(sku, price, expected);
        repository.save(p);
    }

    public void edit(String merchant, String id, String title, String desc, String category, String image, long expected) {
        validCategory(category);
        ProductAggregate p = owned(merchant, id);
        p.changeInfo(title, desc, category, image, expected);
        repository.save(p);
    }

    public void publish(String merchant, String id, boolean onShelf) {
        ProductAggregate p = owned(merchant, id);
        if (onShelf) {
            validCategory(p.getCategoryCode());
            p.publish();
        } else p.unpublish();
        repository.save(p);
    }

    public void forceUnpublish(String id) {
        ProductAggregate p = repository.find(id, true);
        require(p != null, ResponseCode.NOT_FOUND);
        p.unpublish();
        repository.save(p);
    }

    public List<ProductAggregate> search(String merchant, String q, String category, boolean pub, int page, int size) {
        return queries.search(merchant, Checks.optional(q, 100), category, pub, Checks.offset(page, size), size);
    }

    private String checkedSort(String sort) {
        String value = sort == null || sort.isBlank() ? ProductSortEnumVO.NEWEST.getCode() : sort;
        return ProductSortEnumVO.filter(value);
    }

    public List<ProductAggregate> searchSorted(String merchant, String q, String category, boolean pub, int page, int size, String sort) {
        return queries.searchSorted(merchant, Checks.optional(q, 100), category, pub, Checks.offset(page, size), size, checkedSort(sort));
    }

    public List<ProductAggregate> searchManagedSorted(String merchant, String q, String cat, String status, int page, int size, String sort) {
        return queries.searchManagedSorted(merchant, Checks.optional(q, 100), cat, managedFilter(status), Checks.offset(page, size), size, checkedSort(sort));
    }

    public long count(String merchant, String q, String category, boolean pub) {
        return queries.count(merchant, Checks.optional(q, 100), category, pub);
    }

    public List<ProductAggregate> searchManaged(String merchant, String q, String category, String status, int page, int size) {
        return queries.searchManaged(merchant, Checks.optional(q, 100), category, managedFilter(status), Checks.offset(page, size), size);
    }

    /** LOW_STOCK 是查询条件，不能作为商品的持久化状态。 */
    private String managedFilter(String status) {
        return "LOW_STOCK".equals(status) ? status : ProductStatusEnumVO.filter(status);
    }

    public long countManaged(String merchant, String q, String category, String status) {
        return queries.countManaged(merchant, Checks.optional(q, 100), category, managedFilter(status));
    }

    public List<SkuOfferVO> availableOffers(List<String> ids) {
        require(ids != null && ids.size() <= 300, ResponseCode.ILLEGAL_PARAMETER);
        return repository
            .offers(ids.stream().distinct().sorted().toList(), false)
            .stream()
            .filter(o -> "PUBLISHED".equals(o.productStatus()) && "ACTIVE".equals(o.skuStatus()))
            .toList();
    }

    @Override
    public List<SkuOfferVO> offers(List<String> ids) {
        return loadOffers(ids, false, false);
    }

    @Override
    public List<SkuOfferVO> saleOffers(List<String> ids) {
        return loadOffers(ids, true, false);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public List<SkuOfferVO> saleOffersForUpdate(List<String> ids) {
        return loadOffers(ids, true, true);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public List<SkuOfferVO> offersForUpdate(List<String> ids) {
        return loadOffers(ids, false, true);
    }

    private List<SkuOfferVO> loadOffers(List<String> ids, boolean sale, boolean lock) {
        require(
            ids != null && ids.size() <= 1000 && ids.stream().allMatch(id -> id != null && !id.isBlank() && id.length() <= 64),
            ResponseCode.ILLEGAL_PARAMETER
        );
        List<String> unique = ids.stream().distinct().sorted().toList();
        List<SkuOfferVO> offers = repository.offers(unique, lock);
        require(offers.size() == unique.size(), ResponseCode.PRODUCT_UNAVAILABLE);
        if (sale) for (SkuOfferVO o : offers)
            require(o.productStatusEnum() == ProductStatusEnumVO.PUBLISHED && o.skuStatusEnum() == SkuStatusEnumVO.ACTIVE, ResponseCode.PRODUCT_UNAVAILABLE);
        return offers;
    }

    public List<CategoryVO> categories() {
        return repository.displayCategories();
    }

    private void validCategory(String code) {
        require(
            repository
                .categories()
                .stream()
                .anyMatch(c -> c.active() && c.code().equals(code)),
            ResponseCode.ILLEGAL_PARAMETER
        );
    }

    public void category(String code, String name, boolean active) {
        String c = Checks.text(code, "类目编码", 32);
        require(c.matches("[a-z0-9_-]+"), ResponseCode.ILLEGAL_PARAMETER);
        repository.category(c, Checks.text(name, "类目名称", 50), active);
    }

    public String storeImage(byte[] data) {
        return images.storeImage(data);
    }
}
