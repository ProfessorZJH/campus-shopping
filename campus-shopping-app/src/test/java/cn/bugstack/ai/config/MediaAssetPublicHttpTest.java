package cn.bugstack.ai.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogQueryRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.service.impl.CatalogServiceImpl;
import cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageConfig;
import cn.bugstack.ai.infrastructure.config.QiniuPublicHttpPolicy;
import cn.bugstack.ai.infrastructure.gateway.QiniuObjectGateway;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 本机公开测试模式的真实 MVC 切片契约：/media/qiniu/** 返回无查询串的明文 HTTP 302，
 * 且实际下发的 CSP 的 img-src 同时包含原 HTTPS 源与精确的 HTTP 测试源，其余指令不变。
 *
 * <p>只装载媒体资产 Controller、真实安全配置与真实七牛签名器；仓储/身份/限流为替身，
 * 不装载数据源、Redis、任务或 AI 适配器，因此不会连接 3306/6379 或任何真实云。</p>
 *
 * <p>profile 使用 {@code spring.profiles.default=dev}（不设 active），覆盖用户常见的本机启动方式。</p>
 */
@WebMvcTest(
    controllers = MediaAssetController.class,
    excludeAutoConfiguration = UserDetailsServiceAutoConfiguration.class,
    properties = {
        "campus.security.rate-limit-enabled=false",
        "spring.profiles.default=dev",
        "server.address=127.0.0.1",
        "campus.images.provider=QINIU",
        "campus.images.qiniu.access-key=fake-access-key",
        "campus.images.qiniu.secret-key=fake-secret-key",
        "campus.images.qiniu.bucket=fake-bucket",
        "campus.images.qiniu.download-domain=abcdefgh12345678.hn-bkt.clouddn.com",
        "campus.images.qiniu.region=z0",
        "campus.images.qiniu.private-bucket=false",
        "campus.images.qiniu.public-http-download=true",
    }
)
@Import({
    SessionSecurityConfig.class,
    ProductImageStorageConfig.class,
    QiniuObjectGateway.class,
    CatalogServiceImpl.class,
    MediaAssetPublicHttpTest.FixedClockConfig.class,
})
class MediaAssetPublicHttpTest {

    private static final Instant NOW = Instant.parse("2026-11-05T00:00:00Z");
    private static final String UUID_KEY = "11111111-1111-1111-1111-111111111111";
    private static final String ASSET = "/media/qiniu/" + UUID_KEY + ".png";
    private static final String HOST = "abcdefgh12345678.hn-bkt.clouddn.com";

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedClockConfig {

        @Bean
        Clock fixedClock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private QiniuPublicHttpPolicy policy;

    @MockitoSpyBean
    private QiniuObjectGateway gateway;

    // 领域仓储与身份/限流依赖全部为替身：只验证 HTTP 投影、CSP 与签名/明文分支。
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

    @Test
    void policyIsEnabledUnderDefaultDevProfile() {
        assertTrue(policy.isEnabled(), "spring.profiles.default=dev + 回环 + 公有桶 + 测试域名应启用本机模式");
    }

    @Test
    void mediaAssetRedirectsToPlainHttpWithoutQueryString() throws Exception {
        MvcResult result = mockMvc.perform(get(ASSET)).andExpect(status().isFound()).andExpect(header().exists("Location")).andReturn();
        String location = result.getResponse().getHeader("Location");
        assertNotNull(location);
        assertTrue(location.startsWith("http://" + HOST + "/"), "本机模式必须跳到明文 HTTP 测试域名");
        assertFalse(location.contains("?"), "明文测试模式绝不允许签名/查询串");
        assertFalse(location.contains("token"), "明文测试模式绝不允许 token");
    }

    @Test
    void activeCspKeepsHttpsSourceAndAddsOnlyTheExactHttpTestHost() throws Exception {
        String csp = mockMvc.perform(get(ASSET)).andReturn().getResponse().getHeader("Content-Security-Policy");
        assertNotNull(csp, "响应必须带真实 CSP 头");
        assertEquals(
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://" +
                HOST +
                " http://" +
                HOST +
                "; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
            csp
        );
        assertTrue(csp.contains("connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"));
        assertFalse(csp.contains("http://*"));
        assertEquals(1, csp.split("http://", -1).length - 1, "只允许出现一个 http:// 来源");
    }

    @Test
    void nonUuidAssetStaysNotFoundUnderTestMode() throws Exception {
        mockMvc.perform(get("/media/qiniu/not-a-uuid.png")).andExpect(status().isNotFound());
    }
}
