package cn.bugstack.ai.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogQueryRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.service.impl.CatalogServiceImpl;
import cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageConfig;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.gateway.QiniuObjectGateway;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 媒体资产入口的 MVC 契约：真实 Controller → 真实 CatalogServiceImpl 引用校验 → 真实七牛签名器，
 * 仓储与身份依赖为替身，全程不连接数据库、云或网络。CSP 断言使用真实 SessionSecurityConfig 的策略。
 */
// 排除默认内存用户自动配置：媒体资产只做匿名 GET，不需要 UserDetailsService，也避免测试启动时生成并打印随机口令。
@WebMvcTest(
    controllers = MediaAssetController.class,
    excludeAutoConfiguration = UserDetailsServiceAutoConfiguration.class,
    properties = {
        "campus.security.rate-limit-enabled=false",
        "campus.images.provider=LOCAL",
        "campus.images.qiniu.access-key=fake-access-key",
        "campus.images.qiniu.secret-key=fake-secret-key",
        "campus.images.qiniu.bucket=fake-bucket",
        "campus.images.qiniu.download-domain=images.example.com",
    }
)
@Import({
    SessionSecurityConfig.class,
    ProductImageStorageConfig.class,
    QiniuObjectGateway.class,
    CatalogServiceImpl.class,
    MediaAssetContractTest.FixedClockConfig.class,
})
@ExtendWith(OutputCaptureExtension.class)
class MediaAssetContractTest {

    private static final Instant NOW = Instant.parse("2026-11-05T00:00:00Z");
    private static final String UUID_KEY = "11111111-1111-1111-1111-111111111111";
    private static final String ASSET = "/media/qiniu/" + UUID_KEY + ".png";
    private static final String DEFAULT_POLICY =
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
        "connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper mapper;

    @Autowired
    private ProductImageStorageProperties properties;

    @MockitoSpyBean
    private QiniuObjectGateway gateway;

    // 领域仓储与安全过滤器依赖全部为替身：本用例只验证 HTTP/领域校验/签名投影。
    @MockitoBean
    private ICatalogRepository catalogRepository;

    @MockitoBean
    private ICatalogQueryRepository catalogQueryRepository;

    @MockitoBean
    private IProductImageRepository productImageRepository;

    @MockitoBean
    private IUserAccountService userAccountService;

    @MockitoBean
    private IRequestQuotaRepository requestQuotaRepository;

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedClockConfig {

        @Bean
        Clock fixedClock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }
    }

    @Test
    void anonymousRequestIsRedirectedToSignedHttpsAssetAndRecordsContract() throws Exception {
        MvcResult result = mockMvc
            .perform(get(ASSET))
            .andExpect(status().isFound())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(content().string(""))
            .andReturn();

        String location = result.getResponse().getHeader("Location");
        assertNotNull(location, "合法引用必须返回 Location");
        URI uri = URI.create(location);
        assertEquals("https", uri.getScheme(), "必须固定 HTTPS");
        assertEquals("images.example.com", uri.getHost(), "host 必须取自配置的下载域名");
        assertEquals("/qiniu/" + UUID_KEY + ".png", uri.getPath(), "路径必须保留稳定 object key");
        Map<String, String> query = query(uri);
        assertEquals(String.valueOf(NOW.getEpochSecond() + 300), query.get("e"), "私有桶 deadline 必须是当前时间加默认 300 秒");
        assertNotNull(query.get("token"), "私有桶必须携带签名");
        assertFalse(query.get("token").isBlank(), "签名不得为空");

        String csp = result.getResponse().getHeader("Content-Security-Policy");
        assertNotNull(csp, "安全过滤器必须写出 CSP");
        writeContract(csp, location);
    }

    @Test
    void nonUuidFilenameIsRejectedAsNotFoundWithoutLeakingAsset() throws Exception {
        for (String bad : new String[] { "/media/qiniu/not-a-uuid.png", "/media/qiniu/" + UUID_KEY + "?token=1" }) {
            mockMvc
                .perform(get(bad))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().doesNotExist("Location"))
                .andExpect(content().string(""));
        }
    }

    @Test
    void missingCloudReadCapabilityBecomesServiceUnavailable() throws Exception {
        doReturn(null).when(gateway).downloadUrl(anyString());
        mockMvc
            .perform(get(ASSET))
            .andExpect(status().isServiceUnavailable())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(header().doesNotExist("Location"))
            .andExpect(content().string(""));
    }

    @Test
    void businessFailureBecomesServiceUnavailableWithoutLocation() throws Exception {
        doThrow(new AppException(ResponseCode.UN_ERROR)).when(gateway).downloadUrl(anyString());
        mockMvc.perform(get(ASSET)).andExpect(status().isServiceUnavailable()).andExpect(header().doesNotExist("Location")).andExpect(content().string(""));
    }

    @Test
    void runtimeFailureBecomesServiceUnavailableWithoutDownstreamBody(CapturedOutput output) throws Exception {
        String sentinel = "fake-downstream-body";
        doThrow(new IllegalStateException(sentinel)).when(gateway).downloadUrl(anyString());
        mockMvc.perform(get(ASSET)).andExpect(status().isServiceUnavailable()).andExpect(header().doesNotExist("Location")).andExpect(content().string(""));
        assertFalse(output.getAll().contains(sentinel), "日志不得输出下游异常正文");
    }

    @Test
    void securityHeaderOnlyAddsVerifiedDownloadHostToImgSrc() throws Exception {
        String csp = mockMvc.perform(get(ASSET)).andReturn().getResponse().getHeader("Content-Security-Policy");
        assertEquals(
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://images.example.com; " +
                "connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
            csp,
            "CSP 只能在 img-src 追加已验证的下载 host，其余指令保持原样"
        );
        // 与默认策略比较：除 img-src 追加的 host 外不得有任何其他差异。
        assertEquals(DEFAULT_POLICY.replace("img-src 'self' data:;", "img-src 'self' data: https://images.example.com;"), csp);
    }

    @Test
    void defaultLocalPolicyStaysByteIdenticalWithoutQiniu() {
        assertEquals(
            DEFAULT_POLICY,
            SessionSecurityConfig.cspPolicy(new ProductImageStorageProperties(), cn.bugstack.ai.infrastructure.config.QiniuPublicHttpPolicy.disabled()),
            "未配置七牛时 CSP 必须保持原 literal，不得多出 img-src 来源"
        );
    }

    /**
     * 供浏览器组消费的契约文件：只含假配置生成的值，不含凭据。
     */
    private void writeContract(String csp, String location) throws Exception {
        Map<String, Object> contract = new LinkedHashMap<>();
        contract.put("csp", csp);
        contract.put("location", location);
        contract.put("assetPath", ASSET);
        contract.put("stablePath", "/qiniu/" + UUID_KEY + ".png");
        contract.put("status", 302);
        Path output = Path.of("target", "qiniu-csp-contract.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, mapper.writerWithDefaultPrettyPrinter().writeValueAsString(contract) + "\n", StandardCharsets.UTF_8);
    }

    private static Map<String, String> query(URI uri) {
        Map<String, String> values = new LinkedHashMap<>();
        String raw = uri.getRawQuery();
        if (raw == null || raw.isEmpty()) return values;
        for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            values.put(parts[0], parts.length > 1 ? parts[1] : "");
        }
        return values;
    }
}
