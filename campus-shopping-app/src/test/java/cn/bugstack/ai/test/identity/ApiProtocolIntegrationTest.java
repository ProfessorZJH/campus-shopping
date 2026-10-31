package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import cn.bugstack.ai.Application;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** 真实 MVC/Security + 两种真实 TCP 上传；业务失败仍由 Controller 自行封装。 */
@SpringBootTest(
  classes = Application.class,
  webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@AutoConfigureMockMvc
@ActiveProfiles("session-test")
class ApiProtocolIntegrationTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper mapper;

  @Autowired
  JdbcTemplate jdbc;

  @LocalServerPort
  int port;

  private static final String ACTOR = "protocol-audit-user";

  @BeforeEach
  void seed() {
    jdbc.update("DELETE FROM iam_user WHERE id=?", ACTOR);
    jdbc.update(
      "INSERT INTO iam_user(id,username,password_hash,display_name,status) VALUES(?,?,?,?,?)",
      ACTOR,
      ACTOR,
      "unused-test-hash",
      "协议测试用户",
      "ACTIVE"
    );
  }

  @Test
  void malformedJsonAndTrailingJsonHaveSafeEnvelopes() throws Exception {
    for (String body : new String[] { "{\"password\":\"private-body\",", "{} {}", "null", "" }) {
      mvc
        .perform(
          post("/api/v1/auth/register").with(csrf()).contentType("application/json").content(body)
        )
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("0002"))
        .andExpect(jsonPath("$.info").value("非法参数"))
        .andExpect(
          content().string(
            org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private-body"))
          )
        );
    }
  }

  @Test
  void fractionalQuantitiesAndAmountsCannotBeTruncated() throws Exception {
    for (String body : new String[] {
      "{\"skuId\":\"sku\",\"quantity\":1.5}",
      "{\"skuId\":\"sku\",\"quantity\":2147483648}",
    }) {
      mvc
        .perform(
          put("/api/v1/cart")
            .with(user(ACTOR))
            .with(csrf())
            .contentType("application/json")
            .content(body)
        )
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("0002"));
    }
    mvc
      .perform(
        put("/api/v1/merchants/m/products/p/skus/s/price")
          .with(user(ACTOR))
          .with(csrf())
          .contentType("application/json")
          .content("{\"priceCent\":123.9,\"expectedVersion\":0}")
      )
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.code").value("0002"));
  }

  @Test
  void queryBindingAndUnsupportedProtocolsHaveEnvelopes() throws Exception {
    mvc
      .perform(get("/api/v1/products/page").param("size", "abc"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.code").value("0002"));
    mvc
      .perform(patch("/api/v1/auth/csrf").with(user(ACTOR)).with(csrf()))
      .andExpect(status().isMethodNotAllowed())
      .andExpect(jsonPath("$.code").value("G0005"))
      .andExpect(header().string("Allow", org.hamcrest.Matchers.containsString("GET")));
    mvc
      .perform(post("/api/v1/auth/register").with(csrf()).contentType("text/plain").content("{}"))
      .andExpect(status().isUnsupportedMediaType())
      .andExpect(jsonPath("$.code").value("G0006"));
    mvc
      .perform(get("/api/v1/auth/csrf").accept("text/plain"))
      .andExpect(status().isNotAcceptable())
      .andExpect(jsonPath("$.code").value("G0007"));
    mvc
      .perform(get("/api/v1/absent-audit-route").with(user(ACTOR)))
      .andExpect(status().isNotFound())
      .andExpect(jsonPath("$.code").value("G0001"));
  }

  @Test
  void controllerBusinessValidationKeepsHttp200() throws Exception {
    mvc
      .perform(
        put("/api/v1/cart")
          .with(user(ACTOR))
          .with(csrf())
          .contentType("application/json")
          .content("{\"quantity\":1}")
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.code").value("0002"));
    mvc
      .perform(
        post("/api/v1/auth/register").with(csrf()).contentType("application/json").content("{}")
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.code").value("0002"));
  }

  @Test
  void knownLengthOversizeRequestReturnsJsonThroughRealTomcat() throws Exception {
    assertUploadLimit(false);
  }

  @Test
  void chunkedOversizeRequestReturns413InsteadOf400ThroughRealTomcat() throws Exception {
    assertUploadLimit(true);
  }

  private void assertUploadLimit(boolean chunked) throws Exception {
    HttpClient client = HttpClient.newBuilder()
      .version(HttpClient.Version.HTTP_1_1)
      .connectTimeout(Duration.ofSeconds(5))
      .cookieHandler(new CookieManager())
      .build();
    URI csrfUri = URI.create("http://127.0.0.1:" + port + "/api/v1/auth/csrf");
    JsonNode token = mapper
      .readTree(
        client
          .send(HttpRequest.newBuilder(csrfUri).GET().build(), HttpResponse.BodyHandlers.ofString())
          .body()
      )
      .get("data");
    byte[] body = ("{\"username\":\"" + "a".repeat(3_000_000) + "\"}").getBytes(
      StandardCharsets.UTF_8
    );
    HttpRequest.BodyPublisher publisher = chunked
      ? HttpRequest.BodyPublishers.ofInputStream(() -> new ByteArrayInputStream(body))
      : HttpRequest.BodyPublishers.ofByteArray(body);
    assertEquals(chunked ? -1 : body.length, publisher.contentLength());
    var request = HttpRequest.newBuilder(
      URI.create("http://127.0.0.1:" + port + "/api/v1/auth/register")
    )
      .timeout(Duration.ofSeconds(15))
      .header("Content-Type", "application/json")
      .header(token.get("headerName").asText(), token.get("token").asText())
      .POST(publisher)
      .build();
    var response = client.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(413, response.statusCode(), response.body());
    assertEquals("G0004", mapper.readTree(response.body()).get("code").asText());
    assertTrue(
      response.headers().firstValue("content-type").orElse("").startsWith("application/json")
    );
  }
}
