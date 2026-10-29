package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IOrderService extends IOrderQueryService {
    OrderAggregate order(String id, boolean lock);
    String beginCheckout(String user, String key, String fingerprint);
    void finishCheckout(String user, String key, String orderId);
    OrderAggregate create(String id, String buyer, String merchant, String store, List<OrderItemEntity> items, Instant deadline);
    void save(OrderAggregate order);
    void recordPayment(OrderAggregate order);
    void recordRefund(OrderAggregate order);
}
