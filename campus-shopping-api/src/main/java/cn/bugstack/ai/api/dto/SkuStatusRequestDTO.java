package cn.bugstack.ai.api.dto;

import lombok.*;

/** SKU 独立上下架；版本取商品聚合版本。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkuStatusRequestDTO {

    private Boolean active;
    private Long expectedVersion;
}
