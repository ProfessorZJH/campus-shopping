package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

public final class ProtectedQuotaFilter extends OncePerRequestFilter {

    private final IRequestQuotaRepository quotas;
    private final ObjectMapper mapper;
    private final boolean enabled;

    public ProtectedQuotaFilter(IRequestQuotaRepository quotas, ObjectMapper mapper, boolean enabled) {
        this.quotas = quotas;
        this.mapper = mapper;
        this.enabled = enabled;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest r) {
        return (
            !enabled ||
            !"POST".equals(r.getMethod()) ||
            !(r.getRequestURI().equals("/api/v1/ai/chat") || r.getRequestURI().matches("/api/v1/merchants/[^/]+/orders/[^/]+/verify"))
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest r, HttpServletResponse s, FilterChain chain) throws IOException, ServletException {
        var actor = r.getUserPrincipal();
        if (actor == null) {
            chain.doFilter(r, s);
            return;
        }
        boolean ai = r.getRequestURI().equals("/api/v1/ai/chat");
        long retry;
        try {
            retry = quotas.acquire(ai ? "ai-user" : "pickup-user", actor.getName(), ai ? 10 : 60, 60);
            if (retry == 0) retry = quotas.acquire(ai ? "ai-global" : "pickup-merchant", ai ? "all" : r.getRequestURI().split("/")[4], ai ? 120 : 300, 60);
        } catch (RuntimeException error) {
            ApiErrorWriter.write(mapper, s, 503, ResponseCode.UN_ERROR);
            return;
        }
        if (retry > 0) {
            s.setHeader("Retry-After", Long.toString(retry));
            ApiErrorWriter.write(mapper, s, 429, ResponseCode.AUTH_RATE_LIMITED);
            return;
        }
        chain.doFilter(r, s);
    }
}
