package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.types.common.FailureDiagnostics;
import cn.bugstack.ai.types.exception.AppException;
import org.slf4j.Logger;

/** Controller 保留显式捕获；统一诊断策略，业务提示与内部异常原因分开。 */
final class ControllerFailures {

  private ControllerFailures() {}

  static void record(Logger log, AppException failure) {
    if (failure.isOperationalFailure()) log.error(
      "请求依赖或系统失败 code={} diagnostic={}",
      failure.getCode(),
      FailureDiagnostics.describe(failure)
    );
    else log.warn("业务请求拒绝 code={}", failure.getCode());
  }

  static void unexpected(Logger log, Exception failure) {
    log.error("接口执行异常 diagnostic={}", FailureDiagnostics.describe(failure));
  }
}
