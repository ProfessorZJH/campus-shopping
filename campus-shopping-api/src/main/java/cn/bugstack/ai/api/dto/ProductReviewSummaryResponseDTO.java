package cn.bugstack.ai.api.dto;

import java.util.List;
import lombok.*;

/** 商品评价汇总与明细。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductReviewSummaryResponseDTO {

    private String productId;
    private Double averageRating;
    private Long totalCount;
    private List<ProductReviewResponseDTO> items;
}
