package cn.bugstack.ai.domain.trading.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import java.util.regex.Pattern;

/** 退款申请、争议、裁决和提货互斥规则；外层用例负责与订单、库存的原子提交。 */
public final class AfterSaleAggregate {

    private static final Pattern MEDIA_URL = Pattern.compile(
        "^/media/(?:[a-f0-9-]+|qiniu/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\\.png$"
    );

    private final AfterSaleVO original;
    private AfterSaleStatusEnumVO status;
    private String decision;

    public AfterSaleAggregate(AfterSaleVO value) {
        original = java.util.Objects.requireNonNull(value);
        status = AfterSaleStatusEnumVO.fromCode(value.status());
        decision = value.decisionReason();
    }

    public static AfterSaleVO request(OrderAggregate order, String buyer, String reason, AfterSaleVO previous, String id, Instant now) {
        return request(order, buyer, reason, "", previous, id, now);
    }

    public static AfterSaleVO request(
        OrderAggregate order,
        String buyer,
        String reason,
        String evidenceImageUrl,
        AfterSaleVO previous,
        String id,
        Instant now
    ) {
        order.requireBuyer(buyer);
        order.requirePaidForRefund();
        String clean = text(reason, "退款原因", 500);
        String cleanEvidence = validateEvidenceImage(evidenceImageUrl);
        if (previous != null) {
            require(
                previous.state() == AfterSaleStatusEnumVO.REQUESTED && clean.equals(previous.reason()) && cleanEvidence.equals(previous.evidenceImageUrl()),
                ResponseCode.REFUND_STATE_INVALID
            );
            return previous;
        }
        return new AfterSaleVO(id, order.getId(), buyer, order.getMerchantId(), AfterSaleStatusEnumVO.REQUESTED.getCode(), clean, "", now, cleanEvidence);
    }

    private static String validateEvidenceImage(String value) {
        if (value == null || value.isBlank()) return "";
        require(value.length() <= 255 && MEDIA_URL.matcher(value).matches(), ResponseCode.ILLEGAL_PARAMETER);
        return value;
    }

    public boolean reject(String reason) {
        if (status == AfterSaleStatusEnumVO.REJECTED) return false;
        requireReviewable();
        decision = text(reason, "驳回理由", 500);
        status = AfterSaleStatusEnumVO.REJECTED;
        return true;
    }

    public boolean appeal(OrderAggregate order, String buyer) {
        order.requireBuyer(buyer);
        order.requirePaidForRefund();
        if (status == AfterSaleStatusEnumVO.DISPUTED) return false;
        require(status == AfterSaleStatusEnumVO.REJECTED, ResponseCode.REFUND_STATE_INVALID);
        status = AfterSaleStatusEnumVO.DISPUTED;
        return true;
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
            original.createdAt(),
            original.evidenceImageUrl()
        );
    }
}
