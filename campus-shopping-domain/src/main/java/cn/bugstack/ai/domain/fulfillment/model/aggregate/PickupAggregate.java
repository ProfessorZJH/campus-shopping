package cn.bugstack.ai.domain.fulfillment.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupStatusEnumVO;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

/** 自提状态与令牌校验；与订单、库存的原子性由外层用例保证。 */
public final class PickupAggregate {

    private final PickupVO original;
    private PickupStatusEnumVO status;
    private String credentialHash;
    private Instant expiresAt;

    public PickupAggregate(PickupVO original) {
        this.original = original;
        status = PickupStatusEnumVO.fromCode(original.status());
        credentialHash = original.credentialHash();
        expiresAt = original.expiresAt();
    }

    public void prepare() {
        if (status == PickupStatusEnumVO.READY || status == PickupStatusEnumVO.PREPARING) return;
        require(status == PickupStatusEnumVO.WAIT_PREP, ResponseCode.PICKUP_STATE_INVALID);
        status = PickupStatusEnumVO.PREPARING;
    }

    public void ready() {
        if (status == PickupStatusEnumVO.READY) return;
        require(status == PickupStatusEnumVO.WAIT_PREP || status == PickupStatusEnumVO.PREPARING, ResponseCode.PICKUP_STATE_INVALID);
        status = PickupStatusEnumVO.READY;
    }

    public void issue(String token, Instant expiresAt) {
        require(status == PickupStatusEnumVO.READY, ResponseCode.PICKUP_NOT_READY);
        credentialHash = Fingerprints.sha256(token);
        this.expiresAt = expiresAt;
    }

    public boolean verify(String token, Instant now) {
        require(token != null && token.length() <= 200 && credentialHash != null, ResponseCode.PICKUP_INVALID);
        require(
            MessageDigest.isEqual(credentialHash.getBytes(StandardCharsets.UTF_8), Fingerprints.sha256(token).getBytes(StandardCharsets.UTF_8)),
            ResponseCode.PICKUP_INVALID
        );
        if (status == PickupStatusEnumVO.COMPLETED) return false;
        require(status == PickupStatusEnumVO.READY, ResponseCode.PICKUP_NOT_READY);
        require(expiresAt != null && now.isBefore(expiresAt), ResponseCode.PICKUP_INVALID);
        status = PickupStatusEnumVO.COMPLETED;
        return true;
    }

    public void cancel() {
        require(status != PickupStatusEnumVO.COMPLETED, ResponseCode.PICKUP_STATE_INVALID);
        status = PickupStatusEnumVO.CANCELED;
    }

    public PickupVO view() {
        return new PickupVO(
            original.id(),
            original.orderId(),
            original.merchantId(),
            original.storeId(),
            original.buyerId(),
            status.getCode(),
            credentialHash,
            expiresAt
        );
    }
}
