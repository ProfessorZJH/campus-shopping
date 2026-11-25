package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.api.dto.ChatRequestDTO;
import cn.bugstack.ai.cases.shoppingai.AiTurnCancelledException;
import cn.bugstack.ai.cases.shoppingai.IShoppingAiCase;
import cn.bugstack.ai.cases.shoppingai.impl.KnowledgeCaseImpl;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.impl.OrderLifecycleCaseImpl;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeBaseVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeIndexAttemptVO;
import cn.bugstack.ai.domain.shoppingai.service.IKnowledgeService;
import cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy;
import cn.bugstack.ai.domain.trading.adapter.repository.IOrderRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.service.IAfterSaleService;
import cn.bugstack.ai.domain.trading.service.IOrderEventService;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.domain.trading.service.impl.OrderServiceImpl;
import cn.bugstack.ai.trigger.http.ShoppingAiController;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.security.Principal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** 阶段 2 并发/幂等/批量查询与异常映射回归测试。 */
class Stage2HardeningTest {

    private static final Instant NOW = Instant.parse("2026-11-25T03:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void appealIdempotentReplayDoesNotDuplicateDisputedOrderEvent() {
        IOrderService trading = mock(IOrderService.class);
        IOrderEventService events = mock(IOrderEventService.class);
        IAfterSaleService afterSales = mock(IAfterSaleService.class);
        OrderLifecycleCaseImpl lifecycle = new OrderLifecycleCaseImpl(
            trading,
            events,
            afterSales,
            mock(IFulfillmentService.class),
            mock(IInventoryService.class),
            mock(IAccessService.class),
            mock(IUserAccountService.class),
            mock(IMerchantService.class),
            mock(IOrderQueryCase.class),
            clock
        );
        OrderAggregate order = new OrderAggregate(
            "order-1",
            "buyer",
            "merchant-1",
            "store-1",
            List.of(new OrderItemEntity("sku-1", "中性笔", "黑色", 1000, 1)),
            "PAID",
            NOW.plusSeconds(600),
            NOW
        );
        AfterSaleVO rejected = new AfterSaleVO("as-1", "order-1", "buyer", "merchant-1", "REJECTED", "缺货", "商户驳回", NOW);
        AfterSaleVO disputed = new AfterSaleVO("as-1", "order-1", "buyer", "merchant-1", "DISPUTED", "缺货", "商户驳回", NOW);
        when(trading.orderForUpdate("order-1")).thenReturn(order);
        when(afterSales.afterSaleForUpdate("order-1")).thenReturn(rejected, disputed);
        when(afterSales.appeal(order, "buyer")).thenReturn(disputed);

        lifecycle.appeal("buyer", "order-1");
        lifecycle.appeal("buyer", "order-1");

        verify(events, times(1)).record("order-1", "as-1", "REFUND_DISPUTED", "buyer", "BUYER", "");
    }

    @Test
    void knowledgeReadableScopeUsesBatchedPermissionsAndBatchedMerchantLookup() {
        IKnowledgeService state = mock(IKnowledgeService.class);
        IAiEnginePort engine = mock(IAiEnginePort.class);
        IAccessService access = mock(IAccessService.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        IMerchantService merchants = mock(IMerchantService.class);
        KnowledgeCaseImpl knowledge = new KnowledgeCaseImpl(state, engine, access, accounts, merchants, mock(KnowledgeEgressPolicy.class));

        List<MembershipVO> memberships = List.of(new MembershipVO("m-1", "user-1", "OWNER", "ACTIVE"), new MembershipVO("m-2", "user-1", "CLERK", "ACTIVE"));
        when(access.isAdmin("user-1")).thenReturn(false);
        when(access.memberships("user-1")).thenReturn(memberships);
        when(access.workspacePermissions("user-1", memberships)).thenReturn(Map.of("m-1", Set.of("knowledge.read"), "m-2", Set.of("order.read")));
        when(state.bases()).thenReturn(
            List.of(
                new KnowledgeBaseVO("kb-pub-1", "公开库1", "m-pub-1", "PUBLIC"),
                new KnowledgeBaseVO("kb-pub-2", "公开库2", "m-pub-2", "PUBLIC"),
                new KnowledgeBaseVO("kb-int-1", "内部库1", "m-1", "MERCHANT_INTERNAL"),
                new KnowledgeBaseVO("kb-int-2", "内部库2", "m-2", "MERCHANT_INTERNAL")
            )
        );
        when(merchants.findAll(List.of("m-pub-1", "m-pub-2"))).thenReturn(
            List.of(
                new MerchantVO("m-pub-1", "app-1", "商户1", "文具", "ACTIVE", "s-1", "店1", "", "", "", ""),
                new MerchantVO("m-pub-2", "app-2", "商户2", "文具", "SUSPENDED", "s-2", "店2", "", "", "", "")
            )
        );
        when(state.visibleScope(List.of("kb-pub-1", "kb-int-1"))).thenReturn(List.of());

        knowledge.readableScope("user-1");

        verify(access, times(1)).workspacePermissions("user-1", memberships);
        verify(access, never()).permissions(anyString(), anyString());
        verify(merchants, times(1)).findAll(List.of("m-pub-1", "m-pub-2"));
        verify(merchants, never()).find(anyString());
        verify(state).visibleScope(List.of("kb-pub-1", "kb-int-1"));
    }

    @Test
    void knowledgeIndexReleasesLeaseWhenNonAiUnavailableAppExceptionOccurs() {
        IKnowledgeService state = mock(IKnowledgeService.class);
        IAiEnginePort engine = mock(IAiEnginePort.class);
        IAccessService access = mock(IAccessService.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        IMerchantService merchants = mock(IMerchantService.class);
        KnowledgeEgressPolicy egress = mock(KnowledgeEgressPolicy.class);
        KnowledgeCaseImpl knowledge = new KnowledgeCaseImpl(state, engine, access, accounts, merchants, egress);

        KnowledgeDocumentVO doc = new KnowledgeDocumentVO("doc-1", "root-1", "base-1", "标题", "m-1", "PUBLIC", 1, "DRAFT", "PENDING", "正文内容", "", NOW);
        KnowledgeIndexAttemptVO attempt = new KnowledgeIndexAttemptVO("doc-1", "attempt-1");
        when(state.document("doc-1")).thenReturn(doc);
        when(state.base("base-1")).thenReturn(new KnowledgeBaseVO("base-1", "库", "m-1", "PUBLIC"));
        when(state.beginIndex("doc-1")).thenReturn(attempt);
        when(egress.allows("PUBLIC", "base-1", "m-1")).thenReturn(false);
        doThrow(new AppException(ResponseCode.ILLEGAL_PARAMETER.getCode(), "文档内容无效")).when(engine).index("doc-1", "标题", "正文内容", 1, false);

        AppException error = assertThrows(AppException.class, () -> knowledge.index("actor", "doc-1"));
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), error.getCode());
        verify(state).completeIndex(attempt, false, "索引构建中断，请重试");
    }

    @Test
    void shoppingAiControllerMapsTurnCancelledToStateConflict() {
        ShoppingAiController controller = new ShoppingAiController();
        IShoppingAiCase shopping = mock(IShoppingAiCase.class);
        ReflectionTestUtils.setField(controller, "shopping", shopping);
        when(shopping.chat("buyer", "conv-1", "推荐文具")).thenThrow(new AiTurnCancelledException());
        ChatRequestDTO request = new ChatRequestDTO();
        request.setConversationId("conv-1");
        request.setQuestion("推荐文具");
        Principal principal = () -> "buyer";

        var response = controller.chat(request, principal);
        assertEquals(ResponseCode.STATE_CONFLICT.getCode(), response.getCode());
    }

    @Test
    void pickupStateOrderQueriesRequireMerchantId() {
        OrderServiceImpl service = new OrderServiceImpl(mock(IOrderRepository.class), clock);
        AppException listError = assertThrows(AppException.class, () -> service.ordersByPickupState(null, null, null, 1, 10, "", "READY"));
        AppException countError = assertThrows(AppException.class, () -> service.countOrdersByPickupState(null, " ", null, "", "READY"));
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), listError.getCode());
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), countError.getCode());
    }
}
