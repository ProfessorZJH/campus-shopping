package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 商品读模型。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProductResponseDTO {
    private String productId;
    private String merchantId;
    private String merchantName;
    private String storeId;
    private String title;
    private String description;
    private String categoryCode;
    private String imageUrl;
    private String status;
    private Long version;
    private List<SkuResponseDTO> skus;
}
