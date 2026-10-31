package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.config.ProductionSecurityGuard;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ProductionSecurityGuardTest {

    private MockEnvironment safe() {
        return new MockEnvironment()
            .withProperty("server.servlet.session.cookie.secure", "true")
            .withProperty("spring.datasource.url", "jdbc:mysql://mysql:3306/campus?sslMode=VERIFY_IDENTITY")
            .withProperty("campus.redis.enabled", "true")
            .withProperty("campus.redis.security-password", "test-only-security")
            .withProperty("campus.redis.cache-password", "test-only-cache")
            .withProperty("campus.redis.namespace", "cs:production");
    }

    @Test
    void productionRequiresTlsSecureCookieAndAuthenticatedRedis() {
        assertDoesNotThrow(() -> ProductionSecurityGuard.validate(safe()));
        for (String property : new String[] { "server.servlet.session.cookie.secure", "campus.redis.enabled" }) {
            assertThrows(IllegalStateException.class, () -> ProductionSecurityGuard.validate(safe().withProperty(property, "false")));
        }
        for (String property : new String[] { "campus.redis.security-password", "campus.redis.cache-password", "campus.redis.namespace" }) {
            assertThrows(IllegalStateException.class, () -> ProductionSecurityGuard.validate(safe().withProperty(property, "")));
        }
    }

    @Test
    void conflictingOrAmbiguousDatabasePropertiesCannotWeakenTls() {
        for (String suffix : new String[] {
            "useSSL=false",
            "sslMode=REQUIRED",
            "sslMode=VERIFY_CA",
            "sslMode=VERIFY_IDENTITY&sslmode=DISABLED",
            "sslMode=VERIFY_IDENTITY&allowPublicKeyRetrieval=true",
            "sslMode=VERIFY_IDENTITY&useSSL=false",
        }) {
            assertThrows(IllegalStateException.class, () ->
                ProductionSecurityGuard.validate(safe().withProperty("spring.datasource.url", "jdbc:mysql://mysql/campus?" + suffix))
            );
        }
    }
}
