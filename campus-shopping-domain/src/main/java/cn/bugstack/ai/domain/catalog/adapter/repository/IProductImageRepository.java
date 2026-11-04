package cn.bugstack.ai.domain.catalog.adapter.repository;

import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageVO;
import java.util.List;
import java.util.Map;

/** 商品图片的对象存储与引用端口，不依赖商品 SQL 仓储。 */
public interface IProductImageRepository {
    /** 将已上传图片重编码为 PNG，并以当前商户身份登记可认领的对象，仅返回服务允许的 /media URL。 */
    String storeImage(byte[] bytes, String merchantId);
    /** 读取新建商品在当前事务中写入的图片。 */
    List<ProductImageVO> findAll(String productId);
    /** 写事务中先锁定商品，再以当前读取得其图片。 */
    List<ProductImageVO> findAllForUpdate(String productId);
    Map<String, List<ProductImageVO>> findAll(List<String> productIds);
    /** 新建商品或持锁确认原本无主图时，只插入新图片，避免空范围删除的间隙锁。 */
    void insertInitial(String productId, String merchantId, List<String> imageUrls);
    /** 持有商品锁且原本有主图时，原子替换其图片。 */
    void replace(String productId, String merchantId, List<String> imageUrls);
}
