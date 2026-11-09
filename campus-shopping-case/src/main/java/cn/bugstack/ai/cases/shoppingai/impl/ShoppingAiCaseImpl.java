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
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import cn.bugstack.ai.domain.shoppingai.service.ShoppingAnswerPolicy;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.LongConsumer;
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
    private final CandidateResolver candidateResolver;
    private final EvidenceAssembler evidenceAssembler;

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
        String preview = answerPreview ? answer.answer() : null;
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

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NEVER)
    public ChatResult chat(String actor, String conversationId, String question) {
        accounts.requireActive(actor);
        String q = text(question, "问题", 2000);
        var turn = state.beginTurn(actor, conversationId, q);
        try {
            return answer(actor, turn, q, null);
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

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NEVER)
    public ChatResult chatStream(String actor, String conversationId, String question, Consumer<String> conversationReady, LongConsumer progress) {
        accounts.requireActive(actor);
        String q = text(question, "问题", 2000);
        var turn = state.beginTurn(actor, conversationId, q);
        if (conversationReady != null) conversationReady.accept(turn.conversationId());
        try {
            return answer(actor, turn, q, progress);
        } catch (RuntimeException failure) {
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

    public ConversationTurnStatusVO turnStatus(String actor, String conversation) {
        accounts.requireActive(actor);
        return state.turnStatus(actor, conversation);
    }

    public ConversationTurnStatusVO requestTurnCancel(String actor, String conversation) {
        accounts.requireActive(actor);
        return state.requestTurnCancel(actor, conversation);
    }

    private ChatResult answer(String actor, ConversationTurnVO turn, String question, LongConsumer progress) {
        String conversation = turn.conversationId();
        var documents = knowledge.readableScope(actor);
        String fingerprint = scope(documents);
        List<MessageVO> history = evidenceAssembler.sanitizeHistory(actor, state.messages(actor, conversation, 12), fingerprint, documents);
        AiRecallVO recall = engine.recall(question, history);
        var prior = java.util.Optional.ofNullable(proposals.proposals(actor, conversation)).orElse(List.of()).stream().findFirst().orElse(null);
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
        AiAnswerVO answer = progress == null ? engine.query(aiQuery) : engine.queryStream(aiQuery, guardedProgress);
        if (progress != null) ensureTurnActive(actor, conversation);
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
        boolean replacementRequest = question.matches(".*(?:换一个|换一款|还有别的|类似的|便宜点|便宜一些|更便宜).*");
        if (!knowledgeOnly && (replacementRequest || !items.isEmpty() || !answer.recommendations().isEmpty() || specs.active())) {
            safeText = items.isEmpty()
                ? replacementRequest
                    ? "当前没有找到符合要求的替代商品，请放宽规格或预算后重试。"
                    : "当前没有可核实且满足要求的商品，请明确规格、数量或预算。"
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
        } catch (cn.bugstack.ai.types.exception.AppException failure) {
            // Cancellation can win between the final status check and finishTurn's conditional UPDATE.
            var status = state.turnStatus(actor, conversation);
            if (status != null && "CANCEL_REQUESTED".equals(status.status())) throw new AiTurnCancelledException();
            throw failure;
        }
        return new ChatResult(conversation, safe, proposal);
    }

    private void ensureTurnActive(String actor, String conversation) {
        var status = state.turnStatus(actor, conversation);
        if (status != null && "CANCEL_REQUESTED".equals(status.status())) throw new AiTurnCancelledException();
    }

    private String scope(List<KnowledgeScopeVO> docs) {
        return Fingerprints.of(docs.stream().map(KnowledgeScopeVO::id).sorted().toArray());
    }

    public List<MessageVO> history(String actor, String conversation) {
        accounts.requireActive(actor);
        List<KnowledgeScopeVO> readable = knowledge.readableScope(actor);
        return evidenceAssembler.sanitizeHistory(actor, state.messages(actor, conversation, 100), scope(readable), readable);
    }

    public List<ConversationVO> conversations(String actor, int page, int size) {
        accounts.requireActive(actor);
        return state.conversations(actor, page, size);
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
