package cn.bugstack.ai.domain.trading.service;

/** 订单逾期延时关闭调度端口；事务提交后投递延时任务。 */
public interface IOrderDelayScheduler {
    void scheduleOrderExpiryAfterCommit(String orderId, long delaySeconds);
}
