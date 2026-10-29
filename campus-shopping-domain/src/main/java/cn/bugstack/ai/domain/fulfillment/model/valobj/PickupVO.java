package cn.bugstack.ai.domain.fulfillment.model.valobj;

import java.time.Instant;

/** 自提任务快照，仅保存凭证摘要；状态在聚合内部使用枚举流转。 */
public record PickupVO(String id, String orderId, String merchantId, String storeId,
                       String buyerId, String status, String credentialHash, Instant expiresAt) {
    public PickupVO {
        PickupStatusEnumVO.fromCode(status);
    }

    public PickupStatusEnumVO statusEnum() {
        return PickupStatusEnumVO.fromCode(status);
    }
}
