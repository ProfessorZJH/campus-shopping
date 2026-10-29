package cn.bugstack.ai.api;
import cn.bugstack.ai.api.dto.*;import cn.bugstack.ai.api.response.Response;import java.security.Principal;import java.util.*;
/** 角色管理纵切接口契约，当前账号和商户由服务端复权。 */
public interface IRoleApi {
 Response<List<PermissionResponseDTO>> permissions(String merchantId,Principal principal);
 Response<List<RoleResponseDTO>> roles(String merchantId,Principal principal);
 Response<RoleResponseDTO> createRole(String merchantId,RoleRequestDTO request,Principal principal);
 Response<RoleResponseDTO> updateRole(String merchantId,String code,RoleRequestDTO request,Principal principal);
 Response<Void> deleteRole(String merchantId,String code,Principal principal);
 Response<Void> assign(String merchantId,String userId,RoleAssignmentRequestDTO request,Principal principal);
}
