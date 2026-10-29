package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 商品表映射。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
