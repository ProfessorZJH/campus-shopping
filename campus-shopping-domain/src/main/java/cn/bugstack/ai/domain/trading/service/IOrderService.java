package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IOrderService extends IOrderQueryService {
    /** 加载待修改订单并持有行锁；仅允许在已有业务事务中调用。 */
    OrderAggregate orderForUpdate(String id);
    String beginCheckout(String user, String key, String fingerprint);
    void finishCheckout(String user, String key, String orderId);
    OrderAggregate create(String id, String buyer, String merchant, String store, List<OrderItemEntity> items, Instant deadline);
    void save(OrderAggregate order);
    void recordPayment(OrderAggregate order);
    void recordRefund(OrderAggregate order);
}
