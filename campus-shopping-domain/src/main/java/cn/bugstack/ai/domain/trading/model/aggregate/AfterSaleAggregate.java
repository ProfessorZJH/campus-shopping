package cn.bugstack.ai.domain.trading.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;

/** 退款申请、争议、裁决和提货互斥规则；外层用例负责与订单、库存的原子提交。 */
public final class AfterSaleAggregate {

    private final AfterSaleVO original;
    private AfterSaleStatusEnumVO status;
    private String decision;

    public AfterSaleAggregate(AfterSaleVO value) {
        original = java.util.Objects.requireNonNull(value);
        status = AfterSaleStatusEnumVO.fromCode(value.status());
        decision = value.decisionReason();
    }

    public static AfterSaleVO request(OrderAggregate order, String buyer, String reason, AfterSaleVO previous, String id, Instant now) {
        order.requireBuyer(buyer);
        order.requirePaidForRefund();
        String clean = text(reason, "退款原因", 500);
        if (previous != null) {
            require(previous.state() == AfterSaleStatusEnumVO.REQUESTED && clean.equals(previous.reason()), ResponseCode.REFUND_STATE_INVALID);
            return previous;
        }
        return new AfterSaleVO(id, order.getId(), buyer, order.getMerchantId(), AfterSaleStatusEnumVO.REQUESTED.getCode(), clean, "", now);
    }

    public boolean reject(String reason) {
        if (status == AfterSaleStatusEnumVO.REJECTED) return false;
        requireReviewable();
        decision = text(reason, "驳回理由", 500);
        status = AfterSaleStatusEnumVO.REJECTED;
        return true;
    }

    public void appeal(OrderAggregate order, String buyer) {
        order.requireBuyer(buyer);
        order.requirePaidForRefund();
        if (status == AfterSaleStatusEnumVO.DISPUTED) return;
        require(status == AfterSaleStatusEnumVO.REJECTED, ResponseCode.REFUND_STATE_INVALID);
        status = AfterSaleStatusEnumVO.DISPUTED;
    }

    public void approve(String reason) {
        requireReviewable();
        decision = text(reason, "退款审核说明", 500);
        status = AfterSaleStatusEnumVO.APPROVED;
    }

    public void requireMerchantReview() {
        require(status != AfterSaleStatusEnumVO.DISPUTED, ResponseCode.AUTH_FORBIDDEN);
        require(status == AfterSaleStatusEnumVO.REQUESTED || status == AfterSaleStatusEnumVO.REJECTED, ResponseCode.REFUND_STATE_INVALID);
    }

    /** 平台仅裁决买家已申诉的争议；不得跳过商户审核。 */
    public void requirePlatformReview() {
        require(status == AfterSaleStatusEnumVO.DISPUTED, ResponseCode.REFUND_STATE_INVALID);
    }

    public void requirePickupAllowed() {
        require(status == AfterSaleStatusEnumVO.REJECTED, ResponseCode.REFUND_STATE_INVALID);
    }

    private void requireReviewable() {
        require(status == AfterSaleStatusEnumVO.REQUESTED || status == AfterSaleStatusEnumVO.DISPUTED, ResponseCode.REFUND_STATE_INVALID);
    }

    public AfterSaleVO view() {
        return new AfterSaleVO(
            original.id(),
            original.orderId(),
            original.buyerId(),
            original.merchantId(),
            status.getCode(),
            original.reason(),
            decision,
            original.createdAt()
        );
    }
}
