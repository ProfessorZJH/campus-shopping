package cn.bugstack.ai.infrastructure.gateway;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** 内部请求签名；原始 capability 只参与调用，不进入日志或持久化。 */
public final class AgentRuntimeSignature {

    private AgentRuntimeSignature() {}

    public static String canonical(String runId, String requestId, double turnExpiresAt) {
        return runId + "|" + requestId + "|" + String.format(java.util.Locale.ROOT, "%.6f", turnExpiresAt);
    }

    public static String hmacSha256(String serviceKey, String runId, String requestId, double turnExpiresAt) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(serviceKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(canonical(runId, requestId, turnExpiresAt).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("runtime signature unavailable", error);
        }
    }

    public static boolean constantTimeEquals(String expected, String actual) {
        return expected != null && actual != null && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }
}
