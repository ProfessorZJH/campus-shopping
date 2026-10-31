package cn.bugstack.ai.cases.shoppingai.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.cases.shoppingai.IConversationTurnCase;
import cn.bugstack.ai.cases.shoppingai.IKnowledgeCase;
import cn.bugstack.ai.cases.shoppingai.IProposalConfirmationCase;
import cn.bugstack.ai.cases.shoppingai.IShoppingAiCase;
import cn.bugstack.ai.cases.shoppingai.model.ChatResult;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiAnswerVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiOfferVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecallVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecommendationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.domain.shoppingai.service.IProposalService;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import cn.bugstack.ai.domain.shoppingai.service.ShoppingAnswerPolicy;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Java 负责复权、商品事实和用户确认；模型文本从不直接变成写命令。 */
@Service
public class ShoppingAiCaseImpl implements IShoppingAiCase {

    private final cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy egress;

    private static final Logger log = LoggerFactory.getLogger(ShoppingAiCaseImpl.class);

    private final IConversationService state;
    private final IProposalService proposals;
    private final IAiEnginePort engine;
    private final IKnowledgeCase knowledge;
    private final ICatalogService catalog;
    private final IInventoryService inventory;
    private final IUserAccountService accounts;
    private final Clock clock;
    private final IConversationTurnCase turns;
    private final IProposalConfirmationCase confirmation;

    @Value("${campus.proposal.minutes:10}")
    private long proposalMinutes = 10;

    public ShoppingAiCaseImpl(
        IConversationService state,
        IProposalService proposals,
        IAiEnginePort engine,
        IKnowledgeCase knowledge,
        ICatalogService catalog,
        IInventoryService inventory,
        IUserAccountService accounts,
        Clock clock,
        IConversationTurnCase turns,
        IProposalConfirmationCase confirmation,
        cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy egress
    ) {
        this.egress = egress;
        this.state = state;
        this.proposals = proposals;
        this.engine = engine;
        this.knowledge = knowledge;
        this.catalog = catalog;
        this.inventory = inventory;
        this.accounts = accounts;
        this.clock = clock;
        this.turns = turns;
        this.confirmation = confirmation;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NEVER)
    public ChatResult chat(String actor, String conversationId, String question) {
        accounts.requireActive(actor);
        String q = text(question, "问题", 2000);
        var turn = state.beginTurn(actor, conversationId, q);
        try {
            return answer(actor, turn, q);
        } catch (RuntimeException failure) {
            // 成功提交已经在短事务中释放租约；失败才做 token 条件释放，不能误清除后继请求。
            try {
                state.releaseTurn(turn);
            } catch (RuntimeException releaseFailure) {
                failure.addSuppressed(releaseFailure);
                log.error(
                    "会话租约释放失败 conversationId={} diagnostic={}",
                    turn.conversationId(),
                    cn.bugstack.ai.types.common.FailureDiagnostics.describe(releaseFailure)
                );
            }
            throw failure;
        }
    }

    private ChatResult answer(String actor, ConversationTurnVO turn, String question) {
        String conversation = turn.conversationId();
        var documents = knowledge.readableScope(actor);
        String fingerprint = scope(documents);
        List<MessageVO> history = safeHistory(actor, conversation, fingerprint, 12);
        AiRecallVO recall = engine.recall(question, history);
        // 词面召回 + 可选 Milvus 语义召回：RRF 合并，商品状态仍须重新由 MySQL 校验。
        List<cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate> lexical = catalog.recall(recall.terms(), 200);
        List<String> semanticIds = List.of();
        try {
            semanticIds = engine.semanticProducts(recall.query(), 80);
        } catch (cn.bugstack.ai.types.exception.AppException e) {
            if (!ResponseCode.AI_UNAVAILABLE.getCode().equals(e.getCode())) throw e;
            log.warn("商品语义召回降级 diagnostic={}", cn.bugstack.ai.types.common.FailureDiagnostics.describe(e));
        }
        var semantic = catalog.recallByIds(semanticIds);
        var byProduct = new HashMap<String, cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate>();
        lexical.forEach(p -> byProduct.put(p.getId(), p));
        semantic.forEach(p -> byProduct.put(p.getId(), p));
        Set<String> semanticProductIds = semantic
            .stream()
            .map(p -> p.getId())
            .collect(Collectors.toSet());
        var products = RecommendationPolicy.fuse(
            lexical
                .stream()
                .map(p -> p.getId())
                .toList(),
            semanticIds
        )
            .stream()
            .filter(byProduct::containsKey)
            .map(byProduct::get)
            .toList();
        List<String> ids = RecommendationPolicy.sampleSkus(
            products
                .stream()
                .map(p ->
                    p
                        .getSkus()
                        .stream()
                        .filter(s -> s.state() == cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO.ACTIVE)
                        .map(s -> s.id())
                        .toList()
                )
                .toList()
        );
        List<SkuOfferVO> offers = catalog.availableOffers(ids);
        Map<String, StockVO> stocks = inventory
            .stocks(ids)
            .stream()
            .collect(Collectors.toMap(StockVO::skuId, s -> s));
        List<AiOfferVO> candidates = offers
            .stream()
            .map(o -> {
                StockVO stock = stocks.get(o.skuId());
                return new AiOfferVO(
                    o.skuId(),
                    o.merchantId(),
                    o.title(),
                    o.specKey(),
                    o.description(),
                    o.priceCent(),
                    stock == null ? 0 : stock.onHand() - stock.reserved()
                );
            })
            .filter(o -> o.available() > 0)
            .toList();
        List<String> semanticSkuIds = offers
            .stream()
            .filter(o -> semanticProductIds.contains(o.productId()))
            .map(SkuOfferVO::skuId)
            .toList();
        AiAnswerVO answer = engine.query(
            new AiQueryEntity(
                question,
                documents.stream().map(KnowledgeScopeVO::id).toList(),
                candidates,
                history,
                recall.query(),
                semanticSkuIds,
                documents
                    .stream()
                    .filter(d -> egress.allows(d.visibility(), d.baseId(), d.merchantId()))
                    .map(KnowledgeScopeVO::id)
                    .toList()
            )
        );
        // 远程响应返回前重新校验整个知识授权快照，撤权/撤稿期间不输出已生成内容。
        var current = knowledge.readableScope(actor);
        require(fingerprint.equals(scope(current)), ResponseCode.KNOWLEDGE_NOT_READY);
        List<AiCitationVO> citations = verifyCitations(actor, answer.citations(), current);
        List<ProposalItemVO> quotes = offers
            .stream()
            .map(o -> new ProposalItemVO(o.skuId(), o.merchantId(), o.title(), o.specKey(), o.priceCent(), o.version(), 1, o.imageUrl()))
            .toList();
        Map<String, Long> available = new HashMap<>();
        stocks.forEach((id, s) -> available.put(id, s.onHand() - s.reserved()));
        boolean knowledgeOnly = ShoppingAnswerPolicy.knowledgeQuestion(question);
        List<ProposalItemVO> items = knowledgeOnly
            ? List.of()
            : RecommendationPolicy.select(
                  answer.recommendations(),
                  quotes,
                  available,
                  question,
                  history
                      .stream()
                      .filter(m -> "user".equals(m.role()))
                      .map(MessageVO::content)
                      .toList()
              );
        // 不把模型提出但未通过 Java SKU/库存复核的条目输出给前端。
        List<AiRecommendationVO> verified = items
            .stream()
            .map(i -> new AiRecommendationVO(i.skuId(), i.quantity(), "规格：" + i.specKey() + "；以当前商品卡片为准"))
            .toList();
        var specs = cn.bugstack.ai.domain.shoppingai.service.SkuConstraintPolicy.resolve(
            question,
            history
                .stream()
                .filter(m -> "user".equals(m.role()))
                .map(MessageVO::content)
                .toList(),
            quotes.stream().map(ProposalItemVO::specKey).toList(),
            quotes.stream().map(ProposalItemVO::title).toList()
        );
        String safeText = ShoppingAnswerPolicy.evidenceAnswer(citations);
        if (!knowledgeOnly && (!items.isEmpty() || !answer.recommendations().isEmpty() || specs.active())) {
            safeText = items.isEmpty()
                ? "当前没有可核实且满足要求的商品，请明确规格、数量或预算。"
                : "可查看以下商品：" +
                  items
                      .stream()
                      .map(i -> i.title() + "（" + i.specKey() + "）×" + i.quantity())
                      .collect(Collectors.joining("；")) +
                  "。确认后只加入购物车，不会自动下单或付款。";
        }
        AiAnswerVO safe = new AiAnswerVO(
            safeText,
            answer.mode(),
            answer.retrievalMode(),
            answer.rewrittenQuery(),
            answer.warning(),
            List.copyOf(citations),
            verified,
            answer.latencyMs()
        );
        require(fingerprint.equals(scope(knowledge.readableScope(actor))), ResponseCode.KNOWLEDGE_NOT_READY);
        ProposalVO proposal = turns.complete(
            turn,
            question,
            safe.answer(),
            items,
            clock.instant().plusSeconds(Math.max(1, Math.min(proposalMinutes, 30)) * 60),
            fingerprint
        );
        return new ChatResult(conversation, safe, proposal);
    }

    /** 只返回当前授权知识范围中的可核实引用，内部文档始终隐藏原文。 */
    private List<AiCitationVO> verifyCitations(String actor, List<AiCitationVO> requested, List<KnowledgeScopeVO> readable) {
        Set<String> allowedIds = readable.stream().map(KnowledgeScopeVO::id).collect(Collectors.toSet());
        List<String> citedIds = requested.stream().map(AiCitationVO::documentId).distinct().toList();
        require(allowedIds.containsAll(citedIds), ResponseCode.KNOWLEDGE_NOT_READY);
        Map<String, KnowledgeDocumentVO> byId = knowledge
            .citationDocuments(actor, citedIds)
            .stream()
            .collect(Collectors.toMap(KnowledgeDocumentVO::id, d -> d));
        List<AiCitationVO> citations = new ArrayList<>();
        for (var citation : requested) {
            var document = byId.get(citation.documentId());
            require(
                document != null && citation.snippet() != null && citation.snippet().length() <= 500 && document.content().contains(citation.snippet()),
                ResponseCode.KNOWLEDGE_NOT_READY
            );
            citations.add(
                new AiCitationVO(
                    document.id(),
                    citation.chunkId(),
                    document.title(),
                    "PUBLIC".equals(document.visibility()) ? citation.snippet() : "内部资料来源，原文片段不公开展示",
                    citation.score()
                )
            );
        }
        return citations;
    }

    private String scope(List<KnowledgeScopeVO> docs) {
        return Fingerprints.of(docs.stream().map(KnowledgeScopeVO::id).sorted().toArray());
    }

    private List<MessageVO> safeHistory(String actor, String conversation, String fingerprint, int limit) {
        return state
            .messages(actor, conversation, limit)
            .stream()
            .map(m ->
                "assistant".equals(m.role()) && !fingerprint.equals(m.accessFingerprint())
                    ? new MessageVO(m.id(), m.conversationId(), m.role(), "资料权限或版本已变化，此历史回答已隐藏，请重新提问。", m.createdAt(), fingerprint)
                    : m
            )
            .toList();
    }

    public List<MessageVO> history(String actor, String conversation) {
        accounts.requireActive(actor);
        return safeHistory(actor, conversation, scope(knowledge.readableScope(actor)), 100);
    }

    public List<ConversationVO> conversations(String actor, int page, int size) {
        accounts.requireActive(actor);
        return state.conversations(actor, page, size);
    }

    public List<ProposalVO> proposals(String actor, String conversation) {
        accounts.requireActive(actor);
        return proposals.proposals(actor, conversation);
    }

    public ProposalVO confirm(String actor, String id, List<String> selected) {
        return confirmation.confirm(actor, id, selected);
    }

    public void reject(String actor, String proposal) {
        accounts.requireActive(actor);
        proposals.reject(actor, proposal);
    }
}
