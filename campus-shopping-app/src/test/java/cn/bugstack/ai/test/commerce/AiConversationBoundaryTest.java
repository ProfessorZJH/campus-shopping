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
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

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
            eq(List.of(new AiCitationVO("used", "chunk", "引用", "允许引用", 1.0, "root", 1))),
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
    void newConversationDoesNotTreatUncommittedQuestionAsSavedSummary() {
        var repository = mock(IConversationRepository.class);
        when(repository.claimTurn(anyString(), eq("buyer"), anyString())).thenReturn(true);
        var service = new ConversationServiceImpl(repository, clock);

        service.beginTurn("buyer", null, "尚未成功保存的问题");

        var created = ArgumentCaptor.forClass(ConversationVO.class);
        verify(repository).createConversation(created.capture());
        assertEquals(clock.instant(), created.getValue().lastActiveAt());
        assertEquals("", created.getValue().summary());
        verify(repository, never()).updateActivity(anyString(), anyString(), any(), anyString());
    }

    @Test
    void cancellationIsBoundToTheCurrentPersistedTurnState() {
        var repository = mock(IConversationRepository.class);
        String id = "conversation";
        when(repository.conversation(id)).thenReturn(new ConversationVO(id, "buyer", "题目", clock.instant()));
        var requested = new ConversationTurnStatusVO(id, "CANCEL_REQUESTED", clock.instant());
        when(repository.turnStatus(id, "buyer")).thenReturn(requested);
        var service = new ConversationServiceImpl(repository, clock);

        assertEquals(requested, service.requestTurnCancel("buyer", id));
        verify(repository).requestTurnCancel(id, "buyer");
        verify(repository, times(1)).turnStatus(id, "buyer");
        verify(repository, never()).releaseTurn(any());
    }

    @Test
    void statusReadDoesNotExposeLeaseToken() {
        var repository = mock(IConversationRepository.class);
        String id = "conversation";
        when(repository.conversation(id)).thenReturn(new ConversationVO(id, "buyer", "题目", clock.instant()));
        when(repository.turnStatus(id, "buyer")).thenReturn(new ConversationTurnStatusVO(id, "RUNNING", null));

        var status = new ConversationServiceImpl(repository, clock).turnStatus("buyer", id);

        assertEquals(id, status.conversationId());
        assertEquals("RUNNING", status.status());
        assertNull(status.cancelRequestedAt());
        assertFalse(status.toString().contains("token"));
    }

    @Test
    void historicalCitationsAreRevalidatedAndOldMessagesRemainExplicitlyMissing() {
        var state = mock(IConversationService.class);
        var knowledge = mock(IKnowledgeCase.class);
        var accounts = mock(IUserAccountService.class);
        var scope = List.of(new KnowledgeScopeVO("doc", "公开规则", "PUBLIC", "base", null));
        var citation = new AiCitationVO("doc", "chunk-1", "公开规则", "请到店领取", 1.0, "root", 2);
        var message = new MessageVO("message", "conversation", "assistant", "回答", clock.instant(), Fingerprints.of("doc"), List.of(citation), true);
        when(knowledge.readableScope("buyer")).thenReturn(scope);
        when(knowledge.citationDocuments("buyer", List.of("doc"))).thenReturn(
            List.of(new KnowledgeDocumentVO("doc", "root", "base", "公开规则", null, "PUBLIC", 2, "PUBLISHED", "READY", "请到店领取", "", clock.instant()))
        );
        when(state.messages("buyer", "conversation", 100)).thenReturn(List.of(message));
        when(accounts.requireActive("buyer")).thenReturn(null);
        var useCase = new ShoppingAiCaseImpl(
            state,
            mock(IProposalService.class),
            mock(IAiEnginePort.class),
            knowledge,
            mock(ICatalogService.class),
            mock(IInventoryService.class),
            accounts,
            clock,
            mock(IConversationTurnCase.class),
            mock(IProposalConfirmationCase.class),
            new KnowledgeEgressPolicy("", "")
        );

        var visible = useCase.history("buyer", "conversation");
        assertEquals(List.of(citation), visible.get(0).citations());
        assertTrue(visible.get(0).citationsVisible());
        verify(knowledge).citationDocuments("buyer", List.of("doc"));

        reset(knowledge);
        when(knowledge.readableScope("buyer")).thenReturn(scope);
        when(knowledge.citationDocuments("buyer", List.of("doc"))).thenReturn(
            List.of(new KnowledgeDocumentVO("doc", "root", "base", "公开规则", null, "PUBLIC", 3, "PUBLISHED", "READY", "请到店领取", "", clock.instant()))
        );
        var versionChanged = useCase.history("buyer", "conversation");
        assertEquals("回答", versionChanged.get(0).content());
        assertTrue(versionChanged.get(0).citations().isEmpty());
        assertFalse(versionChanged.get(0).citationsVisible());

        reset(knowledge);
        when(knowledge.readableScope("buyer")).thenReturn(List.of());
        var hidden = useCase.history("buyer", "conversation");
        assertEquals("资料权限或版本已变化，此历史回答已隐藏，请重新提问。", hidden.get(0).content());
        assertTrue(hidden.get(0).citations().isEmpty());
        assertFalse(hidden.get(0).citationsVisible());

        when(knowledge.readableScope("buyer")).thenReturn(scope);
        when(state.messages("buyer", "conversation", 100)).thenReturn(
            List.of(new MessageVO("old", "conversation", "assistant", "旧回答", clock.instant(), null))
        );
        var missing = useCase.history("buyer", "conversation");
        assertEquals("旧回答", missing.get(0).content());
        assertFalse(missing.get(0).citationsRecorded());
        assertTrue(missing.get(0).citations().isEmpty());
    }

    @Test
    void protectedCitationStoresOnlySafeMarker() {
        var state = mock(IConversationService.class);
        var engine = mock(IAiEnginePort.class);
        var knowledge = mock(IKnowledgeCase.class);
        var catalog = mock(ICatalogService.class);
        var inventory = mock(IInventoryService.class);
        var accounts = mock(IUserAccountService.class);
        var turns = mock(IConversationTurnCase.class);
        var turn = new ConversationTurnVO("conversation", "buyer", "attempt");
        var scope = List.of(new KnowledgeScopeVO("internal", "商户规则", "MERCHANT_INTERNAL", "base", "merchant"));
        when(state.beginTurn("buyer", "conversation", "退款规则怎么处理？")).thenReturn(turn);
        when(state.messages("buyer", "conversation", 12)).thenReturn(List.of());
        when(knowledge.readableScope("buyer")).thenReturn(scope);
        when(knowledge.citationDocuments("buyer", List.of("internal"))).thenReturn(
            List.of(
                new KnowledgeDocumentVO(
                    "internal",
                    "root",
                    "base",
                    "商户规则",
                    "merchant",
                    "MERCHANT_INTERNAL",
                    1,
                    "PUBLISHED",
                    "READY",
                    "内部退款正文",
                    "",
                    clock.instant()
                )
            )
        );
        when(engine.recall(anyString(), anyList())).thenReturn(new AiRecallVO("退款规则怎么处理？", List.of()));
        when(engine.semanticProducts(anyString(), anyInt())).thenReturn(List.of());
        when(catalog.recall(anyList(), anyInt())).thenReturn(List.of());
        when(catalog.recallByIds(anyList())).thenReturn(List.of());
        when(catalog.availableOffers(anyList())).thenReturn(List.of());
        when(inventory.stocks(anyList())).thenReturn(List.of());
        when(engine.query(any())).thenReturn(
            new AiAnswerVO(
                "模型原文不应直接写入",
                "LOCAL_RETRIEVAL_DEMO",
                "LOCAL_CHAR_NGRAM_DEMO",
                "退款规则怎么处理？",
                "",
                List.of(new AiCitationVO("internal", "chunk", "商户规则", "内部退款正文", 1.0)),
                List.of(),
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

        useCase.chat("buyer", "conversation", "退款规则怎么处理？");

        var citations = ArgumentCaptor.forClass(List.class);
        verify(turns).complete(eq(turn), eq("退款规则怎么处理？"), anyString(), eq(List.of()), citations.capture(), any(), anyString());
        var saved = (List<AiCitationVO>) citations.getValue();
        assertEquals(1, saved.size());
        assertEquals("内部资料来源，原文片段不公开展示", saved.get(0).snippet());
        assertFalse(saved.get(0).snippet().contains("内部退款正文"));
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

    @Test
    void proposalConfirmationExpiresAndReplaysOnlyTheSameSelection() {
        var first = new ProposalItemVO("sku-1", "merchant", "商品一", "标准", 100, 1, 1);
        var second = new ProposalItemVO("sku-2", "merchant", "商品二", "标准", 200, 1, 1);
        var now = clock.instant();
        var proposal = ProposalAggregate.create("buyer", "conversation", List.of(first, second), now.plusSeconds(600), now);
        var aggregate = new ProposalAggregate(proposal);

        assertThrows(AppException.class, () -> aggregate.confirm("buyer", List.of("sku-1", "sku-1"), now));
        assertThrows(AppException.class, () -> aggregate.confirm("buyer", List.of("sku-missing"), now));
        assertTrue(aggregate.confirm("buyer", List.of("sku-1"), now));
        assertFalse(aggregate.confirm("buyer", List.of("sku-1"), now.plusSeconds(601)));

        var conflict = assertThrows(AppException.class, () -> aggregate.confirm("buyer", List.of("sku-2"), now.plusSeconds(601)));
        assertEquals(ResponseCode.REQUEST_CONFLICT.getCode(), conflict.getCode());

        var expired = new ProposalAggregate(ProposalAggregate.create("buyer", "conversation", List.of(first), now.plusSeconds(1), now));
        var error = assertThrows(AppException.class, () -> expired.confirm("buyer", List.of("sku-1"), now.plusSeconds(1)));
        assertEquals(ResponseCode.PROPOSAL_EXPIRED.getCode(), error.getCode());
    }
}
