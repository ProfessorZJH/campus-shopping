package cn.bugstack.ai.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** 启动前核对已执行迁移，绝不在启动过程中执行旧库升级或写版本记录。 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnProperty(
  name = "campus.database.validate-schema",
  havingValue = "true",
  matchIfMissing = true
)
public class SchemaVersionGuard implements ApplicationRunner {

  private final JdbcTemplate jdbc;
  private final ObjectMapper mapper;

  public SchemaVersionGuard(DataSource dataSource, ObjectMapper mapper) {
    this.jdbc = new JdbcTemplate(dataSource);
    this.mapper = mapper;
  }

  @Override
  public void run(ApplicationArguments arguments) throws Exception {
    Map<String, String> expected = new HashMap<>();
    try (var input = new ClassPathResource("database-manifest.json").getInputStream()) {
      for (JsonNode entry : mapper.readTree(input).get("migrations")) {
        expected.put(entry.get("version").asText(), entry.get("sha256").asText());
      }
    }
    Map<String, String> actual = new HashMap<>();
    try {
      jdbc.query("SELECT version,checksum FROM sys_schema_migration", rs -> {
        actual.put(rs.getString("version"), rs.getString("checksum"));
      });
    } catch (org.springframework.dao.DataAccessException exception) {
      throw new IllegalStateException(
        "数据库缺少迁移记录；请按迁移手册运行 scripts/migrate-database.py 后再启动"
      );
    }
    if (!expected.equals(actual)) {
      throw new IllegalStateException(
        "数据库迁移版本/校验和与应用不一致，请先运行显式迁移命令，禁止跳过升级"
      );
    }
  }
}
