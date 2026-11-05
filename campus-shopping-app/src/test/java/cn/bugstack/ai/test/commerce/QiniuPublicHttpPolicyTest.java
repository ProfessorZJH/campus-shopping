package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.config.QiniuPublicHttpPolicy;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * 本机公开测试域名策略的共享契约：网关下载地址与 CSP 必须由同一策略驱动。
 * 全部使用假密钥与固定测试域名形状，不发起任何真实网络请求，不输出真实凭据。
 */
class QiniuPublicHttpPolicyTest {

    private static final String TEST_HOST = "abcdefgh12345678.hn-bkt.clouddn.com";

    /** 假配置：公有桶 + 七牛测试域名形状，供正例使用。 */
    private static ProductImageStorageProperties publicBucketProperties() {
        ProductImageStorageProperties properties = new ProductImageStorageProperties();
        properties.setProvider("QINIU");
        ProductImageStorageProperties.Qiniu qiniu = properties.getQiniu();
        qiniu.setAccessKey("fake-access-key");
        qiniu.setSecretKey("fake-secret-key");
        qiniu.setBucket("fake-bucket");
        qiniu.setDownloadDomain(TEST_HOST);
        qiniu.setPrivateBucket(false);
        qiniu.setRegion("z0");
        qiniu.setPublicHttpDownload(true);
        return properties;
    }

    private static QiniuPublicHttpPolicy resolve(boolean switchOn, Set<String> profiles, String address, ProductImageStorageProperties properties) {
        return QiniuPublicHttpPolicy.resolve(switchOn, profiles, Set.of(), address, properties);
    }

    @Test
    void enabledOnlyForLoopbackDevPublicBucketAndTestDomainShape() {
        QiniuPublicHttpPolicy policy = resolve(true, Set.of("dev"), "127.0.0.1", publicBucketProperties());
        assertTrue(policy.isEnabled());
        assertEquals("http", policy.downloadScheme());
        assertEquals("http://" + TEST_HOST, policy.cspImageSource());
        // 不输出真实凭据：仅确认策略对象不自带主机以外的敏感信息。
        assertFalse(policy.toString().contains("fake-secret-key"));
    }

    @Test
    void ipv6LoopbackLiteralIsAccepted() {
        assertTrue(resolve(true, Set.of("dev"), "::1", publicBucketProperties()).isEnabled());
        assertTrue(resolve(true, Set.of("dev"), "[::1]", publicBucketProperties()).isEnabled());
    }

    @Test
    void switchOffKeepsHttpsAndOriginalCspEvenWithValidConfig() {
        ProductImageStorageProperties properties = publicBucketProperties();
        properties.getQiniu().setPublicHttpDownload(false);
        QiniuPublicHttpPolicy policy = resolve(false, Set.of("dev"), "127.0.0.1", properties);
        assertFalse(policy.isEnabled());
        assertEquals("https", policy.downloadScheme());
        assertEquals("", policy.cspImageSource());
    }

    @Test
    void defaultPolicyIsDisabled() {
        QiniuPublicHttpPolicy policy = QiniuPublicHttpPolicy.disabled();
        assertFalse(policy.isEnabled());
        assertEquals("https", policy.downloadScheme());
        assertEquals("", policy.cspImageSource());
    }

    @Test
    void nonLoopbackAddressFailsClosed() {
        for (String address : new String[] { "0.0.0.0", "localhost", "192.168.1.10", "::", "", null }) {
            IllegalStateException error = assertThrows(
                IllegalStateException.class,
                () -> resolve(true, Set.of("dev"), address, publicBucketProperties()),
                "非本机回环字面值必须启动失败: " + address
            );
            assertTrue(error.getMessage().contains("回环"));
        }
    }

    @Test
    void profileMixingFailsClosed() {
        for (Set<String> profiles : new Set[] {
            Set.of("dev", "prod"),
            Set.of("dev", "production"),
            Set.of("prod"),
            Set.of("dev", "test"),
            Set.of("staging"),
            // Spring profile 名区分大小写：DEV/Dev 不等于 dev，必须拒绝。
            Set.of("DEV"),
            Set.of("Dev"),
            Set.of("dev", "DEV"),
            Set.<String>of(),
        }) {
            assertThrows(IllegalStateException.class, () -> resolve(true, profiles, "127.0.0.1", publicBucketProperties()), "只允许单独 dev: " + profiles);
        }
        assertTrue(resolve(true, Set.of("dev"), "127.0.0.1", publicBucketProperties()).isEnabled());
    }

    @Test
    void privateBucketFailsClosed() {
        ProductImageStorageProperties properties = publicBucketProperties();
        properties.getQiniu().setPrivateBucket(true);
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> resolve(true, Set.of("dev"), "127.0.0.1", properties));
        assertTrue(error.getMessage().contains("公有桶"));
    }

    @Test
    void nonTestDomainShapesFailClosed() {
        for (String host : new String[] {
            "images.example.com",
            "cdn.mysite.clouddn.com",
            "abcdefgh12345678.clouddn.com",
            "abcdefgh12345678.hn-bkt.qiniudn.com",
            "abcdefgh12345678.hn-bkt.clouddn.com.evil.com",
            "abcdefgh12345678.hn-bktx.clouddn.com",
            "",
        }) {
            ProductImageStorageProperties properties = publicBucketProperties();
            properties.getQiniu().setDownloadDomain(host);
            assertThrows(IllegalStateException.class, () -> resolve(true, Set.of("dev"), "127.0.0.1", properties), "非七牛测试域名形状必须启动失败: " + host);
        }
    }

    @Test
    void uppercaseHostIsNormalizedThenJudgedByTheSameWhitelist() {
        // 既有契约：qiniuEnabled() 将 host 规范化为小写；本机测试模式不得因此收紧原有合法 host。
        ProductImageStorageProperties properties = publicBucketProperties();
        properties.getQiniu().setDownloadDomain(TEST_HOST.toUpperCase(java.util.Locale.ROOT));
        QiniuPublicHttpPolicy policy = resolve(true, Set.of("dev"), "127.0.0.1", properties);
        assertTrue(policy.isEnabled(), "大写测试域名规范化后应通过同一白名单");
        assertEquals("http://" + TEST_HOST, policy.cspImageSource(), "CSP 只能使用规范化后的小写 host");

        // 规范化后仍不属测试域名形状的，必须拒绝。
        ProductImageStorageProperties invalid = publicBucketProperties();
        invalid.getQiniu().setDownloadDomain("IMAGES.EXAMPLE.COM");
        assertThrows(IllegalStateException.class, () -> resolve(true, Set.of("dev"), "127.0.0.1", invalid));
    }

    @Test
    void qiniuMustBeFullyConfigured() {
        ProductImageStorageProperties properties = new ProductImageStorageProperties();
        assertThrows(IllegalStateException.class, () -> resolve(true, Set.of("dev"), "127.0.0.1", properties));
    }

    @Test
    void defaultProfileDevIsAcceptedWhenNoActiveProfile() {
        QiniuPublicHttpPolicy policy = QiniuPublicHttpPolicy.resolve(true, Set.of(), Set.of("dev"), "127.0.0.1", publicBucketProperties());
        assertTrue(policy.isEnabled(), "spring.profiles.default=dev 的本机启动不得被误拒");
    }

    @Test
    void activeProfileOverridesDefault() {
        // active 非空时以 active 为准：active=prod + default=dev 必须拒绝。
        assertThrows(IllegalStateException.class, () ->
            QiniuPublicHttpPolicy.resolve(true, Set.of("prod"), Set.of("dev"), "127.0.0.1", publicBucketProperties())
        );
        assertThrows(IllegalStateException.class, () ->
            QiniuPublicHttpPolicy.resolve(true, Set.of("dev", "prod"), Set.of("dev"), "127.0.0.1", publicBucketProperties())
        );
        // 默认 profile 本身非 dev 且 active 为空时也拒绝。
        assertThrows(IllegalStateException.class, () ->
            QiniuPublicHttpPolicy.resolve(true, Set.of(), Set.of("default"), "127.0.0.1", publicBucketProperties())
        );
    }

    @Test
    void policyNeverExposesSecretKey() {
        ProductImageStorageProperties properties = publicBucketProperties();
        QiniuPublicHttpPolicy enabled = resolve(true, Set.of("dev"), "127.0.0.1", properties);
        assertFalse(enabled.toString().contains("fake-secret-key"));
        assertFalse(enabled.toString().contains("fake-access-key"));
    }
}
