package cn.bugstack.ai.domain.trading.service;

/** 订单逾期延时关闭调度端口；事务提交后投递或撤销延时任务。 */
public interface IOrderDelayScheduler {
    void scheduleOrderExpiryAfterCommit(String orderId, long delaySeconds);

    /** 订单已支付、取消或关闭后，在事务提交后撤销冗余延时关单任务。 */
    default void cancelOrderExpiryAfterCommit(String orderId) {}
}
