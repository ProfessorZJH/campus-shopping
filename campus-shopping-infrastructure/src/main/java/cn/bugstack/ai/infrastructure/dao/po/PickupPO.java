package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 自提数据；credentialHash 不得通过 HTTP DTO 对外暴露。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PickupPO {

    private String id;
    private String orderId;
    private String merchantId;
    private String storeId;
    private String buyerId;
    private String status;
    private String credentialHash;
    private Instant expiresAt;
}
