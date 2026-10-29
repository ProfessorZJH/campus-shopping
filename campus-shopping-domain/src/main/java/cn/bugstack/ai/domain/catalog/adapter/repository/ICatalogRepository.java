package cn.bugstack.ai.domain.catalog.adapter.repository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.valobj.*;
import java.util.*;
/** 商品聚合和查询投影的本地存储。 */
public interface ICatalogRepository {
 ProductAggregate find(String id,boolean lock);void insert(ProductAggregate p);void save(ProductAggregate p);
 List<ProductAggregate> search(String merchant,String query,String category,boolean publicOnly,int offset,int limit);
 List<ProductAggregate> recall(List<String> terms,int limit);
 List<ProductAggregate> publicByIds(List<String> ids);
 long count(String merchant,String query,String category,boolean publicOnly);
 default List<ProductAggregate> searchSorted(String merchant,String query,String category,boolean publicOnly,int offset,int limit,String sort){return search(merchant,query,category,publicOnly,offset,limit);}
 default List<ProductAggregate> searchManagedSorted(String merchant,String query,String category,String status,int offset,int limit,String sort){return searchManaged(merchant,query,category,status,offset,limit);}

 List<ProductAggregate> searchManaged(String merchant,String query,String category,String status,int offset,int limit);
 long countManaged(String merchant,String query,String category,String status);
 List<SkuOfferVO> offers(List<String> ids,boolean lock);List<CategoryVO> categories();void category(String code,String name,boolean active);
 String storeImage(byte[] bytes);
}
