package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 用户确认的商品报价快照。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CheckoutItemDTO {
    private String skuId;
    private Integer quantity;
    private Long expectedPriceCent;
    private Long expectedVersion;
}
