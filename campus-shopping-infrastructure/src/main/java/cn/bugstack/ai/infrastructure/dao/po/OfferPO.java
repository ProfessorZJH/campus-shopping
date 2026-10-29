package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 报价查询投影，不直接作为对外响应。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OfferPO {
    private String skuId;
    private String productId;
    private String merchantId;
    private String storeId;
    private String title;
    private String specKey;
    private Long priceCent;
    private Long version;
    private String productStatus;
    private String skuStatus;
    private String imageUrl;
    private String description;
}
