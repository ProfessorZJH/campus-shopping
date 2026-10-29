package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.infrastructure.gateway.AiGatewayService;
import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** 真实本机 HTTP 契约：Python 禁用、数量不匹配或无效响应不能被 Java 当成索引成功。 */
class AiGatewayProductIndexTest {

    private HttpServer server;
    private final AtomicReference<String> body = new AtomicReference<>("{\"indexed\":1,\"unchanged\":1,\"mode\":\"MILVUS\"}");
    private final AtomicInteger status = new AtomicInteger(200);
    private AiGatewayService gateway;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/products/", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] response = body.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status.get(), response.length);
            try (var stream = exchange.getResponseBody()) {
                stream.write(response);
            }
        });
        server.start();

        gateway = new AiGatewayService();
        ReflectionTestUtils.setField(gateway, "url", "http://127.0.0.1:" + server.getAddress().getPort());
        ReflectionTestUtils.setField(gateway, "key", "local-test-only-service-key-123456");
        ReflectionTestUtils.setField(gateway, "mapper", new ObjectMapper());
    }

    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    private AiGatewayDTO.ProductIndexRequest request() {
        return new AiGatewayDTO.ProductIndexRequest(
            List.of(
                new AiGatewayDTO.ProductIndex("p1", "m1", "无糖茶", "", "drinks", List.of("500ml")),
                new AiGatewayDTO.ProductIndex("p2", "m2", "饼干", "", "snacks", List.of("盒装"))
            )
        );
    }

    private void unavailable() {
        AppException error = assertThrows(AppException.class, () -> gateway.indexProducts(request()));
        assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), error.getCode());
    }

    @Test
    void acceptsRealIndexedAndUnchangedCounts() {
        assertDoesNotThrow(() -> gateway.indexProducts(request()));
        body.set("{\"indexed\":0,\"unchanged\":2,\"mode\":\"MILVUS\"}");
        assertDoesNotThrow(() -> gateway.indexProducts(request()));
    }

    @Test
    void disabledBackendMustNotPretendToIndex() {
        body.set("{\"indexed\":0,\"unchanged\":0,\"mode\":\"DISABLED\"}");
        unavailable();
    }

    @Test
    void incompleteOrMalformedResultMustFailClosed() {
        for (String invalid : List.of(
            "{\"indexed\":1,\"unchanged\":0,\"mode\":\"MILVUS\"}",
            "{\"indexed\":-1,\"unchanged\":3,\"mode\":\"MILVUS\"}",
            "{\"indexed\":2,\"unchanged\":1,\"mode\":\"MILVUS\"}",
            "{\"indexed\":2,\"unchanged\":0,\"mode\":\"UNKNOWN\"}",
            "{}"
        )) {
            body.set(invalid);
            unavailable();
        }
    }

    @Test
    void downstreamHttpFailureMustNotBeCountedAsSuccess() {
        status.set(503);
        body.set("{\"detail\":\"backend unavailable\"}");
        unavailable();
    }

    @Test
    void deletionAcceptsAbsentIndexAndIdempotentResults() {
        var request = new AiGatewayDTO.ProductDeleteRequest(List.of("p1", "p2"));
        for (String response : List.of(
            "{\"deleted\":0,\"mode\":\"EMPTY_INDEX\"}",
            "{\"deleted\":0,\"mode\":\"MILVUS\"}",
            "{\"deleted\":2,\"mode\":\"MILVUS\"}"
        )) {
            body.set(response);
            assertDoesNotThrow(() -> gateway.deleteProducts(request));
        }
    }

    @Test
    void deletionRejectsDisabledAndMalformedResults() {
        var request = new AiGatewayDTO.ProductDeleteRequest(List.of("p1", "p2"));
        for (String response : List.of(
            "null",
            "{}",
            "{\"deleted\":0,\"mode\":\"DISABLED\"}",
            "{\"deleted\":-1,\"mode\":\"MILVUS\"}",
            "{\"deleted\":3,\"mode\":\"MILVUS\"}",
            "{\"deleted\":1,\"mode\":\"EMPTY_INDEX\"}"
        )) {
            body.set(response);
            assertEquals(ResponseCode.AI_UNAVAILABLE.getCode(), assertThrows(AppException.class, () -> gateway.deleteProducts(request)).getCode());
        }
    }
}
