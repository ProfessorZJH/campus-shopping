package cn.bugstack.ai.domain.trading.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import java.util.*;

/**
 * 订单聚合：金额和状态在服务端维护，外部不能任意 setStatus。
 */
public final class OrderAggregate {

    private final String id, buyerId, merchantId, storeId;
    private final List<OrderItemEntity> items;
    private final long totalCent;
    private final Instant deadline, createdAt;
    private OrderStatusEnumVO status;

    public OrderAggregate(
        String id,
        String buyerId,
        String merchantId,
        String storeId,
        List<OrderItemEntity> items,
        String status,
        Instant deadline,
        Instant createdAt
    ) {
        this.id = text(id, "订单ID", 64);
        this.buyerId = text(buyerId, "买家ID", 64);
        this.merchantId = text(merchantId, "商户ID", 64);
        this.storeId = text(storeId, "门店ID", 64);
        require(items != null && !items.isEmpty() && items.size() <= 20, ResponseCode.ILLEGAL_PARAMETER);
        Set<String> seen = new HashSet<>();
        long total = 0;
        for (OrderItemEntity item : items) {
            require(
                item != null &&
                    seen.add(item.skuId()) &&
                    item.quantity() > 0 &&
                    item.quantity() <= 99 &&
                    item.unitPriceCent() > 0 &&
                    item.unitPriceCent() <= 100000000L,
                ResponseCode.ILLEGAL_PARAMETER
            );
            total = Math.addExact(total, Math.multiplyExact(item.unitPriceCent(), (long) item.quantity()));
        }
        this.items = List.copyOf(items);
        this.totalCent = total;
        this.status = OrderStatusEnumVO.fromCode(status);
        this.deadline = Objects.requireNonNull(deadline);
        this.createdAt = Objects.requireNonNull(createdAt);
    }

    public void requireBuyer(String actor) {
        require(buyerId.equals(actor), ResponseCode.AUTH_FORBIDDEN);
    }

    /**
     * 已支付/完成的重复付款返回原状态，退款或取消后不能再付款。
     */
    public boolean pay(Instant now) {
        if (status == OrderStatusEnumVO.PAID || status == OrderStatusEnumVO.COMPLETED) return false;
        require(status == OrderStatusEnumVO.PENDING_PAYMENT, ResponseCode.ORDER_STATE_INVALID);
        require(now.isBefore(deadline), ResponseCode.ORDER_EXPIRED);
        status = OrderStatusEnumVO.PAID;
        return true;
    }

    public boolean cancel() {
        if (status == OrderStatusEnumVO.CANCELED) return false;
        require(status == OrderStatusEnumVO.PENDING_PAYMENT, ResponseCode.ORDER_STATE_INVALID);
        status = OrderStatusEnumVO.CANCELED;
        return true;
    }

    public boolean expire(Instant now) {
        if (status != OrderStatusEnumVO.PENDING_PAYMENT || now.isBefore(deadline)) return false;
        status = OrderStatusEnumVO.CANCELED;
        return true;
    }

    public void complete() {
        require(status == OrderStatusEnumVO.PAID, ResponseCode.ORDER_STATE_INVALID);
        status = OrderStatusEnumVO.COMPLETED;
    }

    public void refund() {
        require(status == OrderStatusEnumVO.PAID, ResponseCode.ORDER_STATE_INVALID);
        status = OrderStatusEnumVO.REFUNDED;
    }

    public String getId() {
        return id;
    }

    public String getBuyerId() {
        return buyerId;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public String getStoreId() {
        return storeId;
    }

    public List<OrderItemEntity> getItems() {
        return items;
    }

    public long getTotalCent() {
        return totalCent;
    }

    public String getStatus() {
        return status.getCode();
    }

    public OrderStatusEnumVO state() {
        return status;
    }

    public void requirePaidForRefund() {
        require(status == OrderStatusEnumVO.PAID, ResponseCode.REFUND_STATE_INVALID);
    }

    public Instant getDeadline() {
        return deadline;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
