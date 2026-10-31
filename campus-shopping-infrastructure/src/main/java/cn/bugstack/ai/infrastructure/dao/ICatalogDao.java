package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.*;
import java.time.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface ICatalogDao {
    ProductPO productFacts(@Param("id") String id);
    ProductPO product(@Param("id") String id, @Param("lock") boolean lock);
    List<SkuPO> skus(@Param("productIds") List<String> productIds);
    List<SkuPO> skusForUpdate(@Param("productId") String productId);
    int insertProduct(@Param("p") ProductPO p);
    int insertSku(@Param("s") SkuPO s);
    int saveProduct(@Param("p") ProductPO p);
    int saveSku(@Param("s") SkuPO s);
    List<OfferPO> offers(@Param("skuIds") List<String> skuIds, @Param("lock") boolean lock);
    List<CategoryPO> categories();
    int category(@Param("code") String code, @Param("name") String name, @Param("active") boolean active);
}
