package cn.bugstack.ai.domain.trading.service;

/** 订单逾期关闭执行回调，供延时队列与定时扫描共同调用。 */
@FunctionalInterface
public interface IOrderExpiryHandler {
    void expire(String orderId);
}
