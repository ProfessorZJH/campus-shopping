package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.catalog.model.valobj.ProductImageRef;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageConfig;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.gateway.QiniuObjectGateway;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 商品图片存储装配契约：LOCAL 全空可离线启动、QINIU 缺配置必须启动失败、配置校验与下载地址生成。
 * 全部使用假凭据与固定 Clock，不发起任何真实网络请求。
 */
class ProductImageStorageConfigTest {

    private static final String KEY = "qiniu/11111111-1111-1111-1111-111111111111.png";
    private static final Instant NOW = Instant.parse("2026-11-05T00:00:00Z");

    private final ApplicationContextRunner runner = new ApplicationContextRunner().withUserConfiguration(
        ProductImageStorageConfig.class,
        QiniuObjectGateway.class,
        FixedClockConfig.class
    );

    /** 只装配被验证的组件与固定时间源，不启动 Web、数据库或任务调度。 */
    @Configuration(proxyBeanMethods = false)
    static class FixedClockConfig {

        @Bean
        Clock fixedClock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }
    }

    private static String[] completeQiniu(String provider) {
        return new String[] {
            "campus.images.provider=" + provider,
            "campus.images.qiniu.access-key=fake-access-key",
            "campus.images.qiniu.secret-key=fake-secret-key",
            "campus.images.qiniu.bucket=fake-bucket",
            "campus.images.qiniu.download-domain=images.example.com",
            "campus.images.qiniu.region=z0",
        };
    }

    @Test
    void localWithoutQiniuConfigurationStartsOffline() {
        runner.run(context -> {
            assertNull(context.getStartupFailure(), "LOCAL 且七牛四项全空必须能离线启动");
            QiniuObjectGateway gateway = context.getBean(QiniuObjectGateway.class);
            assertFalse(gateway.configured());
            assertFalse(gateway.uploadEnabled());
            assertNull(gateway.downloadUrl(KEY), "未配置七牛时下载地址投影返回 null，由控制器转 503");
        });
    }

    @Test
    void qiniuProviderWithoutRequiredConfigurationFailsStartup() {
        runner.withPropertyValues("campus.images.provider=QINIU").run(context -> {
            assertNotNull(context.getStartupFailure(), "显式 QINIU 但缺必填项必须启动失败");
            // Spring 会包裹构造器异常，沿 cause 链确认根因是七牛配置而非其他装配问题。
            StringBuilder messages = new StringBuilder();
            for (Throwable cause = context.getStartupFailure(); cause != null; cause = cause.getCause()) {
                messages.append(cause.getMessage()).append(' ');
            }
            assertTrue(messages.toString().contains("七牛"), "启动失败根因应指向七牛配置，实际：" + messages);
        });
    }

    @Test
    void localWithPartialQiniuConfigurationFailsStartup() {
        runner
            .withPropertyValues("campus.images.provider=LOCAL", "campus.images.qiniu.access-key=fake-access-key")
            .run(context -> assertNotNull(context.getStartupFailure(), "只填部分七牛配置必须启动失败，避免静默坏读历史云图"));
    }

    @Test
    void localReadOnlyConfigurationWithoutRegionStillStarts() {
        // 只读历史云图：不启上传，因此 region 可为空（不会触发区域发现）。
        runner
            .withPropertyValues(
                "campus.images.provider=LOCAL",
                "campus.images.qiniu.access-key=fake-access-key",
                "campus.images.qiniu.secret-key=fake-secret-key",
                "campus.images.qiniu.bucket=fake-bucket",
                "campus.images.qiniu.download-domain=images.example.com"
            )
            .run(context -> {
                assertNull(context.getStartupFailure(), "LOCAL 只读历史云图不得因缺 region 而失败");
                QiniuObjectGateway gateway = context.getBean(QiniuObjectGateway.class);
                assertTrue(gateway.configured());
                assertFalse(gateway.uploadEnabled());
                assertNotNull(gateway.downloadUrl(KEY));
            });
    }

    @Test
    void localUploadKeepsCompleteQiniuConfigurationForReadingHistoricalImages() {
        runner.withPropertyValues(completeQiniu("LOCAL")).run(context -> {
            assertNull(context.getStartupFailure(), "LOCAL 上传回退时保留完整七牛配置必须可启动");
            QiniuObjectGateway gateway = context.getBean(QiniuObjectGateway.class);
            assertTrue(gateway.configured(), "完整七牛配置决定历史云图仍可读");
            assertFalse(gateway.uploadEnabled(), "provider=LOCAL 时不得启用云上传");
            assertNotNull(gateway.downloadUrl(KEY), "provider=LOCAL 也要能生成历史云图下载地址");
        });
    }

    @Test
    void privateBucketUrlIsHttpsWithHostPathAndDeadlineSignature() {
        runner.withPropertyValues(completeQiniu("LOCAL")).run(context -> {
            String url = context.getBean(QiniuObjectGateway.class).downloadUrl(KEY);
            assertNotNull(url);
            // 用 URI 精确核对结构，不把完整签名 URL 放进断言消息。
            URI uri = URI.create(url);
            assertEquals("https", uri.getScheme(), "下载地址必须固定 HTTPS");
            assertEquals("images.example.com", uri.getHost(), "host 必须取自配置的纯域名");
            assertEquals("/qiniu/11111111-1111-1111-1111-111111111111.png", uri.getPath(), "路径必须保留 object key");
            Map<String, String> query = query(uri);
            assertEquals(String.valueOf(NOW.getEpochSecond() + 300), query.get("e"), "deadline 必须是当前时间加默认 300 秒");
            assertNotNull(query.get("token"), "私有桶必须携带签名");
            assertFalse(query.get("token").isBlank(), "签名不得为空");
        });
    }

    @Test
    void publicBucketUrlHasNoSignatureQuery() {
        runner
            .withPropertyValues(completeQiniu("LOCAL"))
            .withPropertyValues("campus.images.qiniu.private-bucket=false")
            .run(context -> {
                String url = context.getBean(QiniuObjectGateway.class).downloadUrl(KEY);
                assertNotNull(url);
                URI uri = URI.create(url);
                assertEquals("https", uri.getScheme(), "公开桶仍使用 HTTPS");
                assertEquals("images.example.com", uri.getHost(), "公开桶仍使用配置 host");
                assertEquals("/qiniu/11111111-1111-1111-1111-111111111111.png", uri.getPath());
                assertNull(uri.getRawQuery(), "公开桶不得携带签名或 deadline query");
            });
    }

    /** 只解析 query 键值，不做网络或签名计算；token 可能含 '='，因此只按首个 '=' 切分。 */
    private static Map<String, String> query(URI uri) {
        Map<String, String> values = new HashMap<>();
        String raw = uri.getRawQuery();
        if (raw == null || raw.isEmpty()) return values;
        for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            values.put(parts[0], parts.length > 1 ? parts[1] : "");
        }
        return values;
    }

    @Test
    void signatureTtlOutsideAllowedRangeIsRejected() {
        for (String ttl : new String[] { "29", "3601" }) {
            assertThrows(
                IllegalStateException.class,
                () -> propertiesWith("campus.images.qiniu.signature-ttl-seconds", ttl).qiniuEnabled(),
                "TTL 越界必须拒绝：" + ttl
            );
        }
    }

    @Test
    void timeoutsAndRetryOutsideAllowedRangeAreRejected() {
        for (String[] pair : new String[][] {
            { "connect-timeout-seconds", "0" },
            { "connect-timeout-seconds", "61" },
            { "read-timeout-seconds", "0" },
            { "read-timeout-seconds", "61" },
            { "write-timeout-seconds", "0" },
            { "write-timeout-seconds", "61" },
            { "retry-max", "-1" },
            { "retry-max", "4" },
        }) {
            assertThrows(
                IllegalStateException.class,
                () -> propertiesWith("campus.images.qiniu." + pair[0], pair[1]).qiniuEnabled(),
                pair[0] + " 越界必须拒绝：" + pair[1]
            );
        }
    }

    @Test
    void unsupportedRegionIsRejected() {
        assertThrows(IllegalStateException.class, () -> propertiesWith("campus.images.qiniu.region", "z9").qiniuEnabled());
    }

    @Test
    void uploadRequiresExplicitFixedRegionAndRejectsAuto() {
        // 缺省留空：不得静默猜测 bucket 区（autoRegion 会在 SDK 内联网发现并可能打印异常栈）。
        assertThrows(IllegalStateException.class, () -> propertiesWith("campus.images.qiniu.region", "").qiniuEnabled());
        assertThrows(IllegalStateException.class, () -> propertiesWith("campus.images.qiniu.region", "auto").qiniuEnabled());
        // 固定区域取值合法。
        for (String region : new String[] { "z0", "z1", "z2", "na0", "as0", "cn-east-2" }) {
            assertTrue(propertiesWith("campus.images.qiniu.region", region).qiniuEnabled(), "固定区域应可用：" + region);
        }
    }

    @Test
    void accessKeyMustUseTokenSafeCharacterSet() {
        // token 首段是 access-key 原文：内部冒号/空白会让 SDK 自解析 token 失败并在内部打印异常栈。
        for (String key : new String[] { "fake:access-key", "fake access key", "fake\taccess-key", "fake\naccess-key", "fake/access+key" }) {
            ProductImageStorageProperties properties = propertiesWith("campus.images.qiniu.region", "z0");
            properties.getQiniu().setAccessKey(key);
            assertThrows(IllegalStateException.class, properties::qiniuEnabled, "非法 access-key 必须拒绝");
        }
        // 首尾空白按既有规范 trim，不视为非法（与其它配置项一致）。
        ProductImageStorageProperties trimmed = propertiesWith("campus.images.qiniu.region", "z0");
        trimmed.getQiniu().setAccessKey("  fake-access-key  ");
        assertTrue(trimmed.qiniuEnabled());
        assertEquals("fake-access-key", trimmed.getQiniu().getAccessKey());
        // secret-key 只作 HMAC 密钥：允许常见 base64url 字符，仅拒绝内部空白/换行。
        ProductImageStorageProperties ok = propertiesWith("campus.images.qiniu.region", "z0");
        ok.getQiniu().setSecretKey("fake-secret_key-with_underscore-and-dash");
        assertTrue(ok.qiniuEnabled());
        for (String secret : new String[] { "fake secret", "fake\nsecret" }) {
            ProductImageStorageProperties bad = propertiesWith("campus.images.qiniu.region", "z0");
            bad.getQiniu().setSecretKey(secret);
            assertThrows(IllegalStateException.class, bad::qiniuEnabled, "含内部空白的 secret-key 必须拒绝");
        }
    }

    @Test
    void downloadHostMustBePlainDnsName() {
        String[] invalid = {
            "https://images.example.com",
            "user:pass@images.example.com",
            "images.example.com:8443",
            "images.example.com/path",
            "images.example.com?token=1",
            "images.example.com#fragment",
            "127.0.0.1",
            "*.example.com",
        };
        for (String host : invalid) {
            assertThrows(
                IllegalStateException.class,
                () -> propertiesWith("campus.images.qiniu.download-domain", host).qiniuEnabled(),
                "非法下载 host 必须拒绝：" + host
            );
        }
    }

    @Test
    void domainAndBucketAreTrimmedAndLowercased() {
        ProductImageStorageProperties properties = propertiesWith("campus.images.qiniu.download-domain", "  Images.Example.COM  ");
        properties.getQiniu().setBucket("  Fake-Bucket  ");
        assertTrue(properties.qiniuEnabled());
        assertEquals("images.example.com", properties.getQiniu().getDownloadDomain());
        assertEquals("fake-bucket", properties.getQiniu().getBucket());
    }

    @Test
    void completeQiniuConfigurationEnablesUploadAndDownload() {
        runner.withPropertyValues(completeQiniu("QINIU")).run(context -> {
            assertNull(context.getStartupFailure(), "完整七牛配置必须能正常启动");
            QiniuObjectGateway gateway = context.getBean(QiniuObjectGateway.class);
            assertTrue(gateway.configured(), "完整配置应标记为可用");
            assertTrue(gateway.uploadEnabled(), "provider=QINIU 且配置完整时应启用上传");
            assertNotNull(gateway.downloadUrl(KEY), "应能生成下载地址");
        });
    }

    @Test
    void stableReferencesAcceptLegacyLocalAndStrictQiniuOnly() {
        assertEquals(ProductImageRef.PROVIDER_LOCAL, ProductImageRef.of("/media/a.png").provider());
        assertEquals(ProductImageRef.PROVIDER_LOCAL, ProductImageRef.of("/media/11111111-1111-1111-1111-111111111111.png").provider());
        ProductImageRef qiniu = ProductImageRef.of("/media/qiniu/11111111-1111-1111-1111-111111111111.png");
        assertEquals(ProductImageRef.PROVIDER_QINIU, qiniu.provider());
        assertEquals(KEY, qiniu.objectKey());
        assertTrue(ProductImageRef.accepts("/media/a.png"));
        assertTrue(ProductImageRef.accepts("/media/qiniu/11111111-1111-1111-1111-111111111111.png"));
        assertFalse(ProductImageRef.accepts(null));
    }

    @Test
    void stableReferencesRejectExternalQueryEncodedAndUppercaseForms() {
        String[] invalid = {
            "https://images.example.com/media/a.png",
            "//images.example.com/media/a.png",
            "/media/a.png?token=1",
            "/media/a.png#fragment",
            "/media/qiniu/11111111-1111-1111-1111-111111111111.png?token=1",
            "/media/qiniu/1111111A-1111-1111-1111-111111111111.png",
            "/media/qiniu/1111.png",
            "/media/qiniu/%2e%2e/11111111-1111-1111-1111-111111111111.png",
            "/media/../etc/passwd.png",
            "",
        };
        for (String url : invalid) {
            assertThrows(cn.bugstack.ai.types.exception.AppException.class, () -> ProductImageRef.of(url), "必须拒绝非稳定引用：" + url);
            assertFalse(ProductImageRef.accepts(url), "accepts 必须与 of 一致：" + url);
        }
    }

    /** 完整假必填项 + 单个被验证字段，避免每个用例重复拼装。 */ private static ProductImageStorageProperties propertiesWith(String name, String value) {
        ProductImageStorageProperties properties = new ProductImageStorageProperties();
        properties.setProvider("QINIU");
        ProductImageStorageProperties.Qiniu qiniu = properties.getQiniu();
        qiniu.setAccessKey("fake-access-key");
        qiniu.setSecretKey("fake-secret-key");
        qiniu.setBucket("fake-bucket");
        qiniu.setDownloadDomain("images.example.com");
        qiniu.setRegion("z0");
        switch (name) {
            case "campus.images.qiniu.signature-ttl-seconds" -> qiniu.setSignatureTtlSeconds(Long.parseLong(value));
            case "campus.images.qiniu.connect-timeout-seconds" -> qiniu.setConnectTimeoutSeconds(Integer.parseInt(value));
            case "campus.images.qiniu.read-timeout-seconds" -> qiniu.setReadTimeoutSeconds(Integer.parseInt(value));
            case "campus.images.qiniu.write-timeout-seconds" -> qiniu.setWriteTimeoutSeconds(Integer.parseInt(value));
            case "campus.images.qiniu.retry-max" -> qiniu.setRetryMax(Integer.parseInt(value));
            case "campus.images.qiniu.region" -> qiniu.setRegion(value);
            case "campus.images.qiniu.download-domain" -> qiniu.setDownloadDomain(value);
            default -> throw new IllegalArgumentException("未覆盖的配置项：" + name);
        }
        return properties;
    }
}
