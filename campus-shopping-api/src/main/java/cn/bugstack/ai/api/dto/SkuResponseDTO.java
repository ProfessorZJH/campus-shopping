package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 商品销售规格，库存是查询时快照，结算必须重验。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SkuResponseDTO {
    private String skuId;
    private String specKey;
    private Long priceCent;
    private String status;
    private Long quoteVersion;
    private Long available;
}
