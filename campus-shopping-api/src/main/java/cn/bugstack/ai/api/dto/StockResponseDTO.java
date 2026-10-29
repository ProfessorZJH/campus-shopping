package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 商户库存三量。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class StockResponseDTO {
    private String skuId;
    private String productId;
    private String productTitle;
    private String specKey;
    private String imageUrl;
    private String storeId;
    private Long onHand;
    private Long reserved;
    private Long available;
    private Long version;
}
