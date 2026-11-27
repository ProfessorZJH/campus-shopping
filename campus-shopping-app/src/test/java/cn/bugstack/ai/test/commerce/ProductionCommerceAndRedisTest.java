package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.shoppingai.*;
import cn.bugstack.ai.cases.shoppingai.impl.ShoppingAiCaseImpl;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.impl.CheckoutCaseImpl;
import cn.bugstack.ai.cases.trading.impl.OrderLifecycleCaseImpl;
import cn.bugstack.ai.cases.trading.model.OrderPage;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.fulfillment.adapter.repository.IFulfillmentRepository;
import cn.bugstack.ai.domain.fulfillment.model.aggregate.PickupAggregate;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupTokenVO;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.fulfillment.service.impl.FulfillmentServiceImpl;
import cn.bugstack.ai.domain.identity.adapter.repository.IRequestQuotaRepository;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.domain.shoppingai.service.IProposalService;
import cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy;
import cn.bugstack.ai.domain.trading.model.aggregate.AfterSaleAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.CheckoutItemEntity;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.OrderReviewVO;
import cn.bugstack.ai.domain.trading.service.*;
import cn.bugstack.ai.infrastructure.redis.CampusRedisHub;
import cn.bugstack.ai.infrastructure.redis.DisplayCache;
import cn.bugstack.ai.infrastructure.redis.RedisClients;
import cn.bugstack.ai.infrastructure.redis.RedisInfrastructureConfig;
import cn.bugstack.ai.trigger.http.PublicAntiCrawlerFilter;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

/** 生产级商业交易、双 Redis 7 支柱、防爬盾牌与流式 AI 导购综合测试。 */
class ProductionCommerceAndRedisTest {

    private static final Instant NOW = Instant.parse("2026-11-26T04:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void campusRedisHubExercisesAllSevenPillarsLocallyAndWithDualRedisWhenConfigured() throws Exception {
        DefaultListableBeanFactory emptyBeans = new DefaultListableBeanFactory();
        CampusRedisHub localHub = new CampusRedisHub(emptyBeans.getBeanProvider(RedisClients.class), mapper);
        exerciseHub(localHub, false);

        String secAddr = System.getenv("REDIS_TEST_ADDRESS");
        String cacheAddr = System.getenv("REDIS_TEST_CACHE_ADDRESS");
        if (secAddr != null && !secAddr.isBlank() && cacheAddr != null && !cacheAddr.isBlank()) {
            RedisInfrastructureConfig.validateSeparateInstances(secAddr, cacheAddr);
            String pwd = System.getenv().getOrDefault("REDIS_TEST_PASSWORD", "");
            try (
                RedisClients clients = new RedisClients(
                    RedisInfrastructureConfig.client(secAddr, "", pwd),
                    RedisInfrastructureConfig.client(cacheAddr, "", pwd),
                    "cs:test:prod:" + UUID.randomUUID()
                )
            ) {
                DefaultListableBeanFactory redisBeans = new DefaultListableBeanFactory();
                redisBeans.registerSingleton("clients", clients);
                DisplayCache displayCache = new DisplayCache(redisBeans.getBeanProvider(RedisClients.class), mapper);
                redisBeans.registerSingleton("displayCache", displayCache);
                CampusRedisHub redisHub = new CampusRedisHub(
                    redisBeans.getBeanProvider(RedisClients.class),
                    mapper,
                    redisBeans.getBeanProvider(DisplayCache.class)
                );
                try {
                    exerciseHub(redisHub, true);
                    AtomicInteger dbLoads = new AtomicInteger();
                    assertNull(
                        displayCache.readWithNullSentinel("missing-product-xyz", 30, new TypeReference<String>() {}, () -> {
                            dbLoads.incrementAndGet();
                            return null;
                        })
                    );
                    assertNull(
                        displayCache.readWithNullSentinel("missing-product-xyz", 30, new TypeReference<String>() {}, () -> {
                            dbLoads.incrementAndGet();
                            return "unexpected";
                        })
                    );
                    assertEquals(1, dbLoads.get(), "空值哨兵应拦截重复穿透回源");
                } finally {
                    redisHub.shutdown();
                }
            }
        }
    }

    private void exerciseHub(CampusRedisHub hub, boolean expectRedis) throws Exception {
        assertEquals("A-101", hub.nextPickupQueueCode("store-1"));
        assertEquals("A-102", hub.nextPickupQueueCode("store-1"));

        hub.storePickupPin("m-1", "682914", "ord-1", "raw-secret-token", 120);
        assertEquals("ord-1|raw-secret-token", hub.peekOrConsumePickupPin("m-1", "682914", false));
        assertEquals("ord-1|raw-secret-token", hub.peekOrConsumePickupPin("m-1", "682914", true));
        assertNull(hub.peekOrConsumePickupPin("m-1", "682914", true), "Lua 原子消费后不可再次读取");

        for (int i = 0; i < 4; i++) {
            hub.recordPinFailure("m-1", "clerk-1");
            assertDoesNotThrow(() -> hub.checkPinBruteForce("m-1", "clerk-1"));
        }
        hub.recordPinFailure("m-1", "clerk-1");
        AppException lockErr = assertThrows(AppException.class, () -> hub.checkPinBruteForce("m-1", "clerk-1"));
        assertEquals(ResponseCode.AUTH_RATE_LIMITED.getCode(), lockErr.getCode());

        assertFalse(hub.isIpBanned("10.0.0.9"));
        assertEquals(0L, hub.recordRateViolationAndMaybeBan("10.0.0.9"));
        assertEquals(0L, hub.recordRateViolationAndMaybeBan("10.0.0.9"));
        assertEquals(300L, hub.recordRateViolationAndMaybeBan("10.0.0.9"));
        assertTrue(hub.isIpBanned("10.0.0.9"));

        hub.recordCrawlerBlocked("10.0.0.8");
        hub.recordOrderBrushBlocked();

        hub.recordSearchKeyword("无糖乌龙茶");
        hub.recordSearchKeyword("无糖乌龙茶");
        hub.recordSearchKeyword("中性笔");
        assertEquals("无糖乌龙茶", hub.topHotKeywords(5).get(0));

        hub.recordOrderPaid(List.of("p-tea", "p-bread"), Map.of("p-tea", "drink", "p-bread", "snack"), Map.of("p-tea", 3, "p-bread", 1));
        assertEquals("p-tea", hub.topSellingProductIds(5).get(0));
        assertTrue(hub.coPurchasedProductIds("p-tea", 5).contains("p-bread"));

        hub.recordFootprint("u-1", "p-1");
        hub.recordFootprint("u-1", "p-2");
        assertEquals(List.of("p-2", "p-1"), hub.recentFootprintProductIds("u-1", 5));

        hub.saveExpiryCursor("cursor-order-99");
        assertEquals("cursor-order-99", hub.loadExpiryCursor());

        CountDownLatch latch = new CountDownLatch(1);
        List<Map<String, Object>> received = new CopyOnWriteArrayList<>();
        try (
            AutoCloseable ignored = hub.subscribeRealtimeEvents((ch, payload) -> {
                if ("merchant:m-1".equals(ch)) {
                    received.add(payload);
                    latch.countDown();
                }
            })
        ) {
            hub.publishRealtimeEventAfterCommit("merchant:m-1", Map.of("type", "ORDER_PAID", "orderId", "ord-1"));
            assertTrue(latch.await(3, TimeUnit.SECONDS), "应收到实时事件广播");
            assertEquals("ORDER_PAID", received.get(0).get("type"));
        }

        var telemetry = hub.telemetry();
        assertEquals(expectRedis, telemetry.redisEnabled());
        assertTrue(telemetry.crawlerBlockedCount() >= 1);
        assertTrue(telemetry.orderBrushBlockedCount() >= 1);
        assertTrue(telemetry.pinLockoutCount() >= 1);
    }

    @Test
    void pickupIssueSupportsRawTokenQrPayloadAndSixDigitPinWithQuickVerifyLockout() {
        IFulfillmentRepository repo = mock(IFulfillmentRepository.class);
        Map<String, PickupVO> store = new HashMap<>();
        when(repo.pickup(anyString(), anyBoolean())).thenAnswer(inv -> store.get(inv.getArgument(0)));
        doAnswer(inv -> {
            PickupVO v = inv.getArgument(0);
            store.put(v.orderId(), v);
            return null;
        })
            .when(repo)
            .insert(any());
        doAnswer(inv -> {
            PickupVO v = inv.getArgument(0);
            store.put(v.orderId(), v);
            return null;
        })
            .when(repo)
            .save(any());

        FulfillmentServiceImpl service = new FulfillmentServiceImpl(repo, clock);
        service.create("ord-1", "m-1", "s-1", "buyer-1", "A-108");
        service.markReady("ord-1");
        PickupTokenVO issued = service.issue("ord-1");
        assertEquals("A-108", issued.pickupCode());
        assertTrue(issued.pinCode().matches("\\d{6}"));
        assertEquals("CS1|ord-1|" + issued.token(), issued.qrPayload());

        PickupAggregate viaPin = new PickupAggregate(store.get("ord-1"));
        assertTrue(viaPin.verify(issued.pinCode(), NOW));

        PickupAggregate viaQr = new PickupAggregate(store.get("ord-1"));
        assertTrue(viaQr.verify(issued.qrPayload(), NOW));

        DefaultListableBeanFactory emptyBeans = new DefaultListableBeanFactory();
        CampusRedisHub hub = new CampusRedisHub(emptyBeans.getBeanProvider(RedisClients.class), mapper);
        IOrderService trading = mock(IOrderService.class);
        OrderLifecycleCaseImpl lifecycle = new OrderLifecycleCaseImpl(
            trading,
            mock(IOrderEventService.class),
            mock(IAfterSaleService.class),
            service,
            mock(IInventoryService.class),
            mock(IAccessService.class),
            mock(IUserAccountService.class),
            mock(IMerchantService.class),
            mock(IOrderQueryCase.class),
            clock
        );
        ReflectionTestUtils.setField(lifecycle, "redisHub", hub);

        for (int i = 0; i < 5; i++) {
            AppException err = assertThrows(AppException.class, () -> lifecycle.quickVerifyPickup("clerk-1", "m-1", "999999"));
            assertEquals(ResponseCode.PICKUP_INVALID.getCode(), err.getCode());
        }
        AppException locked = assertThrows(AppException.class, () -> lifecycle.quickVerifyPickup("clerk-1", "m-1", "999999"));
        assertEquals(ResponseCode.AUTH_RATE_LIMITED.getCode(), locked.getCode());
    }

    @Test
    void publicAntiCrawlerFilterEnforcesUaDeepPaginationAndPenaltyBox() throws Exception {
        DefaultListableBeanFactory emptyBeans = new DefaultListableBeanFactory();
        CampusRedisHub hub = new CampusRedisHub(emptyBeans.getBeanProvider(RedisClients.class), mapper);
        IRequestQuotaRepository quotas = mock(IRequestQuotaRepository.class);
        when(quotas.acquire(eq("public-browse-ip"), anyString(), eq(600), eq(60))).thenReturn(0L);

        PublicAntiCrawlerFilter filter = new PublicAntiCrawlerFilter(mapper, true, quotas, hub);
        FilterChain okChain = (req, res) -> ((MockHttpServletResponse) res).setStatus(200);

        MockHttpServletRequest badUa = new MockHttpServletRequest("GET", "/api/v1/products/page");
        badUa.setRemoteAddr("10.1.1.1");
        badUa.addHeader("User-Agent", "sqlmap/1.8");
        MockHttpServletResponse badUaRes = new MockHttpServletResponse();
        filter.doFilter(badUa, badUaRes, okChain);
        assertEquals(429, badUaRes.getStatus());
        assertEquals("60", badUaRes.getHeader("Retry-After"));
        assertTrue(badUaRes.getContentAsString().contains(ResponseCode.AUTH_RATE_LIMITED.getCode()));

        MockHttpServletRequest deepPage = new MockHttpServletRequest("GET", "/api/v1/products/page");
        deepPage.setRemoteAddr("10.1.1.2");
        deepPage.addHeader("User-Agent", "Mozilla/5.0");
        deepPage.setParameter("page", "101");
        MockHttpServletResponse deepPageRes = new MockHttpServletResponse();
        filter.doFilter(deepPage, deepPageRes, okChain);
        assertEquals(400, deepPageRes.getStatus());
        assertTrue(deepPageRes.getContentAsString().contains(ResponseCode.ILLEGAL_PARAMETER.getCode()));

        hub.recordRateViolationAndMaybeBan("10.1.1.3");
        hub.recordRateViolationAndMaybeBan("10.1.1.3");
        hub.recordRateViolationAndMaybeBan("10.1.1.3");
        MockHttpServletRequest banned = new MockHttpServletRequest("GET", "/api/v1/discovery/home");
        banned.setRemoteAddr("10.1.1.3");
        banned.addHeader("User-Agent", "Mozilla/5.0");
        MockHttpServletResponse bannedRes = new MockHttpServletResponse();
        filter.doFilter(banned, bannedRes, okChain);
        assertEquals(429, bannedRes.getStatus());
        assertEquals("300", bannedRes.getHeader("Retry-After"));

        MockHttpServletRequest normal = new MockHttpServletRequest("GET", "/api/v1/products/page");
        normal.setRemoteAddr("10.1.1.4");
        normal.addHeader("User-Agent", "Mozilla/5.0");
        normal.setParameter("page", "1");
        normal.setParameter("size", "20");
        MockHttpServletResponse normalRes = new MockHttpServletResponse();
        filter.doFilter(normal, normalRes, okChain);
        assertEquals(200, normalRes.getStatus());
    }

    @Test
    void checkoutAntiHoardingOrderRitualsEvidenceImageAndReviewsWork() {
        OrderAggregate order = new OrderAggregate(
            "ord-10",
            "buyer-1",
            "m-1",
            "s-1",
            "北门书店",
            "图书馆一层",
            "少冰三分糖",
            "12:00-12:30",
            "",
            "",
            List.of(new OrderItemEntity("sku-1", "冰乌龙", "大杯", 1200, 1)),
            "PENDING_PAYMENT",
            NOW.plusSeconds(900),
            NOW
        );
        assertEquals("少冰三分糖", order.getBuyerRemark());
        assertEquals("12:00-12:30", order.getPickupSlot());
        assertTrue(order.pay(NOW, "ALIPAY", "ALI20261126000001ABCDEF"));
        assertEquals("ALIPAY", order.getPaymentChannel());
        assertEquals("ALI20261126000001ABCDEF", order.getPaymentTradeNo());

        var afterSale = AfterSaleAggregate.request(order, "buyer-1", "包装漏液", "/media/a1b2c3.png", null, "as-1", NOW);
        assertEquals("/media/a1b2c3.png", afterSale.evidenceImageUrl());
        assertThrows(AppException.class, () -> AfterSaleAggregate.request(order, "buyer-1", "原因", "https://evil.example/x.png", null, "as-2", NOW));

        IOrderService trading = mock(IOrderService.class);
        IOrderQueryService orderQuery = mock(IOrderQueryService.class);
        when(trading.beginCheckout(eq("buyer-1"), eq("k-1"), anyString())).thenReturn(null);
        when(orderQuery.countOrders(eq("buyer-1"), isNull(), eq("PENDING_PAYMENT"), eq(""), any())).thenReturn(10L);
        DefaultListableBeanFactory emptyBeans = new DefaultListableBeanFactory();
        CampusRedisHub hub = new CampusRedisHub(emptyBeans.getBeanProvider(RedisClients.class), mapper);
        CheckoutCaseImpl checkoutCase = new CheckoutCaseImpl(
            mock(IUserAccountService.class),
            mock(IMerchantService.class),
            mock(ICatalogService.class),
            mock(IInventoryService.class),
            trading,
            mock(IOrderEventService.class),
            mock(ICartService.class),
            mock(IOrderQueryCase.class),
            clock
        );
        ReflectionTestUtils.setField(checkoutCase, "orderQuery", orderQuery);
        ReflectionTestUtils.setField(checkoutCase, "redisHub", hub);
        AppException brushErr = assertThrows(AppException.class, () ->
            checkoutCase.checkout("buyer-1", "m-1", List.of(new CheckoutItemEntity("sku-1", 1, 1200, 0)), "k-1", "少冰", "12:00-12:30")
        );
        assertEquals(ResponseCode.AUTH_RATE_LIMITED.getCode(), brushErr.getCode());
        assertEquals(1L, hub.telemetry().orderBrushBlockedCount());

        order.complete();
        IUserAccountService accounts = mock(IUserAccountService.class);
        when(accounts.requireActive("buyer-1")).thenReturn(UserAccountAggregate.register("buyer-1", "student01", "张同学"));
        when(trading.orderForUpdate("ord-10")).thenReturn(order);
        when(trading.hasOrderReviews("ord-10")).thenReturn(false, true);
        ICatalogService catalog = mock(ICatalogService.class);
        when(catalog.resolveOffers(List.of("sku-1"))).thenReturn(
            List.of(new SkuOfferVO("sku-1", "prod-1", "m-1", "s-1", "冰乌龙", "大杯", 1200, 0, "PUBLISHED", "ACTIVE", "", ""))
        );
        OrderLifecycleCaseImpl lifecycle = new OrderLifecycleCaseImpl(
            trading,
            mock(IOrderEventService.class),
            mock(IAfterSaleService.class),
            mock(IFulfillmentService.class),
            mock(IInventoryService.class),
            mock(IAccessService.class),
            accounts,
            mock(IMerchantService.class),
            mock(IOrderQueryCase.class),
            clock
        );
        ReflectionTestUtils.setField(lifecycle, "catalogService", catalog);
        List<OrderReviewVO> reviews = lifecycle.submitOrderReview("buyer-1", "ord-10", 5, "出餐快,好喝", "非常清爽！");
        assertEquals(1, reviews.size());
        assertEquals("prod-1", reviews.get(0).productId());
        assertEquals(5, reviews.get(0).rating());
        AppException dup = assertThrows(AppException.class, () -> lifecycle.submitOrderReview("buyer-1", "ord-10", 5, "", "重复评价"));
        assertEquals(ResponseCode.STATE_CONFLICT.getCode(), dup.getCode());
    }

    @Test
    void shoppingAiAnswersPersonalOrderInquiryDirectlyAndPreservesNaturalLlmCopy() {
        IConversationService conversations = mock(IConversationService.class);
        IProposalService proposals = mock(IProposalService.class);
        IAiEnginePort engine = mock(IAiEnginePort.class);
        IKnowledgeCase knowledge = mock(IKnowledgeCase.class);
        ICatalogService catalog = mock(ICatalogService.class);
        IInventoryService inventory = mock(IInventoryService.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        IConversationTurnCase turns = mock(IConversationTurnCase.class);
        IOrderQueryCase orderQuery = mock(IOrderQueryCase.class);

        when(knowledge.readableScope("buyer-1")).thenReturn(List.of());
        ConversationTurnVO turn = new ConversationTurnVO("conv-1", "buyer-1", "tok-1");
        when(conversations.beginTurn(eq("buyer-1"), any(), anyString())).thenReturn(turn);

        OrderAggregate paidOrder = new OrderAggregate(
            "ord-108",
            "buyer-1",
            "m-1",
            "s-1",
            "校园轻饮店",
            "二食堂门口",
            List.of(new OrderItemEntity("sku-1", "无糖乌龙茶", "500ml", 600, 2)),
            "PAID",
            NOW.plusSeconds(600),
            NOW
        );
        PickupVO readyPickup = new PickupVO("pk-1", "ord-108", "m-1", "s-1", "buyer-1", "READY", "hash", NOW.plusSeconds(600), "A-108", null);
        when(orderQuery.mine("buyer-1", null, 1, 3)).thenReturn(
            new OrderPage(List.of(new OrderReadModel(paidOrder, "校园轻饮店", readyPickup, null, List.of(), false)), 1)
        );

        ShoppingAiCaseImpl aiCase = new ShoppingAiCaseImpl(
            conversations,
            proposals,
            engine,
            knowledge,
            catalog,
            inventory,
            accounts,
            clock,
            turns,
            mock(IProposalConfirmationCase.class),
            new KnowledgeEgressPolicy("", ""),
            orderQuery
        );

        var orderResult = aiCase.chat("buyer-1", "conv-1", "我的订单做好了吗？取餐号是多少？");
        assertTrue(orderResult.answer().answer().contains("A-108"));
        assertTrue(orderResult.answer().answer().contains("无糖乌龙茶"));
        assertTrue(orderResult.answer().answer().contains("校园轻饮店"));
        verifyNoInteractions(engine);

        when(conversations.messages("buyer-1", "conv-1", 12)).thenReturn(List.of());
        when(proposals.proposals("buyer-1", "conv-1")).thenReturn(List.of());
        when(engine.recall(anyString(), anyList())).thenReturn(new AiRecallVO("推荐乌龙茶", List.of("乌龙茶")));
        when(engine.semanticProductRanks(anyString(), anyInt())).thenReturn(List.of());
        when(catalog.candidateRecall(anyList(), anyInt())).thenReturn(
            List.of(new cn.bugstack.ai.domain.catalog.model.valobj.ProductCandidateSnapshot("prod-1", List.of("sku-1")))
        );
        when(catalog.availableOffers(anyList())).thenReturn(
            List.of(new SkuOfferVO("sku-1", "prod-1", "m-1", "s-1", "无糖乌龙茶", "500ml", 600L, 1L, "PUBLISHED", "ACTIVE", "", "清爽解腻"))
        );
        when(inventory.stocks(anyList())).thenReturn(List.of(new cn.bugstack.ai.domain.inventory.model.valobj.StockVO("m-1", "s-1", "sku-1", 20, 0, 1)));
        when(engine.query(any())).thenReturn(
            new AiAnswerVO(
                "为你挑了这款 500ml 无糖乌龙茶，单价 6 元且库存充足，解腻很合适。",
                "LLM",
                "REMOTE_EMBEDDING",
                "推荐乌龙茶",
                "",
                List.of(),
                List.of(new AiRecommendationVO("sku-1", 1, "低糖清爽、性价比高")),
                120
            )
        );

        var llmResult = aiCase.chat("buyer-1", "conv-1", "预算10元推荐无糖乌龙茶");
        assertTrue(llmResult.answer().answer().contains("为你挑了这款 500ml 无糖乌龙茶"));
        assertTrue(llmResult.answer().answer().contains("不会自动下单"));
        assertEquals("低糖清爽、性价比高", llmResult.answer().recommendations().get(0).reason());
    }
}
