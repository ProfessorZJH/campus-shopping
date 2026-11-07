package cn.bugstack.ai.infrastructure.dao.po;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsProductPO {

    private String productId;
    private String title;
    private Long quantity;
}
