package cn.bugstack.ai.types.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** 长度前缀编码避免分隔符碰撞；只用于请求指纹和随机令牌摘要，不用于密码。 */
public final class Fingerprints {

  private Fingerprints() {}

  public static String sha256(String value) {
    try {
      return HexFormat.of().formatHex(
        MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))
      );
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("运行时缺少 SHA-256", e);
    }
  }

  public static String of(Object... values) {
    StringBuilder b = new StringBuilder();
    for (Object v : values) {
      String s = String.valueOf(v);
      b.append(s.length()).append(':').append(s);
    }
    return sha256(b.toString());
  }
}
