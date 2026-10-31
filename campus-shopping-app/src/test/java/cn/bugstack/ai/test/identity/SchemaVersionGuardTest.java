package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.config.SchemaVersionGuard;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class SchemaVersionGuardTest {

  @Test
  void missingHistoryDoesNotMutateDatabaseAndStopsStartup() throws Exception {
    var source = new DriverManagerDataSource(
      "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1",
      "sa",
      ""
    );
    var guard = new SchemaVersionGuard(source, new ObjectMapper());
    assertThrows(IllegalStateException.class, () -> guard.run(null));
    assertEquals(
      0,
      new JdbcTemplate(source).queryForObject(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='SYS_SCHEMA_MIGRATION'",
        Integer.class
      )
    );
  }

  @Test
  void acceptsExactVersionsAndRejectsMissingChangedOrNewerHistory() throws Exception {
    var source = new DriverManagerDataSource(
      "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1",
      "sa",
      ""
    );
    var jdbc = new JdbcTemplate(source);
    jdbc.execute(
      "CREATE TABLE sys_schema_migration(version VARCHAR(32) PRIMARY KEY, checksum CHAR(64))"
    );
    var mapper = new ObjectMapper();
    try (var input = new ClassPathResource("database-manifest.json").getInputStream()) {
      for (var entry : mapper.readTree(input).get("migrations")) {
        jdbc.update(
          "INSERT INTO sys_schema_migration VALUES(?,?)",
          entry.get("version").asText(),
          entry.get("sha256").asText()
        );
      }
    }
    var guard = new SchemaVersionGuard(source, mapper);
    assertDoesNotThrow(() -> guard.run(null));
    jdbc.update("INSERT INTO sys_schema_migration VALUES('future',REPEAT('0',64))");
    assertThrows(IllegalStateException.class, () -> guard.run(null));
    jdbc.update("DELETE FROM sys_schema_migration WHERE version='future'");
    jdbc.update(
      "UPDATE sys_schema_migration SET checksum=REPEAT('0',64) WHERE version='V20261028_01'"
    );
    assertThrows(IllegalStateException.class, () -> guard.run(null));
    jdbc.update("DELETE FROM sys_schema_migration WHERE version='V20261028_01'");
    assertThrows(IllegalStateException.class, () -> guard.run(null));
  }
}
