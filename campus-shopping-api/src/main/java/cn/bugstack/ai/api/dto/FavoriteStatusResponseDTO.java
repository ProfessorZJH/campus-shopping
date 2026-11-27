package cn.bugstack.ai.api.dto;

import lombok.*;

/** 商品收藏状态。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FavoriteStatusResponseDTO {

    private String productId;
    private Boolean favorited;
}
