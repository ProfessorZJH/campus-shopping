package cn.bugstack.ai.domain.fulfillment.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupStatusEnumVO;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

/** 自提状态与令牌/6位核销码校验；与订单、库存的原子性由外层用例保证。 */
public final class PickupAggregate {

    private final PickupVO original;
    private PickupStatusEnumVO status;
    private String credentialHash;
    private Instant expiresAt;
    private String pickupCode;
    private String pinHash;

    public PickupAggregate(PickupVO original) {
        this.original = original;
        status = PickupStatusEnumVO.fromCode(original.status());
        credentialHash = original.credentialHash();
        expiresAt = original.expiresAt();
        pickupCode = original.pickupCode() == null ? "" : original.pickupCode();
        pinHash = original.pinHash();
    }

    public boolean prepare() {
        if (status == PickupStatusEnumVO.READY || status == PickupStatusEnumVO.PREPARING) return false;
        require(status == PickupStatusEnumVO.WAIT_PREP, ResponseCode.PICKUP_STATE_INVALID);
        status = PickupStatusEnumVO.PREPARING;
        return true;
    }

    public boolean ready() {
        if (status == PickupStatusEnumVO.READY) return false;
        require(status == PickupStatusEnumVO.WAIT_PREP || status == PickupStatusEnumVO.PREPARING, ResponseCode.PICKUP_STATE_INVALID);
        status = PickupStatusEnumVO.READY;
        return true;
    }

    public void issue(String token, Instant expiresAt) {
        issue(token, null, expiresAt);
    }

    public void issue(String token, String pinCode, Instant expiresAt) {
        require(status == PickupStatusEnumVO.READY, ResponseCode.PICKUP_NOT_READY);
        credentialHash = Fingerprints.sha256(token);
        pinHash = pinCode == null || pinCode.isBlank() ? null : Fingerprints.sha256(pinCode);
        this.expiresAt = expiresAt;
    }

    public boolean verify(String input, Instant now) {
        require(input != null && !input.isBlank() && input.length() <= 200 && credentialHash != null, ResponseCode.PICKUP_INVALID);
        String candidate = input.trim();
        boolean matched = false;
        String qrPrefix = "CS1|" + original.orderId() + "|";
        if (candidate.startsWith(qrPrefix)) {
            String rawToken = candidate.substring(qrPrefix.length());
            matched = constantTimeHashEquals(credentialHash, rawToken);
        } else if (candidate.matches("\\d{6}") && pinHash != null) {
            matched = constantTimeHashEquals(pinHash, candidate);
        } else {
            matched = constantTimeHashEquals(credentialHash, candidate);
        }
        require(matched, ResponseCode.PICKUP_INVALID);
        if (status == PickupStatusEnumVO.COMPLETED) return false;
        require(status == PickupStatusEnumVO.READY, ResponseCode.PICKUP_NOT_READY);
        require(expiresAt != null && now.isBefore(expiresAt), ResponseCode.PICKUP_INVALID);
        status = PickupStatusEnumVO.COMPLETED;
        return true;
    }

    private static boolean constantTimeHashEquals(String expectedHash, String raw) {
        if (expectedHash == null || raw == null || raw.isEmpty()) return false;
        return MessageDigest.isEqual(expectedHash.getBytes(StandardCharsets.UTF_8), Fingerprints.sha256(raw).getBytes(StandardCharsets.UTF_8));
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
            expiresAt,
            pickupCode,
            pinHash
        );
    }
}
