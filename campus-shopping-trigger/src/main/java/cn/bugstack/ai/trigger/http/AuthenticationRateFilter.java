package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/** 来源限流不信任 X-Forwarded-For；运行中 Redis 故障不得绕过校验。 */
public final class AuthenticationRateFilter extends OncePerRequestFilter {

    private final ObjectMapper mapper;
    private final boolean enabled;
    private final IRequestQuotaRepository quotas;

    public AuthenticationRateFilter(ObjectMapper mapper, boolean enabled, IRequestQuotaRepository quotas) {
        this.mapper = mapper;
        this.enabled = enabled;
        this.quotas = quotas;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest r) {
        return (
            !enabled ||
            !"POST".equals(r.getMethod()) ||
            !(RequestPath.applicationPath(r).equals("/api/v1/auth/login") || RequestPath.applicationPath(r).equals("/api/v1/auth/register"))
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        boolean register = RequestPath.applicationPath(request).endsWith("register");
        long retry;
        try {
            retry = quotas.acquire(register ? "register-source" : "login-source", request.getRemoteAddr(), register ? 30 : 300, register ? 300 : 60);
        } catch (RuntimeException error) {
            ApiErrorWriter.write(mapper, response, 503, ResponseCode.UN_ERROR);
            return;
        }
        if (retry > 0) {
            response.setHeader("Retry-After", Long.toString(retry));
            ApiErrorWriter.write(mapper, response, 429, ResponseCode.AUTH_RATE_LIMITED);
            return;
        }
        chain.doFilter(request, response);
    }
}
