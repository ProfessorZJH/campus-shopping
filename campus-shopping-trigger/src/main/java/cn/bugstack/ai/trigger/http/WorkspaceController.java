package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;
import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.api.IWorkspaceApi;
import cn.bugstack.ai.api.dto.InvitationRequestDTO;
import cn.bugstack.ai.api.dto.InvitationResponseDTO;
import cn.bugstack.ai.api.dto.MembershipResponseDTO;
import cn.bugstack.ai.api.dto.WorkspaceResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class WorkspaceController implements IWorkspaceApi {

  @Resource
  private IAccessService access;

  @Resource
  private IMerchantService merchants;

  /** 返回当前工作台角色和商户范围。 */
  @Override
  @GetMapping("/workspace")
  public Response<WorkspaceResponseDTO> workspace(Principal principal) {
    return execute(() -> {
      String user = actor(principal);
      var memberships = access.memberships(user);
      return WorkspaceResponseDTO.builder()
        .platformAdmin(access.isAdmin(user))
        .merchantPermissions(
          memberships
            .stream()
            .collect(
              Collectors.toMap(m -> m.merchantId(), m -> access.permissions(user, m.merchantId()))
            )
        )
        .memberships(memberships.stream().map(ApiViews::membership).toList())
        .merchants(
          memberships
            .stream()
            .map(m -> ApiViews.merchant(merchants.find(m.merchantId())))
            .toList()
        )
        .build();
    });
  }

  /** Owner 查询本商户成员。 */
  @Override
  @GetMapping("/merchants/{merchantId}/members")
  public Response<List<MembershipResponseDTO>> members(
    @PathVariable("merchantId") String merchantId,
    Principal principal
  ) {
    return execute(() -> {
      return access
        .members(actor(principal), merchantId)
        .stream()
        .map(ApiViews::membership)
        .toList();
    });
  }

  /** 邀请已注册账号成为店员。 */
  @Override
  @PostMapping("/merchants/{merchantId}/invitations")
  public Response<InvitationResponseDTO> invite(
    @PathVariable("merchantId") String merchantId,
    @RequestBody InvitationRequestDTO request,
    Principal principal
  ) {
    return execute(() -> {
      return ApiViews.invitation(
        access.invite(actor(principal), merchantId, required(request).getUsername())
      );
    });
  }

  /** 查看本人收到的邀请。 */
  @Override
  @GetMapping("/invitations")
  public Response<List<InvitationResponseDTO>> invitations(Principal principal) {
    return execute(() -> {
      return access.invitations(actor(principal)).stream().map(ApiViews::invitation).toList();
    });
  }

  /** 接受本人邀请。 */
  @Override
  @PostMapping("/invitations/{id}/accept")
  public Response<Void> accept(@PathVariable("id") String id, Principal principal) {
    return execute(() -> {
      access.accept(actor(principal), id);
      return null;
    });
  }

  /** 撤销本商户店员，后续请求立即复权。 */
  @Override
  @DeleteMapping("/merchants/{merchantId}/members/{userId}")
  public Response<Void> revoke(
    @PathVariable("merchantId") String merchantId,
    @PathVariable("userId") String userId,
    Principal principal
  ) {
    return execute(() -> {
      access.revoke(actor(principal), merchantId, userId);
      return null;
    });
  }

  private <T> Response<T> execute(Supplier<T> action) {
    try {
      return ApiResponses.success(action.get());
    } catch (AppException e) {
      ControllerFailures.record(log, e);
      return ApiResponses.rejected(e);
    } catch (Exception e) {
      ControllerFailures.unexpected(log, e);
      return ApiResponses.unexpected();
    }
  }
}
