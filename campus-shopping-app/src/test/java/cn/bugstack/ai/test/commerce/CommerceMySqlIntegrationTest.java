package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.cases.catalog.ICatalogQueryCase;
import cn.bugstack.ai.cases.merchant.IMerchantAdmissionCase;
import cn.bugstack.ai.cases.shoppingai.*;
import cn.bugstack.ai.cases.trading.*;
import cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.*;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.*;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.*;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.domain.shoppingai.service.IKnowledgeService;
import cn.bugstack.ai.domain.shoppingai.service.impl.ConversationServiceImpl;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.CheckoutItemEntity;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.infrastructure.adapter.repository.AccessRepository;
import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.dao.ICatalogDao;
import cn.bugstack.ai.infrastructure.gateway.QiniuObjectGateway;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 真实 MySQL + Spring 事务集成测试；绝不使用 H2 冒充行锁语义。
 * 只允许专用 campus_shopping_it 数据库；未配置时整类显式跳过。
 * 每个用例清空专用测试库业务表，因此不能连接开发/生产数据。
 */
@SpringBootTest(
    classes = { Application.class, CommerceMySqlIntegrationTest.TimeConfig.class },
    properties = { "campus.jobs.enabled=false", "campus.bootstrap.enabled=false", "campus.security.rate-limit-enabled=false" }
)
@ActiveProfiles("mysql-integration")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "MYSQL_TEST_URL", matches = ".+")
class CommerceMySqlIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    IUserAccountService accounts;

    @Autowired
    IAccessService access;

    @Autowired
    IRoleService roles;

    @Autowired
    IMerchantApplicationService applications;

    @Autowired
    IMerchantAdmissionCase admission;

    @Autowired
    ICatalogCase catalog;

    @Autowired
    ICatalogQueryCase catalogQuery;

    @Autowired
    IProductImageRepository productImages;

    @Autowired
    ICatalogService catalogSearch;

    @SpyBean
    IMerchantService merchantService;

    @Autowired
    ICheckoutCase checkout;

    @Autowired
    IOrderLifecycleCase life;

    @SpyBean
    IOrderService orderStore;

    @Autowired
    cn.bugstack.ai.domain.trading.service.IOrderQueryService orderReader;

    @SpyBean
    cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService refundFulfillment;

    @SpyBean
    cn.bugstack.ai.domain.trading.service.IAfterSaleService refundAfterSales;

    @Autowired
    ICartCase cart;

    @Autowired
    IKnowledgeCase knowledge;

    @Autowired
    IShoppingAiCase ai;

    @Autowired
    IKnowledgeService aiState;

    @Autowired
    IConversationService conversations;

    @Autowired
    IConversationTurnCase conversationTurns;

    @Autowired
    IConversationRepository conversationRepository;

    @Autowired
    PlatformTransactionManager transactionManager;

    @SpyBean
    IAiEnginePort aiEngine;

    @Autowired
    cn.bugstack.ai.domain.shoppingai.adapter.repository.IAiResourceRepository syncResources;

    @Autowired
    cn.bugstack.ai.domain.trading.service.IOrderQueryService expiryQuery;

    @Autowired
    MutableClock clock;

    @SpyBean
    AccessRepository accessRepository;

    @SpyBean
    cn.bugstack.ai.domain.inventory.service.impl.InventoryServiceImpl inventoryService;

    @Autowired
    cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository imageStore;

    String admin, owner, buyer, other;
    MerchantVO merchant;
    static final String PASSWORD = "Test-only-commerce-password-123!";

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        String url = System.getenv("MYSQL_TEST_URL");
        if (url == null || !url.matches("jdbc:mysql://[^/]+/campus_shopping_it(?:\\?.*)?")) throw new IllegalStateException(
            "必须使用专用测试库 campus_shopping_it"
        );
        String user = System.getenv("MYSQL_TEST_USERNAME"),
            pass = System.getenv("MYSQL_TEST_PASSWORD");
        if (user == null || pass == null) throw new IllegalStateException("未设置测试数据库凭据");
        r.add("spring.datasource.url", () -> url);
        r.add("spring.datasource.username", () -> user);
        r.add("spring.datasource.password", () -> pass);
        r.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        r.add("spring.sql.init.mode", () -> "always");
        r.add("spring.sql.init.schema-locations", () -> "classpath:schema.sql");
        r.add("spring.sql.init.data-locations", () -> "classpath:data.sql");
        // 图片落盘目录固定到构建目录，避免写入仓库默认 ./var/uploads。
        r.add("campus.uploads", () -> uploadRoot().toString());
    }

    @BeforeEach
    void fixture() {
        assertEquals("campus_shopping_it", jdbc.queryForObject("SELECT DATABASE()", String.class));
        // 固定表清单，绝不拼接用户输入。JUnit 默认顺序执行，CI 不启用并行测试类。
        for (String table : List.of(
            "ai_proposal",
            "ai_message",
            "ai_conversation",
            "ai_document",
            "ai_document_root",
            "ai_knowledge_usage",
            "ai_sync_checkpoint",
            "ai_knowledge_base",
            "ful_pickup_verification",
            "ful_pickup_task",
            "trd_refund",
            "trd_after_sale",
            "trd_payment",
            "trd_order_item",
            "trd_order",
            "trd_checkout_request",
            "trd_cart_item",
            "trd_cart_owner",
            "inv_stock_movement",
            "inv_reservation",
            "inv_stock_balance",
            "cat_sku",
            "cat_product_image",
            "cat_product_image_upload",
            "cat_product",
            "iam_invitation",
            "iam_merchant_membership",
            "iam_merchant_role_permission",
            "iam_merchant_role",
            "iam_platform_role",
            "sys_audit",
            "mer_store",
            "mer_merchant",
            "mer_application",
            "iam_user"
        ))
            jdbc.update("DELETE FROM " + table);
        resetUploads();
        jdbc.update("UPDATE ai_knowledge_quota SET used_count=0 WHERE id='global'");
        clock.now = Instant.parse("2026-10-28T04:00:00Z");
        admin = accounts.register("testadmin", PASSWORD, "测试管理员").getUserId();
        owner = accounts.register("testowner", PASSWORD, "测试经营者").getUserId();
        buyer = accounts.register("testbuyer", PASSWORD, "测试买家").getUserId();
        other = accounts.register("testother", PASSWORD, "其他买家").getUserId();
        access.bootstrapAdmin(admin);
        merchant = open(owner, "测试文具商户");
    }

    @Autowired
    cn.bugstack.ai.infrastructure.adapter.repository.MerchantRepository displayMerchants;

    @SpyBean
    cn.bugstack.ai.infrastructure.dao.IMerchantDao merchantDao;

    @Autowired
    org.mybatis.spring.SqlSessionTemplate sqlSession;

    @Test
    @EnabledIfEnvironmentVariable(named = "REDIS_TEST_CACHE_ADDRESS", matches = ".+")
    void merchantCacheLateFillUsesDatabaseVersionAndRollbackPreservesDisplay() throws Exception {
        String id = merchant.id();
        var read = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var realDao = sqlSession.getMapper(cn.bugstack.ai.infrastructure.dao.IMerchantDao.class);
        doAnswer(invocation -> {
            Object snapshot = realDao.find(id, false);
            if (Thread.currentThread().getName().equals("merchant-old-reader")) {
                read.countDown();
                assertTrue(release.await(10, TimeUnit.SECONDS));
            }
            return snapshot;
        })
            .when(merchantDao)
            .find(id, false);
        var executor = Executors.newSingleThreadExecutor(r -> new Thread(r, "merchant-old-reader"));
        try {
            var old = executor.submit(() -> displayMerchants.publicDisplay(id));
            assertTrue(read.await(10, TimeUnit.SECONDS));
            long before = merchantDao.displayFacts(id).getVersion();
            admission.updateProfile(owner, id, "新商户资料", "新门店", "新地点");
            assertEquals(before + 1, merchantDao.displayFacts(id).getVersion());
            assertEquals("新商户资料", displayMerchants.publicDisplay(id).name());
            release.countDown();
            assertEquals(merchant.name(), old.get(10, TimeUnit.SECONDS).name());
            assertEquals("新商户资料", displayMerchants.publicDisplay(id).name());
            var tx = new TransactionTemplate(transactionManager);
            tx.executeWithoutResult(status -> {
                admission.updateProfile(owner, id, "回滚资料", "回滚门店", "回滚地点");
                status.setRollbackOnly();
            });
            assertEquals(before + 1, merchantDao.displayFacts(id).getVersion());
            assertEquals("新商户资料", displayMerchants.publicDisplay(id).name());
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    com.fasterxml.jackson.databind.ObjectMapper json;

    @Autowired
    ProductImageStorageProperties imageProperties;

    @SpyBean
    QiniuObjectGateway qiniuGateway;

    private MerchantVO open(String applicant, String name) {
        var a = applications.submitDetailed(
            applicant,
            new AdmissionCommandEntity(name, "文具", "联系人", "10000000000", "测试门店", "图书馆一层"),
            UUID.randomUUID().toString()
        );
        return admission.approve(admin, a.getApplicationId());
    }

    // ----------------------------------------------------------------
    // 七牛图片：真实 HTTP + 真实 MySQL 事务；云上传网关为替身，不访问任何云。
    // ----------------------------------------------------------------

    /** 上传云端为替身：返回 repository 传入的确切对象键，并记录调用。 */
    private List<String> stubCloudUpload() {
        List<String> keys = new ArrayList<>();
        doAnswer(invocation -> {
            // 云上传不得处于数据库事务中：否则长调用会持有连接/行锁。
            assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive(), "云上传不得在数据库事务内执行");
            String key = invocation.getArgument(1);
            keys.add(key);
            return key;
        })
            .when(qiniuGateway)
            .upload(any(byte[].class), anyString());
        return keys;
    }

    private MockHttpServletRequestBuilder asOwner(MockHttpServletRequestBuilder request) throws Exception {
        return request.with(user(owner)).with(csrf()).contentType(MediaType.APPLICATION_JSON);
    }

    private String bodyOf(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private String uploadImage(String merchantId, String actor) throws Exception {
        String payload = json.writeValueAsString(
            Map.of("filename", "probe.png", "contentType", "image/png", "base64", Base64.getEncoder().encodeToString(pngBytes()))
        );
        var request = post("/api/v1/merchants/" + merchantId + "/images")
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload);
        var result = actor == null ? mvc.perform(request).andReturn() : mvc.perform(request.with(user(actor)).with(csrf())).andReturn();
        return bodyOf(result);
    }

    private String createProductOverHttp(String merchantId, String title, List<String> urls) throws Exception {
        var body = new LinkedHashMap<String, Object>();
        body.put("title", title);
        body.put("description", "多图相册");
        body.put("categoryCode", "stationery");
        body.put("imageUrls", urls);
        body.put("skus", List.of(Map.of("specKey", "标准", "priceCent", 900)));
        var result = mvc.perform(asOwner(post("/api/v1/merchants/" + merchantId + "/products")).content(json.writeValueAsString(body))).andReturn();
        return bodyOf(result);
    }

    private String editProductOverHttp(String merchantId, String productId, String title, List<String> urls, long version) throws Exception {
        var body = new LinkedHashMap<String, Object>();
        body.put("title", title);
        body.put("description", "多图相册");
        body.put("categoryCode", "stationery");
        body.put("imageUrls", urls);
        body.put("expectedVersion", version);
        var result = mvc.perform(asOwner(put("/api/v1/merchants/" + merchantId + "/products/" + productId)).content(json.writeValueAsString(body))).andReturn();
        return bodyOf(result);
    }

    private List<String> albumKeys(String productId) {
        return jdbc.queryForList("SELECT object_key FROM cat_product_image WHERE product_id=? ORDER BY sort_order", String.class, productId);
    }

    private long imageVersion(String productId) {
        return jdbc.queryForObject("SELECT version FROM cat_product WHERE id=?", Long.class, productId);
    }

    /** A：完整 HTTP 上传 + 混合相册持久化，以及重排/移除后仍可放回原商品。 */
    @Test
    void qiniuUploadAndMixedAlbumPersistThroughRealHttpAndTransactions() throws Exception {
        List<String> keys = stubCloudUpload();
        imageProperties.setProvider("QINIU");
        try {
            var uploaded = json.readTree(uploadImage(merchant.id(), owner));
            assertEquals("0000", uploaded.get("code").asText(), uploaded.toString());
            String qiniuUrl = uploaded.get("data").get("url").asText();
            assertTrue(qiniuUrl.matches("^/media/qiniu/[a-f0-9-]{36}\\.png$"), qiniuUrl);
            String objectKey = "qiniu/" + qiniuUrl.substring("/media/qiniu/".length());
            assertEquals(List.of(objectKey), keys, "必须只上传一次且键与稳定引用一致");
            assertEquals(
                1L,
                scalar("SELECT COUNT(*) FROM cat_product_image_upload WHERE object_key=? AND merchant_id=? AND product_id IS NULL", objectKey, merchant.id())
            );

            String localUrl = mediaFixture("44444444-4444-4444-4444-444444444444", merchant.id());
            var created = json.readTree(createProductOverHttp(merchant.id(), "混合相册商品", List.of(localUrl, qiniuUrl)));
            assertEquals("0000", created.get("code").asText(), created.toString());
            String productId = created.get("data").get("productId").asText();
            assertEquals(List.of("44444444-4444-4444-4444-444444444444.png", objectKey), albumKeys(productId), "顺序、object_key 必须与提交一致");
            assertEquals(
                List.of("LOCAL", "QINIU"),
                jdbc.queryForList("SELECT provider FROM cat_product_image WHERE product_id=? ORDER BY sort_order", String.class, productId)
            );
            assertEquals(localUrl, created.get("data").get("imageUrl").asText(), "主图为第一张");
            assertEquals(productId, jdbc.queryForObject("SELECT product_id FROM cat_product_image_upload WHERE object_key=?", String.class, objectKey));

            // 重排：QINIU 升为首图，主图随之变化。
            assertEquals(
                "0000",
                json
                    .readTree(editProductOverHttp(merchant.id(), productId, "混合相册商品", List.of(qiniuUrl, localUrl), imageVersion(productId)))
                    .get("code")
                    .asText()
            );
            assertEquals(List.of(objectKey, "44444444-4444-4444-4444-444444444444.png"), albumKeys(productId));

            // 未发布前匿名不可读；显式发布后再核对主图，避免把权限绕过当行为。
            catalog.setProductPublished(owner, merchant.id(), productId, true);
            assertEquals(
                qiniuUrl,
                json
                    .readTree(
                        bodyOf(
                            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/products/" + productId)).andReturn()
                        )
                    )
                    .get("data")
                    .get("imageUrl")
                    .asText()
            );

            // 移除后再放回：同一商品仍可重新认领自己曾经的 QINIU 对象。
            assertEquals(
                "0000",
                json
                    .readTree(editProductOverHttp(merchant.id(), productId, "混合相册商品", List.of(), imageVersion(productId)))
                    .get("code")
                    .asText()
            );
            assertEquals(List.of(), albumKeys(productId));
            assertEquals(
                "0000",
                json
                    .readTree(editProductOverHttp(merchant.id(), productId, "混合相册商品", List.of(qiniuUrl), imageVersion(productId)))
                    .get("code")
                    .asText()
            );
            assertEquals(List.of(objectKey), albumKeys(productId));
            assertEquals(0L, scalar("SELECT COUNT(*) FROM cat_product_image_upload WHERE product_id IS NULL AND object_key=?", objectKey));
            // 保存、重排、移除、放回与读取均不得产生额外云调用。
            assertEquals(List.of(objectKey), keys, "整个 HTTP 流程只能有一次云上传");
            verify(qiniuGateway, times(1)).upload(any(byte[].class), anyString());
        } finally {
            imageProperties.setProvider("LOCAL");
        }
    }

    /** B：跨商户、跨商品、未登记、非法形状分别拒绝，且鉴权路径不触碰网关。 */
    @Test
    void qiniuReferencesRejectCrossMerchantReuseUnregisteredAndIllegalShapes() throws Exception {
        List<String> keys = stubCloudUpload();
        imageProperties.setProvider("QINIU");
        try {
            String qiniuUrl = json.readTree(uploadImage(merchant.id(), owner)).get("data").get("url").asText();
            String objectKey = "qiniu/" + qiniuUrl.substring("/media/qiniu/".length());
            assertEquals(1, keys.size());

            var first = json.readTree(createProductOverHttp(merchant.id(), "先占用", List.of(qiniuUrl)));
            assertEquals("0000", first.get("code").asText(), first.toString());
            long imagesBefore = scalar("SELECT COUNT(*) FROM cat_product_image");
            long productsBeforeFailures = scalar("SELECT COUNT(*) FROM cat_product");

            // 同商户不同商品复用同一已认领对象。
            assertEquals(
                "A0006",
                json
                    .readTree(createProductOverHttp(merchant.id(), "跨商品复用", List.of(qiniuUrl)))
                    .get("code")
                    .asText()
            );
            // 未登记对象。
            assertEquals(
                "A0006",
                json
                    .readTree(createProductOverHttp(merchant.id(), "未登记", List.of("/media/qiniu/55555555-5555-5555-5555-555555555555.png")))
                    .get("code")
                    .asText()
            );
            // 非法形状（非小写 UUID）。
            assertEquals(
                "0002",
                json
                    .readTree(createProductOverHttp(merchant.id(), "非法形状", List.of("/media/qiniu/5555555A-5555-5555-5555-555555555555.png")))
                    .get("code")
                    .asText()
            );
            assertEquals(imagesBefore, scalar("SELECT COUNT(*) FROM cat_product_image"), "失败请求不得新增图片行");
            assertEquals(productsBeforeFailures, scalar("SELECT COUNT(*) FROM cat_product"), "失败请求不得新增商品行");

            // 另一商户的对象不得被本商户商品引用。
            MerchantVO second = open(buyer, "第二文具商户");
            imageProperties.setProvider("QINIU");
            String foreignUrl = json.readTree(uploadImage(second.id(), buyer)).get("data").get("url").asText();
            assertEquals(
                "A0006",
                json
                    .readTree(createProductOverHttp(merchant.id(), "跨商户引用", List.of(foreignUrl)))
                    .get("code")
                    .asText()
            );
            assertEquals(0L, scalar("SELECT COUNT(*) FROM cat_product_image WHERE object_key=?", "qiniu/" + foreignUrl.substring("/media/qiniu/".length())));

            // 鉴权：匿名（带 CSRF）401、已登录无 CSRF 403、无该商户写权限 A0006 且网关未调用。
            int callsBefore = keys.size();
            assertEquals(
                401,
                mvc
                    .perform(
                        post("/api/v1/merchants/" + merchant.id() + "/images")
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}")
                    )
                    .andReturn()
                    .getResponse()
                    .getStatus()
            );
            assertEquals(
                403,
                mvc
                    .perform(
                        post("/api/v1/merchants/" + merchant.id() + "/images")
                            .with(user(owner))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}")
                    )
                    .andReturn()
                    .getResponse()
                    .getStatus()
            );
            assertEquals("A0006", json.readTree(uploadImage(merchant.id(), other)).get("code").asText());
            assertEquals(callsBefore, keys.size(), "越权请求不得调用云端上传");
            verify(qiniuGateway, times(callsBefore)).upload(any(byte[].class), anyString());
        } finally {
            imageProperties.setProvider("LOCAL");
        }
    }

    /** C：云上传失败不登记；版本冲突不认领备用对象；库存初始化失败使创建事务整体回滚。 */
    @Test
    void qiniuFailuresDoNotRegisterOrLeakClaimsAndInventoryFailureRollsBack() throws Exception {
        imageProperties.setProvider("QINIU");
        try {
            doThrow(new AppException(ResponseCode.UN_ERROR)).when(qiniuGateway).upload(any(byte[].class), anyString());
            var failed = json.readTree(uploadImage(merchant.id(), owner));
            assertEquals("0001", failed.get("code").asText(), failed.toString());
            assertTrue(failed.get("data") == null || failed.get("data").isNull(), "失败不得返回可认领地址");
            assertEquals(0L, scalar("SELECT COUNT(*) FROM cat_product_image_upload"), "云上传失败不得登记对象");

            // 版本冲突：备用对象不得被认领。
            List<String> keys = stubCloudUpload();
            String keepUrl = json.readTree(uploadImage(merchant.id(), owner)).get("data").get("url").asText();
            var created = json.readTree(createProductOverHttp(merchant.id(), "版本冲突商品", List.of(keepUrl)));
            assertEquals("0000", created.get("code").asText(), created.toString());
            String productId = created.get("data").get("productId").asText();
            String spareUrl = json.readTree(uploadImage(merchant.id(), owner)).get("data").get("url").asText();
            String spareKey = "qiniu/" + spareUrl.substring("/media/qiniu/".length());
            assertEquals(
                "G0002",
                json
                    .readTree(editProductOverHttp(merchant.id(), productId, "版本冲突商品", List.of(spareUrl), 99L))
                    .get("code")
                    .asText()
            );
            assertEquals(List.of("qiniu/" + keepUrl.substring("/media/qiniu/".length())), albumKeys(productId));
            assertNull(jdbc.queryForObject("SELECT product_id FROM cat_product_image_upload WHERE object_key=?", String.class, spareKey));
            assertEquals(2, keys.size(), "上传次数必须与真实调用一致");

            // 库存初始化故障：商品、相册、认领全部回滚（认领发生在库存初始化之前）。
            String rollbackUrl = json.readTree(uploadImage(merchant.id(), owner)).get("data").get("url").asText();
            String rollbackKey = "qiniu/" + rollbackUrl.substring("/media/qiniu/".length());
            long productsBefore = scalar("SELECT COUNT(*) FROM cat_product");
            doThrow(new IllegalStateException("fake-inventory-init-failure")).when(inventoryService).initialize(anyString(), anyString(), anyString());
            var rolledBack = json.readTree(createProductOverHttp(merchant.id(), "回滚商品", List.of(rollbackUrl)));
            assertEquals("0001", rolledBack.get("code").asText(), rolledBack.toString());
            assertEquals(productsBefore, scalar("SELECT COUNT(*) FROM cat_product"), "商品行必须回滚");
            assertEquals(0L, scalar("SELECT COUNT(*) FROM cat_product_image WHERE object_key=?", rollbackKey), "相册行必须回滚");
            assertNull(jdbc.queryForObject("SELECT product_id FROM cat_product_image_upload WHERE object_key=?", String.class, rollbackKey), "认领必须回滚");
        } finally {
            imageProperties.setProvider("LOCAL");
        }
    }

    private ProductAggregate product(int quantity) {
        var p = catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity("考试中性笔", "黑色书写", "stationery", "", List.of(new ProductSkuEntity(null, "一盒", 1200, "ACTIVE", 0)))
            )
            .product();
        catalog.setProductPublished(owner, merchant.id(), p.getId(), true);
        if (quantity > 0) catalog.replenishStock(owner, merchant.id(), p.getSkus().get(0).id(), quantity, UUID.randomUUID().toString());
        return catalogQuery.detail(p.getId()).product();
    }

    @Test
    void productImagesRemainConsistentAcrossWritesRollbackAndLegacyRequests() {
        String first = mediaFixture("11111111-1111-1111-1111-111111111111", merchant.id());
        String second = mediaFixture("22222222-2222-2222-2222-222222222222", merchant.id());
        var created = catalog.createProduct(
            owner,
            merchant.id(),
            new ProductCreateCommandEntity(
                "多图商品",
                "描述",
                "stationery",
                "",
                List.of(new ProductSkuEntity(null, "默认", 100, "ACTIVE", 0)),
                List.of(first, second)
            )
        );
        String id = created.product().getId();
        assertThrows(IllegalTransactionStateException.class, () -> productImages.findAllForUpdate(id));
        assertThrows(IllegalTransactionStateException.class, () -> productImages.insertInitial(id, merchant.id(), List.of()));
        assertThrows(IllegalTransactionStateException.class, () -> productImages.replace(id, merchant.id(), List.of()));
        assertEquals(first, created.product().getImageUrl());
        assertEquals(
            List.of(first, second),
            created
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );
        assertEquals(List.of(first, second), jdbc.queryForList("SELECT url FROM cat_product_image WHERE product_id=? ORDER BY sort_order", String.class, id));

        catalog.setProductPublished(owner, merchant.id(), id, true);
        var added = catalog.addSkuToProduct(owner, merchant.id(), id, "另一规格", 200);
        assertEquals(
            List.of(first, second),
            added
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );
        var before = catalogQuery.detail(id);
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            catalog.editProduct(owner, merchant.id(), id, "多图商品", "描述", "stationery", "", List.of(second, first), before.product().getVersion());
            status.setRollbackOnly();
        });
        var rolledBack = catalogQuery.detail(id);
        assertEquals(first, rolledBack.product().getImageUrl());
        assertEquals(
            List.of(first, second),
            rolledBack
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );
        assertEquals(
            ResponseCode.ILLEGAL_PARAMETER.getCode(),
            code(() ->
                catalog.editProduct(owner, merchant.id(), id, "多图商品", "描述", "stationery", "", List.of(first, first), rolledBack.product().getVersion())
            )
        );
        assertEquals(
            List.of(first, second),
            catalogQuery
                .detail(id)
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );

        catalog.editProduct(owner, merchant.id(), id, "多图商品", "描述", "stationery", "", List.of(second, first), rolledBack.product().getVersion());
        var reordered = catalogQuery.detail(id);
        assertEquals(second, reordered.product().getImageUrl());
        assertEquals(
            List.of(second, first),
            reordered
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );
        // 旧客户端只提交主图：first 已是相册中的副图，升为首图并保留其余副图，不得截断成单图。
        catalog.editProduct(owner, merchant.id(), id, "多图商品", "描述", "stationery", first, null, reordered.product().getVersion());
        var legacy = catalogQuery.detail(id);
        assertEquals(first, legacy.product().getImageUrl());
        assertEquals(
            List.of(first, second),
            legacy
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );
        // 旧客户端再提交当前主图却不带列表：视为不改图片，相册保持两图。
        catalog.editProduct(owner, merchant.id(), id, "多图商品", "描述", "stationery", first, null, legacy.product().getVersion());
        var untouched = catalogQuery.detail(id);
        assertEquals(
            List.of(first, second),
            untouched
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );
        // 两个图片字段都为 null：表示未提供图片变更，改标题也不动主图与相册。
        catalog.editProduct(owner, merchant.id(), id, "多图商品改标题", "描述", "stationery", null, null, untouched.product().getVersion());
        var plain = catalogQuery.detail(id);
        assertEquals("多图商品改标题", plain.product().getTitle());
        assertEquals(first, plain.product().getImageUrl());
        assertEquals(
            List.of(first, second),
            plain
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );
        // 新主图替换旧首图：third 排首位，原副图 second 保留，商品主图与图片引用首图一致。
        String third = mediaFixture("44444444-4444-4444-4444-444444444444", merchant.id());
        catalog.editProduct(owner, merchant.id(), id, "多图商品改标题", "描述", "stationery", third, null, plain.product().getVersion());
        var replaced = catalogQuery.detail(id);
        assertEquals(third, replaced.product().getImageUrl());
        assertEquals(
            List.of(third, second),
            replaced
                .images()
                .stream()
                .map(image -> image.url())
                .toList()
        );
        assertEquals(List.of(third, second), jdbc.queryForList("SELECT url FROM cat_product_image WHERE product_id=? ORDER BY sort_order", String.class, id));
        catalog.editProduct(owner, merchant.id(), id, "多图商品改标题", "描述", "stationery", third, List.of(), replaced.product().getVersion());
        var cleared = catalogQuery.detail(id);
        assertEquals("", cleared.product().getImageUrl());
        assertTrue(cleared.images().isEmpty());
    }

    @Test
    void legacySharedImageStaysEditableForEveryReferencingProduct() {
        // 旧库可能让两个商品引用同一个 /media 对象；迁移按“对象 + 商户”登记、不指定商品，
        // 已引用该对象的商品再次保存时不得因认领被占而报 A0006。
        String shared = mediaFixture("33333333-3333-3333-3333-333333333333", merchant.id());
        var first = catalog.createProduct(owner, merchant.id(), albumCommand("共享对象商品一", List.of(shared))).product();
        var second = catalog.createProduct(owner, merchant.id(), albumCommand("共享对象商品二", List.of())).product();
        jdbc.update(
            "INSERT INTO cat_product_image(image_id,product_id,provider,object_key,url,sort_order) VALUES(?,?,'LOCAL',?,?,0)",
            UUID.randomUUID().toString(),
            second.getId(),
            shared.substring("/media/".length()),
            shared
        );
        jdbc.update("UPDATE cat_product SET image_url=? WHERE id=?", shared, second.getId());
        catalog.editProduct(owner, merchant.id(), second.getId(), "共享对象商品二", "多图相册", "stationery", shared, List.of(shared), second.getVersion());
        catalog.setProductPublished(owner, merchant.id(), first.getId(), true);
        catalog.setProductPublished(owner, merchant.id(), second.getId(), true);
        assertEquals(List.of(shared), imageUrls(catalogQuery.detail(second.getId())));
        assertEquals(List.of(shared), imageUrls(catalogQuery.detail(first.getId())));
    }

    @Test
    void concurrentImageEditAndSkuAdditionReturnOneCurrentImageSnapshot() throws Exception {
        String first = mediaFixture("11111111-1111-1111-1111-111111111111", merchant.id());
        String second = mediaFixture("22222222-2222-2222-2222-222222222222", merchant.id());
        var created = catalog.createProduct(
            owner,
            merchant.id(),
            new ProductCreateCommandEntity(
                "并发多图商品",
                "描述",
                "stationery",
                "",
                List.of(new ProductSkuEntity(null, "默认", 100, "ACTIVE", 0)),
                List.of(first, second)
            )
        );
        String id = created.product().getId();
        var edited = new CountDownLatch(1);
        var snapshot = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var editing = executor.submit(() ->
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    catalog.editProduct(
                        owner,
                        merchant.id(),
                        id,
                        "并发多图商品",
                        "描述",
                        "stationery",
                        "",
                        List.of(second, first),
                        created.product().getVersion()
                    );
                    edited.countDown();
                    try {
                        if (!release.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("等待并发测试释放超时");
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(e);
                    }
                })
            );
            assertTrue(edited.await(15, TimeUnit.SECONDS));
            var adding = executor.submit(() ->
                new TransactionTemplate(transactionManager).execute(status -> {
                    assertEquals("REPEATABLE-READ", jdbc.queryForObject("SELECT @@transaction_isolation", String.class));
                    assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM iam_user WHERE id=?", Integer.class, owner));
                    snapshot.countDown();
                    return catalog.addSkuToProduct(owner, merchant.id(), id, "并发规格", 200);
                })
            );
            assertTrue(snapshot.await(15, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> adding.get(200, TimeUnit.MILLISECONDS));
            release.countDown();
            editing.get(15, TimeUnit.SECONDS);
            var result = adding.get(15, TimeUnit.SECONDS);
            assertNotNull(result);
            assertEquals(second, result.product().getImageUrl());
            assertEquals(
                List.of(second, first),
                result
                    .images()
                    .stream()
                    .map(image -> image.url())
                    .toList()
            );
        } finally {
            release.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(15, TimeUnit.SECONDS));
        }
    }

    @Test
    void concurrentSkuChangesAndAdditionReturnCurrentSkuAndStock() throws Exception {
        var created = catalog.createProduct(
            owner,
            merchant.id(),
            new ProductCreateCommandEntity("并发规格商品", "", "stationery", "", List.of(new ProductSkuEntity(null, "默认", 100, "ACTIVE", 0)))
        );
        String id = created.product().getId();
        String originalSku = created.product().getSkus().get(0).id();
        catalog.replenishStock(owner, merchant.id(), originalSku, 10, UUID.randomUUID().toString());
        var changed = new CountDownLatch(1);
        var snapshot = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var changing = executor.submit(() ->
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    catalog.changeSkuPrice(owner, merchant.id(), id, originalSku, 250, created.product().getVersion());
                    catalog.replenishStock(owner, merchant.id(), originalSku, 9, UUID.randomUUID().toString());
                    catalog.addSkuToProduct(owner, merchant.id(), id, "并发规格一", 300);
                    changed.countDown();
                    try {
                        if (!release.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("等待并发测试释放超时");
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(e);
                    }
                })
            );
            assertTrue(changed.await(15, TimeUnit.SECONDS));
            var adding = executor.submit(() ->
                new TransactionTemplate(transactionManager).execute(status -> {
                    assertEquals("REPEATABLE-READ", jdbc.queryForObject("SELECT @@transaction_isolation", String.class));
                    assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM iam_user WHERE id=?", Integer.class, owner));
                    snapshot.countDown();
                    return catalog.addSkuToProduct(owner, merchant.id(), id, "并发规格二", 400);
                })
            );
            assertTrue(snapshot.await(15, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> adding.get(200, TimeUnit.MILLISECONDS));
            release.countDown();
            changing.get(15, TimeUnit.SECONDS);
            var result = adding.get(15, TimeUnit.SECONDS);
            assertNotNull(result);
            assertAll(
                () ->
                    assertEquals(
                        Set.of("默认", "并发规格一", "并发规格二"),
                        result.product().getSkus().stream().map(ProductSkuEntity::specKey).collect(java.util.stream.Collectors.toSet()),
                        "sku set"
                    ),
                () ->
                    assertEquals(
                        250,
                        result
                            .product()
                            .getSkus()
                            .stream()
                            .filter(sku -> sku.id().equals(originalSku))
                            .findFirst()
                            .orElseThrow()
                            .priceCent(),
                        "sku price"
                    ),
                () -> assertEquals(19L, result.availableBySku().get(originalSku), "stock balance")
            );
        } finally {
            release.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(15, TimeUnit.SECONDS));
        }
    }

    private void synchronizeImageInserts(CountDownLatch ready) {
        var realDao = sqlSession.getMapper(ICatalogDao.class);
        doAnswer(invocation -> {
            ready.countDown();
            // 其他表的合法行锁可能使事务串行；限时放行，不能由测试屏障制造死锁。
            ready.await(2, TimeUnit.SECONDS);
            return realDao.insertProductImage(invocation.getArgument(0));
        })
            .when(catalogLockDao)
            .insertProductImage(any());
    }

    @Test
    void concurrentNewProductsWithImagesDoNotDeadlock() throws Exception {
        var secondMerchant = open(other, "另一并发商户");
        var ready = new CountDownLatch(2);
        synchronizeImageInserts(ready);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() ->
                catalog.createProduct(
                    owner,
                    merchant.id(),
                    new ProductCreateCommandEntity(
                        "并发商品一",
                        "",
                        "stationery",
                        "",
                        List.of(new ProductSkuEntity(null, "默认", 100, "ACTIVE", 0)),
                        List.of(mediaFixture("11111111-1111-1111-1111-111111111111", merchant.id()))
                    )
                )
            );
            var second = executor.submit(() ->
                catalog.createProduct(
                    other,
                    secondMerchant.id(),
                    new ProductCreateCommandEntity(
                        "并发商品二",
                        "",
                        "stationery",
                        "",
                        List.of(new ProductSkuEntity(null, "默认", 100, "ACTIVE", 0)),
                        List.of(mediaFixture("22222222-2222-2222-2222-222222222222", secondMerchant.id()))
                    )
                )
            );
            assertEquals(1, first.get(30, TimeUnit.SECONDS).images().size());
            assertEquals(1, second.get(30, TimeUnit.SECONDS).images().size());
            verify(catalogLockDao, never()).deleteProductImages(anyString());
        } finally {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(15, TimeUnit.SECONDS));
        }
    }

    @Test
    void concurrentFirstImageEditsDoNotDeadlock() throws Exception {
        var secondMerchant = open(other, "另一并发商户");
        var left = catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity("无图商品一", "", "stationery", "", List.of(new ProductSkuEntity(null, "默认", 100, "ACTIVE", 0)))
            )
            .product();
        var right = catalog
            .createProduct(
                other,
                secondMerchant.id(),
                new ProductCreateCommandEntity("无图商品二", "", "stationery", "", List.of(new ProductSkuEntity(null, "默认", 100, "ACTIVE", 0)))
            )
            .product();
        var ready = new CountDownLatch(2);
        synchronizeImageInserts(ready);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() ->
                catalog.editProduct(
                    owner,
                    merchant.id(),
                    left.getId(),
                    "无图商品一",
                    "",
                    "stationery",
                    "",
                    List.of(mediaFixture("11111111-1111-1111-1111-111111111111", merchant.id())),
                    left.getVersion()
                )
            );
            var second = executor.submit(() ->
                catalog.editProduct(
                    other,
                    secondMerchant.id(),
                    right.getId(),
                    "无图商品二",
                    "",
                    "stationery",
                    "",
                    List.of(mediaFixture("22222222-2222-2222-2222-222222222222", secondMerchant.id())),
                    right.getVersion()
                )
            );
            first.get(30, TimeUnit.SECONDS);
            second.get(30, TimeUnit.SECONDS);
            assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM cat_product_image", Integer.class));
            verify(catalogLockDao, never()).deleteProductImages(anyString());
        } finally {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(15, TimeUnit.SECONDS));
        }
    }

    @Test
    void lowStockFilterPagesBeforeReturningTotal() {
        var low = product(19);
        product(30);
        var empty = product(0);
        var hidden = product(1);
        catalog.setProductPublished(owner, merchant.id(), hidden.getId(), false);
        var first = catalogQuery.managedPage(owner, merchant.id(), null, null, "LOW_STOCK", 1, 1, "NEWEST");
        var second = catalogQuery.managedPage(owner, merchant.id(), null, null, "LOW_STOCK", 2, 1, "NEWEST");
        assertEquals(2L, first.total());
        assertEquals(2L, second.total());
        assertEquals(1, first.items().size());
        assertEquals(1, second.items().size());
        assertEquals(Set.of(low.getId(), empty.getId()), Set.of(first.items().get(0).product().getId(), second.items().get(0).product().getId()));
        assertEquals(0, catalogQuery.managedPage(owner, merchant.id(), "不存在", null, "LOW_STOCK", 1, 10, "NEWEST").total());
        assertEquals(
            cn.bugstack.ai.types.enums.ResponseCode.ILLEGAL_PARAMETER.getCode(),
            code(() -> catalogQuery.managedPage(owner, merchant.id(), null, null, "UNKNOWN", 1, 10, "NEWEST"))
        );
    }

    @Test
    void durableCursorAndExpiryKeysetUseCurrentDatabaseFacts() {
        var resources = syncResources;
        assertEquals("", resources.productSyncCursor());
        resources.saveProductSyncCursor("p-cursor");
        assertEquals("p-cursor", jdbc.queryForObject("SELECT last_id FROM ai_sync_checkpoint WHERE id='product-vector'", String.class));
        assertEquals("p-cursor", resources.productSyncCursor());
        var first = product(1);
        var second = product(1);
        var ids = catalogSearch.scanIdsAfter("", 1);
        assertEquals(1, ids.size());
        assertEquals(1, catalogSearch.scanIdsAfter(ids.get(0), 1).size());
        for (int n = 0; n < 205; n++) jdbc.update(
            "INSERT INTO trd_order(id,buyer_id,merchant_id,store_id,total_cent,status,deadline) VALUES(?,?,?,?,100,'PENDING_PAYMENT',?)",
            String.format("expiry-%06d", n),
            buyer,
            merchant.id(),
            merchant.storeId(),
            java.sql.Timestamp.from(clock.instant().minusSeconds(60))
        );
        var query = expiryQuery;
        var page1 = query.expiredAfter("", 100);
        var page2 = query.expiredAfter(page1.get(99), 100);
        var page3 = query.expiredAfter(page2.get(99), 100);
        assertEquals(100, page1.size());
        assertEquals(100, page2.size());
        assertEquals(5, page3.size());
        assertEquals(205, java.util.stream.Stream.of(page1, page2, page3).flatMap(List::stream).distinct().count());
        assertNotNull(query.oldestExpired());
    }

    @Test
    void concurrentPriceCheckoutAndProposalDoNotProduceInnoDbDeadlock() throws Exception {
        long before = jdbc.queryForObject("SELECT COUNT FROM information_schema.INNODB_METRICS WHERE NAME='lock_deadlocks'", Long.class);
        var product = product(100);
        for (int n = 0; n < 20; n++) {
            var current = catalogQuery.detail(product.getId()).product();
            var proposal = proposal(current);
            long price = current.getSkus().get(0).priceCent() == 1200 ? 1300 : 1200;
            var results = race(
                () -> catalog.changeSkuPrice(owner, merchant.id(), current.getId(), current.getSkus().get(0).id(), price, current.getVersion()),
                () -> checkout.checkout(buyer, merchant.id(), List.of(item(current)), UUID.randomUUID().toString()),
                () -> ai.confirm(buyer, proposal.id(), List.of(current.getSkus().get(0).id()))
            );
            assertTrue(
                results.stream().allMatch(value -> Set.of("0000", "C0002", cn.bugstack.ai.types.enums.ResponseCode.STATE_CONFLICT.getCode()).contains(value)),
                results.toString()
            );
        }
        assertEquals(before, jdbc.queryForObject("SELECT COUNT FROM information_schema.INNODB_METRICS WHERE NAME='lock_deadlocks'", Long.class));
        assertTrue(scalar("SELECT reserved FROM inv_stock_balance WHERE sku_id=?", product.getSkus().get(0).id()) <= 100);
    }

    @Test
    void creationViewUsesKnownFactsWithoutReadingInventoryAfterCommit() {
        doThrow(new IllegalStateException("unexpected inventory read")).when(inventoryService).stocks(anyList());
        var result = catalog.createProduct(
            owner,
            merchant.id(),
            new ProductCreateCommandEntity("完整创建响应", "", "stationery", "", List.of(new ProductSkuEntity(null, "默认", 100, "ACTIVE", 0)))
        );
        assertEquals(merchant.name(), result.merchantName());
        assertTrue(
            result
                .availableBySku()
                .values()
                .stream()
                .allMatch(value -> value == 0L)
        );
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM cat_product WHERE id=?", Integer.class, result.product().getId()));
        verify(inventoryService, never()).stocks(anyList());
    }

    @Test
    void addSkuViewFailureRollsBackNewSkuAndProductVersion() {
        var product = catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity("事务响应测试", "", "stationery", "", List.of(new ProductSkuEntity(null, "原规格", 100, "ACTIVE", 0)))
            )
            .product();
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
            doThrow(new IllegalStateException("inventory query unavailable")).when(inventoryService).stocksForProductWrite(anyList())
        );
        assertThrows(IllegalStateException.class, () -> catalog.addSkuToProduct(owner, merchant.id(), product.getId(), "新增规格", 200));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM cat_sku WHERE product_id=?", Integer.class, product.getId()));
        assertEquals(product.getVersion(), jdbc.queryForObject("SELECT version FROM cat_product WHERE id=?", Long.class, product.getId()));
        assertEquals(
            1,
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM inv_stock_balance WHERE sku_id IN (SELECT id FROM cat_sku WHERE product_id=?)",
                Integer.class,
                product.getId()
            )
        );
    }

    /** 排序必须发生在 SQL LIMIT/OFFSET 之前：价格与库存结果跨页稳定，COUNT 不受影响。 */
    @Test
    void merchantRowLockServicesRejectCallsWithoutOuterTransaction() {
        assertThrows(IllegalTransactionStateException.class, () -> merchantService.requireActiveForNewTrade(merchant.id()));
        assertThrows(IllegalTransactionStateException.class, () -> merchantService.changeStatus(merchant.id(), false));
        new TransactionTemplate(transactionManager).execute(status -> {
            assertEquals("ACTIVE", merchantService.requireActiveForNewTrade(merchant.id()).status());
            return null;
        });
    }

    @Test
    void catalogGlobalSortOrdersEntireResultBeforePaging() {
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 22; i++) {
            var p = catalog
                .createProduct(
                    owner,
                    merchant.id(),
                    new ProductCreateCommandEntity(
                        "排序测试商品" + i,
                        "",
                        "stationery",
                        "",
                        List.of(new ProductSkuEntity(null, "单规格", 1000L + i * 20L, "ACTIVE", 0))
                    )
                )
                .product();
            catalog.setProductPublished(owner, merchant.id(), p.getId(), true);
            catalog.replenishStock(owner, merchant.id(), p.getSkus().get(0).id(), i + 1, "sort-" + i);
            ids.add(p.getId());
        }
        assertEquals(22L, catalogSearch.count(null, "排序测试商品", null, true));
        assertEquals(
            ids.subList(0, 20),
            catalogSearch.searchSorted(null, "排序测试商品", null, true, 1, 20, "PRICE_ASC").stream().map(ProductAggregate::getId).toList()
        );
        assertEquals(
            ids.subList(20, 22),
            catalogSearch.searchSorted(null, "排序测试商品", null, true, 2, 20, "PRICE_ASC").stream().map(ProductAggregate::getId).toList()
        );
        List<String> reversed = new ArrayList<>(ids);
        Collections.reverse(reversed);
        assertEquals(
            reversed.subList(0, 20),
            catalogSearch.searchSorted(null, "排序测试商品", null, true, 1, 20, "STOCK_DESC").stream().map(ProductAggregate::getId).toList()
        );
        assertEquals(
            reversed.subList(20, 22),
            catalogSearch.searchSorted(null, "排序测试商品", null, true, 2, 20, "STOCK_DESC").stream().map(ProductAggregate::getId).toList()
        );
        assertEquals(
            ids.subList(0, 20),
            catalogSearch
                .searchManagedSorted(merchant.id(), "排序测试商品", null, "PUBLISHED", 1, 20, "PRICE_ASC")
                .stream()
                .map(ProductAggregate::getId)
                .toList()
        );
        assertThrows(AppException.class, () -> catalogSearch.searchSorted(null, "排序测试商品", null, true, 1, 20, "UNKNOWN"));
    }

    /** 商品超过 100 条时仍可召回老商品；召回只读取公开、已上架、有效 SKU。 */
    @Test
    void aiRecallSearchesWholePublishedCatalogInsteadOfNewestHundred() {
        var old = catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity(
                    "无糖乌龙茶",
                    "无糖健康茶饮",
                    "stationery",
                    "",
                    List.of(new ProductSkuEntity(null, "500ml瓶装", 500, "ACTIVE", 0))
                )
            )
            .product();
        catalog.setProductPublished(owner, merchant.id(), old.getId(), true);
        jdbc.update("UPDATE cat_product SET created_at='2025-01-01 00:00:00' WHERE id=?", old.getId());
        for (int i = 0; i < 120; i++) {
            String productId = UUID.randomUUID().toString();
            String skuId = UUID.randomUUID().toString();
            jdbc.update(
                "INSERT INTO cat_product(id,merchant_id,store_id,title,description,image_url,category_code,status,version,created_at) VALUES(?,?,?,?,?,'','stationery','PUBLISHED',0,'2026-10-28 00:00:00')",
                productId,
                merchant.id(),
                merchant.storeId(),
                "商品样例" + i,
                "普通商品"
            );
            jdbc.update(
                "INSERT INTO cat_sku(id,product_id,merchant_id,store_id,spec_key,price_cent,status,version) VALUES(?,?,?,?,?,100,'ACTIVE',0)",
                skuId,
                productId,
                merchant.id(),
                merchant.storeId(),
                "单品"
            );
        }
        assertTrue(
            catalogSearch
                .search(null, "", null, true, 1, 100)
                .stream()
                .noneMatch(p -> p.getId().equals(old.getId()))
        );
        var results = catalogSearch.recall(List.of("无糖", "乌龙"), 200);
        assertEquals(List.of(old.getId()), results.stream().map(ProductAggregate::getId).toList());
        var draft = catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity("无糖草莓茶", "", "stationery", "", List.of(new ProductSkuEntity(null, "单瓶", 500, "ACTIVE", 0)))
            )
            .product();
        assertEquals(List.of(old.getId()), catalogSearch.recall(List.of("无糖"), 200).stream().map(ProductAggregate::getId).toList());
        assertThrows(AppException.class, () -> catalogSearch.recall(List.of("%' OR 1=1 --"), 200));
    }

    /** 向量索引返回的是不可信商品ID，必须重新按 MySQL 公开状态/商户状态校验。 */
    @Test
    void semanticRecallMustRevalidateCurrentCatalogPublicationAndMerchantStatus() {
        var published = product(2);
        var draft = catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity("待发布语义商品", "", "stationery", "", List.of(new ProductSkuEntity(null, "单份", 500, "ACTIVE", 0)))
            )
            .product();
        var ids = List.of(published.getId(), draft.getId());
        assertEquals(List.of(published.getId()), catalogSearch.recallByIds(ids).stream().map(ProductAggregate::getId).toList());
        catalog.setProductPublished(owner, merchant.id(), published.getId(), false);
        assertTrue(catalogSearch.recallByIds(ids).isEmpty());
        catalog.setProductPublished(owner, merchant.id(), published.getId(), true);
        jdbc.update("UPDATE mer_merchant SET status='SUSPENDED' WHERE id=?", merchant.id());
        assertTrue(catalogSearch.recallByIds(ids).isEmpty());
    }

    private CheckoutItemEntity item(ProductAggregate p) {
        return new CheckoutItemEntity(p.getSkus().get(0).id(), 1, p.getSkus().get(0).priceCent(), p.getVersion());
    }

    private OrderAggregate order(ProductAggregate p) {
        return orderReader.order(checkout.checkout(buyer, merchant.id(), List.of(item(p)), UUID.randomUUID().toString()).orderId());
    }

    private long scalar(String sql, Object... args) {
        return Objects.requireNonNull(jdbc.queryForObject(sql, Long.class, args));
    }

    private String code(Runnable action) {
        try {
            action.run();
            return "0000";
        } catch (AppException e) {
            return e.getCode();
        }
    }

    @Test
    void conversationAndInvitationPagingCanReachTheOldestRecord() {
        var conversationRows = new ArrayList<Object[]>();
        var invitationRows = new ArrayList<Object[]>();
        for (int i = 0; i < 101; i++) {
            String suffix = String.format("%03d", i);
            conversationRows.add(new Object[] { "conversation-" + suffix, buyer, "会话" + i });
            invitationRows.add(new Object[] { "invitation-" + suffix, merchant.id(), buyer, owner });
        }
        jdbc.batchUpdate("INSERT INTO ai_conversation(id,user_id,title,created_at) VALUES(?,?,?,'2025-01-01')", conversationRows);
        jdbc.batchUpdate(
            "INSERT INTO iam_invitation(id,merchant_id,target_user_id,invited_by,status,expires_at,created_at) VALUES(?,?,?,?,'PENDING','2027-01-01','2025-01-01')",
            invitationRows
        );
        assertEquals(100, ai.conversations(buyer, 1, 100).size());
        assertEquals("conversation-100", ai.conversations(buyer, 2, 100).get(0).id());
        assertTrue(ai.conversations(other, 1, 100).isEmpty());
        assertEquals(100, access.invitations(buyer, 1, 100).size());
        assertEquals("invitation-100", access.invitations(buyer, 2, 100).get(0).id());
        assertTrue(access.invitations(other, 1, 100).isEmpty());
        assertEquals("0002", code(() -> ai.conversations(buyer, 0, 100)));
        assertEquals("0002", code(() -> access.invitations(buyer, 1, 101)));
    }

    @Test
    void knowledgeScopeIncludesTheOldestBaseAndRejectsOverflowExplicitly() {
        var baseRows = new ArrayList<Object[]>();
        for (int i = 0; i < 1001; i++) baseRows.add(new Object[] { String.format("scope-base-%04d", i), admin });
        jdbc.batchUpdate("INSERT INTO ai_knowledge_base(id,name,visibility,created_by,created_at) VALUES(?,'知识','PUBLIC',?,'2025-01-01')", baseRows);
        jdbc.update(
            "INSERT INTO ai_document_root(id,base_id,version_counter,active_document_id) VALUES('scope-root-last','scope-base-1000',1,'scope-doc-last')"
        );
        jdbc.update(
            "INSERT INTO ai_document(id,root_id,base_id,version,title,status,index_status,content) VALUES('scope-doc-last','scope-root-last','scope-base-1000',1,'较早知识','PUBLISHED','READY','可见正文')"
        );
        assertEquals(List.of("scope-doc-last"), knowledge.readableScope(buyer).stream().map(KnowledgeScopeVO::id).toList());
        var roots = new ArrayList<Object[]>();
        var documents = new ArrayList<Object[]>();
        for (int i = 0; i < 1000; i++) {
            roots.add(new Object[] { "scope-root-" + i, "scope-doc-" + i });
            documents.add(new Object[] { "scope-doc-" + i, "scope-root-" + i });
        }
        jdbc.batchUpdate("INSERT INTO ai_document_root(id,base_id,version_counter,active_document_id) VALUES(?,'scope-base-1000',1,?)", roots);
        jdbc.batchUpdate(
            "INSERT INTO ai_document(id,root_id,base_id,version,title,status,index_status,content) VALUES(?,?,'scope-base-1000',1,'知识','PUBLISHED','READY','正文')",
            documents
        );
        assertEquals("AI0005", code(() -> knowledge.readableScope(buyer)));
        jdbc.update("UPDATE ai_document SET status='WITHDRAWN' WHERE id='scope-doc-last'");
        assertEquals(1000, knowledge.readableScope(buyer).size());
    }

    @Test
    void checkoutReadModelFailureRollsBackOrderReservationAndRequestKey() {
        var p = product(3);
        doThrow(new IllegalStateException("read model unavailable")).when(merchantService).findAll(anyList());
        assertThrows(IllegalStateException.class, () -> checkout.checkout(buyer, merchant.id(), List.of(item(p)), "read-model-failure"));
        assertEquals(0L, scalar("SELECT COUNT(*) FROM trd_order"));
        assertEquals(0L, scalar("SELECT COUNT(*) FROM trd_checkout_request"));
        assertEquals(0L, scalar("SELECT SUM(reserved) FROM inv_stock_balance"));
    }

    @Test
    void paymentReadModelFailureRollsBackPaymentAndPickupTogether() {
        var o = order(product(3));
        doThrow(new IllegalStateException("read model unavailable")).when(merchantService).findAll(anyList());
        assertThrows(IllegalStateException.class, () -> life.pay(buyer, o.getId()));
        assertEquals("PENDING_PAYMENT", jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?", String.class, o.getId()));
        assertEquals(0L, scalar("SELECT COUNT(*) FROM trd_payment"));
        assertEquals(0L, scalar("SELECT COUNT(*) FROM ful_pickup_task"));
    }

    @Autowired
    ICartQueryCase cartQuery;

    @Test
    void cartStockAndUnavailableRowsRemainEditable() {
        var p = product(0);
        String sku = item(p).skuId();
        assertEquals("I0001", code(() -> cart.set(buyer, sku, 1)));
        assertTrue(cart.list(buyer).isEmpty());
        catalog.replenishStock(owner, merchant.id(), sku, 4, "cart-stock");
        cart.set(buyer, sku, 2);
        assertEquals("I0001", code(() -> cart.set(buyer, sku, 5)));
        assertEquals(2, cart.list(buyer).get(0).quantity());
        cart.set(buyer, sku, 4);
        // 模拟库存已被其他订单预占；购物车不持有库存保证。
        for (int i = 0; i < 4; i++) checkout.checkout(other, merchant.id(), List.of(item(p)), UUID.randomUUID().toString());
        assertFalse(cartQuery.list(buyer).get(0).sellable());
        assertEquals("I0001", code(() -> order(p)));
        assertEquals(4, cartQuery.list(buyer).get(0).item().quantity());
        assertEquals("I0001", code(() -> cart.set(buyer, sku, 5)));
        cart.set(buyer, sku, 3);
        catalog.forceUnpublishProduct(admin, p.getId());
        cart.set(buyer, sku, 2);
        assertEquals("C0001", code(() -> cart.set(buyer, sku, 3)));
        admission.setActive(admin, merchant.id(), false, "测试停业");
        cart.set(buyer, sku, 1);
        cart.delete(buyer, sku);
        assertTrue(cart.list(buyer).isEmpty());
    }

    @Test
    void proposalChecksAccumulatedCartAndRollsBackConfirmation() {
        var p = product(2);
        var proposal = proposal(p);
        String sku = item(p).skuId();
        cart.set(buyer, sku, 2);
        assertEquals("I0001", code(() -> ai.confirm(buyer, proposal.id(), List.of(sku))));
        assertEquals(2, cart.list(buyer).get(0).quantity());
        assertEquals("PENDING", jdbc.queryForObject("SELECT status FROM ai_proposal WHERE id=?", String.class, proposal.id()));
        assertNull(jdbc.queryForObject("SELECT selection_hash FROM ai_proposal WHERE id=?", String.class, proposal.id()));
        cart.set(buyer, sku, 1);
        ai.confirm(buyer, proposal.id(), List.of(sku));
        assertEquals(2, cart.list(buyer).get(0).quantity());
    }

    @Test
    void multiItemProposalFailureRollsBackEarlierCartWrites() {
        var products = java.util.stream.Stream.of(product(2), product(2))
            .sorted(Comparator.comparing(p -> item(p).skuId()))
            .toList();
        var full = products.get(1);
        cart.set(buyer, item(full).skuId(), 2);
        var conversation = conversations.conversation(buyer, null, "两种笔");
        var turn = conversations.beginTurn(buyer, conversation.id(), "两种笔");
        var items = products
            .stream()
            .map(p -> new ProposalItemVO(item(p).skuId(), merchant.id(), p.getTitle(), "一盒", 1200, p.getVersion(), 1))
            .toList();
        var proposal = conversationTurns.complete(turn, "两种笔", "测试提案", items, clock.instant().plusSeconds(600), "scope");
        assertEquals("I0001", code(() -> ai.confirm(buyer, proposal.id(), items.stream().map(ProposalItemVO::skuId).toList())));
        assertEquals(1, cart.list(buyer).size());
        assertEquals(2, cart.list(buyer).get(0).quantity());
        assertEquals(item(full).skuId(), cart.list(buyer).get(0).skuId());
        assertEquals("PENDING", jdbc.queryForObject("SELECT status FROM ai_proposal WHERE id=?", String.class, proposal.id()));
    }

    @Test
    void doublePayCreatesOnePaymentAndPickup() throws Exception {
        var o = order(product(2));
        assertEquals(List.of("0000", "0000"), race(() -> life.pay(buyer, o.getId()), () -> life.pay(buyer, o.getId())));
        assertEquals(1, scalar("SELECT COUNT(*) FROM trd_payment"));
        assertEquals(1, scalar("SELECT COUNT(*) FROM ful_pickup_task"));
        assertEquals("PAID", jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?", String.class, o.getId()));
    }

    @Test
    void doubleCancelReleasesReservationOnce() throws Exception {
        var o = order(product(2));
        assertEquals(List.of("0000", "0000"), race(() -> life.cancel(buyer, o.getId()), () -> life.cancel(buyer, o.getId())));
        assertEquals(0, scalar("SELECT SUM(reserved) FROM inv_stock_balance"));
        assertEquals(2, scalar("SELECT SUM(on_hand) FROM inv_stock_balance"));
        assertEquals("CANCELED", jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?", String.class, o.getId()));
        assertEquals(1, scalar("SELECT COUNT(*) FROM inv_stock_movement WHERE type='RELEASE'"));
    }

    @Test
    void doubleRefundRequestCreatesOneRequestedAfterSale() throws Exception {
        var o = order(product(2));
        life.pay(buyer, o.getId());
        assertEquals(List.of("0000", "0000"), race(() -> life.requestRefund(buyer, o.getId(), "退款"), () -> life.requestRefund(buyer, o.getId(), "退款")));
        assertEquals(1, scalar("SELECT COUNT(*) FROM trd_after_sale WHERE status='REQUESTED'"));
        assertEquals(0, scalar("SELECT COUNT(*) FROM trd_refund"));
    }

    @Test
    void doubleProposalConfirmAddsToCartOnce() throws Exception {
        var p = product(3);
        var proposal = proposal(p);
        String sku = item(p).skuId();
        assertEquals(List.of("0000", "0000"), race(() -> ai.confirm(buyer, proposal.id(), List.of(sku)), () -> ai.confirm(buyer, proposal.id(), List.of(sku))));
        assertEquals(1, cart.list(buyer).get(0).quantity());
        assertEquals("CONFIRMED", jdbc.queryForObject("SELECT status FROM ai_proposal WHERE id=?", String.class, proposal.id()));
    }

    @Test
    void skuStatusIsOwnedVersionedIdempotentAndPreservesOrders() throws Exception {
        var p = product(5);
        String first = item(p).skuId();
        var o = order(p);
        var added = catalog.addSkuToProduct(owner, merchant.id(), p.getId(), "另一规格", 1800).product();
        String second = added
            .getSkus()
            .stream()
            .filter(sku -> !sku.id().equals(first))
            .findFirst()
            .orElseThrow()
            .id();
        long version = added.getVersion();
        assertEquals("A0006", code(() -> catalog.changeSkuStatus(other, merchant.id(), p.getId(), first, false, version)));
        var foreign = open(other, "另一个商户");
        assertEquals("A0006", code(() -> catalog.changeSkuStatus(other, foreign.id(), p.getId(), first, false, version)));
        var results = race(
            () -> catalog.changeSkuStatus(owner, merchant.id(), p.getId(), first, false, version),
            () -> catalog.changeSkuStatus(owner, merchant.id(), p.getId(), second, false, version)
        );
        assertEquals(1, results.stream().filter("0000"::equals).count());
        assertEquals(1, results.stream().filter("G0002"::equals).count());
        var current = catalogSearch.find(p.getId());
        var inactive = current
            .getSkus()
            .stream()
            .filter(sku -> sku.status().equals("INACTIVE"))
            .findFirst()
            .orElseThrow();
        var active = current
            .getSkus()
            .stream()
            .filter(sku -> sku.status().equals("ACTIVE"))
            .findFirst()
            .orElseThrow();
        catalog.changeSkuStatus(owner, merchant.id(), p.getId(), inactive.id(), false, version);
        assertEquals(current.getVersion(), catalogSearch.find(p.getId()).getVersion());
        long lastVersion = current.getVersion();
        assertEquals("C0001", code(() -> catalog.changeSkuStatus(owner, merchant.id(), p.getId(), active.id(), false, lastVersion)));
        catalog.setProductPublished(owner, merchant.id(), p.getId(), false);
        current = catalogSearch.find(p.getId());
        catalog.changeSkuStatus(owner, merchant.id(), p.getId(), active.id(), false, current.getVersion());
        assertEquals("C0001", code(() -> catalog.setProductPublished(owner, merchant.id(), p.getId(), true)));
        assertEquals(1200, scalar("SELECT unit_price_cent FROM trd_order_item WHERE order_id=?", o.getId()));
        assertEquals("考试中性笔", jdbc.queryForObject("SELECT title FROM trd_order_item WHERE order_id=?", String.class, o.getId()));
    }

    @Test
    void productAlbumIsOrderedOwnedAndAtomicInRealMysql() throws Exception {
        String merchantId = merchant.id();
        List<String> urls = new ArrayList<>();
        for (int i = 0; i < 4; i++) urls.add(imageStore.storeImage(pngBytes(), merchantId));

        var created = catalog.createProduct(owner, merchantId, albumCommand("相册商品", urls));
        String productId = created.product().getId();
        assertEquals(urls, imageUrls(created));
        assertEquals(urls.get(0), created.product().getImageUrl());
        assertEquals(4L, scalar("SELECT COUNT(*) FROM cat_product_image WHERE product_id=?", productId));
        assertEquals(4L, scalar("SELECT COUNT(*) FROM cat_product_image_upload WHERE product_id=? AND merchant_id=?", productId, merchantId));

        // 重排 + 移除：上架后用消费者详情读取，只保留最后一张和第一张。
        catalog.setProductPublished(owner, merchantId, productId, true);
        long version = catalogSearch.find(productId).getVersion();
        List<String> reordered = List.of(urls.get(3), urls.get(0));
        catalog.editProduct(owner, merchantId, productId, "相册商品", "多图", "stationery", "", reordered, version);
        var edited = catalogQuery.detail(productId);
        assertEquals(reordered, imageUrls(edited));
        assertEquals(urls.get(3), edited.product().getImageUrl());

        // 清空相册：兼容主图同步为空，已认领对象仍只能回到本商品。
        catalog.editProduct(owner, merchantId, productId, "相册商品", "多图", "stationery", "", List.of(), edited.product().getVersion());
        var cleared = catalogQuery.detail(productId);
        assertEquals(List.of(), imageUrls(cleared));
        assertEquals("", cleared.product().getImageUrl());
        assertEquals(0L, scalar("SELECT COUNT(*) FROM cat_product_image WHERE product_id=?", productId));
        catalog.editProduct(owner, merchantId, productId, "相册商品", "多图", "stationery", "", List.of(urls.get(0)), cleared.product().getVersion());
        assertEquals(List.of(urls.get(0)), imageUrls(catalogQuery.detail(productId)));
    }

    @Test
    void productImageReferencesRejectForeignOwnershipMissingAndForgedObjects() throws Exception {
        String merchantId = merchant.id();
        String mine = imageStore.storeImage(pngBytes(), merchantId);
        var foreign = open(other, "另一个商户");

        // 文件存在但属于其他商户：不得被本商户引用，商品写入整体回滚。
        assertEquals("A0006", code(() -> catalog.createProduct(other, foreign.id(), albumCommand("越权商品", List.of(mine)))));
        assertEquals(0L, scalar("SELECT COUNT(*) FROM cat_product WHERE merchant_id=?", foreign.id()));
        assertEquals(0L, scalar("SELECT COUNT(*) FROM cat_product_image WHERE object_key=?", mine.substring("/media/".length())));

        // 未登记的伪造对象：即便文件存在也不能入库。
        String forged = "/media/" + UUID.randomUUID() + ".png";
        Files.createDirectories(uploadRoot());
        Files.write(uploadRoot().resolve(forged.substring("/media/".length())), pngBytes());
        assertEquals("A0006", code(() -> catalog.createProduct(owner, merchantId, albumCommand("伪造商品", List.of(forged)))));

        // 文件不存在的引用：按资源不存在拒绝，而不是静默写入。
        String missing = "/media/" + UUID.randomUUID() + ".png";
        assertEquals("G0001", code(() -> catalog.createProduct(owner, merchantId, albumCommand("缺失商品", List.of(missing)))));

        // 非法形状与去重由领域层提前拒绝，不产生任何图片行。
        assertEquals("0002", code(() -> catalog.createProduct(owner, merchantId, albumCommand("非法商品", List.of("/media/../a.png")))));
        assertEquals("0002", code(() -> catalog.createProduct(owner, merchantId, albumCommand("重复商品", List.of(mine, mine)))));
        assertEquals(0L, scalar("SELECT COUNT(*) FROM cat_product_image"));
    }

    @Test
    void productAlbumRollsBackBeforeClaimingWhenVersionConflicts() throws Exception {
        String merchantId = merchant.id();
        List<String> keep = List.of(imageStore.storeImage(pngBytes(), merchantId), imageStore.storeImage(pngBytes(), merchantId));
        var created = catalog.createProduct(owner, merchantId, albumCommand("版本商品", keep));
        String productId = created.product().getId();
        catalog.setProductPublished(owner, merchantId, productId, true);
        String spare = imageStore.storeImage(pngBytes(), merchantId);

        assertEquals("G0002", code(() -> catalog.editProduct(owner, merchantId, productId, "版本商品", "多图", "stationery", "", List.of(spare), 99)));
        assertEquals(keep, imageUrls(catalogQuery.detail(productId)));
        assertEquals(
            0L,
            scalar("SELECT COUNT(*) FROM cat_product_image_upload WHERE product_id=? AND object_key=?", productId, spare.substring("/media/".length()))
        );
    }

    private ProductCreateCommandEntity albumCommand(String title, List<String> urls) {
        return new ProductCreateCommandEntity(title, "多图相册", "stationery", "", List.of(new ProductSkuEntity(null, "标准", 900, "ACTIVE", 0)), urls);
    }

    private List<String> imageUrls(cn.bugstack.ai.cases.catalog.model.ProductReadModel model) {
        return model.images().stream().map(cn.bugstack.ai.domain.catalog.model.valobj.ProductImageVO::url).toList();
    }

    private static java.nio.file.Path uploadRoot() {
        return java.nio.file.Path.of("target", "test-uploads").toAbsolutePath();
    }

    /** 上传对象归属校验只接受已登记商户的真实对象：夹具同时落盘文件并写入上传凭证。 */
    private String mediaFixture(String objectKey, String merchantId) {
        try {
            Files.createDirectories(uploadRoot());
            Files.write(uploadRoot().resolve(objectKey + ".png"), new byte[] { 1 });
        } catch (java.io.IOException error) {
            throw new IllegalStateException("测试图片夹具写入失败", error);
        }
        jdbc.update(
            "INSERT INTO cat_product_image_upload(object_key,merchant_id) VALUES(?,?) " +
                "ON DUPLICATE KEY UPDATE merchant_id=VALUES(merchant_id),product_id=NULL",
            objectKey + ".png",
            merchantId
        );
        return "/media/" + objectKey + ".png";
    }

    /** 每个用例清空本次构建目录下的图片文件，不触碰任何运行目录。 */
    private static void resetUploads() {
        java.nio.file.Path root = uploadRoot();
        if (!Files.isDirectory(root)) return;
        try (var paths = Files.walk(root)) {
            paths.sorted((a, b) -> b.getNameCount() - a.getNameCount()).forEach(path -> path.toFile().delete());
        } catch (java.io.IOException error) {
            throw new IllegalStateException("测试图片目录清理失败", error);
        }
    }

    private static byte[] pngBytes() throws Exception {
        var out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(4, 4, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }

    @Test
    void forceUnpublishAndCheckoutRespectSerializedSaleState() throws Exception {
        long before = scalar("SELECT COUNT FROM information_schema.INNODB_METRICS WHERE NAME='lock_deadlocks'");
        for (int i = 0; i < 10; i++) {
            var p = product(2);
            // 生产锁定报价现为两个按主键执行的当前读，诊断也分别核对，不再执行联表锁计划。
            var productPlan = jdbc.queryForList("EXPLAIN SELECT * FROM cat_product WHERE id=? FOR UPDATE", p.getId());
            var skuPlan = jdbc.queryForList("EXPLAIN SELECT * FROM cat_sku WHERE id=? FOR UPDATE", item(p).skuId());
            assertEquals("PRIMARY", productPlan.get(0).get("key"));
            assertEquals("PRIMARY", skuPlan.get(0).get("key"));
            if (i == 0) System.out.println("force-unpublish checkout plan=Product:PRIMARY -> SKU:PRIMARY");
            var results = race(() -> catalog.forceUnpublishProduct(admin, p.getId()), () -> order(p));
            assertEquals("0000", results.get(0));
            assertTrue(Set.of("0000", "C0001").contains(results.get(1)), results.toString());
            assertEquals("UNPUBLISHED", catalogSearch.find(p.getId()).getStatus());
            assertEquals("C0001", code(() -> order(p)));
        }
        long after = scalar("SELECT COUNT FROM information_schema.INNODB_METRICS WHERE NAME='lock_deadlocks'");
        assertEquals(before, after, "专项竞争不得新增 InnoDB 死锁记录");
        String innodb = jdbc.queryForMap("SHOW ENGINE INNODB STATUS").get("Status").toString();
        System.out.println(
            "force-unpublish checkout: races=10, newDeadlocks=" +
                (after - before) +
                ", historicalDeadlockPresent=" +
                innodb.contains("LATEST DETECTED DEADLOCK")
        );
    }

    @Autowired
    org.mybatis.spring.SqlSessionTemplate catalogLockSqlSession;

    @SpyBean
    cn.bugstack.ai.infrastructure.dao.ICatalogDao catalogLockDao;

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({ "3,2,0", "2,1,1" })
    void concurrentCartIncrementsAreAccumulatedAndStockBounded(int stock, int successes, int failures) throws Exception {
        var p = product(stock);
        String sku = item(p).skuId();
        cart.set(buyer, sku, 1);
        var results = race(() -> cart.add(buyer, sku, 1), () -> cart.add(buyer, sku, 1));
        assertEquals(successes, results.stream().filter("0000"::equals).count());
        assertEquals(failures, results.stream().filter("I0001"::equals).count());
        assertEquals(1 + successes, cart.list(buyer).get(0).quantity());
        assertEquals(0, scalar("SELECT SUM(reserved) FROM inv_stock_balance"));
    }

    @Test
    void cartIncrementLimitAndUnavailableStateDoNotMutateCart() {
        var p = product(120);
        String sku = item(p).skuId();
        cart.set(buyer, sku, 98);
        cart.add(buyer, sku, 1);
        assertEquals("T0005", code(() -> cart.add(buyer, sku, 1)));
        assertEquals("0002", code(() -> cart.add(buyer, sku, 0)));
        assertEquals(99, cart.list(buyer).get(0).quantity());
        catalog.forceUnpublishProduct(admin, p.getId());
        assertEquals("C0001", code(() -> cart.add(buyer, sku, 1)));
        assertEquals(99, cart.list(buyer).get(0).quantity());
    }

    @Test
    void lockedOffersIgnoreEarlierRepeatableReadQuoteSnapshot() throws Exception {
        var p = product(5);
        String sku = item(p).skuId();
        var pool = Executors.newSingleThreadExecutor();
        try {
            new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
                assertEquals(1200, catalogSearch.offers(List.of(sku)).get(0).priceCent());
                try {
                    pool.submit(() -> catalog.changeSkuPrice(owner, merchant.id(), p.getId(), sku, 1600, p.getVersion())).get(10, TimeUnit.SECONDS);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
                var locked = catalogSearch.saleOffersForUpdate(List.of(sku)).get(0);
                assertEquals(1600, locked.priceCent());
                assertEquals(p.getVersion() + 1, locked.version());
            });
        } finally {
            pool.shutdownNow();
        }
    }

    @SpyBean
    cn.bugstack.ai.infrastructure.adapter.repository.CatalogRepository catalogLockRepository;

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({ "unpublish,checkout", "sku,checkout", "unpublish,cart", "sku,cart" })
    void productLockWaitDoesNotPrelockSku(String writerKind, String consumerKind) throws Exception {
        var original = product(5);
        var p = catalog.addSkuToProduct(owner, merchant.id(), original.getId(), "备用规格", 1500).product();
        String sku = item(original).skuId();
        var held = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var consumerStarted = new CountDownLatch(1);
        var connection = new java.util.concurrent.atomic.AtomicLong();
        doAnswer(invocation -> {
            if (Thread.currentThread().getName().equals("catalog-lock-writer")) {
                held.countDown();
                if (!release.await(30, TimeUnit.SECONDS)) throw new IllegalStateException("商品锁测试等待超时");
            }
            // 继续执行同一个真实 MyBatis 映射；只暂停时序，不替换 SQL 或返回值。
            return catalogLockSqlSession.selectList("cn.bugstack.ai.infrastructure.dao.ICatalogDao.skusForUpdate", Map.of("productId", p.getId()));
        })
            .when(catalogLockDao)
            .skusForUpdate(p.getId());
        doAnswer(invocation -> {
            connection.set(scalar("SELECT CONNECTION_ID()"));
            consumerStarted.countDown();
            return invocation.callRealMethod();
        })
            .when(catalogLockRepository)
            .offers(anyList(), eq(true));
        var pool = Executors.newFixedThreadPool(2);
        Future<String> writer = null;
        Future<String> consumer = null;
        try {
            writer = pool.submit(() -> {
                Thread.currentThread().setName("catalog-lock-writer");
                return code(() -> {
                    if (writerKind.equals("unpublish")) catalog.forceUnpublishProduct(admin, p.getId());
                    else catalog.changeSkuStatus(owner, merchant.id(), p.getId(), sku, false, p.getVersion());
                });
            });
            assertTrue(held.await(10, TimeUnit.SECONDS), "写操作必须已持有 Product 并暂停在 SKU 读取前");
            consumer = pool.submit(() ->
                code(() -> {
                    if (consumerKind.equals("checkout")) checkout.checkout(
                        buyer,
                        merchant.id(),
                        List.of(new CheckoutItemEntity(sku, 1, 1200, p.getVersion())),
                        UUID.randomUUID().toString()
                    );
                    else cart.add(buyer, sku, 1);
                })
            );
            assertTrue(consumerStarted.await(10, TimeUnit.SECONDS));
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            while (
                System.nanoTime() < deadline &&
                scalar("SELECT COUNT(*) FROM information_schema.INNODB_TRX WHERE trx_mysql_thread_id=? AND trx_state='LOCK WAIT'", connection.get()) == 0
            ) {
                // INNODB_TRX 快照需有超过 100ms 的读取间隔，频繁轮询会一直看到旧状态。
                Thread.sleep(200);
            }
            assertEquals(
                1,
                scalar("SELECT COUNT(*) FROM information_schema.INNODB_TRX WHERE trx_mysql_thread_id=? AND trx_state='LOCK WAIT'", connection.get()),
                "consumerConnection=" +
                    connection.get() +
                    ", done=" +
                    consumer.isDone() +
                    ", transactions=" +
                    jdbc.queryForList("SELECT trx_mysql_thread_id,trx_state FROM information_schema.INNODB_TRX") +
                    ", process=" +
                    jdbc.queryForList("SELECT ID,STATE FROM information_schema.PROCESSLIST WHERE ID=?", connection.get())
            );
            // 第三个真实事务探测 SKU：等待 Product 的消费者不能抢先持有 SKU，避免与写操作形成环。
            assertDoesNotThrow(
                () ->
                    new TransactionTemplate(transactionManager).executeWithoutResult(tx ->
                        assertEquals(sku, jdbc.queryForObject("SELECT id FROM cat_sku WHERE id=? FOR UPDATE NOWAIT", String.class, sku))
                    ),
                "等待 Product 时已经持有 SKU，存在反向锁序"
            );
        } finally {
            release.countDown();
            try {
                if (writer != null) assertEquals("0000", writer.get(30, TimeUnit.SECONDS));
                if (consumer != null) assertEquals("C0001", consumer.get(30, TimeUnit.SECONDS));
            } finally {
                pool.shutdownNow();
            }
        }
        assertEquals(0, scalar("SELECT COUNT(*) FROM trd_order"));
        assertTrue(cart.list(buyer).isEmpty());
        assertEquals(0, scalar("SELECT SUM(reserved) FROM inv_stock_balance"));
    }

    private List<String> race(Runnable... workItems) throws Exception {
        var pool = Executors.newFixedThreadPool(workItems.length);
        var ready = new CountDownLatch(workItems.length);
        var start = new CountDownLatch(1);
        java.util.function.Function<Runnable, Callable<String>> call = work -> () -> {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("等待超时");
            return code(work);
        };
        try {
            var futures = java.util.Arrays.stream(workItems)
                .map(work -> pool.submit(call.apply(work)))
                .toList();
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            var results = new java.util.ArrayList<String>();
            for (var future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        } finally {
            start.countDown();
            pool.shutdownNow();
        }
    }

    /** 关键字是字面子串，商品/商户/SKU/规格搜索及列表和 COUNT 必须等价。 */
    @Test
    void catalogLiteralSearchAndCountCoverMerchantSkuAndSpecification() {
        var percent = catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity(
                    "校园100%果茶",
                    "特价批次",
                    "stationery",
                    "",
                    List.of(new ProductSkuEntity(null, "限量规格搜索A", 1200, "ACTIVE", 0))
                )
            )
            .product();
        var underscore = catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity(
                    "校园_书写套装",
                    "规格说明",
                    "stationery",
                    "",
                    List.of(new ProductSkuEntity(null, "限量规格搜索B", 1300, "ACTIVE", 0))
                )
            )
            .product();
        catalog.setProductPublished(owner, merchant.id(), percent.getId(), true);
        catalog.setProductPublished(owner, merchant.id(), underscore.getId(), true);
        assertEquals(List.of(percent.getId()), catalogSearch.search(null, "%", null, true, 1, 100).stream().map(ProductAggregate::getId).toList());
        assertEquals(1L, catalogSearch.count(null, "%", null, true));
        assertEquals(List.of(underscore.getId()), catalogSearch.search(null, "_", null, true, 1, 100).stream().map(ProductAggregate::getId).toList());
        assertEquals(1L, catalogSearch.count(null, "_", null, true));
        assertEquals(2, catalogSearch.search(null, "测试文具商户", null, true, 1, 100).size());
        assertEquals(2L, catalogSearch.count(null, "测试文具商户", null, true));
        assertEquals(1, catalogSearch.search(null, "限量规格搜索A", null, true, 1, 100).size());
        assertEquals(1L, catalogSearch.count(null, "限量规格搜索A", null, true));
        String skuId = percent.getSkus().get(0).id();
        assertEquals(List.of(percent.getId()), catalogSearch.search(null, skuId, null, true, 1, 100).stream().map(ProductAggregate::getId).toList());
        assertEquals(1L, catalogSearch.count(null, skuId, null, true));
        assertEquals(1, catalogQuery.managedPage(owner, merchant.id(), "限量规格搜索B", null, "", 1, 100, "NEWEST").items().size());
        assertEquals(1L, catalogQuery.managedPage(owner, merchant.id(), "限量规格搜索B", null, "", 1, 100, "NEWEST").total());
    }

    @Test
    void approvalAtomicallyCreatesStoreAndOwnerAndIsIdempotent() {
        var second = admission.approve(admin, merchant.applicationId());
        assertEquals(merchant.id(), second.id());
        assertEquals(1, scalar("SELECT COUNT(*) FROM mer_merchant WHERE source_application_id=?", merchant.applicationId()));
        assertEquals(1, scalar("SELECT COUNT(*) FROM mer_store WHERE merchant_id=?", merchant.id()));
        access.requireMember(owner, merchant.id(), true);
    }

    @Test
    void approvalFailureRollsBackAllThreeDomains() {
        var a = applications.submitDetailed(other, new AdmissionCommandEntity("回滚测试", "食品", "联系人", "10000000000", "门店", "东门"), "rollback");
        doThrow(new IllegalStateException("测试注入授权写入失败")).when(accessRepository).grantOwner(anyString(), eq(other), eq(a.getApplicationId()));
        assertThrows(IllegalStateException.class, () -> admission.approve(admin, a.getApplicationId()));
        assertEquals("SUBMITTED", jdbc.queryForObject("SELECT status FROM mer_application WHERE application_id=?", String.class, a.getApplicationId()));
        assertEquals(0, scalar("SELECT COUNT(*) FROM mer_merchant WHERE source_application_id=?", a.getApplicationId()));
        assertEquals(0, scalar("SELECT COUNT(*) FROM iam_merchant_membership WHERE user_id=?", other));
    }

    @Test
    void ordinaryUserAndSelfReviewerCannotApprove() {
        var a = applications.submitDetailed(admin, new AdmissionCommandEntity("本人申请", "食品", "联系人", "10000000000", "门店", "东门"), "self");
        assertEquals("A0006", code(() -> admission.approve(buyer, a.getApplicationId())));
        assertEquals("M0003", code(() -> admission.approve(admin, a.getApplicationId())));
    }

    @Test
    void lastStockOnlyOneConcurrentCheckoutSucceeds() throws Exception {
        var p = product(1);
        var result = race(
            () -> checkout.checkout(buyer, merchant.id(), List.of(item(p)), "race-a"),
            () -> checkout.checkout(other, merchant.id(), List.of(item(p)), "race-b")
        );
        assertEquals(1, result.stream().filter("0000"::equals).count());
        assertEquals(1, result.stream().filter("I0001"::equals).count());
        assertEquals(1, scalar("SELECT reserved FROM inv_stock_balance WHERE sku_id=?", p.getSkus().get(0).id()));
        assertEquals(1, scalar("SELECT COUNT(*) FROM trd_order"));
    }

    @Test
    void concurrentRetryCreatesOneOrderAndOneReservation() throws Exception {
        var p = product(5);
        var result = race(
            () -> checkout.checkout(buyer, merchant.id(), List.of(item(p)), "same-key"),
            () -> checkout.checkout(buyer, merchant.id(), List.of(item(p)), "same-key")
        );
        assertEquals(List.of("0000", "0000"), result);
        assertEquals(1, scalar("SELECT COUNT(*) FROM trd_order"));
        assertEquals(1, scalar("SELECT COUNT(*) FROM inv_reservation"));
        assertEquals(1, scalar("SELECT reserved FROM inv_stock_balance WHERE sku_id=?", p.getSkus().get(0).id()));
    }

    @Test
    void stalePriceFailsWithoutLeavingReservationOrRequestGate() {
        var p = product(3);
        catalog.changeSkuPrice(owner, merchant.id(), p.getId(), p.getSkus().get(0).id(), 1500, p.getVersion());
        assertEquals("C0002", code(() -> order(p)));
        assertEquals(0, scalar("SELECT COUNT(*) FROM trd_order"));
        assertEquals(0, scalar("SELECT COUNT(*) FROM trd_checkout_request"));
        assertEquals(0, scalar("SELECT COUNT(*) FROM inv_reservation"));
    }

    @Test
    void sameRequestDifferentContentsCannotCreateAnotherOrder() {
        var p = product(4);
        checkout.checkout(buyer, merchant.id(), List.of(item(p)), "same");
        var changed = new CheckoutItemEntity(item(p).skuId(), 2, 1200, p.getVersion());
        assertEquals("G0003", code(() -> checkout.checkout(buyer, merchant.id(), List.of(changed), "same")));
        assertEquals(1, scalar("SELECT COUNT(*) FROM trd_order"));
    }

    @Test
    void paymentAndCancellationRaceLeavesOneConsistentOutcome() throws Exception {
        var p = product(2);
        var o = order(p);
        var result = race(() -> life.pay(buyer, o.getId()), () -> life.cancel(buyer, o.getId()));
        assertEquals(1, result.stream().filter("0000"::equals).count());
        String status = jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?", String.class, o.getId());
        if ("PAID".equals(status)) {
            assertEquals(1, scalar("SELECT COUNT(*) FROM trd_payment"));
            assertEquals(1, scalar("SELECT COUNT(*) FROM ful_pickup_task"));
            assertEquals(1, scalar("SELECT reserved FROM inv_stock_balance"));
        } else {
            assertEquals("CANCELED", status);
            assertEquals(0, scalar("SELECT COUNT(*) FROM trd_payment"));
            assertEquals(0, scalar("SELECT reserved FROM inv_stock_balance"));
        }
    }

    @Test
    void expiryReleasesOnlyOnce() {
        var p = product(2);
        var o = order(p);
        clock.now = clock.now.plusSeconds(901);
        life.expire(o.getId());
        life.expire(o.getId());
        assertEquals(0, scalar("SELECT reserved FROM inv_stock_balance"));
        assertEquals(1, scalar("SELECT COUNT(*) FROM inv_stock_movement WHERE type='RELEASE'"));
        assertEquals("T0001", code(() -> life.pay(buyer, o.getId())));
    }

    @Test
    void pickupReissueInvalidatesOldTokenAndDuplicateIsSafe() {
        var p = product(2);
        var o = order(p);
        life.pay(buyer, o.getId());
        life.markReady(owner, merchant.id(), o.getId());
        var old = life.issuePickupToken(buyer, o.getId());
        var current = life.issuePickupToken(buyer, o.getId());
        assertEquals("F0001", code(() -> life.verifyPickup(owner, merchant.id(), o.getId(), old.token())));
        life.verifyPickup(owner, merchant.id(), o.getId(), current.token());
        life.verifyPickup(owner, merchant.id(), o.getId(), current.token());
        assertEquals(1, scalar("SELECT on_hand FROM inv_stock_balance"));
        assertEquals(0, scalar("SELECT reserved FROM inv_stock_balance"));
        assertEquals(1, scalar("SELECT COUNT(*) FROM ful_pickup_verification"));
    }

    @Test
    void refundRequestAndPickupCannotBothWin() throws Exception {
        var p = product(2);
        var o = order(p);
        life.pay(buyer, o.getId());
        life.markReady(owner, merchant.id(), o.getId());
        var token = life.issuePickupToken(buyer, o.getId());
        var result = race(() -> life.requestRefund(buyer, o.getId(), "未提货退款"), () -> life.verifyPickup(owner, merchant.id(), o.getId(), token.token()));
        assertEquals(1, result.stream().filter("0000"::equals).count());
        long requests = scalar("SELECT COUNT(*) FROM trd_after_sale");
        if (requests == 1) {
            life.merchantApproveRefund(owner, merchant.id(), o.getId(), "同意");
            assertEquals(2, scalar("SELECT on_hand FROM inv_stock_balance"));
        } else assertEquals(1, scalar("SELECT on_hand FROM inv_stock_balance"));
        assertEquals(0, scalar("SELECT reserved FROM inv_stock_balance"));
    }

    @Test
    void approvedRefundReplaysWithoutDoubleReleaseOrPayout() {
        var p = product(2);
        var o = order(p);
        life.pay(buyer, o.getId());
        life.requestRefund(buyer, o.getId(), "取消购买");
        life.merchantApproveRefund(owner, merchant.id(), o.getId(), "同意");
        life.merchantApproveRefund(owner, merchant.id(), o.getId(), "同意");
        assertEquals(1, scalar("SELECT COUNT(*) FROM trd_refund"));
        assertEquals(2, scalar("SELECT on_hand FROM inv_stock_balance"));
        assertEquals(0, scalar("SELECT reserved FROM inv_stock_balance"));
        assertEquals("T0001", code(() -> life.verifyPickup(owner, merchant.id(), o.getId(), "invalid")));
    }

    @Test
    void platformReviewRequiresAppealAndConcurrentApprovalPaysOnlyOnce() throws Exception {
        var o = order(product(2));
        life.pay(buyer, o.getId());
        life.requestRefund(buyer, o.getId(), "未提货");
        assertEquals("A0006", code(() -> life.platformApproveRefund(buyer, o.getId(), "越权")));
        assertEquals("T0004", code(() -> life.platformApproveRefund(admin, o.getId(), "跳过申诉")));
        assertEquals("T0004", code(() -> life.platformRejectRefund(admin, o.getId(), "跳过申诉")));
        assertEquals(0, scalar("SELECT COUNT(*) FROM sys_audit WHERE action LIKE 'REFUND_%'"));
        assertEquals(0, scalar("SELECT COUNT(*) FROM trd_refund"));
        assertEquals(1, scalar("SELECT reserved FROM inv_stock_balance"));
        life.merchantRejectRefund(owner, merchant.id(), o.getId(), "商户驳回");
        life.merchantRejectRefund(owner, merchant.id(), o.getId(), "重复驳回");
        assertEquals(1, scalar("SELECT COUNT(*) FROM sys_audit WHERE action='REFUND_REJECTED'"));
        assertEquals("T0004", code(() -> life.platformApproveRefund(admin, o.getId(), "尚未申诉")));
        life.appeal(buyer, o.getId());
        assertEquals("A0006", code(() -> life.merchantApproveRefund(owner, merchant.id(), o.getId(), "争议中")));
        assertEquals(
            List.of("0000", "0000"),
            race(() -> life.platformApproveRefund(admin, o.getId(), "平台同意"), () -> life.platformApproveRefund(admin, o.getId(), "平台同意"))
        );
        assertEquals(1, scalar("SELECT COUNT(*) FROM trd_refund"));
        assertEquals(1, scalar("SELECT COUNT(*) FROM sys_audit WHERE action='REFUND_APPROVED'"));
        assertEquals(2, scalar("SELECT on_hand FROM inv_stock_balance"));
        assertEquals(0, scalar("SELECT reserved FROM inv_stock_balance"));
        assertEquals("CANCELED", jdbc.queryForObject("SELECT status FROM ful_pickup_task WHERE order_id=?", String.class, o.getId()));
    }

    @Test
    void platformRejectsDisputeWithoutDuplicateAuditOnRetry() {
        var o = order(product(2));
        life.pay(buyer, o.getId());
        life.requestRefund(buyer, o.getId(), "未提货");
        life.merchantRejectRefund(owner, merchant.id(), o.getId(), "商户驳回");
        life.appeal(buyer, o.getId());
        life.platformRejectRefund(admin, o.getId(), "平台驳回");
        assertEquals("T0004", code(() -> life.platformRejectRefund(admin, o.getId(), "重复裁决")));
        assertEquals(2, scalar("SELECT COUNT(*) FROM sys_audit WHERE action='REFUND_REJECTED'"));
        assertEquals(0, scalar("SELECT COUNT(*) FROM trd_refund"));
        assertEquals(1, scalar("SELECT reserved FROM inv_stock_balance"));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = { "afterSale", "fulfillment", "inventory", "refund", "order", "audit" })
    void refundFailureAtEachStepRollsBackEveryDomain(String stage) {
        var o = order(product(2));
        life.pay(buyer, o.getId());
        life.requestRefund(buyer, o.getId(), "未提货");
        life.merchantRejectRefund(owner, merchant.id(), o.getId(), "商户驳回");
        life.appeal(buyer, o.getId());
        org.mockito.stubbing.Answer<Object> failAfterWrite = call -> {
            call.callRealMethod();
            throw new IllegalStateException("injected transaction failure");
        };
        // 故障注入到事务代理内部的 spy；不能在无事务的 stubbing 阶段调用 MANDATORY 代理。
        cn.bugstack.ai.domain.trading.service.IAfterSaleService afterSaleTarget = org.springframework.test.util.AopTestUtils.getUltimateTargetObject(
            refundAfterSales
        );
        cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService fulfillmentTarget = org.springframework.test.util.AopTestUtils.getUltimateTargetObject(
            refundFulfillment
        );
        cn.bugstack.ai.domain.inventory.service.IInventoryService inventoryTarget = org.springframework.test.util.AopTestUtils.getUltimateTargetObject(
            inventoryService
        );
        IOrderService orderTarget = org.springframework.test.util.AopTestUtils.getUltimateTargetObject(orderStore);
        switch (stage) {
            case "afterSale" -> doAnswer(failAfterWrite).when(afterSaleTarget).approveAfterSale(eq(o.getId()), anyString());
            case "fulfillment" -> doAnswer(failAfterWrite).when(fulfillmentTarget).cancel(o.getId());
            case "inventory" -> doAnswer(failAfterWrite).when(inventoryTarget).release(o.getId());
            case "refund" -> doAnswer(failAfterWrite).when(orderTarget).recordRefund(any());
            case "order" -> doAnswer(failAfterWrite).when(orderTarget).save(any());
            case "audit" -> doAnswer(failAfterWrite).when(accessRepository).audit(any(), eq("REFUND_APPROVED"), any(), any(), any());
            default -> fail("unknown stage");
        }
        assertThrows(IllegalStateException.class, () -> life.platformApproveRefund(admin, o.getId(), "平台同意"));
        assertEquals("PAID", jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?", String.class, o.getId()));
        assertEquals("DISPUTED", jdbc.queryForObject("SELECT status FROM trd_after_sale WHERE order_id=?", String.class, o.getId()));
        assertEquals("WAIT_PREP", jdbc.queryForObject("SELECT status FROM ful_pickup_task WHERE order_id=?", String.class, o.getId()));
        assertEquals(0, scalar("SELECT COUNT(*) FROM trd_refund"));
        assertEquals(0, scalar("SELECT COUNT(*) FROM sys_audit WHERE action='REFUND_APPROVED'"));
        assertEquals(2, scalar("SELECT on_hand FROM inv_stock_balance"));
        assertEquals(1, scalar("SELECT reserved FROM inv_stock_balance"));
        assertEquals("RESERVED", jdbc.queryForObject("SELECT status FROM inv_reservation WHERE order_id=?", String.class, o.getId()));
    }

    @Test
    void merchantStatusRetriesDoNotChangeVersionOrAuditAndAuditFailureRollsBack() throws Exception {
        long version = scalar("SELECT version FROM mer_merchant WHERE id=?", merchant.id());
        assertEquals(
            List.of("0000", "0000"),
            race(() -> admission.setActive(admin, merchant.id(), false, "暂停"), () -> admission.setActive(admin, merchant.id(), false, "暂停"))
        );
        assertEquals(version + 1, scalar("SELECT version FROM mer_merchant WHERE id=?", merchant.id()));
        assertEquals(1, scalar("SELECT COUNT(*) FROM sys_audit WHERE action='MERCHANT_SUSPENDED'"));
        admission.setActive(admin, merchant.id(), true, "恢复");
        admission.setActive(admin, merchant.id(), true, "恢复重试");
        assertEquals(version + 2, scalar("SELECT version FROM mer_merchant WHERE id=?", merchant.id()));
        assertEquals(1, scalar("SELECT COUNT(*) FROM sys_audit WHERE action='MERCHANT_RESUMED'"));
        doAnswer(call -> {
            call.callRealMethod();
            throw new IllegalStateException("audit unavailable");
        })
            .when(accessRepository)
            .audit(any(), eq("MERCHANT_SUSPENDED"), any(), any(), any());
        assertThrows(IllegalStateException.class, () -> admission.setActive(admin, merchant.id(), false, "失败暂停"));
        assertEquals("ACTIVE", merchantService.find(merchant.id()).status());
        assertEquals(version + 2, scalar("SELECT version FROM mer_merchant WHERE id=?", merchant.id()));
        assertEquals(1, scalar("SELECT COUNT(*) FROM sys_audit WHERE action='MERCHANT_SUSPENDED'"));
    }

    @Test
    void merchantIsolationAndRevocationAreCheckedAtOperationTime() {
        var p = product(2);
        assertEquals("A0006", code(() -> catalog.replenishStock(other, merchant.id(), p.getSkus().get(0).id(), 1, "bad")));
        var invitation = access.invite(owner, merchant.id(), "testother");
        access.accept(other, invitation.id());
        access.requireMember(other, merchant.id(), false);
        assertEquals("A0006", code(() -> catalog.changeSkuPrice(other, merchant.id(), p.getId(), p.getSkus().get(0).id(), 1600, p.getVersion())));
        access.revoke(owner, merchant.id(), other);
        assertEquals("A0006", code(() -> access.requireMember(other, merchant.id(), false)));
    }

    @Test
    void suspendBlocksNewOrdersButNotPaidFulfillment() {
        var p = product(2);
        var o = order(p);
        life.pay(buyer, o.getId());
        admission.setActive(admin, merchant.id(), false, "监管暂停");
        assertEquals("M0004", code(() -> order(p)));
        life.markReady(owner, merchant.id(), o.getId());
        var token = life.issuePickupToken(buyer, o.getId());
        life.verifyPickup(owner, merchant.id(), o.getId(), token.token());
        assertEquals("COMPLETED", jdbc.queryForObject("SELECT status FROM trd_order WHERE id=?", String.class, o.getId()));
    }

    @Test
    void proposalConfirmationIsOwnedVersionedAndExactlyOnce() {
        var p = product(4);
        var conversation = conversations.conversation(buyer, null, "买笔");
        var draft = new ProposalVO(
            UUID.randomUUID().toString(),
            buyer,
            conversation.id(),
            "PENDING",
            List.of(new ProposalItemVO(item(p).skuId(), merchant.id(), p.getTitle(), "一盒", 1200, p.getVersion(), 1)),
            null,
            clock.instant().plusSeconds(600)
        );
        var turn = conversations.beginTurn(buyer, conversation.id(), "买笔");
        var proposal = conversationTurns.complete(turn, "买笔", "仅测试提案，不调用模型", draft.items(), draft.expiresAt(), "scope");
        assertEquals("G0001", code(() -> ai.confirm(other, proposal.id(), List.of(item(p).skuId()))));
        ai.confirm(buyer, proposal.id(), List.of(item(p).skuId()));
        ai.confirm(buyer, proposal.id(), List.of(item(p).skuId()));
        assertEquals(1, cart.list(buyer).get(0).quantity());
    }

    @Test
    void knowledgeInternalScopeAndWithdrawalAreEffectiveImmediately() {
        var base = knowledge.createBase(owner, merchant.id(), "内部资料", "MERCHANT_INTERNAL");
        var doc = aiState.createDocument(null, base.id(), "内部说明", "不得给普通买家看的内容");
        // 这里只验证 Java ACL/版本状态，索引构建由 Python 独立测试，不假装已调用向量库。
        aiState.completeIndex(aiState.beginIndex(doc.id()), true, "");
        knowledge.publish(owner, doc.id());
        assertTrue(
            knowledge
                .readableScope(owner)
                .stream()
                .anyMatch(d -> d.id().equals(doc.id()))
        );
        assertTrue(
            knowledge
                .readableScope(buyer)
                .stream()
                .noneMatch(d -> d.id().equals(doc.id()))
        );
        knowledge.withdraw(owner, doc.id());
        assertTrue(
            knowledge
                .readableScope(owner)
                .stream()
                .noneMatch(d -> d.id().equals(doc.id()))
        );
    }

    @Test
    void replenishRetryDoesNotAddTwice() {
        var p = product(0);
        String sku = item(p).skuId();
        catalog.replenishStock(owner, merchant.id(), sku, 5, "once");
        catalog.replenishStock(owner, merchant.id(), sku, 5, "once");
        assertEquals(5, scalar("SELECT on_hand FROM inv_stock_balance"));
        assertEquals("G0003", code(() -> catalog.replenishStock(owner, merchant.id(), sku, 6, "once")));
    }

    @Test
    void requestKeyIsCaseSensitive() {
        var p = product(4);
        checkout.checkout(buyer, merchant.id(), List.of(item(p)), "Key-A");
        checkout.checkout(buyer, merchant.id(), List.of(item(p)), "key-a");
        assertEquals(2, scalar("SELECT COUNT(*) FROM trd_order"));
    }

    @Test
    void profileIsOwnerOnlyAndAdminCanModerateWithoutOwnership() {
        assertEquals("A0006", code(() -> admission.updateProfile(other, merchant.id(), "越权商户", "门店", "地点")));
        admission.updateProfile(owner, merchant.id(), "更新商户", "校园新店", "西门三楼");
        assertEquals("更新商户", jdbc.queryForObject("SELECT name FROM mer_merchant WHERE id=?", String.class, merchant.id()));
        assertEquals("西门三楼", jdbc.queryForObject("SELECT location FROM mer_store WHERE merchant_id=?", String.class, merchant.id()));
        var p = product(2);
        assertFalse(catalogQuery.adminProducts(admin, null, "", 1, 20).isEmpty());
        assertEquals("A0006", code(() -> catalogQuery.adminProducts(other, null, "", 1, 20)));
        catalog.forceUnpublishProduct(admin, p.getId());
        assertEquals("C0001", code(() -> catalogQuery.detail(p.getId())));
    }

    @Test
    void proposalConfirmationRollsBackStateWhenPriceChanges() {
        var product = product(4);
        var proposal = proposal(product);
        catalog.changeSkuPrice(owner, merchant.id(), product.getId(), item(product).skuId(), 1500, product.getVersion());
        assertEquals("C0002", code(() -> ai.confirm(buyer, proposal.id(), List.of(item(product).skuId()))));
        assertEquals("PENDING", jdbc.queryForObject("SELECT status FROM ai_proposal WHERE id=?", String.class, proposal.id()));
        assertNull(jdbc.queryForObject("SELECT selection_hash FROM ai_proposal WHERE id=?", String.class, proposal.id()));
        assertEquals(0, scalar("SELECT COUNT(*) FROM trd_cart_item"));
    }

    @Test
    void proposalConfirmationRollsBackWhenCartLimitRejectsAddition() {
        var product = product(120);
        cart.set(buyer, item(product).skuId(), 99);
        var proposal = proposal(product);
        assertEquals("T0005", code(() -> ai.confirm(buyer, proposal.id(), List.of(item(product).skuId()))));
        assertEquals("PENDING", jdbc.queryForObject("SELECT status FROM ai_proposal WHERE id=?", String.class, proposal.id()));
        assertEquals(99, scalar("SELECT quantity FROM trd_cart_item WHERE user_id=?", buyer));
    }

    private ProposalVO proposal(ProductAggregate product) {
        var conversation = conversations.conversation(buyer, null, "买笔");
        var draft = new ProposalVO(
            UUID.randomUUID().toString(),
            buyer,
            conversation.id(),
            "PENDING",
            List.of(new ProposalItemVO(item(product).skuId(), merchant.id(), product.getTitle(), "一盒", 1200, product.getVersion(), 1)),
            null,
            clock.instant().plusSeconds(600)
        );
        var turn = conversations.beginTurn(buyer, conversation.id(), "买笔");
        var proposal = conversationTurns.complete(turn, "买笔", "仅构建事务测试提案，不调用模型", draft.items(), draft.expiresAt(), "scope");
        return proposal;
    }

    @Test
    void concurrentKnowledgePublicationKeepsLatestPointerAndWithdrawOldIsSafe() throws Exception {
        var base = knowledge.createBase(owner, merchant.id(), "规则", "PUBLIC");
        var old = aiState.createDocument(null, base.id(), "旧规则", "旧规则正文");
        var latest = aiState.createDocument(old.rootId(), base.id(), "新规则", "新规则正文");
        aiState.completeIndex(aiState.beginIndex(old.id()), true, "");
        aiState.completeIndex(aiState.beginIndex(latest.id()), true, "");
        var result = race(() -> aiState.publish(old.id()), () -> aiState.publish(latest.id()));
        assertTrue(result.contains("0000"));
        assertTrue(result.contains("G0002"));
        assertEquals(latest.id(), jdbc.queryForObject("SELECT active_document_id FROM ai_document_root WHERE id=?", String.class, old.rootId()));
        aiState.withdraw(old.id());
        assertEquals(latest.id(), jdbc.queryForObject("SELECT active_document_id FROM ai_document_root WHERE id=?", String.class, old.rootId()));
        assertEquals(1, scalar("SELECT COUNT(*) FROM ai_document WHERE status='PUBLISHED'"));
    }

    @Autowired
    IOrderQueryCase orderQueries;

    @Test
    void batchOrderReadIncludesPickupRefundAndEnforcesOwnership() {
        var product = product(6);
        var first = order(product);
        var second = order(product);
        life.pay(buyer, first.getId());
        life.requestRefund(buyer, first.getId(), "未提货");
        var result = orderQueries.mine(buyer, null, 1, 100);
        assertEquals(2, result.total());
        var byId = result
            .items()
            .stream()
            .collect(java.util.stream.Collectors.toMap(m -> m.orderId(), m -> m));
        assertEquals(merchant.name(), byId.get(first.getId()).merchantName());
        assertEquals("WAIT_PREP", byId.get(first.getId()).pickup().status());
        assertEquals("REQUESTED", byId.get(first.getId()).afterSale().status());
        assertNull(byId.get(second.getId()).pickup());
        assertNull(byId.get(second.getId()).afterSale());
        assertEquals("A0006", code(() -> orderQueries.detail(other, first.getId())));
        assertEquals("A0006", code(() -> orderQueries.merchant(other, merchant.id(), null, 1, 100, "")));
    }

    /** 以固定时间明确验证到期边界，不靠 sleep 碰运气。 */
    static class MutableClock extends Clock {

        volatile Instant now = Instant.parse("2026-10-28T04:00:00Z");

        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        public Clock withZone(ZoneId zone) {
            return this;
        }

        public Instant instant() {
            return now;
        }
    }

    @TestConfiguration
    static class TimeConfig {

        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock();
        }
    }

    @Test
    void lateKnowledgeAttemptCannotOverwriteNewerReadyState() {
        var base = knowledge.createBase(owner, merchant.id(), "并发知识", "PUBLIC");
        var doc = aiState.createDocument(null, base.id(), "说明", "不可变正文");
        var oldAttempt = aiState.beginIndex(doc.id());
        assertThrows(AppException.class, () -> aiState.beginIndex(doc.id()));
        jdbc.update("UPDATE ai_document SET index_expires_at=TIMESTAMPADD(SECOND,-1,CURRENT_TIMESTAMP(3)) WHERE id=?", doc.id());
        assertFalse(aiState.completeIndex(oldAttempt, true, "过期不能成功"));
        var newAttempt = aiState.beginIndex(doc.id());
        assertTrue(aiState.completeIndex(newAttempt, true, ""));
        assertFalse(aiState.completeIndex(oldAttempt, false, "旧请求超时"));
        assertEquals("READY", aiState.document(doc.id()).indexStatus());
        assertFalse(aiState.completeIndex(newAttempt, false, "重复完成"));
    }

    @Test
    void concurrentKnowledgeClaimsHaveOneOwnerAndCrashLeaseCanBeRecovered() throws Exception {
        var base = knowledge.createBase(owner, merchant.id(), "索引领取", "PUBLIC");
        var doc = aiState.createDocument(null, base.id(), "说明", "不可变正文");
        var results = race(() -> aiState.beginIndex(doc.id()), () -> aiState.beginIndex(doc.id()));
        assertEquals(1, results.stream().filter("0000"::equals).count());
        assertEquals(1, jdbc.queryForObject("SELECT index_count FROM ai_knowledge_usage WHERE owner_id=?", Integer.class, merchant.id()));
        assertEquals(ResponseCode.KNOWLEDGE_NOT_READY.getCode(), code(() -> aiState.publish(doc.id())));
        jdbc.update("UPDATE ai_document SET index_expires_at=TIMESTAMPADD(SECOND,-1,CURRENT_TIMESTAMP(3)) WHERE id=?", doc.id());
        var recovered = aiState.beginIndex(doc.id());
        assertTrue(aiState.completeIndex(recovered, false, "重试失败"));
        assertEquals("FAILED", aiState.document(doc.id()).indexStatus());
        assertEquals(ResponseCode.KNOWLEDGE_NOT_READY.getCode(), code(() -> aiState.publish(doc.id())));
        var retry = aiState.beginIndex(doc.id());
        assertTrue(aiState.completeIndex(retry, true, ""));
        aiState.publish(doc.id());
        assertEquals("PUBLISHED", aiState.document(doc.id()).status());
    }

    @Test
    void merchantDocumentBytesAndCountAreReservedAtomicallyAndRollbackOnInvalidRoot() throws Exception {
        var base = knowledge.createBase(owner, merchant.id(), "配额", "PUBLIC");
        aiState.createDocument(null, base.id(), "初始化", "中文");
        assertEquals(6, jdbc.queryForObject("SELECT content_bytes FROM ai_knowledge_usage WHERE owner_id=?", Long.class, merchant.id()));
        jdbc.update("UPDATE ai_knowledge_usage SET document_count=999 WHERE owner_id=?", merchant.id());
        var results = race(() -> aiState.createDocument(null, base.id(), "甲", "x"), () -> aiState.createDocument(null, base.id(), "乙", "y"));
        assertEquals(1, results.stream().filter("0000"::equals).count());
        assertEquals(1000, jdbc.queryForObject("SELECT document_count FROM ai_knowledge_usage WHERE owner_id=?", Integer.class, merchant.id()));
        jdbc.update("UPDATE ai_knowledge_usage SET document_count=1,content_bytes=104857600 WHERE owner_id=?", merchant.id());
        assertThrows(AppException.class, () -> aiState.createDocument(null, base.id(), "超额", "z"));
        jdbc.update("UPDATE ai_knowledge_usage SET content_bytes=6 WHERE owner_id=?", merchant.id());
        assertThrows(AppException.class, () -> aiState.createDocument("missing-root", base.id(), "失效根", "z"));
        assertEquals(1, jdbc.queryForObject("SELECT document_count FROM ai_knowledge_usage WHERE owner_id=?", Integer.class, merchant.id()));
        assertEquals(6, jdbc.queryForObject("SELECT content_bytes FROM ai_knowledge_usage WHERE owner_id=?", Long.class, merchant.id()));
    }

    @Test
    void merchantIndexConcurrencyAndRateAreBoundedAndCompletionChecksVersion() {
        var base = knowledge.createBase(owner, merchant.id(), "索引配额", "PUBLIC");
        var docs = new ArrayList<KnowledgeDocumentVO>();
        var attempts = new ArrayList<KnowledgeIndexAttemptVO>();
        for (int i = 0; i < 5; i++) docs.add(aiState.createDocument(null, base.id(), "说明" + i, "正文"));
        for (int i = 0; i < 4; i++) attempts.add(aiState.beginIndex(docs.get(i).id()));
        assertThrows(AppException.class, () -> aiState.beginIndex(docs.get(4).id()));
        assertTrue(aiState.completeIndex(attempts.get(0), true, ""));
        var fifth = aiState.beginIndex(docs.get(4).id());
        jdbc.update("UPDATE ai_document SET index_version=999 WHERE id=?", docs.get(4).id());
        assertFalse(aiState.completeIndex(fifth, true, ""));
        for (int i = 1; i < 4; i++) assertTrue(aiState.completeIndex(attempts.get(i), false, "受控失败"));
        jdbc.update("UPDATE ai_knowledge_usage SET index_window=CURRENT_TIMESTAMP(3),index_count=60 WHERE owner_id=?", merchant.id());
        assertEquals("A0007", code(() -> aiState.beginIndex(docs.get(0).id())));
        jdbc.update("UPDATE ai_knowledge_usage SET index_window=TIMESTAMPADD(SECOND,-61,CURRENT_TIMESTAMP(3)) WHERE owner_id=?", merchant.id());
        assertNotNull(aiState.beginIndex(docs.get(0).id()));
    }

    @Test
    void publicationReloadsReadyDocumentAfterCachedPendingRead() {
        var base = knowledge.createBase(owner, merchant.id(), "当前读", "PUBLIC");
        var doc = aiState.createDocument(null, base.id(), "说明", "正文");
        var attempt = aiState.beginIndex(doc.id());
        var executor = Executors.newSingleThreadExecutor();
        try {
            new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                assertEquals("PENDING", aiState.document(doc.id()).indexStatus());
                try {
                    assertTrue(executor.submit(() -> aiState.completeIndex(attempt, true, "")).get(10, TimeUnit.SECONDS));
                } catch (Exception error) {
                    throw new IllegalStateException("并发完成未成功", error);
                }
                aiState.publish(doc.id());
            });
            assertEquals("PUBLISHED", aiState.document(doc.id()).status());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void conversationLeaseIsPerIdAndExpiredOwnerCannotCommitOrReleaseSuccessor() {
        String firstId = "00000000-0000-0000-0000-000000000000";
        String secondId = "00000000-0000-0000-0000-000000000022";
        assertEquals(Math.floorMod(firstId.hashCode(), 64), Math.floorMod(secondId.hashCode(), 64));
        jdbc.update("INSERT INTO ai_conversation(id,user_id,title) VALUES(?,?,?),(?,?,?)", firstId, buyer, "one", secondId, buyer, "two");
        var first = conversations.beginTurn(buyer, firstId, "问题");
        var independent = conversations.beginTurn(buyer, secondId, "问题");
        assertEquals("G0002", code(() -> conversations.beginTurn(buyer, firstId, "并发")));
        jdbc.update("UPDATE ai_conversation SET turn_expires_at=TIMESTAMPADD(SECOND,-1,CURRENT_TIMESTAMP(3)) WHERE id=?", firstId);
        var successor = conversations.beginTurn(buyer, firstId, "重试");
        assertEquals("G0002", code(() -> conversationTurns.complete(first, "旧问题", "旧答案", List.of(), clock.instant().plusSeconds(600), "scope")));
        conversations.releaseTurn(first);
        assertEquals(successor.token(), jdbc.queryForObject("SELECT turn_token FROM ai_conversation WHERE id=?", String.class, firstId));
        conversationTurns.complete(successor, "问题", "答案", List.of(), clock.instant().plusSeconds(600), "scope");
        conversationTurns.complete(independent, "问题", "答案", List.of(), clock.instant().plusSeconds(600), "scope");
        assertEquals(4, scalar("SELECT COUNT(*) FROM ai_message"));
    }

    @Test
    void proposalCreationFailureRollsBackBothMessagesAndTurnCompletion() {
        var turn = conversations.beginTurn(buyer, null, "问题");
        var invalid = new ProposalItemVO("sku", merchant.id(), "坏报价", "", 0, 0, 1);
        assertEquals("0002", code(() -> conversationTurns.complete(turn, "问题", "答案", List.of(invalid), clock.instant().plusSeconds(600), "scope")));
        assertEquals(0, scalar("SELECT COUNT(*) FROM ai_message WHERE conversation_id=?", turn.conversationId()));
        assertEquals(0, scalar("SELECT COUNT(*) FROM ai_proposal WHERE conversation_id=?", turn.conversationId()));
        assertEquals(turn.token(), jdbc.queryForObject("SELECT turn_token FROM ai_conversation WHERE id=?", String.class, turn.conversationId()));
        conversationTurns.complete(turn, "问题", "正确答案", List.of(), clock.instant().plusSeconds(600), "scope");
        assertEquals(2, scalar("SELECT COUNT(*) FROM ai_message WHERE conversation_id=?", turn.conversationId()));
    }

    @Test
    void independentConversationServiceInstancesCompeteThroughDatabaseLease() throws Exception {
        var conversation = conversations.conversation(buyer, null, "竞争问题");
        var instanceA = new ConversationServiceImpl(conversationRepository, Clock.offset(clock, Duration.ofDays(1)));
        var instanceB = new ConversationServiceImpl(conversationRepository, Clock.offset(clock, Duration.ofDays(-1)));
        var result = race(() -> instanceA.beginTurn(buyer, conversation.id(), "问题 A"), () -> instanceB.beginTurn(buyer, conversation.id(), "问题 B"));
        assertEquals(List.of("0000", "G0002"), result.stream().sorted().toList());
        assertEquals(
            1,
            scalar("SELECT COUNT(*) FROM ai_conversation WHERE id=? AND turn_token IS NOT NULL AND turn_expires_at>CURRENT_TIMESTAMP(3)", conversation.id())
        );
        assertEquals(0, scalar("SELECT COUNT(*) FROM ai_message"));
    }

    @Test
    void longRunningAiEntrypointsRejectOuterTransactionBeforeAnyRemoteWork() {
        clearInvocations(aiEngine);
        var transaction = new TransactionTemplate(transactionManager);
        transaction.executeWithoutResult(status -> {
            assertThrows(IllegalTransactionStateException.class, () -> ai.chat(buyer, null, "问题"));
            assertThrows(IllegalTransactionStateException.class, () -> knowledge.index(owner, "unused"));
            assertThrows(IllegalTransactionStateException.class, () ->
                knowledge.upload(owner, "unused", null, "标题", "说明.txt", "text/plain", new byte[] { 1 })
            );
        });
        verifyNoInteractions(aiEngine);
        assertEquals(0, scalar("SELECT COUNT(*) FROM ai_conversation"));
    }

    @Test
    void globalKnowledgeQuotaCannotOverflowUnderConcurrentCreation() throws Exception {
        for (int i = 0; i < 999; i++) jdbc.update(
            "INSERT INTO ai_knowledge_base(id,name,visibility,created_by) VALUES(?,?,'PUBLIC',?)",
            "quota-" + i,
            "配额夹具",
            admin
        );
        jdbc.update("UPDATE ai_knowledge_quota SET used_count=999 WHERE id='global'");
        var executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> create = () -> {
                try {
                    knowledge.createBase(admin, null, "最后一个名额", "PUBLIC");
                    return true;
                } catch (AppException expected) {
                    return false;
                }
            };
            var results = executor.invokeAll(List.of(create, create));
            assertEquals(
                1,
                results
                    .stream()
                    .filter(f -> {
                        try {
                            return f.get();
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    })
                    .count()
            );
            assertEquals(1000, jdbc.queryForObject("SELECT COUNT(*) FROM ai_knowledge_base", Integer.class));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void stockOnlyMemberCanReadStockOffersAndRevocationTakesEffect() {
        var invitation = access.invite(owner, merchant.id(), accounts.requireActive(other).getUsername());
        access.accept(other, invitation.id());
        var role = roles.saveRole(owner, merchant.id(), null, "只读库存", Set.of("stock.read"));
        roles.assignRole(owner, merchant.id(), other, role.code());
        assertDoesNotThrow(() -> catalogQuery.stockPage(other, merchant.id(), 1, 20, ""));
        assertThrows(AppException.class, () -> catalogQuery.managedProducts(other, merchant.id(), 1, 20));
        access.revoke(owner, merchant.id(), other);
        assertThrows(AppException.class, () -> catalogQuery.stockPage(other, merchant.id(), 1, 20, ""));
    }
}
