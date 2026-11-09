package cn.bugstack.ai.infrastructure.gateway;

import cn.bugstack.ai.domain.shoppingai.adapter.port.IAgentRuntimePort;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeCommandVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeToolCallVO;
import cn.bugstack.ai.infrastructure.gateway.dto.AgentRuntimeDTO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** 受控 Java→Python Runtime 适配器；不暴露公开用户路由。 */
@Service
@ConditionalOnProperty(prefix = "campus.ai.agent-runtime", name = "enabled", havingValue = "true")
public class AgentRuntimeGateway implements IAgentRuntimePort {
    private static final Logger log = LoggerFactory.getLogger(AgentRuntimeGateway.class);
    private static final String PROTOCOL = "1.0";
    private final ObjectMapper mapper;
    private final HttpClient client;
    private final String baseUrl;
    private final String serviceKey;
    private final boolean enabled;
    private final int timeoutSeconds;

    public AgentRuntimeGateway(
        ObjectMapper mapper,
        @Value("${campus.ai.url:http://127.0.0.1:8100}") String baseUrl,
        @Value("${campus.ai.service-key:}") String serviceKey,
        @Value("${campus.ai.agent-runtime.enabled:false}") boolean enabled,
        @Value("${campus.ai.agent-runtime.timeout-seconds:60}") int timeoutSeconds
    ) {
        this.mapper = mapper;
        this.baseUrl = baseUrl;
        this.serviceKey = serviceKey;
        this.enabled = enabled;
        this.timeoutSeconds = Math.max(1, Math.min(timeoutSeconds, 120));
        this.client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @Override
    public AgentRuntimeResultVO run(AgentRuntimeCommandVO command) {
        if (!enabled || serviceKey == null || serviceKey.length() < 24) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        String requestId = command.requestId();
        double expires = command.scope().turnExpiresAt().toEpochMilli() / 1000.0;
        AgentRuntimeDTO.Command payload = new AgentRuntimeDTO.Command(
            PROTOCOL, command.runId(), requestId, command.stage().name(), command.question(),
            new AgentRuntimeDTO.Scope(command.scope().userId(), command.scope().identityKind(), command.scope().identityId(), command.scope().authorizedMerchantIds(), command.scope().permissions(), command.scope().conversationId(), command.scope().turnToken(), expires),
            command.allowedTools().stream().map(name -> new AgentRuntimeDTO.ToolDefinition(name, "受控只读工具", toolParameters(name), true)).toList(), command.continuationId(), command.toolResults().stream().map(item -> new AgentRuntimeDTO.ToolResult(item.callId(), item.name(), item.result(), item.errorCode())).toList()
        );
        long started = System.nanoTime();
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl.replaceAll("/$", "") + "/internal/v1/agent/runtime/turn"))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/json")
                .header("X-Service-Key", serviceKey)
                .header("X-Agent-Capability", command.capabilityToken())
                .header("X-Agent-Capability-Digest", capabilityDigest(command.capabilityToken()))
                .header("X-Agent-Capability-Signature", AgentRuntimeSignature.hmacSha256(serviceKey, command.runId(), requestId, expires))
                .header("X-Request-ID", requestId)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload), StandardCharsets.UTF_8)).build();
            HttpResponse<byte[]> response = client.sendAsync(request, ignored -> new BoundedHttpBodySubscriber(1_000_000)).get(timeoutSeconds, TimeUnit.SECONDS);
            if (response.statusCode() / 100 != 2) throw new AppException(ResponseCode.AI_UNAVAILABLE);
            AgentRuntimeDTO.Result dto = mapper.readValue(response.body(), AgentRuntimeDTO.Result.class);
            return toDomain(dto, command);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw unavailable("interrupted", requestId, started);
        } catch (Exception error) {
            if (error instanceof AppException app) throw app;
            throw unavailable(error.getClass().getSimpleName(), requestId, started);
        }
    }

    private Map<String, Object> toolParameters(String name) {
        if ("search_products".equals(name)) {
            Map<String, Object> properties = new LinkedHashMap<>();
            properties.put("query", Map.of("type", "string", "minLength", 1, "maxLength", 2000));
            properties.put("limit", Map.of("type", "integer", "minimum", 1, "maximum", 20));
            properties.put("merchantId", Map.of("type", "string"));
            return Map.of("type", "object", "additionalProperties", false, "properties", properties, "required", List.of("query"));
        }
        return Map.of("type", "object", "additionalProperties", false);
    }

    private String capabilityDigest(String capabilityToken) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(capabilityToken.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException("capability digest unavailable", error);
        }
    }

    private AgentRuntimeResultVO toDomain(AgentRuntimeDTO.Result dto, AgentRuntimeCommandVO command) {
        if (dto == null || !PROTOCOL.equals(dto.protocolVersion()) || !command.runId().equals(dto.runId()) || !command.requestId().equals(dto.requestId())) throw new AppException(ResponseCode.AI_UNAVAILABLE);
        AgentRuntimeStatusVO status;
        try { status = AgentRuntimeStatusVO.valueOf(dto.status()); } catch (RuntimeException error) { throw new AppException(ResponseCode.AI_UNAVAILABLE); }
        List<AgentRuntimeToolCallVO> calls = dto.toolCalls() == null ? List.of() : dto.toolCalls().stream().map(call -> new AgentRuntimeToolCallVO(call.callId(), call.name(), call.arguments())).toList();
        return new AgentRuntimeResultVO(dto.runId(), dto.requestId(), status, dto.continuationId(), calls, dto.answer(), dto.evidenceStatus(), dto.usage(), dto.durationMs(), dto.errorCode());
    }

    private AppException unavailable(String type, String requestId, long started) {
        log.warn("agent_runtime_failed request_id={} exception_type={} duration_ms={}", requestId, type, (System.nanoTime() - started) / 1_000_000);
        return new AppException(ResponseCode.AI_UNAVAILABLE);
    }
}
