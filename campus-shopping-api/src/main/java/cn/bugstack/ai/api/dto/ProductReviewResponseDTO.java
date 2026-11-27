package cn.bugstack.ai.api.dto;

import java.time.Instant;
import lombok.*;

/** 商品单条买家真实评价。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductReviewResponseDTO {

    private String id;
    private String productId;
    private String buyerDisplayName;
    private Integer rating;
    private String tags;
    private String content;
    private Instant createdAt;
}
