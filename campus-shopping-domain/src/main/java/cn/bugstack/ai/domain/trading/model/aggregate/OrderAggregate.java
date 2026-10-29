package cn.bugstack.ai.domain.trading.model.aggregate;

import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/**
 * 订单聚合根：成交金额为商品快照计算值，状态只能通过业务行为改变。
 * 数据库存储枚举名称，HTTP 仍返回原字符串，兼容现有订单契约。
 */
public final class OrderAggregate {
    private final String id;
    private final String buyerId;
    private final String merchantId;
    private final String storeId;
    private final List<OrderItemEntity> items;
    private final long totalCent;
    private final Instant deadline;
    private final Instant createdAt;
    private OrderStatusEnumVO status;

    public OrderAggregate(String id, String buyerId, String merchantId, String storeId,
                          List<OrderItemEntity> items, String status, Instant deadline, Instant createdAt) {
        this.id = text(id, "订单ID", 64);
        this.buyerId = text(buyerId, "买家ID", 64);
        this.merchantId = text(merchantId, "商户ID", 64);
        this.storeId = text(storeId, "门店ID", 64);
        require(items != null && !items.isEmpty() && items.size() <= 20, ResponseCode.ILLEGAL_PARAMETER);
        Set<String> seen = new HashSet<>();
        long total = 0;
        for (OrderItemEntity item : items) {
            require(item != null && seen.add(item.skuId()) && item.quantity() > 0
                            && item.quantity() <= 99 && item.unitPriceCent() > 0
                            && item.unitPriceCent() <= 100000000L, ResponseCode.ILLEGAL_PARAMETER);
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

    /** 重复付款对已付款和已完成订单返回无变化；取消/退款后不得再次付款。 */
    public boolean pay(Instant now) {
        if (status == OrderStatusEnumVO.PAID || status == OrderStatusEnumVO.COMPLETED) {
            return false;
        }
        require(status == OrderStatusEnumVO.PENDING_PAYMENT, ResponseCode.ORDER_STATE_INVALID);
        require(now.isBefore(deadline), ResponseCode.ORDER_EXPIRED);
        status = OrderStatusEnumVO.PAID;
        return true;
    }

    public boolean cancel() {
        if (status == OrderStatusEnumVO.CANCELED) {
            return false;
        }
        require(status == OrderStatusEnumVO.PENDING_PAYMENT, ResponseCode.ORDER_STATE_INVALID);
        status = OrderStatusEnumVO.CANCELED;
        return true;
    }

    public boolean expire(Instant now) {
        if (status != OrderStatusEnumVO.PENDING_PAYMENT || now.isBefore(deadline)) {
            return false;
        }
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

    public String getId() { return id; }
    public String getBuyerId() { return buyerId; }
    public String getMerchantId() { return merchantId; }
    public String getStoreId() { return storeId; }
    public List<OrderItemEntity> getItems() { return items; }
    public long getTotalCent() { return totalCent; }
    /** Domain 使用类型安全的状态；外部只在适配边界进行字符串编码。 */
    public OrderStatusEnumVO getStatusEnum() { return status; }
    public String getStatus() { return status.name(); }
    public Instant getDeadline() { return deadline; }
    public Instant getCreatedAt() { return createdAt; }
}
