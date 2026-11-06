package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.valobj.OrderEventVO;
import java.util.List;
import java.util.Map;

/** 履约与售后事件的追加和授权读取能力。 */
public interface IOrderEventService {
    void record(String orderId, String afterSaleId, String type, String actorId, String actorRole, String reason);

    List<OrderEventVO> events(String orderId);

    Map<String, List<OrderEventVO>> eventsByOrders(List<String> orderIds);
}
