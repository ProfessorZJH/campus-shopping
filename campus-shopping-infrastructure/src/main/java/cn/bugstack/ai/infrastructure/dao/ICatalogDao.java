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
    SkuPO skuForUpdate(@Param("id") String id);
    List<SkuPO> skusForUpdate(@Param("productId") String productId);
    int insertProduct(@Param("p") ProductPO p);
    int insertSku(@Param("s") SkuPO s);
    int saveProduct(@Param("p") ProductPO p);
    int saveSku(@Param("s") SkuPO s);
    List<OfferPO> offers(@Param("skuIds") List<String> skuIds);
    List<CategoryPO> categories();
    int category(@Param("code") String code, @Param("name") String name, @Param("active") boolean active);
    List<ProductImagePO> productImages(@Param("productId") String productId);
    List<ProductImagePO> productImagesForUpdate(@Param("productId") String productId);
    List<ProductImagePO> productImagesByProducts(@Param("productIds") List<String> productIds);
    int deleteProductImages(@Param("productId") String productId);
    int insertProductImage(@Param("i") ProductImagePO image);
    int registerProductImageUpload(@Param("objectKey") String objectKey, @Param("merchantId") String merchantId);
    int claimProductImage(@Param("objectKey") String objectKey, @Param("merchantId") String merchantId, @Param("productId") String productId);
    List<String> productImageClaims(@Param("productId") String productId);
}
