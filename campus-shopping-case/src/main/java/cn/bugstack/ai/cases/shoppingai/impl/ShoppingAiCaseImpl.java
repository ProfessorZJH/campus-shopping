package cn.bugstack.ai.cases.shoppingai.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.cases.shoppingai.AiTurnCancelledException;
import cn.bugstack.ai.cases.shoppingai.IConversationTurnCase;
import cn.bugstack.ai.cases.shoppingai.IKnowledgeCase;
import cn.bugstack.ai.cases.shoppingai.IProposalConfirmationCase;
import cn.bugstack.ai.cases.shoppingai.IShoppingAiCase;
import cn.bugstack.ai.cases.shoppingai.model.ChatResult;
import cn.bugstack.ai.cases.shoppingai.model.KnowledgeDebugResult;
import cn.bugstack.ai.cases.shoppingai.model.ProposalView;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiAnswerVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecallVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiRecommendationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.domain.shoppingai.service.IConversationService;
import cn.bugstack.ai.domain.shoppingai.service.IProposalService;
import cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import cn.bugstack.ai.domain.shoppingai.service.ShoppingAnswerPolicy;
import cn.bugstack.ai.domain.shoppingai.service.SkuConstraintPolicy;
import cn.bugstack.ai.types.common.FailureDiagnostics;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.LongConsumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Java 负责复权、商品事实和用户确认；模型文本从不直接变成写命令。 */
@Service
public class ShoppingAiCaseImpl implements IShoppingAiCase {

    private static final Logger log = LoggerFactory.getLogger(ShoppingAiCaseImpl.class);
    private static final Pattern REPLACEMENT_PATTERN = Pattern.compile("换一个|换一款|还有别的|类似的|便宜点|便宜一些|更便宜");

    private final KnowledgeEgressPolicy egress;
    private final IConversationService conversations;
    private final IProposalService proposals;
    private final IAiEnginePort engine;
    private final IKnowledgeCase knowledge;
    private final ICatalogService catalog;
    private final IInventoryService inventory;
    private final IUserAccountService accounts;
    private final Clock clock;
    private final IConversationTurnCase turns;
    private final IProposalConfirmationCase confirmation;
    private final IOrderQueryCase orderQuery;
    private final CandidateResolver candidateResolver;
    private final EvidenceAssembler evidenceAssembler;

    @Value("${campus.proposal.minutes:10}")
    private long proposalMinutes = 10;

    public ShoppingAiCaseImpl(
        IConversationService conversations,
        IProposalService proposals,
        IAiEnginePort engine,
        IKnowledgeCase knowledge,
        ICatalogService catalog,
        IInventoryService inventory,
        IUserAccountService accounts,
        Clock clock,
        IConversationTurnCase turns,
        IProposalConfirmationCase confirmation,
        KnowledgeEgressPolicy egress
    ) {
        this(conversations, proposals, engine, knowledge, catalog, inventory, accounts, clock, turns, confirmation, egress, null);
    }

    @Autowired
    public ShoppingAiCaseImpl(
        IConversationService conversations,
        IProposalService proposals,
        IAiEnginePort engine,
        IKnowledgeCase knowledge,
        ICatalogService catalog,
        IInventoryService inventory,
        IUserAccountService accounts,
        Clock clock,
        IConversationTurnCase turns,
        IProposalConfirmationCase confirmation,
        KnowledgeEgressPolicy egress,
        IOrderQueryCase orderQuery
    ) {
        this.egress = egress;
        this.conversations = conversations;
        this.proposals = proposals;
        this.engine = engine;
        this.knowledge = knowledge;
        this.catalog = catalog;
        this.inventory = inventory;
        this.accounts = accounts;
        this.clock = clock;
        this.turns = turns;
        this.confirmation = confirmation;
        this.orderQuery = orderQuery;
        this.candidateResolver = new CandidateResolver(engine, catalog, inventory);
        this.evidenceAssembler = new EvidenceAssembler(knowledge);
    }

    /** 复用正式 AI 检索入口的只读调试链路；不创建会话、不产生提案。 */
    @Override
    public KnowledgeDebugResult debugRetrieval(String actor, String question, boolean answerPreview) {
        knowledge.requireDebugAccess(actor);
        require(question != null && !question.isBlank() && question.length() <= 1000, ResponseCode.ILLEGAL_PARAMETER);
        long started = System.nanoTime();
        List<KnowledgeScopeVO> readable = knowledge.readableScope(actor);
        String fingerprint = scope(readable);
        AiRecallVO recall = engine.recall(question.trim(), List.of());
        AiQueryEntity query = new AiQueryEntity(
            question.trim(),
            readable.stream().map(KnowledgeScopeVO::id).toList(),
            List.of(),
            List.of(),
            recall.query(),
            List.of(),
            readable
                .stream()
                .filter(d -> egress.allows(d.visibility(), d.baseId(), d.merchantId()))
                .map(KnowledgeScopeVO::id)
                .toList()
        );
        AiAnswerVO answer = answerPreview ? engine.query(query) : engine.retrieve(query);
        List<KnowledgeScopeVO> current = knowledge.readableScope(actor);
        require(fingerprint.equals(scope(current)), ResponseCode.KNOWLEDGE_NOT_READY);
        List<AiCitationVO> citations = evidenceAssembler.verifyOutput(actor, answer.citations(), current);
        Map<String, String> visibilityByDoc = current
            .stream()
            .collect(Collectors.toMap(KnowledgeScopeVO::id, KnowledgeScopeVO::visibility, (first, second) -> first));
        boolean hasNonPublicCitation = citations.stream().anyMatch(c -> !"PUBLIC".equals(visibilityByDoc.get(c.documentId())));
        // 内部文档即便临时放行外发，调试预览正文也不得透出未脱敏原文片段，统一改用已脱敏引用摘要。
        String preview = !answerPreview ? null : hasNonPublicCitation ? ShoppingAnswerPolicy.evidenceAnswer(citations) : answer.answer();
        String warning = answer.warning();
        if (!answerPreview) warning = warning == null || warning.isBlank() ? "未请求回答预览；排名仅用于检索调试，不代表答案正确性。" : warning;
        return new KnowledgeDebugResult(
            recall.query(),
            answer.retrievalMode(),
            answer.mode(),
            preview,
            warning,
            citations,
            Duration.ofNanos(System.nanoTime() - started).toMillis()
        );
    }

    @Transactional(propagation = Propagation.NEVER)
    public ChatResult chat(String actor, String conversationId, String question) {
        accounts.requireActive(actor);
        String normalizedQuestion = text(question, "问题", 2000);
        var turn = conversations.beginTurn(actor, conversationId, normalizedQuestion);
        try {
            return answer(actor, turn, normalizedQuestion, null, null, null);
        } catch (RuntimeException failure) {
            // 成功提交已经在短事务中释放租约；失败才做 token 条件释放，不能误清除后继请求。
            try {
                conversations.releaseTurn(turn);
            } catch (RuntimeException releaseFailure) {
                failure.addSuppressed(releaseFailure);
                log.error("会话租约释放失败 conversationId={} diagnostic={}", turn.conversationId(), FailureDiagnostics.describe(releaseFailure));
            }
            throw failure;
        }
    }

    @Transactional(propagation = Propagation.NEVER)
    public ChatResult chatStream(String actor, String conversationId, String question, Consumer<String> conversationReady, LongConsumer progress) {
        return chatStream(actor, conversationId, question, conversationReady, null, null, progress);
    }

    @Transactional(propagation = Propagation.NEVER)
    @Override
    public ChatResult chatStream(
        String actor,
        String conversationId,
        String question,
        Consumer<String> conversationReady,
        Consumer<String> stageListener,
        LongConsumer progress
    ) {
        return chatStream(actor, conversationId, question, conversationReady, stageListener, null, progress);
    }

    @Transactional(propagation = Propagation.NEVER)
    @Override
    public ChatResult chatStream(
        String actor,
        String conversationId,
        String question,
        Consumer<String> conversationReady,
        Consumer<String> stageListener,
        Consumer<String> deltaListener,
        LongConsumer progress
    ) {
        accounts.requireActive(actor);
        String normalizedQuestion = text(question, "问题", 2000);
        var turn = conversations.beginTurn(actor, conversationId, normalizedQuestion);
        try {
            if (conversationReady != null) conversationReady.accept(turn.conversationId());
            return answer(actor, turn, normalizedQuestion, stageListener, deltaListener, progress);
        } catch (RuntimeException failure) {
            try {
                conversations.releaseTurn(turn);
            } catch (RuntimeException releaseFailure) {
                failure.addSuppressed(releaseFailure);
                log.error("会话租约释放失败 conversationId={} diagnostic={}", turn.conversationId(), FailureDiagnostics.describe(releaseFailure));
            }
            throw failure;
        }
    }

    public ConversationTurnStatusVO turnStatus(String actor, String conversation) {
        accounts.requireActive(actor);
        return conversations.turnStatus(actor, conversation);
    }

    public ConversationTurnStatusVO requestTurnCancel(String actor, String conversation) {
        accounts.requireActive(actor);
        return conversations.requestTurnCancel(actor, conversation);
    }

    private ChatResult answer(
        String actor,
        ConversationTurnVO turn,
        String question,
        Consumer<String> stageListener,
        Consumer<String> deltaListener,
        LongConsumer progress
    ) {
        String conversation = turn.conversationId();
        if (orderQuery != null && ShoppingAnswerPolicy.personalOrderInquiry(question)) {
            return answerPersonalOrderInquiry(actor, turn, question, stageListener, deltaListener);
        }
        if (stageListener != null) stageListener.accept("recall");
        var documents = knowledge.readableScope(actor);
        String fingerprint = scope(documents);
        List<MessageVO> history = evidenceAssembler.sanitizeHistory(actor, conversations.messages(actor, conversation, 12), fingerprint, documents);
        AiRecallVO recall = engine.recall(question, history);
        var prior = Optional.ofNullable(proposals.proposals(actor, conversation)).orElse(List.of()).stream().findFirst().orElse(null);
        CandidateResolver.CandidateSnapshot candidateSnapshot = candidateResolver.resolve(question, recall, prior);
        var candidates = candidateSnapshot.candidates();
        var quotes = candidateSnapshot.quotes();
        var available = candidateSnapshot.available();
        List<String> semanticSkuIds = candidateSnapshot.semanticSkuIds();
        AiQueryEntity aiQuery = new AiQueryEntity(
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
        );
        AtomicLong lastCancellationCheck = new AtomicLong(0);
        LongConsumer guardedProgress =
            progress == null
                ? null
                : bytes -> {
                      long now = System.nanoTime();
                      long previous = lastCancellationCheck.get();
                      if (previous == 0 || now - previous >= 200_000_000L) {
                          if (lastCancellationCheck.compareAndSet(previous, now)) ensureTurnActive(actor, conversation);
                      }
                      progress.accept(bytes);
                  };
        if (stageListener != null) stageListener.accept("generating");
        AiAnswerVO answer = progress == null ? engine.query(aiQuery) : engine.queryStream(aiQuery, guardedProgress, deltaListener);
        if (progress != null) ensureTurnActive(actor, conversation);
        if (stageListener != null) stageListener.accept("verifying");
        // 远程响应返回前重新校验整个知识授权快照，撤权/撤稿期间不输出已生成内容。
        var current = knowledge.readableScope(actor);
        require(fingerprint.equals(scope(current)), ResponseCode.KNOWLEDGE_NOT_READY);
        List<AiCitationVO> citations = evidenceAssembler.verifyOutput(actor, answer.citations(), current);
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
            .map(i ->
                new AiRecommendationVO(
                    i.skuId(),
                    i.quantity(),
                    i.reason() != null && !i.reason().isBlank() ? i.reason() : "规格：" + i.specKey() + "；以当前商品卡片为准"
                )
            )
            .toList();
        var specs = SkuConstraintPolicy.resolve(
            question,
            history
                .stream()
                .filter(m -> "user".equals(m.role()))
                .map(MessageVO::content)
                .toList(),
            quotes.stream().map(ProposalItemVO::specKey).toList(),
            quotes.stream().map(ProposalItemVO::title).toList()
        );
        Map<String, String> visibilityByDoc = current
            .stream()
            .collect(Collectors.toMap(KnowledgeScopeVO::id, KnowledgeScopeVO::visibility, (first, second) -> first));
        boolean hasNonPublicCitation = citations.stream().anyMatch(c -> !"PUBLIC".equals(visibilityByDoc.get(c.documentId())));
        boolean replacementRequest = REPLACEMENT_PATTERN.matcher(question).find();
        boolean rejectedRecommendation = !knowledgeOnly && items.isEmpty() && (replacementRequest || !answer.recommendations().isEmpty() || specs.active());
        String safeText;
        if ("LLM".equals(answer.mode()) && !hasNonPublicCitation && !rejectedRecommendation && ShoppingAnswerPolicy.isSafeNaturalAnswer(answer.answer())) {
            String natural = answer.answer().trim();
            if (!items.isEmpty() && !natural.contains("不会自动下单") && !natural.contains("加入购物车")) {
                natural = natural + "\n\n确认提案后只加入购物车，不会自动下单或付款。";
            }
            safeText = natural;
        } else {
            safeText = ShoppingAnswerPolicy.evidenceAnswer(citations);
            if (!knowledgeOnly && (replacementRequest || !items.isEmpty() || !answer.recommendations().isEmpty() || specs.active())) {
                String recommendationText = items.isEmpty()
                    ? replacementRequest
                        ? "当前没有找到符合要求的替代商品，请放宽规格或预算后重试。"
                        : "当前没有可核实且满足要求的商品，请明确规格、数量或预算。"
                    : "可查看以下商品：" +
                      items
                          .stream()
                          .map(i -> i.title() + "（" + i.specKey() + "）×" + i.quantity())
                          .collect(Collectors.joining("；")) +
                      "。确认后只加入购物车，不会自动下单或付款。";
                boolean appendKnowledge = !items.isEmpty() && !citations.isEmpty() && !specs.active() && ShoppingAnswerPolicy.hasServiceInquiry(question);
                safeText = appendKnowledge ? ShoppingAnswerPolicy.evidenceBrief(citations) + "\n" + recommendationText : recommendationText;
            }
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
        if (progress != null) ensureTurnActive(actor, conversation);
        ProposalVO proposal;
        try {
            proposal = turns.complete(
                turn,
                question,
                safe.answer(),
                items,
                citations,
                clock.instant().plusSeconds(Math.max(1, Math.min(proposalMinutes, 30)) * 60),
                fingerprint
            );
        } catch (AppException failure) {
            // Cancellation can win between the final status check and finishTurn's conditional UPDATE.
            var status = conversations.turnStatus(actor, conversation);
            if (status != null && "CANCEL_REQUESTED".equals(status.status())) throw new AiTurnCancelledException();
            throw failure;
        }
        return new ChatResult(conversation, safe, proposal);
    }

    private ChatResult answerPersonalOrderInquiry(
        String actor,
        ConversationTurnVO turn,
        String question,
        Consumer<String> stageListener,
        Consumer<String> deltaListener
    ) {
        long started = System.nanoTime();
        if (stageListener != null) stageListener.accept("verifying");
        var documents = knowledge.readableScope(actor);
        String fingerprint = scope(documents);
        var page = orderQuery.mine(actor, null, 1, 3);
        List<OrderReadModel> recent = page == null ? List.of() : page.items();
        String summary;
        if (recent.isEmpty()) {
            summary = "您当前暂无订单记录。如需选购校园好物，可以直接告诉我预算或想要的品类，我会为您推荐并核实实时库存。";
        } else {
            StringBuilder sb = new StringBuilder("为您查到最近 ").append(recent.size()).append(" 笔订单实时进度：\n");
            for (int idx = 0; idx < recent.size(); idx++) {
                OrderReadModel o = recent.get(idx);
                String titles = o
                    .items()
                    .stream()
                    .map(i -> i.title() + "×" + i.quantity())
                    .collect(Collectors.joining("、"));
                String statusLabel = orderStatusLabel(o.status(), o.pickup() == null ? null : o.pickup().status());
                sb.append(idx + 1)
                    .append(". ")
                    .append(titles)
                    .append(" — ")
                    .append(statusLabel);
                if (o.pickup() != null && o.pickup().pickupCode() != null && !o.pickup().pickupCode().isBlank()) {
                    sb.append("，取餐号：").append(o.pickup().pickupCode());
                }
                if (o.pickupStoreName() != null && !o.pickupStoreName().isBlank()) {
                    sb.append("（自提点：").append(o.pickupStoreName());
                    if (o.pickupLocation() != null && !o.pickupLocation().isBlank()) {
                        sb.append(" · ").append(o.pickupLocation());
                    }
                    sb.append("）");
                }
                sb.append("\n");
            }
            sb.append("以上为服务端实时只读状态；如需出示自提核销码或申请退款，请前往「我的订单」页面操作。");
            summary = sb.toString();
        }
        if (deltaListener != null) deltaListener.accept(summary);
        long latencyMs = Duration.ofNanos(System.nanoTime() - started).toMillis();
        AiAnswerVO safe = new AiAnswerVO(summary, "LOCAL_RETRIEVAL_DEMO", "LOCAL_CHAR_NGRAM_DEMO", question, "", List.of(), List.of(), latencyMs);
        ProposalVO proposal = turns.complete(
            turn,
            question,
            summary,
            List.of(),
            List.of(),
            clock.instant().plusSeconds(Math.max(1, Math.min(proposalMinutes, 30)) * 60),
            fingerprint
        );
        return new ChatResult(turn.conversationId(), safe, proposal);
    }

    private String orderStatusLabel(String orderStatus, String pickupStatus) {
        if ("PENDING_PAYMENT".equals(orderStatus)) return "待付款";
        if ("CANCELED".equals(orderStatus)) return "已取消";
        if ("REFUNDED".equals(orderStatus)) return "已退款";
        if ("COMPLETED".equals(orderStatus)) return "已完成自提";
        if ("PAID".equals(orderStatus)) {
            if ("READY".equals(pickupStatus)) return "已备好，可凭取餐号/核销码到店自提";
            if ("PREPARING".equals(pickupStatus)) return "商家正在备货中";
            return "已付款，等待商家接单备货";
        }
        return orderStatus;
    }

    private void ensureTurnActive(String actor, String conversation) {
        var status = conversations.turnStatus(actor, conversation);
        if (status != null && "CANCEL_REQUESTED".equals(status.status())) throw new AiTurnCancelledException();
    }

    private String scope(List<KnowledgeScopeVO> docs) {
        return Fingerprints.of(docs.stream().map(KnowledgeScopeVO::id).sorted().toArray());
    }

    public List<MessageVO> history(String actor, String conversation) {
        accounts.requireActive(actor);
        List<KnowledgeScopeVO> readable = knowledge.readableScope(actor);
        return evidenceAssembler.sanitizeHistory(actor, conversations.messages(actor, conversation, 100), scope(readable), readable);
    }

    public List<ConversationVO> conversations(String actor, int page, int size) {
        accounts.requireActive(actor);
        return conversations.conversations(actor, page, size);
    }

    public List<ProposalVO> proposals(String actor, String conversation) {
        accounts.requireActive(actor);
        return proposals.proposals(actor, conversation);
    }

    public List<ProposalView> proposalViews(String actor, String conversation) {
        accounts.requireActive(actor);
        return ProposalViewAssembler.assemble(proposals.proposals(actor, conversation), catalog);
    }

    public ProposalVO confirm(String actor, String id, List<String> selected) {
        return confirmation.confirm(actor, id, selected);
    }

    public void reject(String actor, String proposal) {
        accounts.requireActive(actor);
        proposals.reject(actor, proposal);
    }
}
