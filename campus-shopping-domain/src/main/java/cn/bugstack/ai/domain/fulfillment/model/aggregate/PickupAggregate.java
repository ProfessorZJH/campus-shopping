package cn.bugstack.ai.domain.fulfillment.model.aggregate;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import static cn.bugstack.ai.types.common.Checks.require;
/** 自提状态与令牌校验；与订单、库存的原子性由外层用例保证。 */
public final class PickupAggregate {
    private final PickupVO original;
    private String status, credentialHash;
    private Instant expiresAt;
    public PickupAggregate(PickupVO original) {
        this.original=original; status=original.status();credentialHash=original.credentialHash();expiresAt=original.expiresAt();
    }
    public void prepare() {
        if ("READY".equals(status)||"PREPARING".equals(status))return;
        require("WAIT_PREP".equals(status),ResponseCode.ORDER_STATE_INVALID);status="PREPARING";
    }
    public void ready() {
        if ("READY".equals(status))return;
        require("WAIT_PREP".equals(status)||"PREPARING".equals(status),ResponseCode.ORDER_STATE_INVALID);status="READY";
    }
    public void issue(String token,Instant expiresAt) {
        require("READY".equals(status),ResponseCode.PICKUP_NOT_READY);
        credentialHash=Fingerprints.sha256(token); this.expiresAt=expiresAt;
    }
    public boolean verify(String token, Instant now) {
        require(token!=null && token.length()<=200 && credentialHash!=null,ResponseCode.PICKUP_INVALID);
        require(MessageDigest.isEqual(credentialHash.getBytes(StandardCharsets.UTF_8),Fingerprints.sha256(token).getBytes(StandardCharsets.UTF_8)),ResponseCode.PICKUP_INVALID);
        if ("COMPLETED".equals(status))return false;
        require("READY".equals(status),ResponseCode.PICKUP_NOT_READY);
        require(expiresAt!=null && now.isBefore(expiresAt),ResponseCode.PICKUP_INVALID); status="COMPLETED";return true;
    }
    public void cancel() { require(!"COMPLETED".equals(status),ResponseCode.ORDER_STATE_INVALID);status="CANCELED"; }
    public PickupVO view() {return new PickupVO(original.id(),original.orderId(),original.merchantId(),original.storeId(),original.buyerId(),status,credentialHash,expiresAt);}
}
