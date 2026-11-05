package cn.bugstack.ai.infrastructure.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** 商品图片存储配置绑定；校验在网关或仓库适配器创建时立即执行。 */
@Configuration
@EnableConfigurationProperties(ProductImageStorageProperties.class)
public class ProductImageStorageConfig {}
