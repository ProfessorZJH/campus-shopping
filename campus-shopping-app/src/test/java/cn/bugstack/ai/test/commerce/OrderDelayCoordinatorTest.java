package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.impl.OrderLifecycleCaseImpl;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.service.IAfterSaleService;
import cn.bugstack.ai.domain.trading.service.IOrderDelayScheduler;
import cn.bugstack.ai.domain.trading.service.IOrderEventService;
import cn.bugstack.ai.domain.trading.service.IOrderExpiryHandler;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.infrastructure.redis.OrderDelayCoordinator;
import cn.bugstack.ai.infrastructure.redis.RedisClients;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.redisson.api.RBlockingDeque;
import org.redisson.api.RDelayedQueue;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 验证 Redisson 延时关单队列的事务提交后撤销与订单生命周期退队联动。 */
class OrderDelayCoordinatorTest {

    private static final Instant NOW = Instant.parse("2026-11-26T08:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @AfterEach
    void cleanupTransactionSync() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @SuppressWarnings("unchecked")
    private CoordinatorFixture createFixture() {
        RedissonClient security = mock(RedissonClient.class);
        RedissonClient cache = mock(RedissonClient.class);
        RBlockingDeque<String> deque = mock(RBlockingDeque.class);
        RDelayedQueue<String> delayedQueue = mock(RDelayedQueue.class);
        when(cache.<String>getBlockingDeque("cs:test:delay:order-expire", StringCodec.INSTANCE)).thenReturn(deque);
        when(cache.getDelayedQueue(deque)).thenReturn(delayedQueue);

        RedisClients clients = new RedisClients(security, cache, "cs:test");
        DefaultListableBeanFactory beans = new DefaultListableBeanFactory();
        beans.registerSingleton("redisClients", clients);
        OrderDelayCoordinator coordinator = new OrderDelayCoordinator(
            beans.getBeanProvider(RedisClients.class),
            beans.getBeanProvider(IOrderExpiryHandler.class),
            beans.getBeanProvider(ICampusRedisPort.class)
        );
        return new CoordinatorFixture(coordinator, deque, delayedQueue);
    }

    @Test
    void cancelNowRemovesOrderFromBothDelayedQueueAndBlockingDeque() {
        CoordinatorFixture f = createFixture();

        f.coordinator.cancelNow("ord-paid-1");

        verify(f.delayedQueue).remove("ord-paid-1");
        verify(f.deque).remove("ord-paid-1");

        f.coordinator.cancelNow(" ");
        f.coordinator.cancelNow(null);
        verifyNoMoreInteractions(f.delayedQueue, f.deque);
    }

    @Test
    void cancelNowDegradesGracefullyWhenRedisThrows() {
        CoordinatorFixture f = createFixture();
        when(f.delayedQueue.remove("ord-err-1")).thenThrow(new IllegalStateException("redis unreachable"));

        assertDoesNotThrow(() -> f.coordinator.cancelNow("ord-err-1"));
        verify(f.delayedQueue).remove("ord-err-1");
    }

    @Test
    void cancelOrderExpiryAfterCommitRunsImmediatelyWithoutActiveTransaction() {
        CoordinatorFixture f = createFixture();

        f.coordinator.cancelOrderExpiryAfterCommit("ord-no-tx");

        verify(f.delayedQueue).remove("ord-no-tx");
        verify(f.deque).remove("ord-no-tx");
    }

    @Test
    void cancelOrderExpiryAfterCommitWaitsUntilTransactionCommits() {
        CoordinatorFixture f = createFixture();
        TransactionSynchronizationManager.initSynchronization();

        f.coordinator.cancelOrderExpiryAfterCommit("ord-tx-1");

        // 事务未提交前不得提前移除延时队列项，防止事务回滚后丢失超时关单保护。
        verifyNoInteractions(f.delayedQueue, f.deque);

        for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
            sync.afterCommit();
        }

        verify(f.delayedQueue).remove("ord-tx-1");
        verify(f.deque).remove("ord-tx-1");
    }

    @Test
    void orderLifecycleCancelsDelayEntryWhenOrderLeavesPendingPayment() {
        IOrderService trading = mock(IOrderService.class);
        IOrderEventService events = mock(IOrderEventService.class);
        IAfterSaleService afterSales = mock(IAfterSaleService.class);
        IFulfillmentService fulfillment = mock(IFulfillmentService.class);
        IInventoryService inventory = mock(IInventoryService.class);
        IAccessService access = mock(IAccessService.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        IMerchantService merchants = mock(IMerchantService.class);
        IOrderQueryCase query = mock(IOrderQueryCase.class);
        IOrderDelayScheduler delayScheduler = mock(IOrderDelayScheduler.class);

        OrderLifecycleCaseImpl lifecycle = new OrderLifecycleCaseImpl(
            trading,
            events,
            afterSales,
            fulfillment,
            inventory,
            access,
            accounts,
            merchants,
            query,
            clock
        );
        ReflectionTestUtils.setField(lifecycle, "delayScheduler", delayScheduler);

        // 1. 支付成功 -> 撤销延时关单；幂等重复支付不再重复触发。
        OrderAggregate toPay = pendingOrder("ord-pay", NOW.plusSeconds(900));
        when(trading.orderForUpdate("ord-pay")).thenReturn(toPay);
        lifecycle.pay("buyer-1", "ord-pay", "WECHAT_PAY");
        verify(delayScheduler, times(1)).cancelOrderExpiryAfterCommit("ord-pay");
        lifecycle.pay("buyer-1", "ord-pay", "WECHAT_PAY");
        verify(delayScheduler, times(1)).cancelOrderExpiryAfterCommit("ord-pay");

        // 2. 买家取消 -> 撤销延时关单；幂等重复取消不再重复触发。
        OrderAggregate toCancel = pendingOrder("ord-cancel", NOW.plusSeconds(900));
        when(trading.orderForUpdate("ord-cancel")).thenReturn(toCancel);
        lifecycle.cancel("buyer-1", "ord-cancel");
        verify(delayScheduler, times(1)).cancelOrderExpiryAfterCommit("ord-cancel");
        lifecycle.cancel("buyer-1", "ord-cancel");
        verify(delayScheduler, times(1)).cancelOrderExpiryAfterCommit("ord-cancel");

        // 3. 兜底任务超时关单 -> 同步撤销延时队列残留；未到期不撤销。
        OrderAggregate notExpired = pendingOrder("ord-live", NOW.plusSeconds(60));
        when(trading.orderForUpdate("ord-live")).thenReturn(notExpired);
        lifecycle.expire("ord-live");
        verify(delayScheduler, never()).cancelOrderExpiryAfterCommit("ord-live");

        OrderAggregate expired = pendingOrder("ord-expired", NOW.minusSeconds(1));
        when(trading.orderForUpdate("ord-expired")).thenReturn(expired);
        lifecycle.expire("ord-expired");
        verify(delayScheduler, times(1)).cancelOrderExpiryAfterCommit("ord-expired");
    }

    private OrderAggregate pendingOrder(String id, Instant deadline) {
        return new OrderAggregate(
            id,
            "buyer-1",
            "m-1",
            "s-1",
            List.of(new OrderItemEntity("sku-1", "无糖乌龙茶", "500ml", 600, 1)),
            "PENDING_PAYMENT",
            deadline,
            NOW.minusSeconds(60)
        );
    }

    private record CoordinatorFixture(OrderDelayCoordinator coordinator, RBlockingDeque<String> deque, RDelayedQueue<String> delayedQueue) {}
}
