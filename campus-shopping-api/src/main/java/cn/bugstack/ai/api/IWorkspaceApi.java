package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 WorkspaceController 实现。 */
public interface IWorkspaceApi {
  /** 返回当前工作台角色和商户范围。 */
  Response<WorkspaceResponseDTO> workspace(Principal principal);
  /** Owner 查询本商户成员。 */
  Response<List<MembershipResponseDTO>> members(String merchantId, Principal principal);
  /** 邀请已注册账号成为店员。 */
  Response<InvitationResponseDTO> invite(
    String merchantId,
    InvitationRequestDTO request,
    Principal principal
  );
  /** 查看本人收到的邀请。 */
  Response<List<InvitationResponseDTO>> invitations(Principal principal);
  /** 接受本人邀请。 */
  Response<Void> accept(String id, Principal principal);
  /** 撤销本商户店员，后续请求立即复权。 */
  Response<Void> revoke(String merchantId, String userId, Principal principal);
}
