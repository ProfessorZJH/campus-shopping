package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;
import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.api.IShoppingAiApi;
import cn.bugstack.ai.api.dto.ChatRequestDTO;
import cn.bugstack.ai.api.dto.ChatResponseDTO;
import cn.bugstack.ai.api.dto.CitationResponseDTO;
import cn.bugstack.ai.api.dto.ConfirmProposalRequestDTO;
import cn.bugstack.ai.api.dto.ConversationResponseDTO;
import cn.bugstack.ai.api.dto.MessageResponseDTO;
import cn.bugstack.ai.api.dto.ProposalItemResponseDTO;
import cn.bugstack.ai.api.dto.ProposalResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.cases.shoppingai.IShoppingAiCase;
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

    /** 本人会话列表。 */
    @Override
    @GetMapping("/ai/conversations")
    public Response<List<ConversationResponseDTO>> conversations(Principal principal) {
        return execute(() -> {
            return shopping
                .conversations(actor(principal))
                .stream()
                .map(c -> ConversationResponseDTO.builder().id(c.id()).title(c.title()).createdAt(c.createdAt()).build())
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
                .map(m -> MessageResponseDTO.builder().id(m.id()).role(m.role()).content(m.content()).createdAt(m.createdAt()).build())
                .toList();
        });
    }

    /** 本人会话产生的提案。 */
    @Override
    @GetMapping("/ai/conversations/{conversationId}/proposals")
    public Response<List<ProposalResponseDTO>> proposals(@PathVariable("conversationId") String conversationId, Principal principal) {
        return execute(() -> {
            return shopping.proposals(actor(principal), conversationId).stream().map(this::proposal).toList();
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
                          .map(i ->
                              ProposalItemResponseDTO.builder()
                                  .skuId(i.skuId())
                                  .merchantId(i.merchantId())
                                  .title(i.title())
                                  .specKey(i.specKey())
                                  .imageUrl(i.imageUrl())
                                  .priceCent(i.priceCent())
                                  .quoteVersion(i.quoteVersion())
                                  .quantity(i.quantity())
                                  .build()
                          )
                          .toList()
                  )
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
