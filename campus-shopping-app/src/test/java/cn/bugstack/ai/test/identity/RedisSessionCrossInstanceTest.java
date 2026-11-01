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
@EnabledIfEnvironmentVariable(named = "REDIS_TEST_CACHE_ADDRESS", matches = ".+")
class RedisSessionCrossInstanceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();

    @Test
    void cookieLoginCsrfLogoutAndDependencyFailureAcrossTwoInstances() throws Exception {
        String address = System.getenv("REDIS_TEST_ADDRESS");
        String namespace = "cs:test:session:" + UUID.randomUUID();
        String[] options = {
            "--spring.profiles.active=session-test",
            "--server.port=0",
            "--server.servlet.context-path=/foo",
            "--server.servlet.session.timeout=30s",
            "--campus.security.rate-limit-enabled=true",
            "--campus.redis.enabled=true",
            "--campus.redis.namespace=" + namespace,
            "--campus.redis.security-address=" + address,
            "--campus.redis.cache-address=" + System.getenv("REDIS_TEST_CACHE_ADDRESS"),
            "--campus.redis.security-password=" + System.getenv().getOrDefault("REDIS_TEST_PASSWORD", ""),
            "--campus.redis.cache-password=" + System.getenv().getOrDefault("REDIS_TEST_PASSWORD", ""),
        };
        try (
            var a = (ServletWebServerApplicationContext) new SpringApplicationBuilder(Application.class).run(options);
            var b = (ServletWebServerApplicationContext) new SpringApplicationBuilder(Application.class).run(options)
        ) {
            a.getBean(IUserAccountService.class).register("redisuser", "Redis-test-password-123!", "Redis测试");
            String ua = "http://127.0.0.1:" + a.getWebServer().getPort() + "/foo",
                ub = "http://127.0.0.1:" + b.getWebServer().getPort() + "/foo";
            String oldToken = mapper
                .readTree(get(ua + "/api/v1/auth/csrf").body())
                .at("/data/token")
                .asText();
            String beforeCookie = cookie();
            var login = post(
                ua + "/api/v1/auth/login",
                oldToken,
                mapper.writeValueAsString(Map.of("username", "redisuser", "password", "Redis-test-password-123!"))
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
            String freshToken = mapper
                .readTree(get(ua + "/api/v1/auth/csrf").body())
                .at("/data/token")
                .asText();
            assertEquals(
                "0000",
                mapper
                    .readTree(
                        post(
                            ua + "/api/v1/auth/login",
                            freshToken,
                            mapper.writeValueAsString(Map.of("username", "redisuser", "password", "Redis-test-password-123!"))
                        ).body()
                    )
                    .path("code")
                    .asText()
            );
            String idleCookie = cookie();
            Thread.sleep(31200);
            for (String base : List.of(ua, ub)) {
                assertEquals(
                    401,
                    HttpClient.newHttpClient()
                        .send(
                            HttpRequest.newBuilder(URI.create(base + "/api/v1/auth/me"))
                                .header("Cookie", idleCookie)
                                .GET()
                                .build(),
                            HttpResponse.BodyHandlers.ofString()
                        )
                        .statusCode()
                );
            }
            // 来源配额在 CSRF 之前执行；非法 CSRF 请求避免密码校验耗时影响 300/60 限流验收，两个节点及 context-path 同时回归。
            String quotaToken = mapper
                .readTree(get(ua + "/api/v1/auth/csrf").body())
                .at("/data/token")
                .asText();
            int accepted = 0;
            int rejected = 0;
            var pool = java.util.concurrent.Executors.newFixedThreadPool(12);
            try {
                var requests = new ArrayList<java.util.concurrent.Future<HttpResponse<String>>>();
                for (int i = 0; i < 301; i++) {
                    final int index = i;
                    requests.add(
                        pool.submit(() ->
                            post(
                                (index % 2 == 0 ? ua : ub) + "/api/v1/auth/login",
                                "invalid-csrf-token",
                                "{}"
                            )
                        )
                    );
                }
                for (var request : requests) {
                    var response = request.get(30, java.util.concurrent.TimeUnit.SECONDS);
                    if (response.statusCode() == 429) {
                        assertLimited(response);
                        rejected++;
                    } else {
                        assertEquals(403, response.statusCode());
                        accepted++;
                    }
                }
            } finally {
                pool.shutdownNow();
            }
            // 首次两次真实登录可能在 60 秒窗口内，接受数应为 298～300。
            assertTrue(accepted >= 298 && accepted <= 300, "来源阈值必须为每分钟 300 次");
            assertEquals(301, accepted + rejected);
            assertTrue(rejected >= 1);
            for (int i = 0; i < 31; i++) {
                // 非法业务输入不创建用户，但仍必须受真实 HTTP 来源限流保护。
                var response = post((i % 2 == 0 ? ua : ub) + "/api/v1/auth/register", quotaToken, "{}");
                if (i < 30) {
                    assertEquals(200, response.statusCode());
                    assertNotEquals("0000", mapper.readTree(response.body()).path("code").asText());
                } else assertLimited(response);
            }
            a.getBean(RedisClients.class).cache().shutdown();
            assertEquals(200, get(ua + "/api/v1/auth/csrf").statusCode());
            a.getBean(RedisClients.class).security().shutdown();
            assertEquals(503, get(ua + "/api/v1/auth/csrf").statusCode());
        }
    }

    private void assertLimited(HttpResponse<String> response) throws Exception {
        assertNotNull(response);
        assertEquals(429, response.statusCode());
        assertEquals("A0007", mapper.readTree(response.body()).path("code").asText());
        assertTrue(Long.parseLong(response.headers().firstValue("Retry-After").orElseThrow()) > 0);
    }

    HttpResponse<String> get(String url) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(url)).GET().build(), HttpResponse.BodyHandlers.ofString());
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
