package cn.bugstack.ai.domain.catalog.adapter.repository;

import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageVO;
import java.util.List;

/** 商品图片的本地存储端口：负责内容校验和存储，不依赖商品 SQL 仓储。 */
public interface IProductImageRepository {
    /** 将已上传图片重编码为 PNG，仅返回服务允许的 /media URL。 */
    String storeImage(byte[] bytes);
    List<ProductImageVO> findAll(String productId);
    java.util.Map<String, List<ProductImageVO>> findAll(List<String> productIds);
    void replace(String productId, List<String> imageUrls);
}
