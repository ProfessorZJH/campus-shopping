package cn.bugstack.ai.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 金额、数量和版本均为整数，禁止静默截断小数；每个正文只接受一个 JSON 值。 */
@Configuration
public class ApiJsonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer apiJsonContract() {
        return builder ->
            builder.featuresToDisable(DeserializationFeature.ACCEPT_FLOAT_AS_INT).featuresToEnable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }
}
