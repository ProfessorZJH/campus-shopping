package cn.bugstack.ai.config;

import cn.bugstack.ai.infrastructure.redis.RedisClients;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.redisson.spring.data.connection.RedissonConnectionFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.security.jackson2.SecurityJackson2Modules;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/** 安全会话独立于展示缓存，关闭 Redis 仅用于显式单实例模式。 */
@Configuration
@ConditionalOnProperty(name = "campus.redis.enabled", havingValue = "true", matchIfMissing = true)
@EnableRedisHttpSession(redisNamespace = "${campus.redis.namespace:cs:dev}:session", maxInactiveIntervalInSeconds = 1800)
public class RedisSessionConfig {

    @Bean
    public RedisConnectionFactory redisConnectionFactory(RedisClients clients) {
        return new RedissonConnectionFactory(clients.security());
    }

    @Bean
    public CookieSerializer cookieSerializer(@Value("${server.servlet.session.cookie.secure:true}") boolean secure) {
        DefaultCookieSerializer cookie = new DefaultCookieSerializer();
        cookie.setCookieName("JSESSIONID");
        cookie.setCookiePath("/");
        cookie.setUseHttpOnlyCookie(true);
        cookie.setSameSite("Lax");
        cookie.setUseSecureCookie(secure);
        return cookie;
    }

    @Bean
    public RedisSerializer<Object> springSessionDefaultRedisSerializer() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModules(SecurityJackson2Modules.getModules(getClass().getClassLoader()));
        return new GenericJackson2JsonRedisSerializer(mapper);
    }
}
