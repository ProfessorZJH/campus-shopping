package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.api.IAuthApi;
import cn.bugstack.ai.api.dto.RegisterRequestDTO;
import cn.bugstack.ai.api.dto.RegisterResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import cn.bugstack.ai.api.dto.LoginRequestDTO;
import cn.bugstack.ai.api.dto.CurrentUserResponseDTO;
import cn.bugstack.ai.api.dto.CsrfTokenResponseDTO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.security.web.csrf.CsrfToken;
import java.security.Principal;

/**
 * 用户认证 HTTP 入口，参照 group-buy-market：API 接口由 Trigger 实现。
 * 账号校验交给领域服务，会话持久化使用 Spring Security。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController implements IAuthApi {

    @Resource
    private IUserAccountService userAccountService;

    // Spring 注入的是当前请求的代理，不是在单例中缓存用户请求。
    @Resource
    private HttpServletRequest servletRequest;
    @Resource
    private HttpServletResponse servletResponse;
    @Resource
    private SecurityContextRepository securityContextRepository;
    @Resource
    private SessionAuthenticationStrategy sessionAuthenticationStrategy;
    @Resource(name = "sessionLogoutHandler")
    private LogoutHandler logoutHandler;

    @Override
    @PostMapping("/register")
    public Response<RegisterResponseDTO> register(@RequestBody RegisterRequestDTO request) {
        try {
            if (request == null) {
                throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
            }
            // 绝对不要记录 request 整体：它包含明文密码。
            UserAccountAggregate account = userAccountService.register(
                    request.getUsername(), request.getPassword(), request.getDisplayName());

            log.info("用户注册成功 userId={}", account.getUserId());
            RegisterResponseDTO dto = RegisterResponseDTO.builder()
                    .userId(account.getUserId())
                    .build();
            return Response.<RegisterResponseDTO>builder()
                    .code(ResponseCode.SUCCESS.getCode())
                    .info(ResponseCode.SUCCESS.getInfo())
                    .data(dto)
                    .build();
        } catch (AppException e) {
            log.warn("用户注册业务失败 code={}", e.getCode());
            return Response.<RegisterResponseDTO>builder()
                    .code(e.getCode())
                    .info(e.getInfo())
                    .build();
        } catch (Exception e) {
            log.error("用户注册系统错误", e);
            return Response.<RegisterResponseDTO>builder()
                    .code(ResponseCode.UN_ERROR.getCode())
                    .info(ResponseCode.UN_ERROR.getInfo())
                    .build();
        }
    }

    @Override
    @PostMapping("/login")
    public Response<CurrentUserResponseDTO> login(@RequestBody LoginRequestDTO request) {
        try {
            if (request == null) {
                throw new AppException(ResponseCode.AUTH_BAD_CREDENTIALS);
            }
            // 1. 数据库凭据校验成功之前，不创建认证主体。
            UserAccountAggregate account = userAccountService.authenticate(
                    request.getUsername(), request.getPassword());
            // 2. Principal 使用稳定 userId，不使用可变显示名称；不保存密码。
            Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                    account.getUserId(), null, AuthorityUtils.createAuthorityList("ROLE_USER"));
            // 3. 更换会话 ID，清除登录前的 CSRF 令牌。
            sessionAuthenticationStrategy.onAuthentication(authentication, servletRequest, servletResponse);
            // 4. Spring Security 6 需显式保存上下文，不只是设置当前线程。
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            securityContextRepository.saveContext(context, servletRequest, servletResponse);
            log.info("用户登录成功 userId={}", account.getUserId());
            return success(toResponse(account));
        } catch (AppException e) {
            log.warn("登录失败 code={}", e.getCode());
            return failure(e.getCode(), e.getInfo());
        } catch (Exception e) {
            // 会话建立中途失败，清理可能已写入的认证上下文。
            logoutHandler.logout(servletRequest, servletResponse, SecurityContextHolder.getContext().getAuthentication());
            log.error("登录系统异常", e);
            return failure(ResponseCode.UN_ERROR.getCode(), ResponseCode.UN_ERROR.getInfo());
        }
    }

    @Override
    @GetMapping("/me")
    public Response<CurrentUserResponseDTO> me(Principal principal) {
        try {
            if (principal == null) {
                throw new AppException(ResponseCode.AUTH_UNAUTHENTICATED);
            }
            return success(toResponse(userAccountService.requireActive(principal.getName())));
        } catch (AppException e) {
            return failure(e.getCode(), e.getInfo());
        } catch (Exception e) {
            log.error("查询当前用户失败", e);
            return failure(ResponseCode.UN_ERROR.getCode(), ResponseCode.UN_ERROR.getInfo());
        }
    }

    @Override
    @PostMapping("/logout")
    public Response<Void> logout() {
        // SecurityContextLogoutHandler 清理会话，同时清理 CSRF 与 Cookie。
        logoutHandler.logout(servletRequest, servletResponse, SecurityContextHolder.getContext().getAuthentication());
        return success(null);
    }

    @Override
    @GetMapping("/csrf")
    public Response<CsrfTokenResponseDTO> csrf() {
        CsrfToken token = (CsrfToken) servletRequest.getAttribute(CsrfToken.class.getName());
        if (token == null) {
            throw new IllegalStateException("CSRF 过滤器未正确装配");
        }
        servletResponse.setHeader("Cache-Control", "no-store");
        return success(CsrfTokenResponseDTO.builder()
                .headerName(token.getHeaderName()).token(token.getToken()).build());
    }

    private CurrentUserResponseDTO toResponse(UserAccountAggregate account) {
        return CurrentUserResponseDTO.builder().userId(account.getUserId())
                .username(account.getUsername()).displayName(account.getDisplayName())
                .status(account.getStatus().getCode()).build();
    }

    private <T> Response<T> success(T data) {
        return Response.<T>builder().code(ResponseCode.SUCCESS.getCode())
                .info(ResponseCode.SUCCESS.getInfo()).data(data).build();
    }

    private <T> Response<T> failure(String code, String info) {
        return Response.<T>builder().code(code).info(info).build();
    }
}
