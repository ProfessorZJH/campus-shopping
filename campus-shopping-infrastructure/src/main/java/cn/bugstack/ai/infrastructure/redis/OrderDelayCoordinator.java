package cn.bugstack.ai.infrastructure.redis;

import cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort;
import cn.bugstack.ai.domain.trading.service.IOrderDelayScheduler;
import cn.bugstack.ai.domain.trading.service.IOrderExpiryHandler;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBlockingDeque;
import org.redisson.api.RDelayedQueue;
import org.redisson.client.codec.StringCodec;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 基于 Redisson RDelayedQueue 的精准订单超时关闭协调器；
 * 仅在事务提交后投递延时消息，由后台守护线程触发幂等关单，仍保留 OrderExpiryJob 作为兜底扫描。
 */
@Slf4j
@Component
public class OrderDelayCoordinator implements IOrderDelayScheduler {

    private final ObjectProvider<RedisClients> clients;
    private final ObjectProvider<IOrderExpiryHandler> expiryHandler;
    private final ObjectProvider<ICampusRedisPort> redisHub;

    @Value("${campus.jobs.enabled:true}")
    private boolean jobsEnabled = true;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile Thread worker;
    private volatile RBlockingDeque<String> blockingDeque;
    private volatile RDelayedQueue<String> delayedQueue;

    public OrderDelayCoordinator(
        ObjectProvider<RedisClients> clients,
        ObjectProvider<IOrderExpiryHandler> expiryHandler,
        ObjectProvider<ICampusRedisPort> redisHub
    ) {
        this.clients = clients;
        this.expiryHandler = expiryHandler;
        this.redisHub = redisHub;
    }

    @PostConstruct
    public void start() {
        ICampusRedisPort hub = redisHub == null ? null : redisHub.getIfAvailable();
        if (hub != null) {
            hub.setDelayedExpiryQueueSizeSupplier(this::queueSize);
        }
        RedisClients redis = clients == null ? null : clients.getIfAvailable();
        if (!jobsEnabled || redis == null) return;
        try {
            String key = redis.namespace() + ":delay:order-expire";
            blockingDeque = redis.cache().getBlockingDeque(key, StringCodec.INSTANCE);
            delayedQueue = redis.cache().getDelayedQueue(blockingDeque);
            running.set(true);
            worker = new Thread(this::pollLoop, "order-delay-expiry");
            worker.setDaemon(true);
            worker.start();
        } catch (RuntimeException error) {
            log.warn("order_delay_coordinator_start_degraded error={}", error.getClass().getSimpleName());
        }
    }

    @PreDestroy
    public void stop() {
        running.set(false);
        Thread t = worker;
        if (t != null) t.interrupt();
        RDelayedQueue<String> dq = delayedQueue;
        if (dq != null) {
            try {
                dq.destroy();
            } catch (RuntimeException ignored) {}
        }
    }

    @Override
    public void scheduleOrderExpiryAfterCommit(String orderId, long delaySeconds) {
        if (orderId == null || orderId.isBlank()) return;
        long effectiveDelay = Math.max(1, delaySeconds);
        Runnable offerTask = () -> offerNow(orderId, effectiveDelay);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        offerTask.run();
                    }
                }
            );
        } else {
            offerTask.run();
        }
    }

    public void offerNow(String orderId, long delaySeconds) {
        RDelayedQueue<String> dq = ensureQueue();
        if (dq == null) return;
        try {
            dq.offer(orderId, Math.max(1, delaySeconds), TimeUnit.SECONDS);
        } catch (RuntimeException error) {
            log.warn("order_delay_offer_degraded orderId={} error={}", orderId, error.getClass().getSimpleName());
        }
    }

    @Override
    public void cancelOrderExpiryAfterCommit(String orderId) {
        if (orderId == null || orderId.isBlank()) return;
        Runnable cancelTask = () -> cancelNow(orderId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        cancelTask.run();
                    }
                }
            );
        } else {
            cancelTask.run();
        }
    }

    /** 订单已支付、取消或关闭后立即移除延时队列与就绪队列中的残留任务，避免遥测虚高。 */
    public void cancelNow(String orderId) {
        if (orderId == null || orderId.isBlank()) return;
        RDelayedQueue<String> dq = ensureQueue();
        if (dq == null) return;
        try {
            dq.remove(orderId);
            RBlockingDeque<String> deque = blockingDeque;
            if (deque != null) {
                deque.remove(orderId);
            }
        } catch (RuntimeException error) {
            log.warn("order_delay_cancel_degraded orderId={} error={}", orderId, error.getClass().getSimpleName());
        }
    }

    public long queueSize() {
        RDelayedQueue<String> dq = delayedQueue;
        if (dq == null) return 0L;
        try {
            return dq.size();
        } catch (RuntimeException ignored) {
            return 0L;
        }
    }

    private RDelayedQueue<String> ensureQueue() {
        if (delayedQueue != null) return delayedQueue;
        RedisClients redis = clients == null ? null : clients.getIfAvailable();
        if (redis == null) return null;
        try {
            String key = redis.namespace() + ":delay:order-expire";
            blockingDeque = redis.cache().getBlockingDeque(key, StringCodec.INSTANCE);
            delayedQueue = redis.cache().getDelayedQueue(blockingDeque);
            return delayedQueue;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private void pollLoop() {
        while (running.get() && !Thread.currentThread().isInterrupted()) {
            try {
                RBlockingDeque<String> deque = blockingDeque;
                if (deque == null) break;
                String orderId = deque.poll(2, TimeUnit.SECONDS);
                if (orderId != null && !orderId.isBlank()) {
                    IOrderExpiryHandler handler = expiryHandler.getIfAvailable();
                    if (handler != null) {
                        try {
                            handler.expire(orderId);
                        } catch (Exception error) {
                            log.warn("order_delay_expire_failed orderId={} error={}", orderId, error.getClass().getSimpleName());
                        }
                    }
                }
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                break;
            } catch (RuntimeException error) {
                try {
                    Thread.sleep(3000L);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
    }
}
