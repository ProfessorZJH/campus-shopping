package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;

/** 身份认证对外契约；HTTP 路由和会话适配由 Trigger 实现。 */
public interface IAuthApi {
    /** 注册普通账号，不自动登录或授予管理员权限。 */
    Response<RegisterResponseDTO> register(RegisterRequestDTO request);
    /** 校验数据库凭据后建立服务端会话。 */
    Response<CurrentUserResponseDTO> login(LoginRequestDTO request);
    /** 仅查询当前认证主体，不接受前端指定 userId。 */
    Response<CurrentUserResponseDTO> me(Principal principal);
    /** 销毁会话并清理认证信息。 */
    Response<Void> logout();
    /** 初次访问、登录后、退出后均需重新获取令牌。 */
    Response<CsrfTokenResponseDTO> csrf();
}
