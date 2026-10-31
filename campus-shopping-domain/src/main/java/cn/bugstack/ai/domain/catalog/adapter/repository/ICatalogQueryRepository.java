package cn.bugstack.ai.domain.catalog.adapter.repository;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import java.util.List;

/** 目录只读查询，允许同库商户资格/库存排序投影，不可写入其他领域。 */
public interface ICatalogQueryRepository {
  List<ProductAggregate> search(
    String merchant,
    String q,
    String category,
    boolean pub,
    int offset,
    int limit
  );
  List<ProductAggregate> searchSorted(
    String merchant,
    String q,
    String category,
    boolean pub,
    int offset,
    int limit,
    String sort
  );
  List<ProductAggregate> searchManaged(
    String merchant,
    String q,
    String category,
    String status,
    int offset,
    int limit
  );
  List<ProductAggregate> searchManagedSorted(
    String merchant,
    String q,
    String category,
    String status,
    int offset,
    int limit,
    String sort
  );
  List<ProductAggregate> recall(List<String> terms, int limit);
  List<ProductAggregate> publicByIds(List<String> ids);
  long count(String merchant, String q, String category, boolean pub);
  long countManaged(String merchant, String q, String category, String status);
}
