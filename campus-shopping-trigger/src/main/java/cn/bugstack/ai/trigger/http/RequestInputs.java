package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.security.Principal;
import java.util.Base64;

/** HTTP 输入的机械边界处理；身份不能由请求体指定。 */
final class RequestInputs {

  private RequestInputs() {}

  static String actor(Principal p) {
    require(p != null && p.getName() != null, ResponseCode.AUTH_UNAUTHENTICATED);
    return p.getName();
  }

  static <T> T required(T v) {
    require(v != null, ResponseCode.ILLEGAL_PARAMETER);
    return v;
  }

  static byte[] file(String encoded) {
    require(encoded != null && encoded.length() <= 2800000, ResponseCode.UPLOAD_INVALID);
    try {
      byte[] bytes = Base64.getDecoder().decode(encoded);
      require(bytes.length > 0 && bytes.length <= 2000000, ResponseCode.UPLOAD_INVALID);
      return bytes;
    } catch (IllegalArgumentException e) {
      throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.UPLOAD_INVALID);
    }
  }
}
