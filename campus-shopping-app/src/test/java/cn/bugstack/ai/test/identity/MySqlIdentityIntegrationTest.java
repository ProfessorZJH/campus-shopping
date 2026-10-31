package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.types.exception.AppException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** 真实 MySQL 测试：必须显式设置专用测试库，未配置时标记跳过。 */
@SpringBootTest(
  classes = Application.class,
  properties = { "campus.jobs.enabled=false", "campus.bootstrap.enabled=false" }
)
@ActiveProfiles("mysql-integration")
@EnabledIfEnvironmentVariable(named = "MYSQL_TEST_URL", matches = ".+")
class MySqlIdentityIntegrationTest {

  @Autowired
  IUserAccountService service;

  @Autowired
  JdbcTemplate jdbc;

  private final String username =
    "it" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  private static final String PASSWORD = "Test-only-password-123!";

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    String url = System.getenv("MYSQL_TEST_URL");
    if (url == null || !url.matches("jdbc:mysql://[^/]+/campus_shopping_it(?:\\?.*)?")) {
      throw new IllegalStateException("只允许连接专用测试库 campus_shopping_it");
    }
    String user = System.getenv("MYSQL_TEST_USERNAME");
    String password = System.getenv("MYSQL_TEST_PASSWORD");
    if (user == null || password == null) throw new IllegalStateException("缺少测试库凭据");
    registry.add("spring.datasource.url", () -> url);
    registry.add("spring.datasource.username", () -> user);
    registry.add("spring.datasource.password", () -> password);
    registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
    registry.add("spring.sql.init.mode", () -> "always");
    registry.add("spring.sql.init.schema-locations", () -> "classpath:schema.sql");
    registry.add("spring.sql.init.data-locations", () -> "classpath:data.sql");
  }

  @AfterEach
  void removeOwnFixtureOnly() {
    jdbc.update("DELETE FROM iam_user WHERE username=?", username);
  }

  @Test
  void registerAndAuthenticateThroughActualMySql() {
    var user = service.register(username, PASSWORD, "数据库测试");
    assertEquals(user.getUserId(), service.authenticate(username, PASSWORD).getUserId());
    assertEquals(user.getUserId(), service.requireActive(user.getUserId()).getUserId());
    assertNotEquals(
      PASSWORD,
      jdbc.queryForObject(
        "SELECT password_hash FROM iam_user WHERE id=?",
        String.class,
        user.getUserId()
      )
    );
  }

  @Test
  void concurrentRegistrationCreatesExactlyOneRow() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    Callable<String> command = () -> {
      ready.countDown();
      if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("并发启动超时");
      try {
        service.register(username, PASSWORD, "并发测试");
        return "0000";
      } catch (AppException e) {
        return e.getCode();
      }
    };
    try {
      Future<String> first = pool.submit(command);
      Future<String> second = pool.submit(command);
      assertTrue(ready.await(10, TimeUnit.SECONDS));
      start.countDown();
      List<String> codes = List.of(
        first.get(30, TimeUnit.SECONDS),
        second.get(30, TimeUnit.SECONDS)
      );
      assertEquals(1, codes.stream().filter("0000"::equals).count());
      assertEquals(1, codes.stream().filter("A0001"::equals).count());
      assertEquals(
        1,
        jdbc.queryForObject(
          "SELECT COUNT(*) FROM iam_user WHERE username=?",
          Integer.class,
          username
        )
      );
    } finally {
      start.countDown();
      pool.shutdownNow();
    }
  }

  @Test
  void currentAccountStatusIsReadFromActualDatabase() {
    var user = service.register(username, PASSWORD, "状态测试");
    jdbc.update(
      "UPDATE iam_user SET status='DISABLED', version=version+1 WHERE id=?",
      user.getUserId()
    );
    assertEquals(
      "A0003",
      assertThrows(AppException.class, () -> service.requireActive(user.getUserId())).getCode()
    );
  }
}
