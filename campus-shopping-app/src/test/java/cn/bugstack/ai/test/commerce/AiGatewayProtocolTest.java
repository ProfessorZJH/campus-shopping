package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.cases.shoppingai.AiTurnCancelledException;
import cn.bugstack.ai.infrastructure.gateway.AiGatewayService;
import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** 真实 JDK TCP 客户端/服务端；提取端为显式协议替身，真实 Uvicorn 另由 smoke-full 覆盖。 */
class AiGatewayProtocolTest {

    private static final String SERVICE_KEY = "test-only-shared-service-key-for-protocol";

    @Test
    void gatewayPostsCompatibleHttp11WithoutH2cUpgrade() throws Exception {
        var protocol = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/extract", exchange -> {
            protocol.set(exchange.getProtocol());
            byte[] body = exchange.getRequestBody().readAllBytes();
            boolean valid =
                exchange.getRequestHeaders().getFirst("Upgrade") == null &&
                SERVICE_KEY.equals(exchange.getRequestHeaders().getFirst("X-Service-Key")) &&
                new ObjectMapper().readTree(body).get("filename").asText().equals("rules.md");
            byte[] response = (valid ? "{\"text\":\"自提规则\"}" : "{\"detail\":\"unsupported upgrade\"}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(valid ? 200 : 400, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            assertEquals("自提规则", gateway(server).extract(new AiGatewayDTO.Extract("rules.md", "text/markdown", "eA==")));
            assertEquals("HTTP/1.1", protocol.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void invalidFileUsesUploadCodeWhileDependencyFailureUsesUnavailable() throws Exception {
        for (int status : new int[] { 400, 413, 415, 422, 500, 503 }) {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/v1/extract", exchange -> {
                exchange.getRequestBody().readAllBytes();
                byte[] response = "{\"detail\":\"private upstream details\"}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(status, response.length);
                exchange.getResponseBody().write(response);
                exchange.close();
            });
            server.start();
            try {
                var error = assertThrows(AppException.class, () -> gateway(server).extract(new AiGatewayDTO.Extract("invalid.exe", "", "eA==")));
                assertEquals(status < 500 ? "AI0004" : "AI0001", error.getCode());
                assertFalse(error.getInfo().contains("private"));
            } finally {
                server.stop(0);
            }
        }
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = { "null", "", " ", "{}", "{\"text\":null}", "{\"text\":\" \"}", "invalid-json" })
    void emptyOrMalformedSuccessfulExtractionIsUnavailable(String responseBody) throws Exception {
        assertExtractionUnavailable(responseBody);
    }

    @Test
    void oversizedExtractedTextIsUnavailable() throws Exception {
        assertExtractionUnavailable(new ObjectMapper().writeValueAsString(java.util.Map.of("text", "x".repeat(100001))));
    }

    private void assertExtractionUnavailable(String responseBody) throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/extract", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] response = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            var error = assertThrows(AppException.class, () -> gateway(server).extract(new AiGatewayDTO.Extract("rules.md", "text/markdown", "eA==")));
            assertEquals("AI0001", error.getCode());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void jsonNullIsRejectedAtSharedBoundaryForRecallAndQuery() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(200, 4);
            exchange.getResponseBody().write("null".getBytes(StandardCharsets.UTF_8));
            exchange.close();
        });
        server.start();
        try {
            var client = gateway(server);
            assertEquals("AI0001", assertThrows(AppException.class, () -> client.recall(null)).getCode());
            assertEquals("AI0001", assertThrows(AppException.class, () -> client.query(null)).getCode());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void queryStreamConsumesProgressAndOnlyReturnsCompletedJson() throws Exception {
        var progress = new AtomicLong();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/query/stream", exchange -> {
            exchange.getRequestBody().readAllBytes();
            assertEquals("text/event-stream", exchange.getRequestHeaders().getFirst("Accept"));
            String body =
                "event: started\n\n" +
                "event: progress\n" +
                "data: {\"bytes\":17}\n\n" +
                "event: completed\n" +
                "data: {\"answer\":\"ok\",\"mode\":\"LOCAL_FALLBACK\",\"retrievalMode\":\"NONE\",\"rewrittenQuery\":\"q\",\"warning\":null,\"citations\":[],\"recommendations\":[],\"latencyMs\":3}\n\n";
            byte[] response = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            AiGatewayDTO.Answer answer = gateway(server).queryStream(
                new AiGatewayDTO.Query("q", java.util.List.of(), java.util.List.of(), java.util.List.of(), "q", java.util.List.of(), java.util.List.of()),
                progress::set
            );
            assertEquals("ok", answer.answer());
            assertEquals(17, progress.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void queryStreamClosesTheResponseWhenProgressRequestsCancellation() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/query/stream", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] response = ("event: progress\n" + "data: {\"bytes\":1}\n\n").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            assertThrows(AiTurnCancelledException.class, () ->
                gateway(server).queryStream(
                    new AiGatewayDTO.Query("q", java.util.List.of(), java.util.List.of(), java.util.List.of(), "q", java.util.List.of(), java.util.List.of()),
                    bytes -> {
                        throw new AiTurnCancelledException();
                    }
                )
            );
        } finally {
            server.stop(0);
        }
    }

    @Test
    void abruptlyClosedStreamFailsImmediatelyInsteadOfWaitingForFullTimeout() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/query/stream", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] response = "event: started\ndata: {\"mode\":\"FULL_RESPONSE\"}\n\n".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            var client = gateway(server);
            ReflectionTestUtils.setField(client, "timeoutSeconds", 30);
            long started = System.nanoTime();
            var error = assertThrows(AppException.class, () ->
                client.queryStream(
                    new AiGatewayDTO.Query("q", java.util.List.of(), java.util.List.of(), java.util.List.of(), "q", java.util.List.of(), java.util.List.of()),
                    null
                )
            );
            long elapsedMs = (System.nanoTime() - started) / 1_000_000;
            assertEquals("AI0001", error.getCode());
            assertTrue(elapsedMs < 3000, "abrupt EOF should fail promptly, elapsedMs=" + elapsedMs);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void queryStreamReassemblesMultiByteChineseAndEmojiSplitAcrossChunkBoundaries() throws Exception {
        String expectedAnswer = "中餐夜宵：东湖便利无糖乌龙茶与豚骨拉面🍜";
        String ssePayload =
            "event: started\n" +
            "data: {\"mode\":\"FULL_RESPONSE\"}\n\n" +
            "event: progress\n" +
            "data: {\"bytes\":42}\n\n" +
            "event: completed\n" +
            "data: {\"answer\":\"" +
            expectedAnswer +
            "\",\"mode\":\"LLM\",\"retrievalMode\":\"LOCAL\",\"rewrittenQuery\":\"中餐夜宵\",\"warning\":null,\"citations\":[],\"recommendations\":[],\"latencyMs\":12}\n\n";
        byte[] raw = ssePayload.getBytes(StandardCharsets.UTF_8);

        // Locate the 3-byte UTF-8 sequence of '中' (0xE4 0xB8 0xAD) and split after its 2nd byte.
        int splitIndex = -1;
        for (int i = 0; i <= raw.length - 3; i++) {
            if ((raw[i] & 0xFF) == 0xE4 && (raw[i + 1] & 0xFF) == 0xB8 && (raw[i + 2] & 0xFF) == 0xAD) {
                splitIndex = i + 2;
                break;
            }
        }
        assertTrue(splitIndex > 0, "UTF-8 bytes of '中' must exist in payload");
        int twoByteSplit = splitIndex;

        for (boolean singleByteMode : new boolean[] { false, true }) {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/v1/query/stream", exchange -> {
                exchange.getRequestBody().readAllBytes();
                exchange.getResponseHeaders().set("Content-Type", "text/event-stream; charset=utf-8");
                exchange.sendResponseHeaders(200, 0);
                try (var out = exchange.getResponseBody()) {
                    if (singleByteMode) {
                        for (byte b : raw) {
                            out.write(b);
                            out.flush();
                        }
                    } else {
                        out.write(raw, 0, twoByteSplit);
                        out.flush();
                        try {
                            Thread.sleep(20);
                        } catch (InterruptedException ignored) {
                            Thread.currentThread().interrupt();
                        }
                        out.write(raw, twoByteSplit, raw.length - twoByteSplit);
                        out.flush();
                    }
                }
            });
            server.start();
            try {
                var seenProgress = new java.util.concurrent.atomic.AtomicLong(-1);
                var answer = gateway(server).queryStream(
                    new AiGatewayDTO.Query("q", java.util.List.of(), java.util.List.of(), java.util.List.of(), "q", java.util.List.of(), java.util.List.of()),
                    seenProgress::set
                );
                assertEquals(expectedAnswer, answer.answer());
                assertFalse(answer.answer().contains("\uFFFD"), "decoded answer must not contain replacement character");
                assertEquals(42L, seenProgress.get());
            } finally {
                server.stop(0);
            }
        }
    }

    private AiGatewayService gateway(HttpServer server) {
        var gateway = new AiGatewayService();
        ReflectionTestUtils.setField(
            gateway,
            "resources",
            new cn.bugstack.ai.infrastructure.adapter.repository.AiResourceRepository(
                new org.springframework.beans.factory.support.DefaultListableBeanFactory().getBeanProvider(
                    cn.bugstack.ai.infrastructure.redis.RedisClients.class
                ),
                4
            )
        );
        ReflectionTestUtils.setField(gateway, "url", "http://127.0.0.1:" + server.getAddress().getPort());
        ReflectionTestUtils.setField(gateway, "key", SERVICE_KEY);
        ReflectionTestUtils.setField(gateway, "mapper", new ObjectMapper());
        return gateway;
    }
}
