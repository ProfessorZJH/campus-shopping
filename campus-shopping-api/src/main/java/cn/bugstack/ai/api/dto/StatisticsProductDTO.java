package cn.bugstack.ai.api.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsProductDTO {

    private String productId;
    private String title;
    private Long quantity;
}
