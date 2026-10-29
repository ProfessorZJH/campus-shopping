package cn.bugstack.ai.cases.shoppingai.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.cases.shoppingai.*;
import cn.bugstack.ai.cases.shoppingai.model.ChatResult;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.model.valobj.StockVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.domain.shoppingai.service.IProposalService;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Java 负责复权、商品事实和用户确认；模型文本从不直接变成写命令。 */
@lombok.extern.slf4j.Slf4j
@Service
public class ShoppingAiCaseImpl implements IShoppingAiCase {

    private final IConversationService state;
    private final IProposalService proposals;
    private final IAiEnginePort engine;
    private final IKnowledgeCase knowledge;
    private final ICatalogService catalog;
    private final IInventoryService inventory;
    private final IMerchantService merchants;
    private final IUserAccountService accounts;
    private final ICartService trading;
    private final Clock clock;
    private final ReentrantLock[] locks = new ReentrantLock[64];

    @Value("${campus.proposal.minutes:10}")
    private long proposalMinutes = 10;

    public ShoppingAiCaseImpl(
        IConversationService state,
        IProposalService proposals,
        IAiEnginePort engine,
        IKnowledgeCase knowledge,
        ICatalogService catalog,
        IInventoryService inventory,
        IMerchantService merchants,
        IUserAccountService accounts,
        ICartService trading,
        Clock clock
    ) {
        this.state = state;
        this.proposals = proposals;
        this.engine = engine;
        this.knowledge = knowledge;
        this.catalog = catalog;
        this.inventory = inventory;
        this.merchants = merchants;
        this.accounts = accounts;
        this.trading = trading;
        this.clock = clock;
        for (int i = 0; i < locks.length; i++) locks[i] = new ReentrantLock();
    }

    public ChatResult chat(String actor, String conversationId, String question) {
        accounts.requireActive(actor);
        String q = text(question, "问题", 2000);
        var conversation = state.conversation(actor, conversationId, q);
        var lock = locks[Math.floorMod(conversation.id().hashCode(), locks.length)];
        require(lock.tryLock(), ResponseCode.STATE_CONFLICT);
        try {
            return answer(actor, conversation.id(), q);
        } finally {
            lock.unlock();
        }
    }

    private ChatResult answer(String actor, String conversation, String question) {
        var documents = knowledge.readableDocuments(actor);
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
        List<SkuOfferVO> offers = catalog.offers(ids, true, false);
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
            new AiQueryEntity(question, documents.stream().map(KnowledgeDocumentVO::id).toList(), candidates, history, recall.query(), semanticSkuIds)
        );
        // 远程响应返回前重新校验整个知识授权快照，撤权/撤稿期间不输出已生成内容。
        var current = knowledge.readableDocuments(actor);
        require(fingerprint.equals(scope(current)), ResponseCode.KNOWLEDGE_NOT_READY);
        Map<String, KnowledgeDocumentVO> byId = current.stream().collect(Collectors.toMap(KnowledgeDocumentVO::id, d -> d));
        List<AiCitationVO> citations = new ArrayList<>();
        for (var c : answer.citations()) {
            var d = byId.get(c.documentId());
            require(d != null && c.snippet() != null && c.snippet().length() <= 500 && d.content().contains(c.snippet()), ResponseCode.KNOWLEDGE_NOT_READY);
            citations.add(
                new AiCitationVO(d.id(), c.chunkId(), d.title(), "PUBLIC".equals(d.visibility()) ? c.snippet() : "内部资料来源，原文片段不公开展示", c.score())
            );
        }
        List<ProposalItemVO> quotes = offers
            .stream()
            .map(o -> new ProposalItemVO(o.skuId(), o.merchantId(), o.title(), o.specKey(), o.priceCent(), o.version(), 1, o.imageUrl()))
            .toList();
        Map<String, Long> available = new HashMap<>();
        stocks.forEach((id, s) -> available.put(id, s.onHand() - s.reserved()));
        List<ProposalItemVO> items = RecommendationPolicy.select(answer.recommendations(), quotes, available);
        ProposalVO proposal = items.isEmpty()
            ? null
            : new ProposalVO(
                  UUID.randomUUID().toString(),
                  actor,
                  conversation,
                  "PENDING",
                  List.copyOf(items),
                  null,
                  clock.instant().plusSeconds(Math.max(1, Math.min(proposalMinutes, 30)) * 60)
              );
        // 不把模型提出但未通过 Java SKU/库存复核的条目输出给前端。
        Map<String, String> reasons = new HashMap<>();
        for (var r : answer.recommendations()) if (r.skuId() != null) reasons.putIfAbsent(r.skuId(), r.reason());
        List<AiRecommendationVO> verified = items
            .stream()
            .map(i -> {
                String reason = reasons.get(i.skuId());
                return new AiRecommendationVO(i.skuId(), i.quantity(), reason == null || reason.isBlank() ? "匹配当前需求" : reason);
            })
            .toList();
        AiAnswerVO safe = new AiAnswerVO(
            answer.answer(),
            answer.mode(),
            answer.retrievalMode(),
            answer.rewrittenQuery(),
            answer.warning(),
            List.copyOf(citations),
            verified,
            answer.latencyMs()
        );
        state.appendTurn(actor, conversation, question, safe.answer(), proposal, fingerprint);
        return new ChatResult(conversation, safe, proposal);
    }

    private String scope(List<KnowledgeDocumentVO> docs) {
        return Fingerprints.of(docs.stream().map(KnowledgeDocumentVO::id).sorted().toArray());
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
        return safeHistory(actor, conversation, scope(knowledge.readableDocuments(actor)), 100);
    }

    public List<ConversationVO> conversations(String actor) {
        accounts.requireActive(actor);
        return state.conversations(actor);
    }

    public List<ProposalVO> proposals(String actor, String conversation) {
        accounts.requireActive(actor);
        return proposals.proposals(actor, conversation);
    }

    @Transactional(rollbackFor = Exception.class)
    public ProposalVO confirm(String actor, String id, List<String> selected) {
        accounts.requireActive(actor);
        ProposalVO p = proposals.confirmSelection(actor, id, selected);
        if (p == null) return proposals.proposal(actor, id);
        List<String> ids = selected.stream().sorted().toList();
        Map<String, ProposalItemVO> proposed = p
            .items()
            .stream()
            .collect(Collectors.toMap(ProposalItemVO::skuId, i -> i));
        trading.lockCart(actor);
        ids.stream()
            .map(s -> proposed.get(s).merchantId())
            .distinct()
            .sorted()
            .forEach(merchants::requireActiveForNewTrade);
        var offers = catalog
            .offers(ids, true, true)
            .stream()
            .collect(Collectors.toMap(SkuOfferVO::skuId, o -> o));
        var stocks = inventory
            .stocks(ids)
            .stream()
            .collect(Collectors.toMap(StockVO::skuId, s -> s));
        for (String sku : ids) {
            var item = proposed.get(sku);
            var o = offers.get(sku);
            require(
                o.priceCent() == item.priceCent() && o.version() == item.quoteVersion() && o.merchantId().equals(item.merchantId()),
                ResponseCode.PRICE_CHANGED
            );
            var stock = stocks.get(sku);
            require(stock != null && stock.onHand() - stock.reserved() >= item.quantity(), ResponseCode.STOCK_NOT_ENOUGH);
            trading.addCart(actor, o.merchantId(), sku, item.quantity());
        }
        return proposals.proposal(actor, id);
    }

    public void reject(String actor, String proposal) {
        accounts.requireActive(actor);
        proposals.reject(actor, proposal);
    }
}
