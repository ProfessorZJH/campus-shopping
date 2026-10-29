package cn.bugstack.ai.domain.trading.model.aggregate;

import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Objects;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/**
 * 售后聚合根：负责退款申请、驳回、申诉和批准的合法状态转换。
 * 不直接操作订单、付款、库存、自提；它们的同库原子变更由 OrderLifecycleCase 编排。
 */
public final class AfterSaleAggregate {
    private final String id;
    private final String orderId;
    private final String buyerId;
    private final String merchantId;
    private final String reason;
    private final Instant createdAt;
    private AfterSaleStatusEnumVO status;
    private String decisionReason;

    private AfterSaleAggregate(String id, String orderId, String buyerId, String merchantId,
                               AfterSaleStatusEnumVO status, String reason, String decisionReason,
                               Instant createdAt) {
        this.id = Objects.requireNonNull(id);
        this.orderId = Objects.requireNonNull(orderId);
        this.buyerId = Objects.requireNonNull(buyerId);
        this.merchantId = Objects.requireNonNull(merchantId);
        this.status = Objects.requireNonNull(status);
        this.reason = Objects.requireNonNull(reason);
        this.decisionReason = Objects.requireNonNull(decisionReason);
        this.createdAt = Objects.requireNonNull(createdAt);
    }

    /** 第一次提交申请时，先验证订单归属及当前支付状态。 */
    public static AfterSaleAggregate request(String id, OrderAggregate order, String buyer,
                                             String reason, Instant now) {
        requirePaidBuyer(order, buyer);
        return new AfterSaleAggregate(id, order.getId(), buyer, order.getMerchantId(),
                AfterSaleStatusEnumVO.REQUESTED, text(reason, "退款原因", 500), "", now);
    }

    /** 从持久化快照重建聚合，不经过新申请的初始状态构造流程。 */
    public static AfterSaleAggregate restore(AfterSaleVO snapshot) {
        Objects.requireNonNull(snapshot);
        return new AfterSaleAggregate(snapshot.id(), snapshot.orderId(), snapshot.buyerId(),
                snapshot.merchantId(), snapshot.statusEnum(), snapshot.reason(),
                snapshot.decisionReason(), snapshot.createdAt());
    }

    /** 同一订单相同原因的待审申请幂等返回；驳回后不能偷偷创建第二份。 */
    public void requireSameRequest(OrderAggregate order, String buyer, String reason) {
        requirePaidBuyer(order, buyer);
        require(status == AfterSaleStatusEnumVO.REQUESTED
                        && this.reason.equals(text(reason, "退款原因", 500)),
                ResponseCode.REFUND_STATE_INVALID);
    }

    /** 重复驳回是幂等的，首次驳回必须携带审核意见。 */
    public boolean reject(String reason) {
        if (status == AfterSaleStatusEnumVO.REJECTED) {
            return false;
        }
        require(EnumSet.of(AfterSaleStatusEnumVO.REQUESTED, AfterSaleStatusEnumVO.DISPUTED)
                .contains(status), ResponseCode.REFUND_STATE_INVALID);
        decisionReason = text(reason, "驳回理由", 500);
        status = AfterSaleStatusEnumVO.REJECTED;
        return true;
    }

    /** 只有被驳回的申请可以向平台申诉；重复申诉不得再次变更数据。 */
    public boolean appeal(OrderAggregate order, String buyer) {
        requirePaidBuyer(order, buyer);
        if (status == AfterSaleStatusEnumVO.DISPUTED) {
            return false;
        }
        require(status == AfterSaleStatusEnumVO.REJECTED, ResponseCode.REFUND_STATE_INVALID);
        status = AfterSaleStatusEnumVO.DISPUTED;
        return true;
    }

    /** 仅待审或争议状态能批准；退款和库存释放必须由外层同事务完成。 */
    public void approve(String reason) {
        require(EnumSet.of(AfterSaleStatusEnumVO.REQUESTED, AfterSaleStatusEnumVO.DISPUTED)
                .contains(status), ResponseCode.REFUND_STATE_INVALID);
        decisionReason = text(reason, "退款审核说明", 500);
        status = AfterSaleStatusEnumVO.APPROVED;
    }

    public AfterSaleVO view() {
        return new AfterSaleVO(id, orderId, buyerId, merchantId, status.name(),
                reason, decisionReason, createdAt);
    }

    public AfterSaleStatusEnumVO getStatus() {
        return status;
    }

    private static void requirePaidBuyer(OrderAggregate order, String buyer) {
        order.requireBuyer(buyer);
        require(order.getStatusEnum() == OrderStatusEnumVO.PAID, ResponseCode.REFUND_STATE_INVALID);
    }
}
