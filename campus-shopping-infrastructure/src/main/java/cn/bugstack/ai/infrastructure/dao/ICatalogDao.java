package cn.bugstack.ai.infrastructure.dao;
import org.apache.ibatis.annotations.*;
import cn.bugstack.ai.infrastructure.dao.po.*;
import java.util.*;
import java.time.*;
/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface ICatalogDao {
    ProductPO product(@Param("id") String id, @Param("lock") boolean lock);
    List<SkuPO> skus(@Param("productIds") List<String> productIds);
    List<ProductPO> search(@Param("merchantId") String merchantId, @Param("query") String query, @Param("category") String category, @Param("publicOnly") boolean publicOnly, @Param("offset") int offset, @Param("limit") int limit,@Param("sort") String sort);
    List<ProductPO> recall(@Param("terms") List<String> terms,@Param("limit") int limit);
    List<ProductPO> publicByIds(@Param("ids") List<String> ids);
    List<ProductPO> searchManaged(@Param("merchantId") String merchantId,@Param("query") String query,@Param("category") String category,@Param("status") String status,@Param("offset") int offset,@Param("limit") int limit,@Param("sort") String sort);
    long countManaged(@Param("merchantId") String merchantId,@Param("query") String query,@Param("category") String category,@Param("status") String status);
    long count(@Param("merchantId") String merchantId,@Param("query") String query,@Param("category") String category,@Param("publicOnly") boolean publicOnly);
    int insertProduct(@Param("p") ProductPO p);
    int insertSku(@Param("s") SkuPO s);
    int saveProduct(@Param("p") ProductPO p);
    int saveSku(@Param("s") SkuPO s);
    List<OfferPO> offers(@Param("skuIds") List<String> skuIds, @Param("lock") boolean lock);
    List<CategoryPO> categories();
    int category(@Param("code") String code, @Param("name") String name, @Param("active") boolean active);
}
