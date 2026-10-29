package cn.bugstack.ai.domain.fulfillment.model.aggregate;

import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupStatusEnumVO;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

import static cn.bugstack.ai.types.common.Checks.require;

/** 自提状态机和一次性令牌校验；跨订单/库存原子性由 Case 负责。 */
public final class PickupAggregate {
    private final PickupVO original;
    private PickupStatusEnumVO status;
    private String credentialHash;
    private Instant expiresAt;

    public PickupAggregate(PickupVO original) {
        this.original = original;
        this.status = original.statusEnum();
        this.credentialHash = original.credentialHash();
        this.expiresAt = original.expiresAt();
    }

    public void prepare() {
        if (status == PickupStatusEnumVO.READY || status == PickupStatusEnumVO.PREPARING) {
            return;
        }
        require(status == PickupStatusEnumVO.WAIT_PREP, ResponseCode.ORDER_STATE_INVALID);
        status = PickupStatusEnumVO.PREPARING;
    }

    public void ready() {
        if (status == PickupStatusEnumVO.READY) {
            return;
        }
        require(status == PickupStatusEnumVO.WAIT_PREP || status == PickupStatusEnumVO.PREPARING,
                ResponseCode.ORDER_STATE_INVALID);
        status = PickupStatusEnumVO.READY;
    }

    public void issue(String token, Instant expiresAt) {
        require(status == PickupStatusEnumVO.READY, ResponseCode.PICKUP_NOT_READY);
        credentialHash = Fingerprints.sha256(token);
        this.expiresAt = expiresAt;
    }

    /** 有效令牌第一次核销改变状态，重复请求不再次产生库存出库。 */
    public boolean verify(String token, Instant now) {
        require(token != null && token.length() <= 200 && credentialHash != null,
                ResponseCode.PICKUP_INVALID);
        require(MessageDigest.isEqual(credentialHash.getBytes(StandardCharsets.UTF_8),
                        Fingerprints.sha256(token).getBytes(StandardCharsets.UTF_8)),
                ResponseCode.PICKUP_INVALID);
        if (status == PickupStatusEnumVO.COMPLETED) {
            return false;
        }
        require(status == PickupStatusEnumVO.READY, ResponseCode.PICKUP_NOT_READY);
        require(expiresAt != null && now.isBefore(expiresAt), ResponseCode.PICKUP_INVALID);
        status = PickupStatusEnumVO.COMPLETED;
        return true;
    }

    public void cancel() {
        require(status != PickupStatusEnumVO.COMPLETED, ResponseCode.ORDER_STATE_INVALID);
        status = PickupStatusEnumVO.CANCELED;
    }

    public PickupVO view() {
        return new PickupVO(original.id(), original.orderId(), original.merchantId(),
                original.storeId(), original.buyerId(), status.name(), credentialHash, expiresAt);
    }
}
