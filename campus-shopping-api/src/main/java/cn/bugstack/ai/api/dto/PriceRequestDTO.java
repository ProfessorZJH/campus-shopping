package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 带商品版本的价格修改。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PriceRequestDTO {
    private Long priceCent;
    private Long expectedVersion;
}
