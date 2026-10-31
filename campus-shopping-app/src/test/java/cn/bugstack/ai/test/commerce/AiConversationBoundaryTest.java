package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.shoppingai.*;
import cn.bugstack.ai.cases.shoppingai.impl.ShoppingAiCaseImpl;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.*;
import cn.bugstack.ai.domain.shoppingai.service.impl.ConversationServiceImpl;
import cn.bugstack.ai.types.exception.AppException;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** 测试规则和能力边界；数据库 CAS/原子提交另由真实 MySQL 测试覆盖。 */
class AiConversationBoundaryTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-10-30T00:00:00Z"), ZoneOffset.UTC);

    @ParameterizedTest
    @ValueSource(strings = { "问题", "这款签字笔怎么申请退款？", "标准装签字笔怎么申请退款？" })
    void onlyActualCitationBodiesAreLoadedAndPermissionIsRecheckedBeforeCommit(String question) {
        var state = mock(IConversationService.class);
        var engine = mock(IAiEnginePort.class);
        var knowledge = mock(IKnowledgeCase.class);
        var catalog = mock(ICatalogService.class);
        var inventory = mock(IInventoryService.class);
        var accounts = mock(IUserAccountService.class);
        var turns = mock(IConversationTurnCase.class);
        var turn = new ConversationTurnVO("conversation", "buyer", "attempt");
        var scope = List.of(new KnowledgeScopeVO("used", "引用", "PUBLIC"), new KnowledgeScopeVO("unused", "其他", "PUBLIC"));
        when(state.beginTurn("buyer", "conversation", question)).thenReturn(turn);
        when(state.messages("buyer", "conversation", 12)).thenReturn(List.of());
        when(knowledge.readableScope("buyer")).thenReturn(scope);
        when(knowledge.citationDocuments("buyer", List.of("used"))).thenReturn(
            List.of(new KnowledgeDocumentVO("used", "root", "base", "引用", null, "PUBLIC", 1, "PUBLISHED", "READY", "允许引用的正文", "", clock.instant()))
        );
        when(engine.recall(anyString(), anyList())).thenReturn(new AiRecallVO(question, List.of()));
        when(engine.semanticProducts(anyString(), anyInt())).thenReturn(List.of());
        when(catalog.recall(anyList(), anyInt())).thenReturn(List.of());
        when(catalog.recallByIds(anyList())).thenReturn(List.of());
        when(catalog.saleOffers(anyList())).thenReturn(List.of());
        when(catalog.availableOffers(anyList())).thenReturn(
            List.of(
                new cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO(
                    "sku",
                    "product",
                    "merchant",
                    "store",
                    "签字笔",
                    "标准装",
                    100,
                    1,
                    "PUBLISHED",
                    "ACTIVE",
                    "",
                    ""
                )
            )
        );
        when(inventory.stocks(anyList())).thenReturn(List.of(new cn.bugstack.ai.domain.inventory.model.valobj.StockVO("merchant", "store", "sku", 10, 0, 1)));
        when(engine.query(any())).thenReturn(
            new AiAnswerVO(
                "回答",
                "LOCAL_RETRIEVAL_DEMO",
                "LOCAL_CHAR_NGRAM_DEMO",
                question,
                "",
                List.of(new AiCitationVO("used", "chunk", "引用", "允许引用", 1.0)),
                ShoppingAnswerPolicy.knowledgeQuestion(question) ? List.of(new AiRecommendationVO("sku", 1, "不可信建议")) : List.of(),
                1
            )
        );
        var useCase = new ShoppingAiCaseImpl(
            state,
            mock(IProposalService.class),
            engine,
            knowledge,
            catalog,
            inventory,
            accounts,
            clock,
            turns,
            mock(IProposalConfirmationCase.class),
            new KnowledgeEgressPolicy("", "")
        );
        useCase.chat("buyer", "conversation", question);
        verify(knowledge).citationDocuments("buyer", List.of("used"));
        verify(knowledge, times(3)).readableScope("buyer");
        verify(turns).complete(
            eq(turn),
            eq(question),
            eq(ShoppingAnswerPolicy.evidenceAnswer(List.of(new AiCitationVO("used", "chunk", "引用", "允许引用", 1.0)))),
            eq(List.of()),
            any(),
            anyString()
        );
        verify(state, never()).releaseTurn(any()); // 成功事务已释放，不再多发可能失败的数据库写。

        reset(turns);
        when(knowledge.readableScope("buyer")).thenReturn(scope, scope, List.of());
        assertThrows(AppException.class, () -> useCase.chat("buyer", "conversation", question));
        verifyNoInteractions(turns);
        verify(state).releaseTurn(turn);
    }

    @Test
    void leaseClaimUsesFullConversationIdentityAndIndependentServicesUsePersistence() {
        var repository = mock(IConversationRepository.class);
        String first = "00000000-0000-0000-0000-000000000000";
        String second = "00000000-0000-0000-0000-000000000022";
        for (String id : List.of(first, second)) {
            when(repository.conversation(id)).thenReturn(new ConversationVO(id, "buyer", "题目", clock.instant()));
            when(repository.claimTurn(eq(id), eq("buyer"), anyString())).thenReturn(true);
        }
        var instanceA = new ConversationServiceImpl(repository, clock);
        var instanceB = new ConversationServiceImpl(repository, clock);
        assertEquals(Math.floorMod(first.hashCode(), 64), Math.floorMod(second.hashCode(), 64));
        var one = instanceA.beginTurn("buyer", first, "问题");
        assertEquals(second, instanceA.beginTurn("buyer", second, "问题").conversationId());
        when(repository.claimTurn(eq(first), eq("buyer"), anyString())).thenReturn(false);
        assertThrows(AppException.class, () -> instanceB.beginTurn("buyer", first, "并发问题"));
        assertNotNull(one.token());
    }

    @Test
    void proposalCreationFreezesItemsAndRejectsInvalidSnapshots() {
        var items = new ArrayList<>(List.of(new ProposalItemVO("sku", "merchant", "商品", "规格", 100, 0, 1)));
        var proposal = ProposalAggregate.create("buyer", "conversation", items, clock.instant().plusSeconds(600), clock.instant());
        items.clear();
        assertEquals(1, proposal.items().size());
        assertThrows(UnsupportedOperationException.class, () -> proposal.items().clear());
        assertThrows(AppException.class, () ->
            ProposalAggregate.create(
                "buyer",
                "conversation",
                List.of(new ProposalItemVO("sku", "merchant", "商品", "规格", -1, 0, 1)),
                clock.instant().plusSeconds(600),
                clock.instant()
            )
        );
    }
}
