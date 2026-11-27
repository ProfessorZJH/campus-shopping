package cn.bugstack.ai.api.dto;

import java.util.List;
import lombok.*;

/** 商品详情页关联推荐：大家还买了 + 同店热销。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductRecommendationsResponseDTO {

    private List<ProductResponseDTO> boughtTogether;
    private List<ProductResponseDTO> sameStoreHot;
}
