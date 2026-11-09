package cn.bugstack.ai.test.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeCommandVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStageVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentRuntimeStatusVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.agent.AgentToolRegistry;
import cn.bugstack.ai.infrastructure.gateway.AgentRuntimeGateway;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Java/Python consumer contract checks; the new tools stay disabled in the M2 bridge. */
class AgentRuntimeConsumerContractTest {

    private static final String SERVICE_KEY = "service-key-for-consumer-contract-123456";
    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void pythonManifestMatchesKnownJavaContractsWhileConsumerToolsRemainGated() throws Exception {
        JsonNode manifest = read("ai-service/contracts/consumer_readonly/v1/manifest.json");
        assertEquals("1.0", manifest.path("schemaVersion").asText());

        Set<String> names = new HashSet<>();
        for (JsonNode tool : manifest.path("tools")) {
            String name = tool.path("name").asText();
            names.add(name);
            assertEquals("1.0", tool.path("version").asText());
            assertTrue(tool.path("readOnly").asBoolean());
            assertEquals("1.0", AgentToolRegistry.version(name));
            assertFalse(AgentToolRegistry.enabled(name, false));
            assertTrue(AgentToolRegistry.enabled(name, true));
        }
        assertEquals(Set.of(AgentToolRegistry.KNOWLEDGE_QA, AgentToolRegistry.GET_MY_ORDERS), names);

        JsonNode knowledgeArguments = read("ai-service/contracts/consumer_readonly/v1/knowledge_qa.arguments.schema.json");
        assertEquals(Set.of("question"), fieldNames(knowledgeArguments.path("properties")));
        assertEquals(List.of("question"), jsonStrings(knowledgeArguments.path("required")));
        assertFalse(knowledgeArguments.path("additionalProperties").asBoolean());

        JsonNode ordersArguments = read("ai-service/contracts/consumer_readonly/v1/get_my_orders.arguments.schema.json");
        assertEquals(Set.of("state", "page", "size"), fieldNames(ordersArguments.path("properties")));
        assertEquals(Set.of("page", "size"), new HashSet<>(jsonStrings(ordersArguments.path("required"))));
        assertFalse(ordersArguments.path("additionalProperties").asBoolean());
    }

    @Test
    void searchProductsRequestKeepsPythonFixtureSchemaAndM2ResultCompatibility() throws Exception {
        AtomicReference<JsonNode> request = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/agent/runtime/turn", exchange -> {
            request.set(mapper.readTree(exchange.getRequestBody().readAllBytes()));
            respond(
                exchange,
                200,
                "{\"protocolVersion\":\"1.0\",\"runId\":\"run-contract\",\"requestId\":\"request-contract\",\"status\":\"FINAL\",\"answer\":\"compatible\",\"evidenceStatus\":\"STUB\",\"usage\":{\"total_tokens\":1},\"durationMs\":1}"
            );
        });
        server.start();

        var result = gateway().run(command(Set.of(AgentToolRegistry.SEARCH_PRODUCTS)));

        assertEquals(AgentRuntimeStatusVO.FINAL, result.status());
        JsonNode tool = request.get().path("allowedTools").get(0);
        assertNotNull(tool);
        JsonNode searchFixture = read("ai-service/tests/fixtures/agent-runtime-contract.json").path("tool");
        assertEquals(searchFixture.path("name").asText(), tool.path("name").asText());
        assertEquals(searchFixture.path("readOnly").asBoolean(), tool.path("readOnly").asBoolean());
        assertEquals(Set.of("query", "limit", "merchantId"), fieldNames(tool.path("parameters").path("properties")));
        assertFalse(tool.path("parameters").path("additionalProperties").asBoolean());
        assertTrue(jsonStrings(tool.path("parameters").path("required")).contains("query"));
        assertEquals("string", tool.path("parameters").path("properties").path("query").path("type").asText());
        assertEquals("integer", tool.path("parameters").path("properties").path("limit").path("type").asText());
        assertEquals(10, tool.path("parameters").path("properties").path("limit").path("default").asInt());
        assertEquals(20, tool.path("parameters").path("properties").path("limit").path("maximum").asInt());
        JsonNode merchantId = tool.path("parameters").path("properties").path("merchantId");
        assertEquals(2, merchantId.path("anyOf").size());
        assertEquals(64, merchantId.path("anyOf").get(0).path("maxLength").asInt());
        assertTrue(merchantId.path("anyOf").get(1).path("type").asText().equals("null"));
    }

    @Test
    void rejectsKnownConsumerToolReturnedBeforePythonSchemaRollout() throws Exception {
        startResponseServer(
            "{\"protocolVersion\":\"1.0\",\"runId\":\"run-contract\",\"requestId\":\"request-contract\",\"status\":\"TOOL_CALLS\",\"continuationId\":\"cont-contract\",\"toolCalls\":[{\"callId\":\"call-contract\",\"name\":\"knowledge_qa\",\"arguments\":{\"question\":\"pickup\"}}],\"evidenceStatus\":\"STUB\",\"usage\":{},\"durationMs\":1}"
        );

        AppException error = assertThrows(AppException.class, () -> gateway().run(command(Set.of(AgentToolRegistry.SEARCH_PRODUCTS))));

        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), error.getCode());
    }

    @Test
    void rejectsSearchSchemaMismatchBeforeToolExecution() throws Exception {
        startResponseServer(
            "{\"protocolVersion\":\"1.0\",\"runId\":\"run-contract\",\"requestId\":\"request-contract\",\"status\":\"TOOL_CALLS\",\"continuationId\":\"cont-contract\",\"toolCalls\":[{\"callId\":\"call-contract\",\"name\":\"search_products\",\"arguments\":{\"limit\":5,\"buyerId\":\"other-user\"}}],\"evidenceStatus\":\"STUB\",\"usage\":{},\"durationMs\":1}"
        );

        AppException error = assertThrows(AppException.class, () -> gateway().run(command(Set.of(AgentToolRegistry.SEARCH_PRODUCTS))));

        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), error.getCode());
    }

    @Test
    void refusesToSendConsumerToolsThroughM2Gateway() {
        AppException error = assertThrows(AppException.class, () -> gateway().run(command(Set.of(AgentToolRegistry.KNOWLEDGE_QA))));

        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), error.getCode());
    }

    @Test
    void preservesSharedFailureCategoryWithoutForwardingProviderBody() throws Exception {
        JsonNode shared = read("ai-service/tests/fixtures/agent-runtime-contract.json");
        Set<String> errors = new HashSet<>(jsonStrings(shared.path("errors")));
        assertTrue(errors.containsAll(Set.of("INVALID_TOOL_CALL", "INVALID_TOOL_ARGUMENTS", "UPSTREAM_429", "UPSTREAM_5XX", "UPSTREAM_TIMEOUT")));

        startResponseServer(
            "{\"protocolVersion\":\"1.0\",\"runId\":\"run-contract\",\"requestId\":\"request-contract\",\"status\":\"FAILED\",\"errorCode\":\"UPSTREAM_429\",\"evidenceStatus\":\"DEGRADED\",\"usage\":{},\"durationMs\":1}"
        );
        var result = gateway().run(command(Set.of(AgentToolRegistry.SEARCH_PRODUCTS)));

        assertEquals(AgentRuntimeStatusVO.FAILED, result.status());
        assertEquals("UPSTREAM_429", result.errorCode());
        assertTrue(result.answer() == null || result.answer().isBlank());
    }

    private AgentRuntimeGateway gateway() {
        int port = server == null ? 1 : server.getAddress().getPort();
        return new AgentRuntimeGateway(mapper, "http://127.0.0.1:" + port, SERVICE_KEY, true, 5);
    }

    private AgentRuntimeCommandVO command(Set<String> tools) {
        return new AgentRuntimeCommandVO(
            "run-contract",
            "request-contract",
            "capability-contract",
            AgentRuntimeStageVO.START,
            "Find tea",
            new AgentScopeVO(
                "buyer",
                AgentScopeVO.CONSUMER,
                null,
                Set.of(),
                Set.of(AgentScopeVO.PRODUCT_SEARCH_PERMISSION),
                "conversation",
                "turn-token",
                Instant.now().plusSeconds(600)
            ),
            tools,
            null,
            List.of()
        );
    }

    private void startResponseServer(String body) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/agent/runtime/turn", exchange -> respond(exchange, 200, body));
        server.start();
    }

    private JsonNode read(String relative) throws IOException {
        Path root = findRoot(Path.of(System.getProperty("user.dir")).toAbsolutePath());
        String payload = Files.readString(root.resolve(relative), StandardCharsets.UTF_8);
        if (!payload.isEmpty() && payload.charAt(0) == '\uFEFF') payload = payload.substring(1);
        return mapper.readTree(payload);
    }

    private static Path findRoot(Path start) {
        Path current = start;
        while (current != null) {
            if (Files.isDirectory(current.resolve("ai-service")) && Files.exists(current.resolve("pom.xml"))) return current;
            current = current.getParent();
        }
        throw new IllegalStateException("campus-shopping root not found");
    }

    private static Set<String> fieldNames(JsonNode node) {
        Set<String> names = new HashSet<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static List<String> jsonStrings(JsonNode node) {
        List<String> values = new java.util.ArrayList<>();
        node.forEach(value -> values.add(value.asText()));
        return values;
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
