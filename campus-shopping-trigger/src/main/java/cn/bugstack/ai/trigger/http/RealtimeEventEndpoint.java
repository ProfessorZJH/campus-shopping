package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.actor;

import cn.bugstack.ai.cases.merchant.IWorkspaceQueryCase;
import cn.bugstack.ai.domain.identity.adapter.port.ICampusRedisPort;
import java.security.Principal;
import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** 实时订单/备货状态推送 SSE 入口（基于 Redis RTopic 跨实例广播，无 Redis 时单实例本地分发）。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class RealtimeEventEndpoint {

    @Autowired(required = false)
    private ICampusRedisPort redisHub;

    @Autowired(required = false)
    private IWorkspaceQueryCase workspaceQuery;

    @GetMapping(value = "/events/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(Principal principal) {
        String userId = actor(principal);
        Set<String> channels = new HashSet<>();
        channels.add("user:" + userId);
        if (workspaceQuery != null) {
            try {
                var ws = workspaceQuery.workspace(userId);
                if (ws != null && ws.memberships() != null) {
                    ws.memberships()
                        .stream()
                        .filter(m -> "ACTIVE".equals(m.status()))
                        .forEach(m -> channels.add("merchant:" + m.merchantId()));
                }
            } catch (RuntimeException ignored) {}
        }
        SseEmitter emitter = new SseEmitter(300_000L);
        AtomicBoolean closed = new AtomicBoolean(false);
        AutoCloseable subscription =
            redisHub == null
                ? null
                : redisHub.subscribeRealtimeEvents((channelKey, payload) -> {
                      if (closed.get() || !channels.contains(channelKey)) return;
                      try {
                          String eventName = String.valueOf(payload.getOrDefault("type", "event"));
                          emitter.send(SseEmitter.event().name(eventName).data(payload));
                      } catch (Exception ignored) {
                          closed.set(true);
                          emitter.complete();
                      }
                  });
        Runnable cleanup = () -> {
            if (closed.compareAndSet(false, true) && subscription != null) {
                try {
                    subscription.close();
                } catch (Exception ignored) {}
            }
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(() -> {
            cleanup.run();
            emitter.complete();
        });
        emitter.onError(e -> cleanup.run());
        try {
            emitter.send(
                SseEmitter.event()
                    .name("connected")
                    .data(Map.of("userId", userId, "connectedAt", Instant.now().toString()))
            );
        } catch (Exception ignored) {
            cleanup.run();
            emitter.complete();
        }
        return emitter;
    }
}
