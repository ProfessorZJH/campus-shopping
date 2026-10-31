package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.cases.catalog.ICatalogQueryCase;
import cn.bugstack.ai.cases.merchant.IMerchantAdmissionCase;
import cn.bugstack.ai.cases.shoppingai.*;
import cn.bugstack.ai.cases.trading.*;
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
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
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
    ICatalogService catalogSearch;

    @SpyBean
    IMerchantService merchantService;

    @Autowired
    ICheckoutCase checkout;

    @Autowired
    IOrderLifecycleCase life;

    @Autowired
    IOrderService orderStore;

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
    MutableClock clock;

    @SpyBean
    AccessRepository accessRepository;

    @SpyBean
    cn.bugstack.ai.domain.inventory.service.impl.InventoryServiceImpl inventoryService;

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
        jdbc.update("UPDATE ai_knowledge_quota SET used_count=0 WHERE id='global'");
        clock.now = Instant.parse("2026-10-28T04:00:00Z");
        admin = accounts.register("testadmin", PASSWORD, "测试管理员").getUserId();
        owner = accounts.register("testowner", PASSWORD, "测试经营者").getUserId();
        buyer = accounts.register("testbuyer", PASSWORD, "测试买家").getUserId();
        other = accounts.register("testother", PASSWORD, "其他买家").getUserId();
        access.bootstrapAdmin(admin);
        merchant = open(owner, "测试文具商户");
    }

    private MerchantVO open(String applicant, String name) {
        var a = applications.submitDetailed(
            applicant,
            new AdmissionCommandEntity(name, "文具", "联系人", "10000000000", "测试门店", "图书馆一层"),
            UUID.randomUUID().toString()
        );
        return admission.approve(admin, a.getApplicationId());
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
        doThrow(new IllegalStateException("inventory query unavailable")).when(inventoryService).stocks(anyList());
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
        return orderStore.order(checkout.checkout(buyer, merchant.id(), List.of(item(p)), UUID.randomUUID().toString()).orderId());
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

    private List<String> race(Runnable a, Runnable b) throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        java.util.function.Function<Runnable, Callable<String>> call = work -> () -> {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("等待超时");
            return code(work);
        };
        try {
            var x = pool.submit(call.apply(a));
            var y = pool.submit(call.apply(b));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            return List.of(x.get(30, TimeUnit.SECONDS), y.get(30, TimeUnit.SECONDS));
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
        var newAttempt = aiState.beginIndex(doc.id());
        assertTrue(aiState.completeIndex(newAttempt, true, ""));
        assertFalse(aiState.completeIndex(oldAttempt, false, "旧请求超时"));
        assertEquals("READY", aiState.document(doc.id()).indexStatus());
        assertFalse(aiState.completeIndex(newAttempt, false, "重复完成"));
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
