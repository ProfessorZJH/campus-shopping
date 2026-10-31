package cn.bugstack.ai.infrastructure.gateway;

import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import java.io.IOException;
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
}
