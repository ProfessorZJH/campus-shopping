package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 购物车设置绝对数量，不预占库存。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartSetRequestDTO {

    private String skuId;
    private Integer quantity;
}
