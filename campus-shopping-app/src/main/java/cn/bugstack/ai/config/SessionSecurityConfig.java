package cn.bugstack.ai.config;

import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.trigger.http.AccountStatusFilter;
import cn.bugstack.ai.trigger.http.AuthenticationRateFilter;
import cn.bugstack.ai.trigger.http.RequestBodyLimitFilter;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.logout.*;
import org.springframework.security.web.authentication.session.*;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.*;

/** 同源 Cookie Session 认证：不混用内存 Basic 账号和 JWT。 */
@Configuration
public class SessionSecurityConfig {

  @org.springframework.beans.factory.annotation.Value("${campus.security.rate-limit-enabled:true}")
  private boolean rateLimitEnabled;

  @Bean
  public SecurityContextRepository securityContextRepository() {
    HttpSessionSecurityContextRepository repository = new HttpSessionSecurityContextRepository();
    repository.setDisableUrlRewriting(true);
    return repository;
  }

  @Bean
  public CsrfTokenRepository csrfTokenRepository() {
    return new HttpSessionCsrfTokenRepository();
  }

  @Bean
  public SessionAuthenticationStrategy sessionAuthenticationStrategy(
    CsrfTokenRepository csrfTokenRepository
  ) {
    return new CompositeSessionAuthenticationStrategy(
      List.of(
        new ChangeSessionIdAuthenticationStrategy(),
        new CsrfAuthenticationStrategy(csrfTokenRepository)
      )
    );
  }

  @Bean
  public LogoutHandler sessionLogoutHandler(
    SecurityContextRepository repository,
    CsrfTokenRepository csrfTokenRepository
  ) {
    SecurityContextLogoutHandler contextHandler = new SecurityContextLogoutHandler();
    contextHandler.setSecurityContextRepository(repository);
    return new CompositeLogoutHandler(
      new CsrfLogoutHandler(csrfTokenRepository),
      contextHandler,
      new CookieClearingLogoutHandler("JSESSIONID")
    );
  }

  @Bean
  public SecurityFilterChain securityFilterChain(
    HttpSecurity http,
    SecurityContextRepository repository,
    CsrfTokenRepository csrfRepository,
    LogoutHandler sessionLogoutHandler,
    IUserAccountService accountService,
    ObjectMapper mapper,
    cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository quotas
  ) throws Exception {
    return http
      .securityContext(s -> s.securityContextRepository(repository).requireExplicitSave(true))
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
      // 登录、注册也保留 CSRF 校验，不使用 permitAll 代替安全校验。
      .csrf(c -> c.csrfTokenRepository(csrfRepository))
      .headers(h ->
        h.contentSecurityPolicy(c ->
          c.policyDirectives(
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
          )
        )
      )
      .requestCache(AbstractHttpConfigurer::disable)
      .formLogin(AbstractHttpConfigurer::disable)
      .httpBasic(AbstractHttpConfigurer::disable)
      // 退出统一从 IAuthApi 对应 Controller 进入，复用框架 LogoutHandler。
      .logout(AbstractHttpConfigurer::disable)
      .authorizeHttpRequests(a ->
        a
          .dispatcherTypeMatchers(DispatcherType.ERROR)
          .permitAll()
          .requestMatchers(
            HttpMethod.GET,
            "/",
            "/index.html",
            "/legacy.html",
            "/ui.bundle.js",
            "/src/**",
            "/vendor/**",
            "/images/**",
            "/assets/**",
            "/media/**",
            "/favicon.ico"
          )
          .permitAll()
          .requestMatchers(
            HttpMethod.GET,
            "/api/v1/auth/csrf",
            "/api/v1/products",
            "/api/v1/products/*",
            "/api/v1/categories",
            "/api/v1/merchants/public",
            "/api/v1/merchants/public/page",
            "/api/v1/merchants/public/{merchantId}"
          )
          .permitAll()
          .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login")
          .anonymous()
          .requestMatchers("/api/v1/**")
          .authenticated()
          .anyRequest()
          .denyAll()
      )
      .exceptionHandling(e ->
        e
          .authenticationEntryPoint((request, response, exception) ->
            writeError(mapper, response, 401, ResponseCode.AUTH_UNAUTHENTICATED)
          )
          .accessDeniedHandler((request, response, exception) ->
            writeError(
              mapper,
              response,
              403,
              exception instanceof CsrfException
                ? ResponseCode.AUTH_CSRF_INVALID
                : ResponseCode.AUTH_FORBIDDEN
            )
          )
      )
      .addFilterBefore(new RequestBodyLimitFilter(mapper), CsrfFilter.class)
      .addFilterBefore(
        new AuthenticationRateFilter(mapper, rateLimitEnabled, quotas),
        CsrfFilter.class
      )
      .addFilterBefore(
        new AccountStatusFilter(accountService, sessionLogoutHandler, mapper),
        AuthorizationFilter.class
      )
      .addFilterAfter(
        new cn.bugstack.ai.trigger.http.ProtectedQuotaFilter(quotas, mapper, rateLimitEnabled),
        AuthorizationFilter.class
      )
      .build();
  }

  private void writeError(
    ObjectMapper mapper,
    HttpServletResponse response,
    int status,
    ResponseCode code
  ) throws IOException {
    response.setStatus(status);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    mapper.writeValue(
      response.getWriter(),
      Response.<Void>builder().code(code.getCode()).info(code.getInfo()).build()
    );
  }
}
