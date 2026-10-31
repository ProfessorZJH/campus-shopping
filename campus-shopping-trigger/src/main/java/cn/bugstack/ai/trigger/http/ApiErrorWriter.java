package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;

/** 协议层只返回固定安全提示，不回显原始正文、解析器异常或数据库细节。 */
public final class ApiErrorWriter {

  private ApiErrorWriter() {}

  public static void write(
    ObjectMapper mapper,
    HttpServletResponse response,
    int status,
    ResponseCode code
  ) throws IOException {
    response.setStatus(status);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    mapper.writeValue(
      response.getWriter(),
      Response.<Void>builder().code(code.getCode()).info(code.getInfo()).build()
    );
  }
}
