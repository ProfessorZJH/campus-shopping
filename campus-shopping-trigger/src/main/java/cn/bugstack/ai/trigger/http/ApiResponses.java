package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 仅统一信封构造，业务异常仍由各 Controller 显式捕获。 */
final class ApiResponses {

  private ApiResponses() {}

  static <T> Response<T> success(T value) {
    return Response.<T>builder()
      .code(ResponseCode.SUCCESS.getCode())
      .info(ResponseCode.SUCCESS.getInfo())
      .data(value)
      .build();
  }

  static <T> Response<T> rejected(AppException failure) {
    return Response.<T>builder().code(failure.getCode()).info(failure.getInfo()).data(null).build();
  }

  static <T> Response<T> unexpected() {
    return Response.<T>builder()
      .code(ResponseCode.UN_ERROR.getCode())
      .info(ResponseCode.UN_ERROR.getInfo())
      .data(null)
      .build();
  }
}
