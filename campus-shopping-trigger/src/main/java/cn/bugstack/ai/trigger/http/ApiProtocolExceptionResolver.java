package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.types.enums.ResponseCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.TypeMismatchException;
import org.springframework.core.Ordered;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.stereotype.Component;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.handler.AbstractHandlerExceptionResolver;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 仅适配 /api 下的 MVC 协议错误；不接管 AppException 或业务运行异常。
 * 业务异常仍由各 Controller 内部捕获，身份/CSRF 仍由 Security 处理。
 */
@Component
public class ApiProtocolExceptionResolver extends AbstractHandlerExceptionResolver {

  private final ObjectMapper mapper;

  public ApiProtocolExceptionResolver(ObjectMapper mapper) {
    this.mapper = mapper;
    setOrder(Ordered.HIGHEST_PRECEDENCE);
  }

  @Override
  protected ModelAndView doResolveException(
    HttpServletRequest request,
    HttpServletResponse response,
    Object handler,
    Exception exception
  ) {
    if (
      !request.getRequestURI().startsWith(request.getContextPath() + "/api/") ||
      response.isCommitted()
    ) return null;
    int status;
    ResponseCode code;
    if (RequestBodyLimitFilter.isTooLarge(exception)) {
      status = 413;
      code = ResponseCode.REQUEST_TOO_LARGE;
    } else if (
      exception instanceof HttpMessageNotReadableException ||
      exception instanceof TypeMismatchException ||
      exception instanceof ServletRequestBindingException
    ) {
      status = 400;
      code = ResponseCode.ILLEGAL_PARAMETER;
    } else if (exception instanceof HttpRequestMethodNotSupportedException method) {
      status = 405;
      code = ResponseCode.METHOD_NOT_ALLOWED;
      if (method.getSupportedMethods() != null) response.setHeader(
        "Allow",
        String.join(", ", method.getSupportedMethods())
      );
    } else if (exception instanceof HttpMediaTypeNotSupportedException) {
      status = 415;
      code = ResponseCode.MEDIA_TYPE_UNSUPPORTED;
    } else if (exception instanceof HttpMediaTypeNotAcceptableException) {
      status = 406;
      code = ResponseCode.MEDIA_TYPE_NOT_ACCEPTABLE;
    } else if (
      exception instanceof NoResourceFoundException || exception instanceof NoHandlerFoundException
    ) {
      status = 404;
      code = ResponseCode.NOT_FOUND;
    } else {
      return null;
    }
    try {
      ApiErrorWriter.write(mapper, response, status, code);
      return new ModelAndView();
    } catch (IOException writeFailure) {
      // 客户端已断开时让容器完成处理，不将异常内容写入响应。
      return null;
    }
  }
}
