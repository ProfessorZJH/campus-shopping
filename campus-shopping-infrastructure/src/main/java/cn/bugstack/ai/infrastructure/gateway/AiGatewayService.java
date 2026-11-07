package cn.bugstack.ai.infrastructure.gateway;

import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
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
        if (key == null || key.length() < 24) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        String requestId = MDC.get("requestId");
        if (requestId == null) requestId = UUID.randomUUID().toString();
        int timeout = Math.max(5, Math.min(timeoutSeconds, 120));
        try (var permit = resources.acquire()) {
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(url.replaceAll("/$", "") + "/v1/query/stream"))
                .timeout(Duration.ofSeconds(timeout))
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .header("X-Service-Key", key)
                .header("X-Request-ID", requestId)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(request), StandardCharsets.UTF_8))
                .build();
            HttpResponse<InputStream> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                if (response.statusCode() == 422) throw new RemoteStatusException(422);
                if (response.statusCode() / 100 != 2) throw new AppException(ResponseCode.AI_UNAVAILABLE);
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(body, StandardCharsets.UTF_8))) {
                    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeout);
                    String event = null;
                    String data = null;
                    String line;
                    while ((line = readBoundedLine(reader, 65536, deadline)) != null) {
                        if (line.isEmpty()) {
                            AiGatewayDTO.Answer answer = consumeStreamEvent(event, data, progress);
                            if (answer != null) return answer;
                            event = null;
                            data = null;
                        } else if (line.startsWith("event:")) {
                            event = line.substring("event:".length()).trim();
                        } else if (line.startsWith("data:")) {
                            String value = line.substring("data:".length()).trim();
                            data = data == null ? value : data + "\n" + value;
                            if (data.length() > 1_000_000) throw new AppException(ResponseCode.AI_UNAVAILABLE);
                        }
                    }
                    AiGatewayDTO.Answer answer = consumeStreamEvent(event, data, progress);
                    if (answer != null) return answer;
                }
            }
            throw new AppException(ResponseCode.AI_UNAVAILABLE);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unavailable(e);
        } catch (IOException | IllegalArgumentException e) {
            throw unavailable(e);
        }
    }

    private AiGatewayDTO.Answer consumeStreamEvent(String event, String data, LongConsumer progress) throws IOException {
        if (event == null || data == null || data.isBlank()) return null;
        var node = mapper.readTree(data);
        if (node == null || !node.isObject()) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        return switch (event) {
            case "started" -> null;
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

    private String readBoundedLine(BufferedReader reader, int maxLength, long deadline) throws IOException {
        StringBuilder line = new StringBuilder(Math.min(maxLength, 256));
        int value;
        while (true) {
            while (!reader.ready()) {
                if (System.nanoTime() >= deadline) throw new IOException("AI stream timeout");
                try {
                    Thread.sleep(25);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IOException("AI stream interrupted", interrupted);
                }
            }
            value = reader.read();
            if (value == -1) break;
            if (value == '\n') return line.toString().endsWith("\r") ? line.substring(0, line.length() - 1) : line.toString();
            if (line.length() >= maxLength) throw new AppException(ResponseCode.AI_UNAVAILABLE);
            line.append((char) value);
        }
        return line.isEmpty() ? null : line.toString();
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
