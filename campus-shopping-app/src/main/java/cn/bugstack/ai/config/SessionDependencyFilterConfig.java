package cn.bugstack.ai.config;

import cn.bugstack.ai.api.response.Response;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SessionDependencyFilterConfig {

  @Bean
  public FilterRegistrationBean<OncePerRequestFilter> sessionDependencyBoundary(
    ObjectMapper mapper
  ) {
    var registration = new FilterRegistrationBean<OncePerRequestFilter>();
    registration.setFilter(
      new OncePerRequestFilter() {
        @Override
        protected void doFilterInternal(
          HttpServletRequest request,
          HttpServletResponse response,
          FilterChain chain
        ) throws ServletException, IOException {
          try {
            chain.doFilter(request, response);
          } catch (RuntimeException error) {
            Throwable cause = error;
            boolean redis = false;
            for (int i = 0; cause != null && i < 20; i++, cause = cause.getCause()) redis |=
              cause.getClass().getName().startsWith("org.redisson.") ||
              cause instanceof org.springframework.data.redis.RedisConnectionFailureException;
            if (!redis || response.isCommitted()) throw error;
            response.reset();
            response.setStatus(503);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            mapper.writeValue(
              response.getWriter(),
              Response.builder().code("0001").info("系统暂不可用").build()
            );
          }
        }
      }
    );
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
    return registration;
  }
}
