package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.infrastructure.config.ProductImageStorageProperties;
import cn.bugstack.ai.infrastructure.gateway.QiniuObjectGateway;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qiniu.storage.Configuration;
import com.qiniu.storage.Region;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

/**
 * 七牛 SDK 7.19.0 的真实 HTTP 协议测试：SDK 通过真实 TCP 连接本机 Node stub，不访问任何外网或真实上传域名。
 * 测试不输出 token、签名或响应正文；stub 仅为真实协议的本地对端，不替代 SDK。
 */
@ExtendWith(OutputCaptureExtension.class)
class QiniuObjectGatewayProtocolTest {

    @TempDir
    Path tempDir;

    private final ObjectMapper mapper = new ObjectMapper();
    private Process node;
    private Path replyFile;
    private Path bodyFile;
    private Path stderrFile;
    private QiniuObjectGateway gateway;
    private String objectKey;

    @BeforeEach
    void startStub() throws Exception {
        Path script = tempDir.resolve("qiniu-http-stub.mjs");
        try (var resource = getClass().getResourceAsStream("/qiniu-http-stub.mjs")) {
            Files.copy(resource, script, StandardCopyOption.REPLACE_EXISTING);
        }
        replyFile = tempDir.resolve("reply.json");
        bodyFile = tempDir.resolve("request-body.bin");
        Path stderrFile = tempDir.resolve("stub-stderr.log");
        this.stderrFile = stderrFile;
        Files.writeString(replyFile, mapper.writeValueAsString(Map.of("status", 500, "body", "")), StandardCharsets.UTF_8);
        node = new ProcessBuilder("node", script.toString(), replyFile.toString(), bodyFile.toString()).redirectError(stderrFile.toFile()).start();
        int port = awaitPort();
        gateway = new QiniuObjectGateway(props(), Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC), configuration(port));
        objectKey = "qiniu/" + UUID.randomUUID() + ".png";
    }

    @AfterEach
    void stopStub() throws Exception {
        if (node == null) return;
        node.destroy();
        if (!node.waitFor(5, TimeUnit.SECONDS)) {
            node.destroyForcibly();
            node.waitFor(5, TimeUnit.SECONDS);
        }
        // Windows 上 Node 的 stderr 重定向句柄可能晚于进程退出才释放；有限重试删除，避免干扰 @TempDir 清理。
        for (int attempt = 0; attempt < 50; attempt++) {
            try {
                Files.deleteIfExists(stderrFile);
                return;
            } catch (java.io.IOException retry) {
                Thread.sleep(100);
            }
        }
    }

    @Test
    void uploadsRealMultipartPngWithObjectKeyAndMime(CapturedOutput output) throws Exception {
        byte[] png = png();
        String key = objectKey;
        reply(200, "{\"key\":\"" + key + "\",\"hash\":\"FakeHash_123\"}");

        assertEquals(key, gateway.upload(png, key));

        String body = new String(capturedBody(), StandardCharsets.ISO_8859_1);
        assertTrue(body.contains("name=\"key\""), "multipart 必须携带 key 字段");
        assertTrue(body.contains(key), "对象 key 必须与请求一致");
        assertTrue(body.contains("Content-Type: image/png"), "图片部分必须声明 image/png");
        assertTrue(body.contains(new String(png, StandardCharsets.ISO_8859_1)), "必须上传完整 PNG 字节");

        // 上传凭证只能授权到确切 object_key，且必须携带真实 PNG 的 CRC32。
        String token = formField(body, "token");
        assertFalse(token.isBlank(), "multipart 必须携带上传凭证");
        Map<String, Object> policy = uploadPolicy(token);
        assertEquals("fake-bucket:" + key, policy.get("scope"), "凭证 scope 必须限定到确切 object key");
        CRC32 crc = new CRC32();
        crc.update(png);
        assertEquals(String.valueOf(crc.getValue()), formField(body, "crc32").trim(), "crc32 必须等于实际 PNG 的 CRC32");
        // 凭证本身不得被打印到测试输出。
        assertFalse(output.getAll().contains(token), "日志不得输出上传凭证");
    }

    @Test
    void everyNonConformingReceiptBecomesSanitizedFailure(CapturedOutput output) throws Exception {
        byte[] png = png();
        String key = objectKey;
        String secret = "fake-downstream-secret";
        Reply[] cases = {
            new Reply(200, ""),
            new Reply(200, "{not-json"),
            // 畸形 JSON 把哨兵作为字段名，确保解析失败路径也不会把内容写进日志。
            new Reply(200, "{\"" + secret + "\":\"value\""),
            new Reply(200, "{\"key\":\"qiniu/" + UUID.randomUUID() + ".png\",\"hash\":\"h\"}"),
            new Reply(200, "{\"key\":\"" + key + "\",\"hash\":\"\"}"),
            new Reply(500, "{\"error\":\"" + secret + "\"}"),
        };
        for (Reply item : cases) {
            reply(item.status, item.body);
            AppException failure = assertThrows(AppException.class, () -> gateway.upload(png, key), "status=" + item.status);
            assertEquals(ResponseCode.UN_ERROR.getCode(), failure.getCode());
            assertFalse(String.valueOf(failure.getMessage()).contains(secret), "异常不得携带下游正文");
            assertFalse(String.valueOf(failure.getMessage()).contains("FakeHash"), "异常不得携带回执内容");
            assertNull(failure.getCause(), "脱敏业务异常不得挂下游异常作 cause");
        }
        String logs = output.getAll();
        assertFalse(logs.contains(secret), "日志不得输出下游响应正文");
        assertFalse(logs.contains("fake-access-key"), "日志不得输出 access key");
        assertFalse(logs.contains("fake-secret-key"), "日志不得输出 secret key");
        // 本次修复的目标：SDK 同步解析器输出的异常栈（com.qiniu 帧）不得再出现；允许 JsonSyntaxException 类型名。
        assertFalse(logs.contains("at com.qiniu"), "日志不得包含 SDK 解析异常栈帧");
        assertFalse(logs.contains("printStackTrace"), "日志不得出现 printStackTrace 痕迹");
    }

    private void reply(int status, String body) throws Exception {
        Files.writeString(replyFile, mapper.writeValueAsString(Map.of("status", status, "body", body)), StandardCharsets.UTF_8);
    }

    /** 从 multipart 正文取普通表单字段值；按分隔头与空行定位，不依赖换行风格。 */
    private static String formField(String body, String name) {
        int marker = body.indexOf("name=\"" + name + "\"");
        assertTrue(marker >= 0, "multipart 必须携带字段：" + name);
        int headerEnd = body.indexOf("\r\n\r\n", marker);
        assertTrue(headerEnd > marker, "字段必须带完整头部：" + name);
        int start = headerEnd + 4;
        int end = body.indexOf("\r\n--", start);
        assertTrue(end > start, "字段值必须被分隔符终止：" + name);
        return body.substring(start, end).trim();
    }

    /** 上传凭证为 ak:encodedSign:encodedPolicy，此处只解出最后一段 policy 做 scope 断言。 */
    private Map<String, Object> uploadPolicy(String token) throws Exception {
        String[] parts = token.split(":");
        assertEquals(3, parts.length, "上传凭证应为三段式");
        byte[] policy = Base64.getUrlDecoder().decode(parts[2]);
        assertTrue(policy.length > 0 && policy[0] == '{', "凭证末段必须是 policy JSON");
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = mapper.readValue(policy, Map.class);
        return parsed;
    }

    private byte[] capturedBody() throws Exception {
        return Files.readAllBytes(bodyFile);
    }

    /** stub 只把监听端口写到 stdout，5 秒内读不到即视为启动失败。 */
    private int awaitPort() throws Exception {
        var port = new ArrayBlockingQueue<String>(1);
        Thread reader = new Thread(() -> {
            try (var in = node.getInputStream(); var lines = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line = lines.readLine();
                if (line != null) port.offer(line);
            } catch (Exception ignored) {
                // stderr 已重定向到临时文件，不在此输出任何内容。
            }
        });
        reader.setDaemon(true);
        reader.start();
        String line = port.poll(5, TimeUnit.SECONDS);
        assertNotNull(line, "Node stub 未在 5 秒内输出监听端口");
        return Integer.parseInt(line.trim());
    }

    private static Configuration configuration(int port) {
        Region region = new Region.Builder().srcUpHost("http://127.0.0.1:" + port).build();
        Configuration configuration = Configuration.create(region);
        configuration.useHttpsDomains = false; // 仅测试：stub 是明文 HTTP
        configuration.accUpHostFirst = false;
        configuration.useDefaultUpHostIfNone = false;
        configuration.retryMax = 0;
        configuration.connectTimeout = 1;
        configuration.readTimeout = 2;
        configuration.writeTimeout = 2;
        return configuration;
    }

    private static ProductImageStorageProperties props() {
        ProductImageStorageProperties props = new ProductImageStorageProperties();
        props.setProvider("QINIU");
        ProductImageStorageProperties.Qiniu qiniu = props.getQiniu();
        qiniu.setAccessKey("fake-access-key");
        qiniu.setSecretKey("fake-secret-key");
        qiniu.setBucket("fake-bucket");
        qiniu.setDownloadDomain("cdn.example.com");
        // 测试使用固定区域：不触发 SDK 的 autoRegion 网络发现。
        qiniu.setRegion("z0");
        return props;
    }

    private byte[] png() throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }

    private record Reply(int status, String body) {}
}
