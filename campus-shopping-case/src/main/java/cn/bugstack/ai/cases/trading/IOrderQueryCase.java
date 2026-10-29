package cn.bugstack.ai.cases.trading;

import cn.bugstack.ai.cases.trading.model.*;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.TradingStatsVO;

/** 查询用例统一复权与批量读模型组装。 */
public interface IOrderQueryCase {
    OrderPage mine(String actor, String state, int page, int size);
    OrderPage merchant(String actor, String merchant, String state, int page, int size, String q);
    OrderPage platform(String actor, String state, int page, int size, String q);
    OrderReadModel detail(String actor, String id);
    /** 仅用于已授权写用例返回的订单事实。 */
    OrderReadModel view(OrderAggregate order);
    TradingStatsVO statistics(String actor, String merchant);
}
