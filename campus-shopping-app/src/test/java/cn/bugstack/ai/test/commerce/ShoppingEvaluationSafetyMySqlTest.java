package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.*;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 真实MySQL确认与ACL，模型用明确替身；读回不是从“抛了异常”推断安全。 */
@SpringBootTest(
    classes = { Application.class, CommerceMySqlIntegrationTest.TimeConfig.class },
    properties = { "campus.jobs.enabled=false", "campus.bootstrap.enabled=false", "campus.security.rate-limit-enabled=false" }
)
@ActiveProfiles("mysql-integration")
@EnabledIfEnvironmentVariable(named = "MYSQL_TEST_URL", matches = ".+")
class ShoppingEvaluationSafetyMySqlTest {

    @Autowired
    ApplicationContext context;

    @SpyBean
    IAiEnginePort engine;

    CommerceMySqlIntegrationTest f;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry r) {
        CommerceMySqlIntegrationTest.db(r);
    }

    @BeforeEach
    void before() {
        f = new ShoppingEvaluationFixture(context).f;
    }

    @AfterEach
    void after() {
        reset(engine);
    }

    ProductAggregate product() {
        var p = f.catalog
            .createProduct(
                f.owner,
                f.merchant.id(),
                new ProductCreateCommandEntity("评测签字笔", "合成数据", "stationery", "", List.of(new ProductSkuEntity(null, "一盒", 1200, "ACTIVE", 0)))
            )
            .product();
        f.catalog.setProductPublished(f.owner, f.merchant.id(), p.getId(), true);
        f.catalog.replenishStock(f.owner, f.merchant.id(), p.getSkus().get(0).id(), 5, "eval-" + p.getId());
        return f.catalogSearch.find(p.getId());
    }

    ProposalVO proposal(List<ProductAggregate> products) {
        var turn = f.conversations.beginTurn(f.buyer, null, "合成安全场景");
        return f.conversationTurns.complete(
            turn,
            "合成安全场景",
            "只创建建议，未加购",
            products
                .stream()
                .map(p -> new ProposalItemVO(p.getSkus().get(0).id(), f.merchant.id(), p.getTitle(), "一盒", 1200, p.getVersion(), 1))
                .toList(),
            f.clock.instant().plusSeconds(600),
            "eval-scope"
        );
    }

    String code(Runnable action) {
        try {
            action.run();
            return "0000";
        } catch (AppException e) {
            return e.getCode();
        }
    }

    Map<String, Object> readback() {
        return Map.of(
            "cart",
            f.jdbc.queryForList("SELECT sku_id,quantity FROM trd_cart_item ORDER BY sku_id"),
            "stock",
            f.jdbc.queryForList("SELECT sku_id,on_hand,reserved FROM inv_stock_balance ORDER BY sku_id"),
            "proposals",
            f.jdbc.queryForList("SELECT status,selection_hash FROM ai_proposal ORDER BY id")
        );
    }

    void evidence(String id, String kind, String actual, Map<String, Object> before, Map<String, Object> after) throws Exception {
        Path output = Path.of(System.getenv().getOrDefault("EVALUATION_SAFETY_OUTPUT", "target/evaluation-safety"));
        Files.createDirectories(output);
        new ObjectMapper()
            .writerWithDefaultPrettyPrinter()
            .writeValue(
                output.resolve(id + ".json").toFile(),
                Map.of(
                    "caseId",
                    id,
                    "scenario",
                    kind,
                    "actualCode",
                    actual,
                    "before",
                    before,
                    "after",
                    after,
                    "javaMysql",
                    "REAL",
                    "llm",
                    "STUB_OR_NOT_USED",
                    "assertions",
                    "PASSED"
                )
            );
    }

    @Test
    void staleOrUnauthorizedConfirmationLeavesCartAndStockUntouched() throws Exception {
        for (String kind : List.of("EXPIRED", "OTHER_USER", "PRICE_CHANGE", "NO_STOCK", "UNPUBLISH", "SUSPEND")) {
            f.fixture();
            var p = product();
            String sku = p.getSkus().get(0).id();
            var proposal = proposal(List.of(p));
            String actor = kind.equals("OTHER_USER") ? f.other : f.buyer;
            switch (kind) {
                case "EXPIRED" -> f.clock.now = f.clock.now.plusSeconds(601);
                case "PRICE_CHANGE" -> f.catalog.changeSkuPrice(f.owner, f.merchant.id(), p.getId(), sku, 1300, p.getVersion());
                case "NO_STOCK" -> f.checkout.checkout(
                    f.other,
                    f.merchant.id(),
                    List.of(new cn.bugstack.ai.domain.trading.model.entity.CheckoutItemEntity(sku, 5, 1200, p.getVersion())),
                    "eval-stock"
                );
                case "UNPUBLISH" -> f.catalog.setProductPublished(f.owner, f.merchant.id(), p.getId(), false);
                case "SUSPEND" -> f.admission.setActive(f.admin, f.merchant.id(), false, "评测");
                default -> {
                }
            }
            var before = readback();
            String result = code(() -> f.ai.confirm(actor, proposal.id(), List.of(sku)));
            assertEquals(
                Map.of("EXPIRED", "AI0002", "OTHER_USER", "G0001", "PRICE_CHANGE", "C0002", "NO_STOCK", "I0001", "UNPUBLISH", "C0001", "SUSPEND", "M0004").get(
                    kind
                ),
                result
            );
            assertEquals(before, readback());
            assertEquals("PENDING", f.jdbc.queryForObject("SELECT status FROM ai_proposal WHERE id=?", String.class, proposal.id()));
            evidence("safe-" + kind.toLowerCase(Locale.ROOT), kind, result, before, readback());
        }
    }

    @Test
    void concurrentConfirmationAndReplayAddExactlyOnce() throws Exception {
        var p = product();
        var proposal = proposal(List.of(p));
        String sku = p.getSkus().get(0).id();
        var before = readback();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<String> confirm = () -> code(() -> f.ai.confirm(f.buyer, proposal.id(), List.of(sku)));
            var results = executor.invokeAll(List.of(confirm, confirm));
            assertEquals(List.of("0000", "0000"), List.of(results.get(0).get(), results.get(1).get()));
            f.ai.confirm(f.buyer, proposal.id(), List.of(sku));
            assertEquals(1, f.jdbc.queryForObject("SELECT SUM(quantity) FROM trd_cart_item", Integer.class));
            assertEquals(before.get("stock"), readback().get("stock"));
            evidence("safe-replay", "COMPETING_CONFIRM_AND_REPLAY", "0000", before, readback());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void partialCartAdditionRollsBackEntireProposal() throws Exception {
        var a = product();
        var b = product();
        List<ProductAggregate> products = new ArrayList<>(List.of(a, b));
        products.sort(Comparator.comparing(p -> p.getSkus().get(0).id()));
        f.catalog.replenishStock(f.owner, f.merchant.id(), products.get(1).getSkus().get(0).id(), 100, "extra");
        f.cart.set(f.buyer, products.get(1).getSkus().get(0).id(), 99);
        var proposal = proposal(products);
        var before = readback();
        String result = code(() ->
            f.ai.confirm(
                f.buyer,
                proposal.id(),
                products
                    .stream()
                    .map(p -> p.getSkus().get(0).id())
                    .toList()
            )
        );
        assertEquals("T0005", result);
        assertEquals(before, readback());
        evidence("safe-rollback", "PARTIAL_ADDITION_ROLLBACK", result, before, readback());
    }

    void stubRecall() {
        doAnswer(call -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive(), "remote recall must not hold a database transaction");
            return new AiRecallVO("规则", List.of("规则"));
        })
            .when(engine)
            .recall(anyString(), anyList());
        doAnswer(call -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive(), "remote vector search must not hold a database transaction");
            return List.of();
        })
            .when(engine)
            .semanticProducts(anyString(), anyInt());
    }

    @Test
    void withdrawalDuringGenerationRejectsResponseAndMasksOldHistory() throws Exception {
        var base = f.knowledge.createBase(f.owner, f.merchant.id(), "内部评测", "MERCHANT_INTERNAL");
        var doc = f.aiState.createDocument(null, base.id(), "内部评测说明", "EVAL-CANARY-WITHDRAW");
        f.aiState.completeIndex(f.aiState.beginIndex(doc.id()), true, "");
        f.knowledge.publish(f.owner, doc.id());
        stubRecall();
        var answer = new AiAnswerVO("EVAL-CANARY-WITHDRAW", "LLM", "STUB", "规则", "", List.of(), List.of(), 0);
        doAnswer(call -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive(), "remote generation must not hold a database transaction");
            return answer;
        })
            .when(engine)
            .query(any());
        var first = f.ai.chat(f.owner, null, "规则");
        assertTrue(
            f.knowledge
                .readableScope(f.owner)
                .stream()
                .anyMatch(d -> d.id().equals(doc.id())),
            "fixture must be readable"
        );
        java.util.concurrent.atomic.AtomicBoolean withdrawn = new java.util.concurrent.atomic.AtomicBoolean();
        doAnswer(call -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive(), "remote generation must not hold a database transaction");
            f.knowledge.withdraw(f.owner, doc.id());
            withdrawn.set(true);
            assertEquals("WITHDRAWN", f.jdbc.queryForObject("SELECT status FROM ai_document WHERE id=?", String.class, doc.id()), "actual database state");
            assertTrue(
                f.knowledge
                    .readableScope(f.owner)
                    .stream()
                    .noneMatch(d -> d.id().equals(doc.id())),
                "withdraw must commit"
            );
            return answer;
        })
            .when(engine)
            .query(any());
        String result = code(() -> f.ai.chat(f.owner, first.conversationId(), "规则"));
        assertTrue(withdrawn.get(), "controlled withdrawal callback must execute");
        assertEquals("AI0003", result);
        assertEquals(2, f.jdbc.queryForObject("SELECT COUNT(*) FROM ai_message", Integer.class));
        assertTrue(
            f.ai
                .history(f.owner, first.conversationId())
                .stream()
                .noneMatch(m -> m.content().contains("EVAL-CANARY-WITHDRAW"))
        );
        assertNull(f.jdbc.queryForObject("SELECT turn_token FROM ai_conversation WHERE id=?", String.class, first.conversationId()));
        evidence("safe-withdrawal", "REVOKE_DURING_GENERATION_AND_MASK_HISTORY", result, Map.of(), readback());
    }

    @Test
    void knowledgePermissionRevocationAndPlatformIsolationUseRealScope() throws Exception {
        var base = f.knowledge.createBase(f.owner, f.merchant.id(), "内部资料", "MERCHANT_INTERNAL");
        var doc = f.aiState.createDocument(null, base.id(), "内部说明", "EVAL-CANARY-ACL");
        f.aiState.completeIndex(f.aiState.beginIndex(doc.id()), true, "");
        f.knowledge.publish(f.owner, doc.id());
        var invitation = f.access.invite(f.owner, f.merchant.id(), "testother");
        f.access.accept(f.other, invitation.id());
        var role = f.roles.saveRole(f.owner, f.merchant.id(), null, "知识读取", Set.of("knowledge.read"));
        f.roles.assignRole(f.owner, f.merchant.id(), f.other, role.code());
        assertTrue(
            f.knowledge
                .readableScope(f.other)
                .stream()
                .anyMatch(d -> d.id().equals(doc.id()))
        );
        stubRecall();
        var answer = new AiAnswerVO("EVAL-CANARY-ACL", "LLM", "STUB", "规则", "", List.of(), List.of(), 0);
        doAnswer(call -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive(), "remote generation must not hold a database transaction");
            return answer;
        })
            .when(engine)
            .query(any());
        var first = f.ai.chat(f.other, null, "规则");
        java.util.concurrent.atomic.AtomicBoolean revoked = new java.util.concurrent.atomic.AtomicBoolean();
        doAnswer(call -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive(), "remote generation must not hold a database transaction");
            f.roles.saveRole(f.owner, f.merchant.id(), role.code(), "知识读取", Set.of("product.read"));
            revoked.set(true);
            assertTrue(
                f.knowledge
                    .readableScope(f.other)
                    .stream()
                    .noneMatch(d -> d.id().equals(doc.id()))
            );
            assertEquals("AI0003", code(() -> f.knowledge.citationDocuments(f.other, List.of(doc.id()))));
            return answer;
        })
            .when(engine)
            .query(any());
        assertEquals("AI0003", code(() -> f.ai.chat(f.other, first.conversationId(), "规则")));
        assertTrue(revoked.get(), "controlled permission revocation callback must execute");
        assertEquals(2, f.jdbc.queryForObject("SELECT COUNT(*) FROM ai_message", Integer.class));
        assertTrue(
            f.ai
                .history(f.other, first.conversationId())
                .stream()
                .noneMatch(m -> m.content().contains("EVAL-CANARY-ACL"))
        );
        assertNull(f.jdbc.queryForObject("SELECT turn_token FROM ai_conversation WHERE id=?", String.class, first.conversationId()));
        assertTrue(
            f.knowledge
                .readableScope(f.other)
                .stream()
                .noneMatch(d -> d.id().equals(doc.id()))
        );
        assertTrue(f.knowledge.readableScope(f.buyer).isEmpty());
        var platformBase = f.knowledge.createBase(f.admin, null, "平台资料", "PLATFORM_INTERNAL");
        var platform = f.aiState.createDocument(null, platformBase.id(), "平台说明", "EVAL-CANARY-PLATFORM");
        f.aiState.completeIndex(f.aiState.beginIndex(platform.id()), true, "");
        f.knowledge.publish(f.admin, platform.id());
        assertTrue(
            f.knowledge
                .readableScope(f.admin)
                .stream()
                .anyMatch(d -> d.id().equals(platform.id()))
        );
        assertTrue(
            f.knowledge
                .readableScope(f.owner)
                .stream()
                .noneMatch(d -> d.id().equals(platform.id()))
        );
        evidence("safe-acl", "KNOWLEDGE_READ_REVOKED_DURING_GENERATION_AND_PLATFORM_SCOPE", "0000", Map.of(), readback());
    }
}
