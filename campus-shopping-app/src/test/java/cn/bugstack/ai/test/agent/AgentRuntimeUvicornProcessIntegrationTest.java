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
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeCommandVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStageVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentProductCandidateVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRunVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentSkuFactVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolResultVO;
import cn.bugstack.ai.infrastructure.gateway.AgentRuntimeGateway;
import cn.bugstack.ai.types.common.Fingerprints;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/**
 * Cross-process bridge test: the Java adapter talks to a real isolated Uvicorn process.
 * The model endpoint is a local deterministic fixture, so this test is STUB evidence for
 * model quality while still exercising HTTP, authentication, continuation and cleanup.
 */
@EnabledIfEnvironmentVariable(named = "AGENT_RUNTIME_PROCESS_TEST", matches = "true")
class AgentRuntimeUvicornProcessIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-11-10T00:00:00Z");
    private static final String SERVICE_KEY = "service-key-for-process-test-123456";
    private static final String CAPABILITY = "capability-process-test";
    private static final String MODEL_KEY = "model-key-for-process-test";

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer modelServer;
    private Process uvicorn;
    private Path tempDirectory;

    @AfterEach
    void cleanup() throws Exception {
        if (uvicorn != null) {
            uvicorn.destroy();
            if (!uvicorn.waitFor(5, java.util.concurrent.TimeUnit.SECONDS)) uvicorn.destroyForcibly();
        }
        if (modelServer != null) modelServer.stop(0);
        if (tempDirectory != null) {
            try (var files = Files.walk(tempDirectory)) {
                files.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                        // Best-effort cleanup is asserted through the temporary directory boundary.
                    }
                });
            }
        }
    }

    @Test
    void runsJavaCaseThroughRealUvicornProcessAndNativeToolCalling() throws Exception {
        AtomicInteger modelTurns = new AtomicInteger();
        modelServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        modelServer.createContext("/chat/completions", exchange -> {
            assertEquals("Bearer " + MODEL_KEY, exchange.getRequestHeaders().getFirst("Authorization"));
            JsonNode request = mapper.readTree(exchange.getRequestBody().readAllBytes());
            boolean hasToolResult = request.path("messages").toString().contains("tool_call_id");
            int turn = modelTurns.incrementAndGet();
            String body = hasToolResult
                ? "{\"choices\":[{\"message\":{\"content\":\"Found verified tea\"}}],\"usage\":{\"total_tokens\":6}}"
                : "{\"choices\":[{\"message\":{\"tool_calls\":[{\"id\":\"call-process\",\"type\":\"function\",\"function\":{\"name\":\"search_products\",\"arguments\":\"{\\\"query\\\":\\\"tea\\\",\\\"limit\\\":5}\"}}]}}],\"usage\":{\"total_tokens\":3}}";
            assertTrue(turn <= 3);
            respond(exchange, 200, body);
        });
        modelServer.start();

        int runtimePort = freePort();
        tempDirectory = Files.createTempDirectory("campus-agent-runtime-process-");
        Path root = findRoot(Path.of(System.getProperty("user.dir")).toAbsolutePath());
        ProcessBuilder builder = new ProcessBuilder(
            pythonExecutable(),
            "-m",
            "uvicorn",
            "app.main:create_app",
            "--factory",
            "--host",
            "127.0.0.1",
            "--port",
            Integer.toString(runtimePort)
        );
        builder.directory(root.resolve("ai-service").toFile());
        builder.redirectError(ProcessBuilder.Redirect.DISCARD);
        builder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        Map<String, String> environment = builder.environment();
        environment.put("AI_SERVICE_KEY", SERVICE_KEY);
        environment.put("AI_DB_PATH", tempDirectory.resolve("runtime.sqlite3").toString());
        environment.put("LLM_BASE_URL", "http://127.0.0.1:" + modelServer.getAddress().getPort());
        environment.put("LLM_API_KEY", MODEL_KEY);
        environment.put("LLM_MODEL", "process-test-model");
        environment.put("LLM_TIMEOUT_SECONDS", "5");
        removeExternalProviderEnvironment(environment);
        uvicorn = builder.start();
        String runtimeUrl = "http://127.0.0.1:" + runtimePort;
        waitForHealth(runtimeUrl, uvicorn);

        IAgentRunRepository repository = mock(IAgentRunRepository.class);
        AgentRunVO created = run(AgentRunStatusVO.CREATED);
        AtomicReference<AgentRunVO> current = new AtomicReference<>(created);
        when(repository.find("run-process")).thenAnswer(ignored -> current.get());
        when(repository.activeTurnExpiry("buyer", "conversation", "turn-token")).thenReturn(NOW.plusSeconds(600));
        when(repository.update(any(), any())).thenAnswer(invocation -> {
            current.set(invocation.getArgument(1));
            return true;
        });
        AgentRunCaseImpl runs = new AgentRunCaseImpl(
            repository,
            mock(IUserAccountService.class),
            mock(IAccessService.class),
            Clock.fixed(NOW, ZoneOffset.UTC)
        );

        IAgentToolInvocationCase tools = mock(IAgentToolInvocationCase.class);
        when(tools.invoke(any())).thenReturn(
            new AgentToolResultVO(
                "search_products",
                "1.0",
                true,
                List.of(new AgentProductCandidateVO(
                    "product-tea",
                    "merchant-1",
                    "store-1",
                    "Verified tea",
                    "CATALOG_READ_MODEL",
                    true,
                    List.of(new AgentSkuFactVO("sku-tea", "default", 500, 1, 4))
                ))
            )
        );
        IAgentRuntimePort runtime = new AgentRuntimeGateway(
            mapper,
            runtimeUrl,
            SERVICE_KEY,
            true,
            10
        );

        AgentRuntimeCommandVO replayCommand = new AgentRuntimeCommandVO(
            "run-process",
            "request-replay",
            CAPABILITY,
            AgentRuntimeStageVO.START,
            "Find tea",
            scope(),
            Set.of("search_products"),
            null,
            List.of()
        );
        var firstReplay = runtime.run(replayCommand);
        var secondReplay = runtime.run(replayCommand);
        assertEquals(AgentRuntimeStatusVO.TOOL_CALLS, firstReplay.status());
        assertEquals(firstReplay, secondReplay);
        AppException replayConflict = org.junit.jupiter.api.Assertions.assertThrows(
            AppException.class,
            () -> runtime.run(new AgentRuntimeCommandVO(
                "run-process",
                "request-replay",
                CAPABILITY,
                AgentRuntimeStageVO.START,
                "Find coffee",
                scope(),
                Set.of("search_products"),
                null,
                List.of()
            ))
        );
        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), replayConflict.getCode());

        IAgentRuntimeCase runtimeCase = new AgentRuntimeCaseImpl(
            runs,
            repository,
            tools,
            runtime,
            Clock.fixed(NOW, ZoneOffset.UTC)
        );

        AgentRuntimeReceipt receipt = runtimeCase.run(
            new RunAgentCommand("buyer", "run-process", CAPABILITY, "Find tea", "request-process")
        );

        assertEquals(AgentRunStatusVO.COMPLETED, current.get().status());
        assertEquals("FINAL", receipt.status().name());
        assertEquals("Found verified tea", receipt.answer());
        assertEquals(2, receipt.rounds());
        assertEquals(3, modelTurns.get());
        verify(tools).invoke(any());
    }

    private AgentScopeVO scope() {
        return new AgentScopeVO(
            "buyer",
            AgentScopeVO.CONSUMER,
            null,
            Set.of(),
            Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
            "conversation",
            "turn-token",
            NOW.plusSeconds(600)
        );
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
            "run-process",
            "buyer",
            "request-process",
            Fingerprints.sha256(CAPABILITY),
            scope,
            Set.of("search_products"),
            status,
            NOW,
            NOW,
            0
        );
    }

    private static void removeExternalProviderEnvironment(Map<String, String> environment) {
        for (String name : List.copyOf(environment.keySet())) {
            if (name.startsWith("EMBEDDING_") || name.startsWith("MILVUS_") || name.startsWith("QDRANT_")) {
                environment.remove(name);
            }
        }
    }

    private static String pythonExecutable() {
        String configured = System.getenv("PYTHON");
        return configured == null || configured.isBlank() ? "python" : configured;
    }

    private static Path findRoot(Path start) {
        Path current = start;
        while (current != null) {
            if (Files.isDirectory(current.resolve("ai-service")) && Files.exists(current.resolve("pom.xml"))) return current;
            current = current.getParent();
        }
        throw new IllegalStateException("campus-shopping root not found");
    }

    private static int freePort() throws IOException {
        try (var socket = new java.net.ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    private static void waitForHealth(String baseUrl, Process process) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        for (int attempt = 0; attempt < 120; attempt++) {
            if (!process.isAlive()) throw new IllegalStateException("Uvicorn exited before readiness");
            try {
                HttpResponse<String> response = client.send(
                    HttpRequest.newBuilder(URI.create(baseUrl + "/health")).GET().build(),
                    HttpResponse.BodyHandlers.ofString()
                );
                if (response.statusCode() == 200 && response.body().contains("UP")) return;
            } catch (IOException ignored) {
                // The process is still starting.
            }
            Thread.sleep(100);
        }
        throw new IllegalStateException("Uvicorn did not become ready");
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
