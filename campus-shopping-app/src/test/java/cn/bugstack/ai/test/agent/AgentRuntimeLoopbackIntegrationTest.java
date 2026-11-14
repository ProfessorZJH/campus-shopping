package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.bugstack.ai.cases.agent.IAgentRuntimeCase;
import cn.bugstack.ai.cases.agent.IAgentToolInvocationCase;
import cn.bugstack.ai.cases.agent.impl.AgentRunCaseImpl;
import cn.bugstack.ai.cases.agent.impl.AgentRuntimeCaseImpl;
import cn.bugstack.ai.cases.agent.model.AgentRuntimeReceipt;
import cn.bugstack.ai.cases.agent.model.RunAgentCommand;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAgentRuntimePort;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IAgentRunRepository;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;
import cn.bugstack.ai.infrastructure.gateway.AgentRuntimeGateway;
import cn.bugstack.ai.infrastructure.gateway.AgentRuntimeSignature;
import cn.bugstack.ai.types.common.Fingerprints;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AgentRuntimeLoopbackIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-11-10T00:00:00Z");
    private static final String SERVICE_KEY = "service-key-for-loopback-integration-123456";
    private static final String CAPABILITY = "capability-loopback-test";

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void runsNativeToolCallThroughJavaFactsAndContinuesToFinal() throws Exception {
        AtomicInteger turns = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/agent/runtime/turn", exchange -> {
            JsonNode request = mapper.readTree(exchange.getRequestBody().readAllBytes());
            String runId = request.get("runId").asText();
            String requestId = request.get("requestId").asText();
            double expires = request.get("scope").get("turnExpiresAt").asDouble();
            assertEquals(SERVICE_KEY, exchange.getRequestHeaders().getFirst("X-Service-Key"));
            assertEquals(CAPABILITY, exchange.getRequestHeaders().getFirst("X-Agent-Capability"));
            assertEquals(
                AgentRuntimeSignature.hmacSha256(SERVICE_KEY, runId, requestId, expires),
                exchange.getRequestHeaders().getFirst("X-Agent-Capability-Signature")
            );
            assertEquals(requestId, exchange.getRequestHeaders().getFirst("X-Request-ID"));
            int turn = turns.incrementAndGet();
            if (turn == 1) {
                respond(
                    exchange,
                    200,
                    "{\"protocolVersion\":\"1.0\",\"runId\":\"" +
                        runId +
                        "\",\"requestId\":\"" +
                        requestId +
                        "\",\"status\":\"TOOL_CALLS\",\"continuationId\":\"continuation-loopback\",\"toolCalls\":[{\"callId\":\"call-loopback\",\"name\":\"search_products\",\"arguments\":{\"query\":\"tea\",\"limit\":5}}],\"evidenceStatus\":\"STUB\",\"usage\":{\"total_tokens\":3},\"durationMs\":8}"
                );
                return;
            }
            assertEquals("CONTINUE", request.get("phase").asText());
            assertTrue(request.get("toolResults").isArray() && request.get("toolResults").size() == 1);
            respond(
                exchange,
                200,
                "{\"protocolVersion\":\"1.0\",\"runId\":\"" +
                    runId +
                    "\",\"requestId\":\"" +
                    requestId +
                    "\",\"status\":\"FINAL\",\"continuationId\":\"continuation-loopback\",\"answer\":\"Found verified tea\",\"evidenceStatus\":\"STUB\",\"usage\":{\"total_tokens\":6},\"durationMs\":11}"
            );
        });
        server.start();

        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        AgentRunVO created = run(AgentRunStatusVO.CREATED);
        AtomicReference<AgentRunVO> current = new AtomicReference<>(created);
        when(repository.find("run-loopback")).thenAnswer(ignored -> current.get());
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(repository.update(any(), any())).thenAnswer(invocation -> {
            current.set(invocation.getArgument(1));
            return true;
        });
        AgentRunCaseImpl runs = new AgentRunCaseImpl(repository, mock(IUserAccountService.class), mock(IAccessService.class), Clock.fixed(NOW, ZoneOffset.UTC));

        IAgentToolInvocationCase tools = mock(IAgentToolInvocationCase.class);
        when(tools.invoke(any())).thenReturn(new AgentToolResultVO("search_products", "1.0", true, List.of()));
        IAgentRuntimePort runtime = new AgentRuntimeGateway(new ObjectMapper(), "http://127.0.0.1:" + server.getAddress().getPort(), SERVICE_KEY, true, 5);
        IAgentRuntimeCase runtimeCase = new AgentRuntimeCaseImpl(runs, repository, tools, runtime, Clock.fixed(NOW, ZoneOffset.UTC));

        AgentRuntimeReceipt receipt = runtimeCase.run(new RunAgentCommand("buyer", "run-loopback", CAPABILITY, "Find tea", "request-loopback"));

        assertEquals(AgentRunStatusVO.COMPLETED, current.get().status());
        assertEquals(cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO.FINAL, receipt.status());
        assertEquals("Found verified tea", receipt.answer());
        assertEquals(2, receipt.rounds());
        assertEquals(2, turns.get());
        verify(tools).invoke(any());
    }

    private AgentRunVO run(AgentRunStatusVO status) {
        AgentScopeVO scope = new AgentScopeVO(
            "buyer",
            AgentScopeVO.CONSUMER,
            null,
            Set.of(),
            Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
            "conversation",
            "turn-token",
            NOW.plusSeconds(600)
        );
        return new AgentRunVO(
            "run-loopback",
            "buyer",
            "request-loopback",
            Fingerprints.sha256(CAPABILITY),
            scope,
            Set.of("search_products"),
            status,
            NOW,
            NOW,
            0
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
