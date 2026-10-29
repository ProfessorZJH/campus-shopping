package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.trading.adapter.repository.IOrderRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.CheckoutRequestVO;
import cn.bugstack.ai.domain.trading.model.valobj.TradingStatsVO;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.CheckoutRequestPO;
import cn.bugstack.ai.infrastructure.dao.po.OrderItemPO;
import cn.bugstack.ai.infrastructure.dao.po.OrderPO;
import cn.bugstack.ai.infrastructure.dao.po.TradingStatsPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

import static cn.bugstack.ai.types.common.Checks.require;

/** 订单聚合、下单请求闸门和模拟交易记录映射；不访问售后或购物车数据。 */
@Repository
public class OrderRepository implements IOrderRepository {
    @Resource
    private ITradingDao dao;

    @Override
    public CheckoutRequestVO begin(String user, String key, String fingerprint) {
        dao.gate(user, key, fingerprint);
        CheckoutRequestPO po = dao.request(user, key);
        return new CheckoutRequestVO(po.getUserId(), po.getRequestKey(),
                po.getFingerprint(), po.getOrderId());
    }

    @Override
    public void finishRequest(String user, String key, String order) {
        require(dao.finishRequest(user, key, order) == 1, ResponseCode.REQUEST_CONFLICT);
    }

    @Override
    public void insert(OrderAggregate order) {
        dao.insertOrder(OrderPO.builder()
                .id(order.getId()).buyerId(order.getBuyerId())
                .merchantId(order.getMerchantId()).storeId(order.getStoreId())
                .totalCent(order.getTotalCent()).status(order.getStatus())
                .deadline(order.getDeadline()).createdAt(order.getCreatedAt()).build());
        for (OrderItemEntity item : order.getItems()) {
            dao.insertItem(OrderItemPO.builder()
                    .orderId(order.getId()).skuId(item.skuId())
                    .title(item.title()).specKey(item.specKey())
                    .imageUrl(item.imageUrl() == null ? "" : item.imageUrl())
                    .unitPriceCent(item.unitPriceCent()).quantity(item.quantity()).build());
        }
    }

    @Override
    public OrderAggregate order(String id, boolean lock) {
        return convert(dao.order(id, lock), lock);
    }

    @Override
    public void save(OrderAggregate order) {
        require(dao.saveOrder(order.getId(), order.getStatus()) == 1, ResponseCode.NOT_FOUND);
    }

    @Override
    public List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size) {
        return orders(buyer, merchant, status, offset, size, "");
    }

    @Override
    public List<OrderAggregate> orders(String buyer, String merchant, String status,
                                       int offset, int size, String q) {
        return dao.orders(buyer, merchant, status, offset, size, q)
                .stream().map(this::convert).toList();
    }

    @Override
    public long countOrders(String buyer, String merchant, String status) {
        return countOrders(buyer, merchant, status, "");
    }

    @Override
    public long countOrders(String buyer, String merchant, String status, String q) {
        return dao.countOrders(buyer, merchant, status, q);
    }

    @Override
    public List<String> expired(Instant now) {
        return dao.expired(now);
    }

    @Override
    public void payment(String order, long amount) {
        dao.payment(order, amount);
    }

    @Override
    public void refund(String order, long amount) {
        dao.refund(order, amount);
    }

    @Override
    public TradingStatsVO statistics(String merchant) {
        TradingStatsPO po = dao.statistics(merchant);
        return new TradingStatsVO(po.getTotalOrders(), po.getPendingCount(), po.getPaidCount(),
                po.getCompletedCount(), po.getRefundedCount(), po.getCompletedAmountCent());
    }

    private OrderAggregate convert(OrderPO po) {
        return convert(po, false);
    }

    private OrderAggregate convert(OrderPO po, boolean lock) {
        if (po == null) {
            return null;
        }
        List<OrderItemEntity> items = dao.items(po.getId(), lock).stream().map(item ->
                new OrderItemEntity(item.getSkuId(), item.getTitle(), item.getSpecKey(),
                        item.getUnitPriceCent(), item.getQuantity(),
                        item.getImageUrl() == null ? "" : item.getImageUrl())).toList();
        OrderAggregate order = new OrderAggregate(po.getId(), po.getBuyerId(),
                po.getMerchantId(), po.getStoreId(), items, po.getStatus(),
                po.getDeadline(), po.getCreatedAt());
        require(order.getTotalCent() == po.getTotalCent(), ResponseCode.UN_ERROR);
        return order;
    }
}
