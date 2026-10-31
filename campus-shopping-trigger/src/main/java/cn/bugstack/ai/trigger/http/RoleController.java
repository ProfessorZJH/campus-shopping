package cn.bugstack.ai.trigger.http;

import static cn.bugstack.ai.trigger.http.RequestInputs.*;

import cn.bugstack.ai.api.IRoleApi;
import cn.bugstack.ai.api.dto.PermissionResponseDTO;
import cn.bugstack.ai.api.dto.RoleAssignmentRequestDTO;
import cn.bugstack.ai.api.dto.RoleRequestDTO;
import cn.bugstack.ai.api.dto.RoleResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.domain.identity.model.valobj.MerchantPermissions;
import cn.bugstack.ai.domain.identity.model.valobj.MerchantRoleVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.security.Principal;
import java.util.*;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/** 自定义角色管理入口：请求不能传任意 permissions 之外的权限事实。 */
@Slf4j
@RestController
@RequestMapping("/api/v1/merchants/{merchantId}/rbac")
public class RoleController implements IRoleApi {

  @Resource
  private IAccessService access;

  @Override
  @GetMapping("/permissions")
  public Response<List<PermissionResponseDTO>> permissions(
    @PathVariable("merchantId") String merchantId,
    Principal principal
  ) {
    return exec(() -> {
      access.requirePermission(actor(principal), merchantId, MerchantPermissions.ROLE_MANAGE);
      return MerchantPermissions.LABELS.entrySet()
        .stream()
        .sorted(Map.Entry.comparingByKey())
        .map(e ->
          PermissionResponseDTO.builder()
            .code(e.getKey())
            .label(e.getValue())
            .grantable(MerchantPermissions.isGrantable(e.getKey()))
            .build()
        )
        .toList();
    });
  }

  @Override
  @GetMapping("/roles")
  public Response<List<RoleResponseDTO>> roles(
    @PathVariable("merchantId") String merchantId,
    Principal principal
  ) {
    return exec(() -> access.roles(actor(principal), merchantId).stream().map(this::view).toList());
  }

  @Override
  @PostMapping("/roles")
  public Response<RoleResponseDTO> createRole(
    @PathVariable("merchantId") String merchantId,
    @RequestBody RoleRequestDTO request,
    Principal principal
  ) {
    return exec(() ->
      view(
        access.saveRole(
          actor(principal),
          merchantId,
          null,
          required(request).getName(),
          request.getPermissions()
        )
      )
    );
  }

  @Override
  @PutMapping("/roles/{code}")
  public Response<RoleResponseDTO> updateRole(
    @PathVariable("merchantId") String merchantId,
    @PathVariable("code") String code,
    @RequestBody RoleRequestDTO request,
    Principal principal
  ) {
    return exec(() ->
      view(
        access.saveRole(
          actor(principal),
          merchantId,
          code,
          required(request).getName(),
          request.getPermissions()
        )
      )
    );
  }

  @Override
  @DeleteMapping("/roles/{code}")
  public Response<Void> deleteRole(
    @PathVariable("merchantId") String merchantId,
    @PathVariable("code") String code,
    Principal principal
  ) {
    return exec(() -> {
      access.deleteRole(actor(principal), merchantId, code);
      return null;
    });
  }

  @Override
  @PutMapping("/members/{userId}/role")
  public Response<Void> assign(
    @PathVariable("merchantId") String merchantId,
    @PathVariable("userId") String userId,
    @RequestBody RoleAssignmentRequestDTO request,
    Principal principal
  ) {
    return exec(() -> {
      access.assignRole(
        actor(principal),
        merchantId,
        userId,
        required(required(request).getRoleCode())
      );
      return null;
    });
  }

  private RoleResponseDTO view(MerchantRoleVO role) {
    return RoleResponseDTO.builder()
      .code(role.code())
      .name(role.name())
      .permissions(role.permissions())
      .builtin(role.builtin())
      .build();
  }

  private <T> Response<T> exec(Supplier<T> job) {
    try {
      return ApiResponses.success(job.get());
    } catch (AppException e) {
      ControllerFailures.record(log, e);
      return ApiResponses.rejected(e);
    } catch (Exception e) {
      ControllerFailures.unexpected(log, e);
      return ApiResponses.unexpected();
    }
  }
}
