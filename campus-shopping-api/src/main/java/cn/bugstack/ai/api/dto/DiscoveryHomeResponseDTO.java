package cn.bugstack.ai.api.dto;

import java.util.List;
import lombok.*;

/** 首页发现聚合数据：校园热搜、热销、个性推荐、足迹与收藏 ID。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscoveryHomeResponseDTO {

    private List<String> hotKeywords;
    private List<ProductResponseDTO> hotProducts;
    private List<ProductResponseDTO> recommendedProducts;
    private List<ProductResponseDTO> recentProducts;
    private List<String> favoriteProductIds;
}
