package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.catalog.model.valobj.ProductStatusEnumVO;
import cn.bugstack.ai.domain.identity.model.valobj.MerchantPermissionEnumVO;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationAggregate;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import cn.bugstack.ai.domain.trading.adapter.repository.IOrderRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.*;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.domain.trading.service.impl.OrderServiceImpl;
import cn.bugstack.ai.infrastructure.adapter.port.AiEnginePort;
import cn.bugstack.ai.infrastructure.gateway.AiGatewayService;
import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.common.FailureDiagnostics;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** 领域规则使用真实生产实现；远程协议输入以明确的网关替身提供。 */
class DddRulesTest {

    private final Instant now = Instant.parse("2026-10-29T10:00:00Z");
    private final AiGatewayService gateway = mock(AiGatewayService.class);

    private AiEnginePort port() {
        var port = new AiEnginePort();
        ReflectionTestUtils.setField(port, "gateway", gateway);
        return port;
    }

    private void code(String expected, Runnable action) {
        assertEquals(expected, assertThrows(AppException.class, action::run).getCode());
    }

    private OrderAggregate paid() {
        return new OrderAggregate("o", "buyer", "m", "s", List.of(new OrderItemEntity("sku", "笔", "黑色", 100, 1)), "PAID", now.plusSeconds(600), now);
    }

    private KnowledgeDocumentVO document(int version, String index) {
        return new KnowledgeDocumentVO("d", "root", "base", "规则", null, "PUBLIC", version, "DRAFT", index, "正文", "", now);
    }

    private AiGatewayDTO.Answer answer(List<AiGatewayDTO.Citation> citations, List<AiGatewayDTO.Recommendation> items) {
        return new AiGatewayDTO.Answer("回答", "LOCAL_RETRIEVAL_DEMO", "LOCAL_CHAR_NGRAM_DEMO", "买笔", null, citations, items, 0);
    }

    private AiQueryEntity query() {
        return new AiQueryEntity("买笔", List.of(), List.of(), List.of(), "买笔", List.of());
    }

    @Test
    void invalidOrderFilterNeverReachesPersistence() {
        var repository = mock(IOrderRepository.class);
        var service = new OrderServiceImpl(repository, Clock.systemUTC());
        code("0002", () -> service.orders("b", null, "PAYED", 1, 20));
        code("0002", () -> service.countOrders("b", null, "PAYED"));
        verifyNoInteractions(repository);
        assertThrows(IllegalStateException.class, () -> ProductStatusEnumVO.fromCode("INVALID"));
    }

    @Test
    void malformedRecallIsAnUpstreamFailure() {
        for (var terms : List.of(Arrays.asList((String) null), List.of("?"), List.of("一"), List.of("bad term"))) {
            when(gateway.recall(any())).thenReturn(new AiGatewayDTO.RecallResponse("买笔", terms));
            code("AI0001", () -> port().recall("买笔", List.of()));
        }
    }

    @Test
    void malformedRecommendationsAndCitationsAreRejected() {
        when(gateway.query(any())).thenReturn(answer(List.of(), Arrays.asList((AiGatewayDTO.Recommendation) null)));
        code("AI0001", () -> port().query(query()));
        when(gateway.query(any())).thenReturn(answer(Arrays.asList((AiGatewayDTO.Citation) null), List.of()));
        code("AI0001", () -> port().query(query()));
        when(gateway.query(any())).thenReturn(answer(List.of(new AiGatewayDTO.Citation("d", "c", "标题", "片段", Double.NaN)), List.of()));
        code("AI0001", () -> port().query(query()));
        when(gateway.query(any())).thenReturn(answer(List.of(), List.of(new AiGatewayDTO.Recommendation("sku", 0, "原因"))));
        code("AI0001", () -> port().query(query()));
    }

    @Test
    void validProtocolStillAcceptsLocalFallback() {
        when(gateway.query(any())).thenReturn(new AiGatewayDTO.Answer("回答", "LOCAL_FALLBACK", "BM25_DEGRADED", "买笔", "模型超时", List.of(), List.of(), 12));
        assertEquals("LOCAL_FALLBACK", port().query(query()).mode());
        when(gateway.semanticProducts(any())).thenReturn(new AiGatewayDTO.ProductSearchResult(List.of(" "), "MILVUS"));
        code("AI0001", () -> port().semanticProducts("买笔", 80));
    }

    @Test
    void errorClassificationRetainsSafeInfoAndCausePositions() {
        var cause = new IllegalStateException("SECRET response body and key");
        var failure = new AppException("AI0001", cause);
        assertEquals(ResponseCode.AI_UNAVAILABLE.getInfo(), failure.getInfo());
        assertSame(cause, failure.getCause());
        assertTrue(failure.isOperationalFailure());
        assertFalse(new AppException("T0001").isOperationalFailure());
        var diagnostic = FailureDiagnostics.describe(failure);
        assertTrue(diagnostic.contains("IllegalStateException"));
        assertTrue(diagnostic.contains("DddRulesTest"));
        assertFalse(diagnostic.contains("SECRET"));
        assertThrows(IllegalArgumentException.class, () -> new AppException("UNREGISTERED"));
    }

    @Test
    void afterSaleRequestIsIdempotentButCannotChangeReason() {
        var order = paid();
        var first = AfterSaleAggregate.request(order, "buyer", "未取货", null, "r", now);
        assertSame(first, AfterSaleAggregate.request(order, "buyer", "未取货", first, "unused", now));
        code("T0004", () -> AfterSaleAggregate.request(order, "buyer", "另一原因", first, "unused", now));
        code("A0006", () -> AfterSaleAggregate.request(order, "stranger", "未取货", null, "r", now));
    }

    @Test
    void disputedRefundBlocksPickupAndMerchantReview() {
        var aggregate = new AfterSaleAggregate(AfterSaleAggregate.request(paid(), "buyer", "未取货", null, "r", now));
        code("T0004", aggregate::requirePickupAllowed);
        aggregate.reject("未满足条件");
        aggregate.requirePickupAllowed();
        aggregate.appeal(paid(), "buyer");
        aggregate.appeal(paid(), "buyer");
        assertEquals("DISPUTED", aggregate.view().status());
        code("A0006", aggregate::requireMerchantReview);
        aggregate.approve("平台核实");
        code("T0004", aggregate::requirePickupAllowed);
        code("T0004", () -> aggregate.reject("不可反转"));
    }

    @Test
    void platformReviewIsOnlyAllowedForDisputedRefunds() {
        for (String state : List.of("REQUESTED", "REJECTED", "APPROVED")) {
            var a = new AfterSaleAggregate(new cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO("a", "o", "buyer", "m", state, "申请", "", now));
            code("T0004", a::requirePlatformReview);
        }
        var a = new AfterSaleAggregate(AfterSaleAggregate.request(paid(), "buyer", "未提货", null, "r", now));
        a.requireMerchantReview();
        assertTrue(a.reject("商户驳回"));
        assertFalse(a.reject("重复"));
        a.appeal(paid(), "buyer");
        a.requirePlatformReview();
        assertTrue(a.reject("平台驳回"));
    }

    @Test
    void onlyLatestIndexedKnowledgeVersionCanPublish() {
        code("AI0003", () -> new KnowledgePublicationAggregate(document(2, "PENDING"), 2, "old").publish());
        code("G0002", () -> new KnowledgePublicationAggregate(document(1, "READY"), 2, "old").publish());
        var aggregate = new KnowledgePublicationAggregate(document(2, "READY"), 2, "old");
        aggregate.publish();
        assertEquals("d", aggregate.activeId());
        assertEquals("old", aggregate.previousActiveId());
        assertEquals("PUBLISHED", aggregate.status());
    }

    @Test
    void withdrawingOldVersionDoesNotClearCurrentPointer() {
        var aggregate = new KnowledgePublicationAggregate(document(1, "READY"), 2, "current");
        aggregate.withdraw();
        assertEquals("current", aggregate.activeId());
        assertEquals("WITHDRAWN", aggregate.status());
    }

    @Test
    void recommendationQuotaIsBalancedAndNeverTrustsModelPriceOrStock() {
        var products = new ArrayList<List<String>>();
        for (int p = 0; p < 200; p++) {
            var skus = new ArrayList<String>();
            for (int s = 0; s < 20; s++) skus.add(p + "-" + s);
            products.add(skus);
        }
        var sampled = RecommendationPolicy.sampleSkus(products);
        assertEquals(300, sampled.size());
        assertTrue(products.stream().allMatch(p -> sampled.contains(p.get(0))));
        var quote = new ProposalItemVO("sku", "m", "笔", "黑色", 123, 9, 1, "/media/test.png");
        var suggestions = List.of(
            new AiRecommendationVO("foreign", 1, "幻觉"),
            new AiRecommendationVO("sku", 2, "建议"),
            new AiRecommendationVO("sku", 1, "重复")
        );
        assertEquals(1, RecommendationPolicy.select(suggestions, List.of(quote), Map.of("sku", 1L)).get(0).quantity());
        var selected = RecommendationPolicy.select(suggestions, List.of(quote), Map.of("sku", 2L));
        assertEquals(1, selected.size());
        assertEquals(123, selected.get(0).priceCent());
        assertEquals(9, selected.get(0).quoteVersion());
        assertEquals(quote.imageUrl(), selected.get(0).imageUrl());
    }

    @Test
    void fusionDeduplicatesEachSourceAndBreaksTiesDeterministically() {
        assertEquals(List.of("a", "b"), RecommendationPolicy.fuse(List.of("a", "a", "b"), List.of("b", "a")));
        assertEquals(List.of("a", "b"), RecommendationPolicy.fuse(List.of("b"), List.of("a")));
    }

    @Test
    void proposalAggregateEnforcesFrozenChoicesAndIdempotentReplay() {
        var one = new ProposalItemVO("sku", "m", "笔", "黑色", 123, 9, 1, "/media/test.png");
        var two = new ProposalItemVO("other", "m", "笔", "蓝色", 125, 9, 1, "/media/test.png");
        var original = ProposalAggregate.create("buyer", "conversation", List.of(one, two), now.plusSeconds(300), now);
        var aggregate = new ProposalAggregate(original);
        code("A0006", () -> aggregate.confirm("foreign", List.of("sku"), now));
        code("0002", () -> aggregate.confirm("buyer", List.of("not-quoted"), now));
        assertTrue(aggregate.confirm("buyer", List.of("sku"), now));
        assertFalse(aggregate.confirm("buyer", List.of("sku"), now));
        code("G0003", () -> aggregate.confirm("buyer", List.of("other"), now));

        var expired = new ProposalAggregate(original);
        code("AI0002", () -> expired.confirm("buyer", List.of("sku"), now.plusSeconds(301)));
    }

    @Test
    void rejectedModelQuantityDoesNotConsumeLaterValidSkuChoice() {
        var quote = new ProposalItemVO("sku", "m", "笔", "黑色", 123, 9, 1, "/media/test.png");
        var recommendations = List.of(new AiRecommendationVO("sku", 99, "超出库存"), new AiRecommendationVO("sku", 2, "有效数量"));
        var selected = RecommendationPolicy.select(recommendations, List.of(quote), Map.of("sku", 2L));
        assertEquals(1, selected.size());
        assertEquals(2, selected.get(0).quantity());
    }

    @Test
    void permissionEnumCentralizesProtectedCapabilitiesAndDependencies() {
        code("A0006", () -> MerchantPermissionEnumVO.validateGrant(Set.of("role.manage")));
        code("0002", () -> MerchantPermissionEnumVO.validateGrant(Set.of("product.write")));
        code("A0006", () -> MerchantPermissionEnumVO.validateGrant(Set.of("unknown")));
        assertEquals(Set.of("product.read", "product.write"), MerchantPermissionEnumVO.validateGrant(Set.of("product.read", "product.write")));
    }
}
