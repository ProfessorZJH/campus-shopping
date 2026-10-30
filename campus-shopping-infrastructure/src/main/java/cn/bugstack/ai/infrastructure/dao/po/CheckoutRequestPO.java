package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 下单请求幂等闸门。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutRequestPO {

    private String userId;
    private String requestKey;
    private String fingerprint;
    private String orderId;
}
