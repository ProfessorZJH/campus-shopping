package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 购物车设置绝对数量，不预占库存。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CartSetRequestDTO {
    private String skuId;
    private Integer quantity;
}
