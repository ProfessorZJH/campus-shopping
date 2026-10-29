package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 CatalogController 实现。 */
public interface ICatalogApi {
    /** 公开商品搜索与分页。 */
    Response<List<ProductResponseDTO>> products(String merchantId, String q, String category, int page, int size);
    Response<PageResponseDTO<ProductResponseDTO>> productPage(String merchantId, String q, String category, int page, int size, String sort);
    /** 查看可售商品与实时库存快照。 */
    Response<ProductResponseDTO> detail(String productId);
    /** 商品类目列表。 */
    Response<List<CategoryResponseDTO>> categories();
    /** 商户自己的商品，包括草稿和下架。 */
    Response<List<ProductResponseDTO>> managed(String merchantId, int page, int size, Principal principal);
    Response<PageResponseDTO<ProductResponseDTO>> managedPage(
        String merchantId,
        String q,
        String category,
        String status,
        int page,
        int size,
        String sort,
        Principal principal
    );
    /** 创建商品、多个规格与空库存。 */
    Response<ProductResponseDTO> create(String merchantId, ProductRequestDTO request, Principal principal);
    /** 按版本修改商品资料。 */
    Response<Void> edit(String merchantId, String productId, ProductRequestDTO request, Principal principal);
    /** 新增规格并初始化库存。 */
    Response<ProductResponseDTO> addSku(String merchantId, String productId, SkuRequestDTO request, Principal principal);
    /** 按确认版本修改 SKU 售价。 */
    Response<Void> price(String merchantId, String productId, String skuId, PriceRequestDTO request, Principal principal);
    /** 上架或下架商品。 */
    Response<Void> publish(String merchantId, String productId, PublishRequestDTO request, Principal principal);
    /** 验证图片像素并重编码为 PNG，拒绝 SVG。 */
    Response<ImageResponseDTO> image(String merchantId, FileUploadRequestDTO request, Principal principal);
    /** 平台违规商品下架。 */
    Response<Void> forceUnpublish(String productId, Principal principal);
    /** 平台维护类目。 */
    Response<Void> category(CategoryRequestDTO request, Principal principal);
    Response<PageResponseDTO<ProductResponseDTO>> adminProductPage(String merchantId, String q, int page, int size, Principal principal);
    Response<List<ProductResponseDTO>> adminProducts(String merchantId, String q, int page, int size, Principal principal);
}
