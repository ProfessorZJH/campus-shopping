package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 需要用户确认的加购建议，不是成交订单。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProposalItemResponseDTO {
    private String skuId;
    private String merchantId;
    private String title;
    private String specKey;
    private String imageUrl;
    private Long priceCent;
    private Long quoteVersion;
    private Integer quantity;
}
