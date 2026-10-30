package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IOrderQueryService {
    OrderAggregate order(String id);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size, String q);
    long countOrders(String buyer, String merchant, String status);
    long countOrders(String buyer, String merchant, String status, String q);
    List<String> expired();
    TradingStatsVO statistics(String merchant);
}
