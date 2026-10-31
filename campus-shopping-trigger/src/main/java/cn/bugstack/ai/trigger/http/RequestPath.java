package cn.bugstack.ai.trigger.http;

import jakarta.servlet.http.HttpServletRequest;

/** 配额路径统一去掉部署前缀，不能依赖外部代理传入的路径头。 */
final class RequestPath {

    private RequestPath() {}

    static String applicationPath(HttpServletRequest request) {
        return request.getRequestURI().substring(request.getContextPath().length());
    }
}
