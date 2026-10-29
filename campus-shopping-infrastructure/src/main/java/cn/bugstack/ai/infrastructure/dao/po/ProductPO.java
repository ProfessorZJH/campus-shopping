package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 商品表映射。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProductPO {
    private String id;
    private String merchantId;
    private String storeId;
    private String title;
    private String description;
    private String categoryCode;
    private String imageUrl;
    private String status;
    private Long version;
}
