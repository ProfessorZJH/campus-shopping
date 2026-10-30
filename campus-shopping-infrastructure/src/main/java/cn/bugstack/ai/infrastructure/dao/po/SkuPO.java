package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** SKU 表映射，价格为整数分。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkuPO {

    private String id;
    private String productId;
    private String merchantId;
    private String storeId;
    private String specKey;
    private Long priceCent;
    private String status;
    private Long version;
}
