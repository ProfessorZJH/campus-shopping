package cn.bugstack.ai.infrastructure.gateway;

import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** 固定服务端地址的 HTTP 客户端；超时覆盖完整响应体，不允许请求指定任意 URL。 */
@Service
public class AiGatewayService {
    @Value("${campus.ai.url:http://127.0.0.1:8100}") private String url;
    @Value("${campus.ai.service-key:}") private String key;
    @Value("${campus.ai.timeout-seconds:90}") private int timeoutSeconds = 90;
    @Resource private ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();

    public AiGatewayDTO.RecallResponse recall(AiGatewayDTO.RecallRequest request) {return post("/v1/recall",request,AiGatewayDTO.RecallResponse.class);}
    public AiGatewayDTO.Answer query(AiGatewayDTO.Query request) {
        return post("/v1/query", request, AiGatewayDTO.Answer.class);
    }
    public AiGatewayDTO.ProductSearchResult semanticProducts(AiGatewayDTO.ProductSearch request) {
        return post("/v1/products/search",request,AiGatewayDTO.ProductSearchResult.class);
    }
    /** 启用同步任务时必须收到 Milvus 实际处理结果，不能把 DISABLED 当成功。 */
    public void indexProducts(AiGatewayDTO.ProductIndexRequest request) {
        AiGatewayDTO.ProductIndexResult result = post(
                "/v1/products/index", request, AiGatewayDTO.ProductIndexResult.class);
        if (result == null || !"MILVUS".equals(result.mode())
                || result.indexed() < 0 || result.unchanged() < 0
                || (long) result.indexed() + result.unchanged() != request.products().size()) {
            throw new AppException(ResponseCode.AI_UNAVAILABLE);
        }
    }
    public void index(AiGatewayDTO.Index request) { post("/v1/index", request, Map.class); }
    public String extract(AiGatewayDTO.Extract request) {
        return post("/v1/extract", request, AiGatewayDTO.Extracted.class).text();
    }

    private <T> T post(String path, Object payload, Class<T> type) {
        if (key == null || key.length() < 24) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        CompletableFuture<HttpResponse<byte[]>> pending = null;
        int timeout = Math.max(5, Math.min(timeoutSeconds, 120));
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url.replaceAll("/$", "") + path))
                    .timeout(Duration.ofSeconds(timeout))
                    .header("Content-Type", "application/json").header("X-Service-Key", key)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload), StandardCharsets.UTF_8)).build();
            pending = client.sendAsync(request, ignored -> new BoundedHttpBodySubscriber(1_000_000));
            HttpResponse<byte[]> response = pending.get(timeout, TimeUnit.SECONDS);
            if (response.statusCode() / 100 != 2) throw new AppException(ResponseCode.AI_UNAVAILABLE);
            return mapper.readValue(response.body(), type);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unavailable(e);
        } catch (IOException | IllegalArgumentException | ExecutionException | TimeoutException e) {
            throw unavailable(e);
        } finally {
            if (pending != null && !pending.isDone()) pending.cancel(true);
        }
    }

    private AppException unavailable(Exception cause) {
        return new AppException(ResponseCode.AI_UNAVAILABLE.getCode(), ResponseCode.AI_UNAVAILABLE.getInfo(), cause);
    }
}