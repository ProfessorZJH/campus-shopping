package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.bugstack.ai.cases.agent.impl.AgentRunCaseImpl;
import cn.bugstack.ai.cases.agent.impl.AgentToolInvocationCaseImpl;
import cn.bugstack.ai.cases.agent.model.AgentToolInvocationCommand;
import cn.bugstack.ai.cases.agent.model.CreateAgentRunCommand;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductCandidateSnapshot;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogCandidateQuery;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentProductCandidateVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolInvocationVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AgentGatewayTest {

    private static final Instant NOW = Instant.parse("2026-11-09T12:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void createsAnIdempotentRunBoundToTheExistingConversationLease() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        IAccessService access = mock(IAccessService.class);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(access.memberships("buyer")).thenReturn(List.of(new MembershipVO("merchant-1", "buyer", "OWNER", "ACTIVE")));
        when(repository.findByIdempotency("buyer", "request-1")).thenReturn(null);
        when(repository.insert(any())).thenReturn(true);

        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, accounts, access, clock);
        var first = runs.create(new CreateAgentRunCommand("buyer", "conversation", "turn-token", "request-1", null, Set.of("search_products")));

        assertNotNull(first.capabilityToken());
        ArgumentCaptor<AgentRunVO> created = ArgumentCaptor.forClass(AgentRunVO.class);
        verify(repository).insert(created.capture());
        assertEquals(AgentRunStatusVO.CREATED, created.getValue().status());
        assertEquals(AgentScopeVO.CONSUMER, created.getValue().scope().identityKind());

        when(repository.findByIdempotency("buyer", "request-1")).thenReturn(created.getValue());
        var replay = runs.create(new CreateAgentRunCommand("buyer", "conversation", "turn-token", "request-1", null, Set.of("search_products")));
        assertEquals(first.runId(), replay.runId());
        assertEquals(null, replay.capabilityToken());
    }

    @Test
    void rejectsRunCreationWhenTheConversationLeaseHasExpired() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.minusSeconds(1));
        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, mock(IUserAccountService.class), mock(IAccessService.class), clock);

        AppException error = assertThrows(
            AppException.class,
            () -> runs.create(new CreateAgentRunCommand("buyer", "conversation", "turn-token", "request-1", null, Set.of("search_products")))
        );
        assertEquals(ResponseCode.STATE_CONFLICT.getCode(), error.getCode());
    }

    @Test
    void searchProductsRevalidatesOfferMerchantAndStockFacts() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        AgentRunVO run = run("buyer", AgentScopeVO.CONSUMER, null, Set.of("merchant-1", "merchant-2"), "capability");
        when(repository.find("run-1")).thenReturn(run);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(repository.invocation("run-1", "call-1")).thenReturn(null);
        when(repository.claimInvocation(any())).thenReturn(true);
        when(repository.completeInvocation(eq("run-1"), eq("call-1"), anyString(), any(), any())).thenReturn(true);

        ICatalogCandidateQuery catalog = mock(ICatalogCandidateQuery.class);
        when(catalog.candidateRecall(List.of("笔记本"), 50)).thenReturn(List.of(new ProductCandidateSnapshot("product-1", List.of("sku-1", "sku-2"))));
        when(catalog.availableOffers(List.of("sku-1", "sku-2"))).thenReturn(
            List.of(
                offer("sku-1", "product-1", "merchant-1", "store-1", "笔记本", 1000),
                offer("sku-2", "product-1", "merchant-2", "store-2", "笔记本", 900)
            )
        );
        IInventoryService inventory = mock(IInventoryService.class);
        when(inventory.stocks(List.of("sku-1", "sku-2"))).thenReturn(
            List.of(new StockVO("merchant-1", "store-1", "sku-1", 5, 1, 3), new StockVO("merchant-2", "store-2", "sku-2", 1, 1, 2))
        );
        IMerchantService merchants = mock(IMerchantService.class);
        when(merchants.findAll(List.of("merchant-1", "merchant-2"))).thenReturn(
            List.of(merchant("merchant-1", "ACTIVE"), merchant("merchant-2", "ACTIVE"))
        );

        AgentToolInvocationCaseImpl tools = new AgentToolInvocationCaseImpl(
            repository,
            mockRuns(repository, accounts),
            catalog,
            inventory,
            merchants,
            accounts,
            clock
        );
        AgentToolResultVO result = tools.invoke(new AgentToolInvocationCommand("buyer", "run-1", "capability", "call-1", "search_products", "笔记本", 5, null));

        assertEquals(1, result.candidates().size());
        AgentProductCandidateVO candidate = result.candidates().get(0);
        assertEquals("merchant-1", candidate.merchantId());
        assertEquals(4, candidate.offers().get(0).availableQuantity());
        verify(repository).completeInvocation(eq("run-1"), eq("call-1"), anyString(), eq(result), any());
    }

    @Test
    void completedInvocationIsReplayedAndDifferentInputIsRejected() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        AgentRunVO run = run("buyer", AgentScopeVO.CONSUMER, null, Set.of("merchant-1"), "capability");
        when(repository.find("run-1")).thenReturn(run);
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        String fingerprint = Fingerprints.of("search_products", "1.0", "笔记本", 5, null);
        AgentToolResultVO result = new AgentToolResultVO("search_products", "1.0", true, List.of());
        when(repository.invocation("run-1", "call-1")).thenReturn(
            new AgentToolInvocationVO("invocation-1", "run-1", "call-1", "search_products", fingerprint, "COMPLETED", result, null, NOW, NOW)
        );

        AgentToolInvocationCaseImpl tools = new AgentToolInvocationCaseImpl(
            repository,
            mockRuns(repository, accounts),
            mock(ICatalogCandidateQuery.class),
            mock(IInventoryService.class),
            mock(IMerchantService.class),
            accounts,
            clock
        );
        assertEquals(result, tools.invoke(new AgentToolInvocationCommand("buyer", "run-1", "capability", "call-1", "search_products", "笔记本", 5, null)));
        verify(repository, never()).claimInvocation(any());

        when(repository.invocation("run-1", "call-2")).thenReturn(
            new AgentToolInvocationVO("invocation-2", "run-1", "call-2", "search_products", fingerprint, "COMPLETED", result, null, NOW, NOW)
        );
        AppException conflict = assertThrows(
            AppException.class,
            () -> tools.invoke(new AgentToolInvocationCommand("buyer", "run-1", "capability", "call-2", "search_products", "水杯", 5, null))
        );
        assertEquals(ResponseCode.REQUEST_CONFLICT.getCode(), conflict.getCode());
    }

    @Test
    void merchantRunCannotReadAnotherMerchant() {
        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        AgentRunVO run = run("merchant-user", AgentScopeVO.MERCHANT, "merchant-1", Set.of("merchant-1", "merchant-2"), "capability");
        when(repository.find("run-1")).thenReturn(run);
        when(repository.activeTurnExpiry("merchant-user", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        AgentToolInvocationCaseImpl tools = new AgentToolInvocationCaseImpl(
            repository,
            mockRuns(repository, accounts),
            mock(ICatalogCandidateQuery.class),
            mock(IInventoryService.class),
            mock(IMerchantService.class),
            accounts,
            clock
        );
        AppException error = assertThrows(
            AppException.class,
            () -> tools.invoke(new AgentToolInvocationCommand("merchant-user", "run-1", "capability", "call-1", "search_products", "笔记本", 5, "merchant-2"))
        );
        assertEquals(ResponseCode.AUTH_FORBIDDEN.getCode(), error.getCode());
        verify(repository, never()).claimInvocation(any());
    }

    private AgentRunCaseImpl mockRuns(IAgentRunRepository repository, IUserAccountService accounts) {
        return new AgentRunCaseImpl(repository, accounts, mock(IAccessService.class), clock);
    }

    private AgentRunVO run(String userId, String identityKind, String identityId, Set<String> merchants, String capability) {
        var scope = new AgentScopeVO(
            userId,
            identityKind,
            identityId,
            merchants,
            Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
            "conversation",
            "turn-token",
            NOW.plusSeconds(600)
        );
        return new AgentRunVO("run-1", userId, "request-1", Fingerprints.sha256(capability), scope, Set.of("search_products"), AgentRunStatusVO.RUNNING, NOW, NOW, 0);
    }

    private SkuOfferVO offer(String sku, String product, String merchant, String store, String title, long price) {
        return new SkuOfferVO(sku, product, merchant, store, title, "默认", price, 1, "PUBLISHED", "ACTIVE", "", "");
    }

    private MerchantVO merchant(String id, String status) {
        return new MerchantVO(id, "application-" + id, "商户", "category", status, "store-" + id, "门店", "", "", "", "");
    }
}
