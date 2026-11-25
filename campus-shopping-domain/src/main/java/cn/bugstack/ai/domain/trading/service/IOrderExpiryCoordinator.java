package cn.bugstack.ai.domain.trading.service;

/** 多实例下协调逾期关单扫描的窄能力；单实例或未注入协调器时直接执行。 */
public interface IOrderExpiryCoordinator {
    boolean coordinateExpiryScan(Runnable task);
}
