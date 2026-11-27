package cn.bugstack.ai.infrastructure.gateway;

import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;
import java.util.function.LongConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** 固定服务端地址的 HTTP 客户端；超时覆盖完整响应体，不允许请求指定任意 URL。 */
@Service
public class AiGatewayService {

    private static final Logger log = LoggerFactory.getLogger(AiGatewayService.class);

    @Value("${campus.ai.url:http://127.0.0.1:8100}")
    private String url;

    @Value("${campus.ai.service-key:}")
    private String key;

    @Value("${campus.ai.timeout-seconds:90}")
    private int timeoutSeconds = 90;

    @Resource
    private ObjectMapper mapper;

    @Resource
    private cn.bugstack.ai.domain.shoppingai.adapter.repository.IAiResourceRepository resources;

    private final HttpClient client = HttpClient.newBuilder()
        // 内部 FastAPI/Uvicorn 为 HTTP/1.1，禁止默认 h2c 升级破坏带正文请求。
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(5))
        .followRedirects(HttpClient.Redirect.NEVER)
        .build();

    public AiGatewayDTO.RecallResponse recall(AiGatewayDTO.RecallRequest request) {
        return post("/v1/recall", request, AiGatewayDTO.RecallResponse.class);
    }

    public AiGatewayDTO.Answer query(AiGatewayDTO.Query request) {
        return post("/v1/query", request, AiGatewayDTO.Answer.class);
    }

    /** 允许 Java 先升级时与仍在运行的旧 Python 实例短暂共存；仅 422 协议拒绝触发降级载荷。 */
    public AiGatewayDTO.Answer queryLegacy(AiGatewayDTO.Query request) {
        return post("/v1/query", legacyQueryPayload(request, true), AiGatewayDTO.Answer.class);
    }

    public AiGatewayDTO.Answer queryLegacyWithoutExternalScope(AiGatewayDTO.Query request) {
        return post("/v1/query", legacyQueryPayload(request, false), AiGatewayDTO.Answer.class);
    }

    private java.util.Map<String, Object> legacyQueryPayload(AiGatewayDTO.Query request, boolean includeExternalScope) {
        var offers = request
            .offers()
            .stream()
            .map(o ->
                java.util.Map.of(
                    "skuId",
                    o.skuId(),
                    "merchantId",
                    o.merchantId(),
                    "title",
                    o.title(),
                    "specKey",
                    o.specKey(),
                    "description",
                    o.description(),
                    "priceCent",
                    o.priceCent(),
                    "available",
                    o.available()
                )
            )
            .toList();
        var payload = new java.util.LinkedHashMap<String, Object>();
        payload.putAll(
            java.util.Map.of(
                "question",
                request.question(),
                "allowedDocumentIds",
                request.allowedDocumentIds(),
                "offers",
                offers,
                "history",
                request.history(),
                "retrievalQuery",
                request.retrievalQuery(),
                "semanticSkuIds",
                request.semanticSkuIds()
            )
        );
        if (includeExternalScope) payload.put("externalDocumentIds", request.externalDocumentIds());
        return payload;
    }

    /**
     * 读取 Python 流式桥接的 SSE 协议；只把最终完整答案交给上层，进度回调不包含模型正文。
     * 连接和共享 AI 准入在整个响应体读取完成前保持有效，避免客户端断开后提前释放执行槽。
     */
    public AiGatewayDTO.Answer queryStream(AiGatewayDTO.Query request, LongConsumer progress) {
        return queryStream(request, progress, null);
    }

    /**
     * 读取 Python 流式桥接的 SSE 协议；支持透传安全增量文本 delta，并始终在完整答案通过 Java 复核后再落库。
     */
    public AiGatewayDTO.Answer queryStream(AiGatewayDTO.Query request, LongConsumer progress, Consumer<String> deltaListener) {
        if (key == null || key.length() < 24) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        AiGatewayDTO.Query payload = request.streamText()
            ? request
            : new AiGatewayDTO.Query(
                  request.question(),
                  request.allowedDocumentIds(),
                  request.offers(),
                  request.history(),
                  request.retrievalQuery(),
                  request.semanticSkuIds(),
                  request.externalDocumentIds(),
                  request.answerPreview(),
                  true
              );
        String requestId = MDC.get("requestId");
        if (requestId == null) requestId = UUID.randomUUID().toString();
        int timeout = Math.max(5, Math.min(timeoutSeconds, 120));
        try (var permit = resources.acquire()) {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeout);
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(url.replaceAll("/$", "") + "/v1/query/stream"))
                .timeout(Duration.ofSeconds(timeout))
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .header("X-Service-Key", key)
                .header("X-Request-ID", requestId)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                .build();
            CompletableFuture<HttpResponse<StreamChunkQueue>> future = client.sendAsync(httpRequest, ignored -> new StreamChunkQueue());
            HttpResponse<StreamChunkQueue> response;
            try {
                long remainingNanos = Math.max(1L, deadline - System.nanoTime());
                response = future.get(remainingNanos, TimeUnit.NANOSECONDS);
            } catch (TimeoutException e) {
                future.cancel(true);
                throw unavailable(e);
            } catch (ExecutionException e) {
                throw unavailable(e.getCause() instanceof Exception cause ? cause : e);
            }
            try (StreamChunkQueue stream = response.body()) {
                if (response.statusCode() == 422) throw new RemoteStatusException(422);
                if (response.statusCode() / 100 != 2) throw new AppException(ResponseCode.AI_UNAVAILABLE);
                AiGatewayDTO.Answer answer = readSseAnswer(stream, deadline, progress, deltaListener);
                if (answer != null) return answer;
            }
            throw new AppException(ResponseCode.AI_UNAVAILABLE);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unavailable(e);
        } catch (IOException | IllegalArgumentException e) {
            throw unavailable(e);
        }
    }

    private static final byte[] EMPTY_BYTES = new byte[0];

    private AiGatewayDTO.Answer readSseAnswer(StreamChunkQueue stream, long deadline, LongConsumer progress, Consumer<String> deltaListener)
        throws IOException, InterruptedException {
        CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPLACE)
            .onUnmappableCharacter(CodingErrorAction.REPLACE);
        StringBuilder currentLine = new StringBuilder(256);
        String[] state = new String[2];
        byte[] carry = EMPTY_BYTES;
        CharBuffer chars = CharBuffer.allocate(1024);
        while (true) {
            byte[] chunk = stream.poll(deadline);
            boolean eof = chunk == null;
            ByteBuffer input;
            if (eof) {
                input = ByteBuffer.wrap(carry);
                carry = EMPTY_BYTES;
            } else if (carry.length == 0) {
                input = ByteBuffer.wrap(chunk);
            } else {
                byte[] combined = new byte[carry.length + chunk.length];
                System.arraycopy(carry, 0, combined, 0, carry.length);
                System.arraycopy(chunk, 0, combined, carry.length, chunk.length);
                input = ByteBuffer.wrap(combined);
                carry = EMPTY_BYTES;
            }
            while (true) {
                var result = decoder.decode(input, chars, eof);
                chars.flip();
                AiGatewayDTO.Answer answer = drainDecodedChars(chars, currentLine, state, progress, deltaListener);
                if (answer != null) return answer;
                chars.clear();
                if (result.isUnderflow()) break;
            }
            if (!eof && input.hasRemaining()) {
                carry = new byte[input.remaining()];
                input.get(carry);
            }
            if (eof) {
                while (true) {
                    var flushResult = decoder.flush(chars);
                    chars.flip();
                    AiGatewayDTO.Answer answer = drainDecodedChars(chars, currentLine, state, progress, deltaListener);
                    if (answer != null) return answer;
                    chars.clear();
                    if (flushResult.isUnderflow()) break;
                }
                if (!currentLine.isEmpty()) {
                    String trailing = trimCarriageReturn(currentLine);
                    currentLine.setLength(0);
                    AiGatewayDTO.Answer last = processSseLine(trailing, state, progress, deltaListener);
                    if (last != null) return last;
                }
                return consumeStreamEvent(state[0], state[1], progress, deltaListener);
            }
        }
    }

    private AiGatewayDTO.Answer drainDecodedChars(
        CharBuffer chars,
        StringBuilder currentLine,
        String[] state,
        LongConsumer progress,
        Consumer<String> deltaListener
    ) throws IOException {
        while (chars.hasRemaining()) {
            char ch = chars.get();
            if (ch == '\n') {
                String line = trimCarriageReturn(currentLine);
                currentLine.setLength(0);
                AiGatewayDTO.Answer answer = processSseLine(line, state, progress, deltaListener);
                if (answer != null) return answer;
            } else {
                if (currentLine.length() >= 65536) throw new AppException(ResponseCode.AI_UNAVAILABLE);
                currentLine.append(ch);
            }
        }
        return null;
    }

    private String trimCarriageReturn(StringBuilder line) {
        int len = line.length();
        return len > 0 && line.charAt(len - 1) == '\r' ? line.substring(0, len - 1) : line.toString();
    }

    private AiGatewayDTO.Answer processSseLine(String line, String[] state, LongConsumer progress, Consumer<String> deltaListener) throws IOException {
        if (line.isEmpty()) {
            AiGatewayDTO.Answer answer = consumeStreamEvent(state[0], state[1], progress, deltaListener);
            state[0] = null;
            state[1] = null;
            return answer;
        }
        if (line.startsWith("event:")) {
            state[0] = line.substring("event:".length()).trim();
        } else if (line.startsWith("data:")) {
            String value = line.substring("data:".length()).trim();
            state[1] = state[1] == null ? value : state[1] + "\n" + value;
            if (state[1].length() > 1_000_000) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        }
        return null;
    }

    private AiGatewayDTO.Answer consumeStreamEvent(String event, String data, LongConsumer progress, Consumer<String> deltaListener) throws IOException {
        if (event == null || data == null || data.isBlank()) return null;
        var node = mapper.readTree(data);
        if (node == null || !node.isObject()) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        return switch (event) {
            case "started" -> null;
            case "delta" -> {
                String text = node.path("text").asText("");
                if (!text.isEmpty() && deltaListener != null) deltaListener.accept(text);
                yield null;
            }
            case "progress" -> {
                long bytes = node.path("bytes").asLong(-1);
                if (bytes < 0) throw new AppException(ResponseCode.AI_UNAVAILABLE);
                if (progress != null) progress.accept(bytes);
                yield null;
            }
            case "completed" -> {
                AiGatewayDTO.Answer answer = mapper.treeToValue(node, AiGatewayDTO.Answer.class);
                if (answer == null || answer.answer() == null || answer.answer().isBlank()) throw new AppException(ResponseCode.AI_UNAVAILABLE);
                yield answer;
            }
            case "failed" -> throw new AppException(ResponseCode.AI_UNAVAILABLE);
            default -> null;
        };
    }

    private static final class StreamChunkQueue implements HttpResponse.BodySubscriber<StreamChunkQueue>, AutoCloseable {

        private static final Object EOF = new Object();
        private static final int WINDOW = 64;

        private final CompletableFuture<StreamChunkQueue> ready = new CompletableFuture<>();
        private final LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>(WINDOW + 2);
        private volatile Flow.Subscription subscription;
        private volatile boolean closed;

        @Override
        public CompletionStage<StreamChunkQueue> getBody() {
            return ready;
        }

        @Override
        public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            ready.complete(this);
            if (closed) {
                subscription.cancel();
            } else {
                subscription.request(WINDOW);
            }
        }

        @Override
        public void onNext(List<ByteBuffer> item) {
            if (closed) return;
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            for (ByteBuffer part : item) {
                if (part.hasRemaining()) {
                    byte[] bytes = new byte[part.remaining()];
                    part.get(bytes);
                    buffer.writeBytes(bytes);
                }
            }
            byte[] payload = buffer.toByteArray();
            if (payload.length == 0) {
                Flow.Subscription sub = subscription;
                if (sub != null && !closed) sub.request(1);
                return;
            }
            if (!queue.offer(payload)) {
                close();
                queue.offer(new IOException("AI stream queue overflow"));
            }
        }

        @Override
        public void onError(Throwable throwable) {
            queue.offer(throwable == null ? new IOException("AI stream error") : throwable);
        }

        @Override
        public void onComplete() {
            queue.offer(EOF);
        }

        byte[] poll(long deadlineNanos) throws IOException, InterruptedException {
            long remaining = deadlineNanos - System.nanoTime();
            if (remaining <= 0) throw new IOException("AI stream timeout");
            Object item = queue.poll(remaining, TimeUnit.NANOSECONDS);
            if (item == null) throw new IOException("AI stream timeout");
            if (item == EOF) return null;
            if (item instanceof Throwable error) {
                if (error instanceof IOException io) throw io;
                throw new IOException("AI stream failed", error);
            }
            Flow.Subscription sub = subscription;
            if (sub != null && !closed) sub.request(1);
            return (byte[]) item;
        }

        @Override
        public void close() {
            closed = true;
            Flow.Subscription sub = subscription;
            if (sub != null) sub.cancel();
        }
    }

    public AiGatewayDTO.ProductSearchResult semanticProducts(AiGatewayDTO.ProductSearch request) {
        return post("/v1/products/search", request, AiGatewayDTO.ProductSearchResult.class);
    }

    public void indexProducts(AiGatewayDTO.ProductIndexRequest request) {
        AiGatewayDTO.ProductIndexResult result = post("/v1/products/index", request, AiGatewayDTO.ProductIndexResult.class);
        if (
            result == null ||
            !"MILVUS".equals(result.mode()) ||
            result.indexed() < 0 ||
            result.unchanged() < 0 ||
            (long) result.indexed() + result.unchanged() != request.products().size()
        ) {
            throw new AppException(ResponseCode.AI_UNAVAILABLE);
        }
    }

    public void deleteProducts(AiGatewayDTO.ProductDeleteRequest request) {
        var result = post("/v1/products/delete", request, AiGatewayDTO.ProductDeleteResult.class);
        if (
            result == null ||
            !("MILVUS".equals(result.mode()) || "EMPTY_INDEX".equals(result.mode())) ||
            result.deleted() == null ||
            result.deleted() < 0 ||
            result.deleted() > request.productIds().size() ||
            ("EMPTY_INDEX".equals(result.mode()) && result.deleted() != 0)
        ) throw new AppException(ResponseCode.AI_UNAVAILABLE);
    }

    public void index(AiGatewayDTO.Index request) {
        var result = post("/v1/index", request, AiGatewayDTO.KnowledgeIndexResult.class);
        if (
            result == null ||
            result.chunks() == null ||
            result.chunks() < 1 ||
            result.chunks() > 162 ||
            !java.util.Set.of("REMOTE_EMBEDDING", "LOCAL_CHAR_NGRAM_DEMO").contains(java.util.Objects.toString(result.mode(), ""))
        ) throw new AppException(ResponseCode.AI_UNAVAILABLE);
    }

    public void indexLegacy(AiGatewayDTO.Index request) {
        var payload = java.util.Map.of(
            "documentId",
            request.documentId(),
            "title",
            request.title(),
            "content",
            request.content(),
            "externalAllowed",
            request.externalAllowed()
        );
        var result = post("/v1/index", payload, AiGatewayDTO.KnowledgeIndexResult.class);
        if (
            result == null ||
            result.chunks() == null ||
            result.chunks() < 1 ||
            result.chunks() > 162 ||
            !java.util.Set.of("REMOTE_EMBEDDING", "LOCAL_CHAR_NGRAM_DEMO").contains(java.util.Objects.toString(result.mode(), ""))
        ) throw new AppException(ResponseCode.AI_UNAVAILABLE);
    }

    public String extract(AiGatewayDTO.Extract request) {
        String text = post("/v1/extract", request, AiGatewayDTO.Extracted.class).text();
        if (text == null || text.isBlank() || text.length() > 100000) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        return text;
    }

    private <T> T post(String path, Object payload, Class<T> type) {
        if (key == null || key.length() < 24) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        CompletableFuture<HttpResponse<byte[]>> pending = null;
        long started = System.nanoTime();
        String requestId = MDC.get("requestId");
        if (requestId == null) requestId = UUID.randomUUID().toString();
        int status = 0;
        boolean success = false;
        String failureType = "RemoteStatus";
        int timeout = Math.max(5, Math.min(timeoutSeconds, 120));
        try (var permit = resources.acquire()) {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url.replaceAll("/$", "") + path))
                .timeout(Duration.ofSeconds(timeout))
                .header("Content-Type", "application/json")
                .header("X-Service-Key", key)
                .header("X-Request-ID", requestId)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                .build();
            pending = client.sendAsync(request, ignored -> new BoundedHttpBodySubscriber(1_000_000));
            HttpResponse<byte[]> response = pending.get(timeout, TimeUnit.SECONDS);
            status = response.statusCode();
            if (response.statusCode() / 100 != 2) {
                // 提取服务明确拒绝的文件输入属于用户可纠正的上传错误；不回显远端正文。
                if (path.equals("/v1/extract") && java.util.Set.of(400, 413, 415, 422).contains(response.statusCode())) throw new AppException(
                    ResponseCode.UPLOAD_INVALID
                );
                if (response.statusCode() == 422 && (path.equals("/v1/query") || path.equals("/v1/index"))) throw new RemoteStatusException(422);
                throw new AppException(ResponseCode.AI_UNAVAILABLE);
            }
            T result = mapper.readValue(response.body(), type);
            if (result == null) throw new AppException(ResponseCode.AI_UNAVAILABLE);
            success = true;
            return result;
        } catch (InterruptedException e) {
            failureType = e.getClass().getSimpleName();
            Thread.currentThread().interrupt();
            throw unavailable(e);
        } catch (IOException | IllegalArgumentException | ExecutionException | TimeoutException e) {
            failureType = e.getClass().getSimpleName();
            throw unavailable(e);
        } finally {
            if (pending != null && !pending.isDone()) pending.cancel(true);
            if (!success) log.warn(
                "ai_dependency_failed operation={} request_id={} http_status={} exception_type={} duration_ms={}",
                path,
                requestId,
                status,
                failureType,
                (System.nanoTime() - started) / 1_000_000
            );
        }
    }

    private AppException unavailable(Exception cause) {
        return new AppException(ResponseCode.AI_UNAVAILABLE.getCode(), ResponseCode.AI_UNAVAILABLE.getInfo(), cause);
    }

    public static final class RemoteStatusException extends RuntimeException {

        private final int status;

        public RemoteStatusException(int status) {
            this.status = status;
        }

        public int status() {
            return status;
        }
    }
}
