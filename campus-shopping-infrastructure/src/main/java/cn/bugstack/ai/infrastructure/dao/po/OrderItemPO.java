package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 不可变成交商品快照。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrderItemPO {
    private String orderId;
    private String skuId;
    private String title;
    private String specKey;
    private String imageUrl;
    private Long unitPriceCent;
    private Integer quantity;
}
