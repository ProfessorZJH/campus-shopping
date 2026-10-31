package cn.bugstack.ai.config;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

/** 生产安全参数在创建服务前校验；错误消息不包含连接串或凭据。 */
@Configuration
@Profile("prod")
public class ProductionSecurityGuard {

    @Bean
    public static BeanFactoryPostProcessor productionSecurityValidation(Environment environment) {
        return beanFactory -> validate(environment);
    }

    public static void validate(Environment environment) {
        if (!environment.getProperty("server.servlet.session.cookie.secure", Boolean.class, false)) {
            throw new IllegalStateException("生产环境必须启用 Secure Cookie");
        }
        String url = environment.getProperty("spring.datasource.url", "");
        var properties = new HashMap<String, String>();
        int query = url.indexOf('?');
        if (!url.matches("jdbc:mysql://[a-zA-Z0-9.\\-\\[\\]:]+/[a-zA-Z0-9_]+\\?.+") || query < 0) throw new IllegalStateException(
            "生产数据库必须使用单地址 MySQL 身份验证型 TLS"
        );
        for (String pair : url.substring(query + 1).split("&")) {
            String[] parts = pair.split("=", 2);
            if (parts.length != 2) throw new IllegalStateException("生产数据库连接属性无效");
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            String value = URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
            if (properties.putIfAbsent(key, value) != null) throw new IllegalStateException("生产数据库连接属性不可重复");
        }
        if (!"VERIFY_IDENTITY".equalsIgnoreCase(properties.get("sslmode")) || "true".equalsIgnoreCase(properties.get("allowpublickeyretrieval"))) {
            throw new IllegalStateException("生产数据库须配置 sslMode=VERIFY_IDENTITY 且禁止公钥自动检索");
        }
        if (properties.containsKey("usessl") || properties.containsKey("verifyservercertificate") || properties.containsKey("requiressl")) {
            throw new IllegalStateException("生产数据库不可混用旧 TLS 参数");
        }
        if (!environment.getProperty("campus.redis.enabled", Boolean.class, false)) throw new IllegalStateException("生产会话必须启用安全 Redis");
        for (String type : new String[] { "security", "cache" }) {
            if (environment.getProperty("campus.redis." + type + "-password", "").isBlank()) {
                throw new IllegalStateException("生产 Redis 必须配置认证");
            }
        }
        String namespace = environment.getProperty("campus.redis.namespace", "");
        if (namespace.isBlank() || "cs:dev".equals(namespace)) throw new IllegalStateException("生产 Redis 必须配置独立命名空间");
    }
}
