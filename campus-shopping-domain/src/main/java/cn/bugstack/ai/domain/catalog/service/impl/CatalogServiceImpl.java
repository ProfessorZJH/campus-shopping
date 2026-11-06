package cn.bugstack.ai.domain.catalog.service.impl;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.catalog.adapter.port.IProductImageMediaPort;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogQueryRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductCreateCommandEntity;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.CategoryVO;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageRef;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageVO;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductSortEnumVO;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductStatusEnumVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.ArrayList;
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
    private final IProductImageMediaPort media;

    public CatalogServiceImpl(ICatalogRepository repository, ICatalogQueryRepository queries, IProductImageRepository images, IProductImageMediaPort media) {
        this.repository = repository;
        this.queries = queries;
        this.images = images;
        this.media = media;
    }

    /** 只接受服务生成的 QINIU 引用；LOCAL 或其他形态一律拒绝。 */
    @Override
    public String productImageDownloadUrl(String url) {
        ProductImageRef ref = ProductImageRef.of(url);
        require(ProductImageRef.PROVIDER_QINIU.equals(ref.provider()), ResponseCode.ILLEGAL_PARAMETER);
        return media.downloadUrl(ref.objectKey());
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
        List<String> imageUrls = checkedImages(c.imageUrls(), c.imageUrl());
        ProductAggregate p = new ProductAggregate(
            UUID.randomUUID().toString(),
            merchant,
            store,
            c.title(),
            c.description(),
            c.categoryCode(),
            imageUrls.isEmpty() ? "" : imageUrls.get(0),
            ProductStatusEnumVO.DRAFT.getCode(),
            0,
            skus
        );
        repository.insert(p);
        images.insertInitial(p.getId(), merchant, imageUrls);
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
        // 已持有商品及规格锁；写响应必须取得当前聚合和递增后的版本。
        return repository.find(id, true);
    }

    public void changeSkuStatus(String merchant, String id, String sku, boolean active, long expectedVersion) {
        ProductAggregate p = owned(merchant, id);
        if (p.changeSkuStatus(sku, active, expectedVersion)) repository.save(p);
    }

    public void changePrice(String merchant, String id, String sku, long price, long expected) {
        ProductAggregate p = owned(merchant, id);
        p.changePrice(sku, price, expected);
        repository.save(p);
    }

    public void edit(String merchant, String id, String title, String desc, String category, String image, List<String> imageUrls, long expected) {
        validCategory(category);
        ProductAggregate p = owned(merchant, id);
        boolean hadImages = !p.getImageUrl().isEmpty();
        // null 表示本次未提供图片变更，保持现有相册；空列表表示显式清空。
        List<String> album = resolveAlbum(id, p.getImageUrl(), imageUrls, image);
        p.changeInfo(title, desc, category, album == null ? p.getImageUrl() : album.isEmpty() ? "" : album.get(0), expected);
        repository.save(p);
        if (album == null) return;
        // 商品行已锁定；原本无图时不做空范围删除，避免不同商品的间隙锁互相阻塞。
        if (hadImages) images.replace(id, merchant, album);
        else if (!album.isEmpty()) images.insertInitial(id, merchant, album);
    }

    /**
     * 解析编辑后的有序相册，null 表示本次不写图片。
     * 新客户端 imageUrls 非 null 时优先，显式空数组即清空；旧客户端只提交 imageUrl：空串沿用清空语义，
     * 与当前主图相同视为不改相册；已有副图升主图时移到首位并保留其余图片，新地址则替换首图、
     * 只保留原副图，两种情况都不重复且不超过 8 张。
     */
    private List<String> resolveAlbum(String productId, String currentMain, List<String> imageUrls, String legacy) {
        if (imageUrls != null) return checkedImages(imageUrls, null);
        if (legacy == null) return null;
        List<String> requested = checkedImages(null, legacy);
        if (requested.isEmpty()) return List.of();
        String promoted = requested.get(0);
        if (promoted.equals(currentMain)) return null;
        // 原本无主图时没有相册可保留，不读空范围图片，直接沿用新建图片的窄能力。
        if (currentMain.isEmpty()) return requested;
        // 已持商品锁，用当前读取得相册顺序；旧客户端只给主图，不能因此丢掉副图。
        List<String> current = images.findAllForUpdate(productId).stream().map(ProductImageVO::url).toList();
        List<String> album = new ArrayList<>();
        album.add(promoted);
        if (current.contains(promoted)) {
            // 已有副图升为主图：移到首位，保留其余所有图片。
            for (String url : current) if (!url.equals(promoted)) album.add(url);
        } else {
            // 新主图替换旧首图：只保留原副图，不把旧主图降为副图。
            for (int i = 1; i < current.size(); i++) album.add(current.get(i));
        }
        // 最终列表沿用同一数量、格式与去重规则，避免组合后超出 8 张或出现重复引用。
        return checkedImages(album, null);
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
        return search(merchant, q, category, pub, page, size, null, null);
    }

    public List<ProductAggregate> search(String merchant, String q, String category, boolean pub, int page, int size, Long minPriceCent, Long maxPriceCent) {
        checkedPriceRange(minPriceCent, maxPriceCent);
        return queries.search(merchant, Checks.optional(q, 100), category, pub, Checks.offset(page, size), size, minPriceCent, maxPriceCent);
    }

    public List<String> scanIdsAfter(String after, int limit) {
        require(limit >= 1 && limit <= 100, ResponseCode.ILLEGAL_PARAMETER);
        return queries.scanIdsAfter(after == null ? "" : after, limit);
    }

    private String checkedSort(String sort) {
        String value = sort == null || sort.isBlank() ? ProductSortEnumVO.NEWEST.getCode() : sort;
        return ProductSortEnumVO.filter(value);
    }

    public List<ProductAggregate> searchSorted(String merchant, String q, String category, boolean pub, int page, int size, String sort) {
        return searchSorted(merchant, q, category, pub, page, size, sort, null, null);
    }

    public List<ProductAggregate> searchSorted(
        String merchant,
        String q,
        String category,
        boolean pub,
        int page,
        int size,
        String sort,
        Long minPriceCent,
        Long maxPriceCent
    ) {
        checkedPriceRange(minPriceCent, maxPriceCent);
        return queries.searchSorted(
            merchant,
            Checks.optional(q, 100),
            category,
            pub,
            Checks.offset(page, size),
            size,
            checkedSort(sort),
            minPriceCent,
            maxPriceCent
        );
    }

    public List<ProductAggregate> searchManagedSorted(String merchant, String q, String cat, String status, int page, int size, String sort) {
        return queries.searchManagedSorted(merchant, Checks.optional(q, 100), cat, managedFilter(status), Checks.offset(page, size), size, checkedSort(sort));
    }

    public long count(String merchant, String q, String category, boolean pub) {
        return count(merchant, q, category, pub, null, null);
    }

    public long count(String merchant, String q, String category, boolean pub, Long minPriceCent, Long maxPriceCent) {
        checkedPriceRange(minPriceCent, maxPriceCent);
        return queries.count(merchant, Checks.optional(q, 100), category, pub, minPriceCent, maxPriceCent);
    }

    /** 价格筛选只接受整数分；区间端点包含在内，下限不得高于上限。 */
    private void checkedPriceRange(Long minPriceCent, Long maxPriceCent) {
        if (
            (minPriceCent != null && minPriceCent < 0) ||
            (maxPriceCent != null && maxPriceCent < 0) ||
            (minPriceCent != null && maxPriceCent != null && minPriceCent > maxPriceCent)
        ) throw new AppException(ResponseCode.ILLEGAL_PARAMETER.getCode(), "价格条件无效：金额须为非负整数分，且最低价不高于最高价");
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

    public String storeImage(String merchantId, byte[] data) {
        require(merchantId != null && !merchantId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        return images.storeImage(data, merchantId);
    }

    private List<String> checkedImages(List<String> values, String legacy) {
        List<String> requested = values == null ? (legacy == null || legacy.isBlank() ? List.of() : List.of(legacy)) : values;
        require(requested.size() <= 8, ResponseCode.ILLEGAL_PARAMETER);
        require(requested.stream().allMatch(ProductImageRef::accepts), ResponseCode.ILLEGAL_PARAMETER);
        require(requested.stream().distinct().count() == requested.size(), ResponseCode.ILLEGAL_PARAMETER);
        // URL 只作为客户端引用；适配器还要核验对象存在，不能伪造 /media 地址写入图片表。
        return List.copyOf(requested);
    }
}
