package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeCommandVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeResultVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStageVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.infrastructure.gateway.AgentRuntimeGateway;
import cn.bugstack.ai.infrastructure.gateway.AgentRuntimeSignature;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AgentRuntimeGatewayHttpTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void sendsSignedHeadersAndParsesFinalResponse() throws Exception {
        AtomicReference<String> serviceKey = new AtomicReference<>();
        AtomicReference<String> capability = new AtomicReference<>();
        AtomicReference<String> capabilityDigest = new AtomicReference<>();
        AtomicReference<String> signature = new AtomicReference<>();
        AtomicReference<String> requestId = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/agent/runtime/turn", exchange -> {
            serviceKey.set(exchange.getRequestHeaders().getFirst("X-Service-Key"));
            capability.set(exchange.getRequestHeaders().getFirst("X-Agent-Capability"));
            capabilityDigest.set(exchange.getRequestHeaders().getFirst("X-Agent-Capability-Digest"));
            signature.set(exchange.getRequestHeaders().getFirst("X-Agent-Capability-Signature"));
            requestId.set(exchange.getRequestHeaders().getFirst("X-Request-ID"));
            respond(
                exchange,
                200,
                "{\"protocolVersion\":\"1.0\",\"runId\":\"run-1\",\"requestId\":\"req-1\",\"status\":\"FINAL\",\"continuationId\":\"cont-1\",\"answer\":\"已找到\",\"evidenceStatus\":\"STUB\",\"usage\":{\"total_tokens\":2},\"durationMs\":17}"
            );
        });
        server.start();
        String key = "service-key-for-loopback-test-123456";
        AgentRuntimeCommandVO command = command();
        AgentRuntimeResultVO result = gateway(key).run(command);
        assertEquals(AgentRuntimeStatusVO.FINAL, result.status());
        assertEquals(17, result.durationMs());
        assertEquals(key, serviceKey.get());
        assertEquals(command.capabilityToken(), capability.get());
        assertEquals(
            java.util.HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(command.capabilityToken().getBytes(StandardCharsets.UTF_8))
            ),
            capabilityDigest.get()
        );
        assertEquals(command.requestId(), requestId.get());
        assertTrue(
            AgentRuntimeSignature.constantTimeEquals(
                signature.get(),
                AgentRuntimeSignature.hmacSha256(key, "run-1", "req-1", command.scope().turnExpiresAt().toEpochMilli() / 1000.0)
            )
        );
    }

    @Test
    void mapsRateLimitAndMalformedJsonToStableAiUnavailable() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/agent/runtime/turn", exchange -> respond(exchange, 429, "provider secret body"));
        server.start();
        AppException rateLimited = assertThrows(AppException.class, () -> gateway("service-key-for-loopback-test-123456").run(command()));
        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), rateLimited.getCode());
        server.stop(0);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/agent/runtime/turn", exchange -> respond(exchange, 200, "not-json"));
        server.start();
        AppException malformed = assertThrows(AppException.class, () -> gateway("service-key-for-loopback-test-123456").run(command()));
        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), malformed.getCode());
    }

    @ParameterizedTest
    @ValueSource(ints = { 401, 403, 422, 500, 503 })
    void mapsRemoteErrorClassesWithoutForwardingBody(int status) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/agent/runtime/turn", exchange -> respond(exchange, status, "private downstream body"));
        server.start();
        AppException error = assertThrows(AppException.class, () -> gateway("service-key-for-loopback-test-123456").run(command()));
        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), error.getCode());
        org.junit.jupiter.api.Assertions.assertFalse(error.getInfo().contains("private"));
    }

    @Test
    void rejectsUnsupportedProtocolVersionBeforeReturningRuntimeResult() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/agent/runtime/turn", exchange ->
            respond(
                exchange,
                200,
                "{\"protocolVersion\":\"2.0\",\"runId\":\"run-1\",\"requestId\":\"req-1\",\"status\":\"FINAL\",\"answer\":\"private\",\"durationMs\":1}"
            )
        );
        server.start();
        AppException error = assertThrows(AppException.class, () -> gateway("service-key-for-loopback-test-123456").run(command()));
        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), error.getCode());
    }

    private AgentRuntimeGateway gateway(String key) {
        return new AgentRuntimeGateway(new ObjectMapper(), "http://127.0.0.1:" + server.getAddress().getPort(), key, true, 5);
    }

    private AgentRuntimeCommandVO command() {
        return new AgentRuntimeCommandVO(
            "run-1",
            "req-1",
            "capability-token",
            AgentRuntimeStageVO.START,
            "找茶",
            new AgentScopeVO(
                "u-1",
                AgentScopeVO.CONSUMER,
                null,
                Set.of(),
                Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
                "c-1",
                "turn-1",
                Instant.now().plusSeconds(600)
            ),
            Set.of("search_products"),
            null,
            List.of()
        );
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
