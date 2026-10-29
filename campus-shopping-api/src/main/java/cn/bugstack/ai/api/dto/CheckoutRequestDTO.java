package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 一次仅提交一个商户的商品。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CheckoutRequestDTO {
    private String merchantId;
    private List<CheckoutItemDTO> items;
}
