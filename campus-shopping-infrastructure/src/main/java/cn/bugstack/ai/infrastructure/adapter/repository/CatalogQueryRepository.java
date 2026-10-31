package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogQueryRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.*;
import cn.bugstack.ai.infrastructure.dao.po.*;
import jakarta.annotation.Resource;
import java.util.*;
import org.springframework.stereotype.Repository;

/** 只读查询适配器；跨领域 SQL 由架构白名单约束。 */
@Repository
public class CatalogQueryRepository implements ICatalogQueryRepository {

    @Resource
    private ICatalogQueryDao dao;

    @Resource
    private ICatalogDao catalogDao;

    public List<String> scanIdsAfter(String after, int limit) {
        return dao.scanIdsAfter(after, limit);
    }

    public List<ProductAggregate> search(String merchant, String q, String category, boolean publicOnly, int offset, int limit) {
        List<ProductPO> ps = dao.search(merchant, q, category, publicOnly, offset, limit, "NEWEST");
        if (ps.isEmpty()) return List.of();
        List<SkuPO> ss = catalogDao.skus(ps.stream().map(ProductPO::getId).toList());
        return ps
            .stream()
            .map(p ->
                aggregate(
                    p,
                    ss
                        .stream()
                        .filter(s -> s.getProductId().equals(p.getId()))
                        .toList()
                )
            )
            .toList();
    }

    public List<ProductAggregate> recall(List<String> terms, int limit) {
        return fromProducts(dao.recall(terms, limit));
    }

    public List<ProductAggregate> publicByIds(List<String> ids) {
        return ids.isEmpty() ? List.of() : fromProducts(dao.publicByIds(ids));
    }

    public List<ProductAggregate> searchSorted(String m, String q, String cat, boolean pub, int offset, int limit, String sort) {
        List<ProductPO> ps = dao.search(m, q, cat, pub, offset, limit, sort);
        return fromProducts(ps);
    }

    public List<ProductAggregate> searchManagedSorted(String m, String q, String cat, String status, int offset, int limit, String sort) {
        List<ProductPO> ps = dao.searchManaged(m, q, cat, status, offset, limit, sort);
        return fromProducts(ps);
    }

    private List<ProductAggregate> fromProducts(List<ProductPO> ps) {
        if (ps.isEmpty()) return List.of();
        List<SkuPO> ss = catalogDao.skus(ps.stream().map(ProductPO::getId).toList());
        return ps
            .stream()
            .map(p ->
                aggregate(
                    p,
                    ss
                        .stream()
                        .filter(s -> s.getProductId().equals(p.getId()))
                        .toList()
                )
            )
            .toList();
    }

    public long count(String m, String q, String cat, boolean pub) {
        return dao.count(m, q, cat, pub);
    }

    public List<ProductAggregate> searchManaged(String merchant, String q, String category, String status, int offset, int limit) {
        List<ProductPO> ps = dao.searchManaged(merchant, q, category, status, offset, limit, "NEWEST");
        if (ps.isEmpty()) return List.of();
        List<SkuPO> ss = catalogDao.skus(ps.stream().map(ProductPO::getId).toList());
        return ps
            .stream()
            .map(p ->
                aggregate(
                    p,
                    ss
                        .stream()
                        .filter(s -> s.getProductId().equals(p.getId()))
                        .toList()
                )
            )
            .toList();
    }

    public long countManaged(String merchant, String q, String category, String status) {
        return dao.countManaged(merchant, q, category, status);
    }

    private ProductAggregate aggregate(ProductPO p, List<SkuPO> ss) {
        return new ProductAggregate(
            p.getId(),
            p.getMerchantId(),
            p.getStoreId(),
            p.getTitle(),
            p.getDescription(),
            p.getCategoryCode(),
            p.getImageUrl(),
            p.getStatus(),
            p.getVersion(),
            ss
                .stream()
                .map(s -> new ProductSkuEntity(s.getId(), s.getSpecKey(), s.getPriceCent(), s.getStatus(), s.getVersion()))
                .toList()
        );
    }
}
