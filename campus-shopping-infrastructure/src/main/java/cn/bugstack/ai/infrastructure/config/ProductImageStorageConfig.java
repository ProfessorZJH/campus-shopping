package cn.bugstack.ai.infrastructure.config;

import java.util.Set;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/** 商品图片存储配置绑定；校验在网关或仓储适配器创建时立即执行。 */
@Configuration
@EnableConfigurationProperties(ProductImageStorageProperties.class)
public class ProductImageStorageConfig {

    /**
     * 本机公开测试域名策略：网关下载地址与 CSP 共用同一实例，避免两处判断漂移。
     * 开关为 true 但条件不满足时在此启动失败（fail closed）。
     */
    @Bean
    public QiniuPublicHttpPolicy qiniuPublicHttpPolicy(ProductImageStorageProperties images, Environment environment) {
        return QiniuPublicHttpPolicy.resolve(
            images.getQiniu().isPublicHttpDownload(),
            Set.of(environment.getActiveProfiles()),
            Set.of(environment.getDefaultProfiles()),
            environment.getProperty("server.address"),
            images
        );
    }
}
