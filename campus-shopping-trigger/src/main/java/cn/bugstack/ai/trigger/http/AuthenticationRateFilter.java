package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.web.filter.OncePerRequestFilter;

/** 单实例的登录/注册入口限流，不相信客户端 X-Forwarded-For；生产多实例需要网关统一限流。 */
public final class AuthenticationRateFilter extends OncePerRequestFilter {

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong cleanup = new AtomicLong();
    private final ObjectMapper mapper;
    private final boolean enabled;

    public AuthenticationRateFilter(ObjectMapper mapper) {
        this(mapper, true);
    }

    public AuthenticationRateFilter(ObjectMapper mapper, boolean enabled) {
        this.mapper = mapper;
        this.enabled = enabled;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest r) {
        return (
            !enabled || !"POST".equals(r.getMethod()) || !(r.getRequestURI().equals("/api/v1/auth/login") || r.getRequestURI().equals("/api/v1/auth/register"))
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        long now = System.currentTimeMillis();
        if (now - cleanup.get() > 60000 && cleanup.getAndSet(now) < now - 60000) windows.entrySet().removeIf(e -> now - e.getValue().started > 300000);
        String key = request.getRemoteAddr() + ":" + request.getRequestURI();
        boolean register = request.getRequestURI().endsWith("register");
        int limit = register ? 10 : 30;
        long duration = register ? 300000 : 60000;
        if (!windows.containsKey(key) && windows.size() >= 10000) {
            reject(response, 60);
            return;
        }
        Window w = windows.compute(key, (k, v) -> v == null || now - v.started >= duration ? new Window(now) : v);
        synchronized (w) {
            if (++w.count > limit) {
                reject(response, Math.max(1, (duration - (now - w.started) + 999) / 1000));
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, long retrySeconds) throws IOException {
        response.setHeader("Retry-After", Long.toString(retrySeconds));
        ApiErrorWriter.write(mapper, response, 429, ResponseCode.AUTH_RATE_LIMITED);
    }

    private static final class Window {

        final long started;
        int count;

        Window(long started) {
            this.started = started;
        }
    }
}
