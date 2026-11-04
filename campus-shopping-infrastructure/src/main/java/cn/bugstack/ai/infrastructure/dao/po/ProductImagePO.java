package cn.bugstack.ai.infrastructure.dao.po;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductImagePO {

    private String imageId;
    private String productId;
    private String provider;
    private String objectKey;
    private String url;
    private Integer sortOrder;
}
