package cn.bugstack.ai.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 时间统一使用 UTC，调度只触发领域用例，不在任务中直接写数据库。 */
@Configuration
@EnableScheduling
public class RuntimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
