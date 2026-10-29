package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 用户确认的商品报价快照。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutItemDTO {

    private String skuId;
    private Integer quantity;
    private Long expectedPriceCent;
    private Long expectedVersion;
}
