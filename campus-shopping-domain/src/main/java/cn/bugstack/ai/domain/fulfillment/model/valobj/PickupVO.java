package cn.bugstack.ai.domain.fulfillment.model.valobj;

import java.time.*;
import java.util.*;

/** 自提任务；只存凭证摘要与 6 位码摘要，不在商户列表暴露给无权用户。 */
public record PickupVO(
    String id,
    String orderId,
    String merchantId,
    String storeId,
    String buyerId,
    String status,
    String credentialHash,
    Instant expiresAt,
    String pickupCode,
    String pinHash
) {
    /** 兼容历史 8 参构造。 */
    public PickupVO(String id, String orderId, String merchantId, String storeId, String buyerId, String status, String credentialHash, Instant expiresAt) {
        this(id, orderId, merchantId, storeId, buyerId, status, credentialHash, expiresAt, "", null);
    }

    public PickupVO {
        PickupStatusEnumVO.fromCode(status);
        pickupCode = pickupCode == null ? "" : pickupCode;
    }

    public PickupStatusEnumVO state() {
        return PickupStatusEnumVO.fromCode(status);
    }
}
