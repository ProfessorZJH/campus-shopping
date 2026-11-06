package cn.bugstack.ai.domain.trading.adapter.repository;

import cn.bugstack.ai.domain.trading.model.valobj.OrderEventVO;
import java.util.List;

/** 订单事件只追加；唯一去重键由仓储层保证。 */
public interface IOrderEventRepository {
    void append(OrderEventVO event);

    List<OrderEventVO> events(String orderId);

    List<OrderEventVO> eventsByOrders(List<String> orderIds);
}
