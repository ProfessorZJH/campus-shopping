package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.actor;
import static cn.bugstack.ai.trigger.http.RequestInputs.required;

import cn.bugstack.ai.api.dto.ChatRequestDTO;
import cn.bugstack.ai.api.dto.ChatResponseDTO;
import cn.bugstack.ai.api.dto.CitationResponseDTO;
import cn.bugstack.ai.api.dto.ProposalItemResponseDTO;
import cn.bugstack.ai.api.dto.ProposalResponseDTO;
import cn.bugstack.ai.cases.shoppingai.IShoppingAiCase;
import cn.bugstack.ai.cases.shoppingai.model.ChatResult;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalVO;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** 独立 SSE 入口；完整响应供应商只发送开始和完整响应终态，不切片伪造增量。 */
@RestController
@RequestMapping("/api/v1/ai")
public class AiStreamEndpoint {

    private static final ThreadPoolExecutor EXECUTOR = new ThreadPoolExecutor(
        2,
        8,
        30,
        TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(32),
        runnable -> {
            Thread thread = new Thread(runnable, "ai-stream");
            thread.setDaemon(true);
            return thread;
        },
        new ThreadPoolExecutor.AbortPolicy()
    );

    @Resource
    private IShoppingAiCase shopping;

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestBody ChatRequestDTO request, Principal principal) {
        required(request);
        String actor = actor(principal);
        SseEmitter emitter = new SseEmitter(120_000L);
        send(emitter, "started", envelope(request.getConversationId(), "FULL_RESPONSE", null, null));
        try {
            EXECUTOR.execute(() -> run(emitter, actor, request));
        } catch (RuntimeException rejected) {
            send(emitter, "failed", envelope(request.getConversationId(), "FULL_RESPONSE", null, "AI_STREAM_BUSY"));
            emitter.complete();
        }
        return emitter;
    }

    private void run(SseEmitter emitter, String actor, ChatRequestDTO request) {
        try {
            ChatResult result = shopping.chat(actor, request.getConversationId(), request.getQuestion());
            send(emitter, "completed", envelope(result.conversationId(), "FULL_RESPONSE", response(result), null));
        } catch (AppException failure) {
            send(emitter, "failed", envelope(request.getConversationId(), "FULL_RESPONSE", null, failure.getCode()));
        } catch (RuntimeException failure) {
            send(emitter, "failed", envelope(request.getConversationId(), "FULL_RESPONSE", null, "UN_ERROR"));
        } finally {
            emitter.complete();
        }
    }

    private void send(SseEmitter emitter, String event, Object data) {
        try {
            emitter.send(SseEmitter.event().name(event).data(data));
        } catch (Exception ignored) {
            emitter.complete();
        }
    }

    private LinkedHashMap<String, Object> envelope(String conversationId, String mode, Object data, String errorCode) {
        LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
        payload.put("conversationId", conversationId);
        payload.put("mode", mode);
        payload.put("data", data);
        payload.put("errorCode", errorCode);
        return payload;
    }

    private ChatResponseDTO response(ChatResult result) {
        var answer = result.answer();
        return ChatResponseDTO.builder()
            .conversationId(result.conversationId())
            .answer(answer.answer())
            .mode(answer.mode())
            .retrievalMode(answer.retrievalMode())
            .warning(answer.warning())
            .citations(answer.citations().stream().map(c -> CitationResponseDTO.builder().documentId(c.documentId()).title(c.title()).snippet(c.snippet()).build()).toList())
            .proposal(proposal(result.proposal()))
            .latencyMs(answer.latencyMs())
            .build();
    }

    private ProposalResponseDTO proposal(ProposalVO proposal) {
        if (proposal == null) return null;
        return ProposalResponseDTO.builder()
            .id(proposal.id())
            .status(proposal.status())
            .expiresAt(proposal.expiresAt())
            .items(proposal.items().stream().map(item ->
                ProposalItemResponseDTO.builder()
                    .skuId(item.skuId())
                    .productId(item.productId())
                    .merchantId(item.merchantId())
                    .title(item.title())
                    .specKey(item.specKey())
                    .imageUrl(item.imageUrl())
                    .priceCent(item.priceCent())
                    .quoteVersion(item.quoteVersion())
                    .quantity(item.quantity())
                    .detailAvailable(true)
                    .build()
            ).toList())
            .build();
    }
}
