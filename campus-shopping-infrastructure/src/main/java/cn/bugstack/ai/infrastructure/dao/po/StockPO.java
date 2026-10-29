package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 库存表映射，不在 PO 中决定扣减规则。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class StockPO {
    private String merchantId;
    private String storeId;
    private String skuId;
    private Long onHand;
    private Long reserved;
    private Long version;
}
