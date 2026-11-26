package cn.bugstack.ai.domain.fulfillment.model.valobj;

import java.time.*;

/** 仅签发时向本人返回自提凭证明文、6位短核销码与二维码载荷，服务端仅保存摘要。 */
public record PickupTokenVO(String token, Instant expiresAt, String pickupCode, String pinCode, String qrPayload) {
    public PickupTokenVO(String token, Instant expiresAt) {
        this(token, expiresAt, "", "", "");
    }

    public PickupTokenVO {
        pickupCode = pickupCode == null ? "" : pickupCode;
        pinCode = pinCode == null ? "" : pinCode;
        qrPayload = qrPayload == null ? "" : qrPayload;
    }
}
