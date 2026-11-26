package cn.bugstack.ai.api.dto;

import lombok.*;

/** 订单完成后的买家评价提交。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderReviewRequestDTO {

    private Integer rating;
    private String tags;
    private String content;
}
