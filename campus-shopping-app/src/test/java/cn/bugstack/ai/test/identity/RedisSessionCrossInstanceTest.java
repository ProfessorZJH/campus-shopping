package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.infrastructure.redis.RedisClients;
import com.fasterxml.jackson.databind.*;
import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;

@EnabledIfEnvironmentVariable(named = "REDIS_TEST_ADDRESS", matches = ".+")
class RedisSessionCrossInstanceTest {

  private final ObjectMapper mapper = new ObjectMapper();
  private final HttpClient client = HttpClient.newBuilder()
    .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
    .build();

  @Test
  void cookieLoginCsrfLogoutAndDependencyFailureAcrossTwoInstances() throws Exception {
    String address = System.getenv("REDIS_TEST_ADDRESS");
    String namespace = "cs:test:session:" + UUID.randomUUID();
    String[] options = {
      "--spring.profiles.active=session-test",
      "--server.port=0",
      "--campus.redis.enabled=true",
      "--campus.redis.namespace=" + namespace,
      "--campus.redis.security-address=" + address,
      "--campus.redis.cache-address=" + address,
      "--campus.redis.security-password=" + System.getenv().getOrDefault("REDIS_TEST_PASSWORD", ""),
      "--campus.redis.cache-password=" + System.getenv().getOrDefault("REDIS_TEST_PASSWORD", ""),
    };
    try (
      var a = (ServletWebServerApplicationContext) new SpringApplicationBuilder(
        Application.class
      ).run(options);
      var b = (ServletWebServerApplicationContext) new SpringApplicationBuilder(
        Application.class
      ).run(options)
    ) {
      a.getBean(IUserAccountService.class).register(
        "redisuser",
        "Redis-test-password-123!",
        "Redis测试"
      );
      String ua = "http://127.0.0.1:" + a.getWebServer().getPort(),
        ub = "http://127.0.0.1:" + b.getWebServer().getPort();
      String oldToken = mapper
        .readTree(get(ua + "/api/v1/auth/csrf").body())
        .at("/data/token")
        .asText();
      String beforeCookie = cookie();
      var login = post(
        ua + "/api/v1/auth/login",
        oldToken,
        mapper.writeValueAsString(
          Map.of("username", "redisuser", "password", "Redis-test-password-123!")
        )
      );
      assertEquals("0000", mapper.readTree(login.body()).path("code").asText());
      String authenticatedCookie = cookie();
      assertNotEquals(beforeCookie, authenticatedCookie);
      assertEquals(
        "0000",
        mapper
          .readTree(get(ub + "/api/v1/auth/me").body())
          .path("code")
          .asText()
      );
      assertEquals(403, post(ub + "/api/v1/auth/logout", oldToken, "{}").statusCode());
      String token = mapper
        .readTree(get(ub + "/api/v1/auth/csrf").body())
        .at("/data/token")
        .asText();
      assertEquals(
        "0000",
        mapper
          .readTree(post(ub + "/api/v1/auth/logout", token, "{}").body())
          .path("code")
          .asText()
      );
      assertEquals(401, get(ua + "/api/v1/auth/me").statusCode());
      assertEquals(
        401,
        HttpClient.newHttpClient()
          .send(
            HttpRequest.newBuilder(URI.create(ua + "/api/v1/auth/me"))
              .header("Cookie", authenticatedCookie)
              .GET()
              .build(),
            HttpResponse.BodyHandlers.ofString()
          )
          .statusCode()
      );
      get(ua + "/api/v1/auth/csrf");
      a.getBean(RedisClients.class).security().shutdown();
      assertEquals(503, get(ua + "/api/v1/auth/csrf").statusCode());
    }
  }

  HttpResponse<String> get(String url) throws Exception {
    return client.send(
      HttpRequest.newBuilder(URI.create(url)).GET().build(),
      HttpResponse.BodyHandlers.ofString()
    );
  }

  HttpResponse<String> post(String url, String token, String json) throws Exception {
    return client.send(
      HttpRequest.newBuilder(URI.create(url))
        .header("Content-Type", "application/json")
        .header("X-CSRF-TOKEN", token)
        .POST(HttpRequest.BodyPublishers.ofString(json))
        .build(),
      HttpResponse.BodyHandlers.ofString()
    );
  }

  String cookie() {
    return ((CookieManager) client.cookieHandler().orElseThrow())
      .getCookieStore()
      .getCookies()
      .stream()
      .filter(c -> c.getName().equals("JSESSIONID"))
      .map(c -> c.getName() + "=" + c.getValue())
      .findFirst()
      .orElse("");
  }
}
