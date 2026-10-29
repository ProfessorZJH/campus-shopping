package cn.bugstack.ai.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 本地密码哈希组件配置。
 * BCrypt 是进程内算法，不涉及远程调用，也不需要远程 Port 或 Gateway。
 */
@Configuration
public class PasswordEncoderConfig {

    /** 注册账号与本地开发环境的 HTTP Basic 测试账号共用此编码器。 */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
