package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 已登录用户的账号状态复验。
 * 仅由安全过滤器链装配，不标记 Component，避免 Servlet 容器重复注册。
 */
@Slf4j
public class AccountStatusFilter extends OncePerRequestFilter {

    private final IUserAccountService accountService;
    private final LogoutHandler logoutHandler;
    private final ObjectMapper objectMapper;

    public AccountStatusFilter(IUserAccountService accountService, LogoutHandler logoutHandler, ObjectMapper objectMapper) {
        this.accountService = accountService;
        this.logoutHandler = logoutHandler;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // 账号已停用时仍允许主动退出，CSRF 仍由前置过滤器检查。
        return "POST".equals(request.getMethod()) && (request.getContextPath() + "/api/v1/auth/logout").equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            try {
                accountService.requireActive(auth.getName());
            } catch (AppException e) {
                logoutHandler.logout(request, response, auth);
                int status = ResponseCode.AUTH_ACCOUNT_DISABLED.getCode().equals(e.getCode()) ? 403 : 401;
                reject(response, status, e.getCode(), e.getInfo());
                return;
            } catch (RuntimeException e) {
                // 数据库不可用时失败关闭，不能绕过账号状态校验。
                log.error("账号状态复验失败", e);
                reject(response, 503, ResponseCode.UN_ERROR.getCode(), "认证服务暂不可用");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, int status, String code, String info) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), Response.<Void>builder().code(code).info(info).build());
    }
}
