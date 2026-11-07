package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;
import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.api.IShoppingAiApi;
import cn.bugstack.ai.api.dto.ChatRequestDTO;
import cn.bugstack.ai.api.dto.ChatResponseDTO;
import cn.bugstack.ai.api.dto.CitationResponseDTO;
import cn.bugstack.ai.api.dto.ConfirmProposalRequestDTO;
import cn.bugstack.ai.api.dto.ConversationResponseDTO;
import cn.bugstack.ai.api.dto.ConversationTurnStatusResponseDTO;
import cn.bugstack.ai.api.dto.KnowledgeDebugHitResponseDTO;
import cn.bugstack.ai.api.dto.KnowledgeDebugRequestDTO;
import cn.bugstack.ai.api.dto.KnowledgeDebugResponseDTO;
import cn.bugstack.ai.api.dto.MessageResponseDTO;
import cn.bugstack.ai.api.dto.ProposalItemResponseDTO;
import cn.bugstack.ai.api.dto.ProposalResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.shoppingai.IShoppingAiCase;
import cn.bugstack.ai.cases.shoppingai.model.ProposalView;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class ShoppingAiController implements IShoppingAiApi {

    @Resource
    private IShoppingAiCase shopping;

    /** 授权检索和导购建议；此接口不执行购物车写入。 */
    @Override
    @PostMapping("/ai/chat")
    public Response<ChatResponseDTO> chat(@RequestBody ChatRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);
            var result = shopping.chat(actor(principal), request.getConversationId(), request.getQuestion());
            var answer = result.answer();
            return ChatResponseDTO.builder()
                .conversationId(result.conversationId())
                .answer(answer.answer())
                .mode(answer.mode())
                .retrievalMode(answer.retrievalMode())
                .warning(answer.warning())
                .citations(
                    answer
                        .citations()
                        .stream()
                        .map(c -> CitationResponseDTO.builder().documentId(c.documentId()).title(c.title()).snippet(c.snippet()).build())
                        .toList()
                )
                .proposal(proposal(result.proposal()))
                .latencyMs(answer.latencyMs())
                .build();
        });
    }

    /** 只读 RAG 命中调试；不创建会话、不产生提案。 */
    @Override
    @PostMapping("/ai/debug/retrieval")
    public Response<KnowledgeDebugResponseDTO> debugRetrieval(@RequestBody KnowledgeDebugRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);
            var result = shopping.debugRetrieval(actor(principal), request.getQuestion(), Boolean.TRUE.equals(request.getAnswerPreview()));
            return KnowledgeDebugResponseDTO.builder()
                .query(result.query())
                .retrievalMode(result.retrievalMode())
                .answerMode(result.answerMode())
                .answerPreview(result.answerPreview())
                .warning(result.warning())
                .latencyMs(result.latencyMs())
                .hits(
                    java.util.stream.IntStream.range(0, result.hits().size())
                        .mapToObj(i -> {
                            var c = result.hits().get(i);
                            return KnowledgeDebugHitResponseDTO.builder()
                                .documentId(c.documentId())
                                .title(c.title())
                                .rootId(c.rootId())
                                .version(c.documentVersion())
                                .snippet(c.snippet())
                                .rank(i + 1)
                                .score(c.score())
                                .scoreType(scoreType(result.retrievalMode()))
                                .build();
                        })
                        .toList()
                )
                .build();
        });
    }

    private String scoreType(String retrievalMode) {
        return switch (retrievalMode) {
            case "REMOTE_EMBEDDING", "BM25_DEGRADED", "LOCAL_CHAR_NGRAM_DEMO" -> "RRF";
            default -> "UNKNOWN";
        };
    }

    /** 本人会话列表。 */
    @Override
    @GetMapping("/ai/conversations")
    public Response<List<ConversationResponseDTO>> conversations(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "100") int size,
        Principal principal
    ) {
        return execute(() -> {
            return shopping
                .conversations(actor(principal), page, size)
                .stream()
                .map(c ->
                    ConversationResponseDTO.builder()
                        .id(c.id())
                        .title(c.title())
                        .createdAt(c.createdAt())
                        .lastActiveAt(c.lastActiveAt())
                        .summary(c.summary())
                        .build()
                )
                .toList();
        });
    }

    /** 加载已重新核验知识权限的历史回答。 */
    @Override
    @GetMapping("/ai/conversations/{conversationId}/messages")
    public Response<List<MessageResponseDTO>> history(@PathVariable("conversationId") String conversationId, Principal principal) {
        return execute(() -> {
            return shopping
                .history(actor(principal), conversationId)
                .stream()
                .map(m ->
                    MessageResponseDTO.builder()
                        .id(m.id())
                        .role(m.role())
                        .content(m.content())
                        .createdAt(m.createdAt())
                        .citations(
                            m
                                .citations()
                                .stream()
                                .map(c -> CitationResponseDTO.builder().documentId(c.documentId()).title(c.title()).snippet(c.snippet()).build())
                                .toList()
                        )
                        .citationStatus(citationStatus(m))
                        .build()
                )
                .toList();
        });
    }

    /** 查询本人当前会话轮次状态；租约令牌只留在服务端。 */
    @Override
    @GetMapping("/ai/conversations/{conversationId}/turn/status")
    public Response<ConversationTurnStatusResponseDTO> turnStatus(@PathVariable("conversationId") String conversationId, Principal principal) {
        return execute(() -> turnStatus(shopping.turnStatus(actor(principal), conversationId)));
    }

    /** 请求取消当前轮次；下游尚未结束时仍返回 CANCEL_REQUESTED。 */
    @Override
    @PostMapping("/ai/conversations/{conversationId}/turn/cancel")
    public Response<ConversationTurnStatusResponseDTO> cancelTurn(@PathVariable("conversationId") String conversationId, Principal principal) {
        return execute(() -> turnStatus(shopping.requestTurnCancel(actor(principal), conversationId)));
    }

    private ConversationTurnStatusResponseDTO turnStatus(cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnStatusVO status) {
        return ConversationTurnStatusResponseDTO.builder()
            .conversationId(status.conversationId())
            .status(status.status())
            .cancelRequestedAt(status.cancelRequestedAt())
            .build();
    }

    private String citationStatus(cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO message) {
        if (!"assistant".equals(message.role())) return "NONE";
        if (!message.citationsRecorded()) return "MISSING";
        if (!message.citationsVisible()) return "HIDDEN";
        return message.citations().isEmpty() ? "NONE" : "AVAILABLE";
    }

    /** 本人会话产生的提案。 */
    @Override
    @GetMapping("/ai/conversations/{conversationId}/proposals")
    public Response<List<ProposalResponseDTO>> proposals(@PathVariable("conversationId") String conversationId, Principal principal) {
        return execute(() -> {
            return shopping.proposalViews(actor(principal), conversationId).stream().map(this::proposal).toList();
        });
    }

    /** 明确确认后，复核价格版本并单次加购。 */
    @Override
    @PostMapping("/ai/proposals/{proposalId}/confirm")
    public Response<ProposalResponseDTO> confirm(
        @PathVariable("proposalId") String proposalId,
        @RequestBody ConfirmProposalRequestDTO request,
        Principal principal
    ) {
        return execute(() -> {
            return proposal(shopping.confirm(actor(principal), proposalId, required(request).getSelectedSkuIds()));
        });
    }

    /** 拒绝提案，不修改购物车。 */
    @Override
    @PostMapping("/ai/proposals/{proposalId}/reject")
    public Response<Void> reject(@PathVariable("proposalId") String proposalId, Principal principal) {
        return execute(() -> {
            shopping.reject(actor(principal), proposalId);
            return null;
        });
    }

    private ProposalResponseDTO proposal(ProposalVO p) {
        return p == null
            ? null
            : ProposalResponseDTO.builder()
                  .id(p.id())
                  .status(p.status())
                  .expiresAt(p.expiresAt())
                  .items(
                      p
                          .items()
                          .stream()
                          .map(i -> item(i, i.productId(), i.hasProductId(), i.hasProductId() ? null : "PRODUCT_UNAVAILABLE"))
                          .toList()
                  )
                  .build();
    }

    private ProposalResponseDTO proposal(ProposalView p) {
        return ProposalResponseDTO.builder()
            .id(p.id())
            .status(p.status())
            .expiresAt(p.expiresAt())
            .items(
                p
                    .items()
                    .stream()
                    .map(i -> item(i.snapshot(), i.productId(), i.detailAvailable(), i.detailUnavailableReason()))
                    .toList()
            )
            .build();
    }

    private ProposalItemResponseDTO item(cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO i, String productId, boolean available, String reason) {
        return ProposalItemResponseDTO.builder()
            .skuId(i.skuId())
            .productId(productId)
            .merchantId(i.merchantId())
            .title(i.title())
            .specKey(i.specKey())
            .imageUrl(i.imageUrl())
            .priceCent(i.priceCent())
            .quoteVersion(i.quoteVersion())
            .quantity(i.quantity())
            .detailAvailable(available)
            .detailUnavailableReason(reason)
            .build();
    }

    private <T> Response<T> execute(Supplier<T> action) {
        try {
            return ApiResponses.success(action.get());
        } catch (AppException e) {
            ControllerFailures.record(log, e);
            return ApiResponses.rejected(e);
        } catch (Exception e) {
            ControllerFailures.unexpected(log, e);
            return ApiResponses.unexpected();
        }
    }
}
