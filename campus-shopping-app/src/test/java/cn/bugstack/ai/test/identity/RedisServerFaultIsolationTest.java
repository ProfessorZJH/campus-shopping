package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.infrastructure.adapter.repository.RequestQuotaRepository;
import cn.bugstack.ai.infrastructure.redis.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;

/** 本类独占启动的 Redis 子进程；绝不对外部配置地址发送关闭命令。 */
@EnabledIfEnvironmentVariable(named = "REDIS_TEST_SERVER_COMMAND", matches = ".+")
class RedisServerFaultIsolationTest {

    @Test
    void cacheServerOutageDoesNotBreakSecurityQuota() throws Exception {
        outage(true);
    }

    @Test
    void securityServerOutageDoesNotBreakDisplayCache() throws Exception {
        outage(false);
    }

    private void outage(boolean stopCache) throws Exception {
        try (
            var security = new TestServer();
            var display = new TestServer();
            var clients = new RedisClients(
                RedisInfrastructureConfig.client(security.address(), "", ""),
                RedisInfrastructureConfig.client(display.address(), "", ""),
                "cs:test:fault:" + UUID.randomUUID()
            )
        ) {
            var beans = new DefaultListableBeanFactory();
            beans.registerSingleton("clients", clients);
            var provider = beans.getBeanProvider(RedisClients.class);
            var quota = new RequestQuotaRepository(provider);
            var cache = new DisplayCache(provider, new ObjectMapper());
            var type = new TypeReference<String>() {};
            assertEquals(0, quota.acquire("isolation", "source", 2, 60));
            assertEquals("cached", cache.read("item", 10, type, () -> "cached"));
            (stopCache ? display : security).close();
            if (stopCache) {
                assertEquals("database", cache.read("item", 10, type, () -> "database"));
                assertTrue(cache.failures() > 0);
                assertEquals(0, quota.acquire("isolation", "source", 2, 60));
                assertTrue(quota.acquire("isolation", "source", 2, 60) > 0);
            } else {
                assertThrows(RuntimeException.class, () -> quota.acquire("isolation", "source", 2, 60));
                assertEquals("cached", cache.read("item", 10, type, () -> "database"));
            }
        }
    }

    private static class TestServer implements AutoCloseable {

        final int port;
        final Process process;
        boolean closed;

        TestServer() throws Exception {
            try (var socket = new java.net.ServerSocket(0)) {
                port = socket.getLocalPort();
            }
            List<String> command = new ArrayList<>(
                new ObjectMapper().readValue(System.getenv("REDIS_TEST_SERVER_COMMAND"), new TypeReference<List<String>>() {})
            );
            command.addAll(List.of("--bind", "127.0.0.1", "--port", Integer.toString(port), "--save", "", "--appendonly", "no"));
            process = new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.DISCARD).start();
            try {
                boolean ready = false;
                for (int i = 0; i < 100; i++) {
                    try (var socket = new Socket("127.0.0.1", port)) {
                        ready = true;
                        break;
                    } catch (java.io.IOException ignored) {
                        Thread.sleep(100);
                    }
                }
                assertTrue(ready, "isolated Redis child must start");
            } catch (Throwable error) {
                process.destroyForcibly();
                throw error;
            }
        }

        String address() {
            return "redis://127.0.0.1:" + port;
        }

        @Override
        public void close() throws Exception {
            if (closed) return;
            closed = true;
            try (var socket = new Socket("127.0.0.1", port)) {
                socket.getOutputStream().write("*2\r\n$8\r\nSHUTDOWN\r\n$6\r\nNOSAVE\r\n".getBytes(StandardCharsets.US_ASCII));
                socket.setSoTimeout(3000);
                // Linux 下 SHUTDOWN 后是干净 EOF；Windows 可能直接 RST。两者都表示服务已停止，
                // 下面仍要求子进程在 5 秒内真实退出，避免把“没关掉”误判为成功。
                try {
                    assertEquals(-1, socket.getInputStream().read());
                } catch (java.net.SocketException reset) {
                    assertTrue(process.waitFor(1, java.util.concurrent.TimeUnit.SECONDS), "Redis 子进程未在关闭后退出");
                }
            } finally {
                if (!process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS)) process.destroyForcibly();
            }
        }
    }
}
