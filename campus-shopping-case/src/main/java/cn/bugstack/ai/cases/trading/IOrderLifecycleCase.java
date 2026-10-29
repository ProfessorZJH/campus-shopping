package cn.bugstack.ai.cases.trading;

import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupTokenVO;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;

/** 支付、关闭、履约和售后均以订单行锁为竞争边界。 */
public interface IOrderLifecycleCase {
    OrderAggregate pay(String buyer, String order);
    OrderAggregate cancel(String buyer, String order);
    void expire(String order);
    void prepare(String actor, String merchant, String order, boolean ready);
    PickupTokenVO token(String buyer, String order);
    OrderAggregate verify(String actor, String merchant, String order, String token);
    AfterSaleVO requestRefund(String buyer, String order, String reason);
    void appeal(String buyer, String order);
    void decideRefund(String actor, String merchant, String order, boolean approved, String reason, boolean platform);
}
