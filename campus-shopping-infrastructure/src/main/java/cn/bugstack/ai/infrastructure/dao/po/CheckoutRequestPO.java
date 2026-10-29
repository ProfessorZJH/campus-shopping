package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 下单请求幂等闸门。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CheckoutRequestPO {
    private String userId;
    private String requestKey;
    private String fingerprint;
    private String orderId;
}
