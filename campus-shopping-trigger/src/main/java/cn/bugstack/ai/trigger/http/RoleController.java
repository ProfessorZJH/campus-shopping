package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.IRoleApi;import cn.bugstack.ai.api.dto.*;import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IRoleService;
import cn.bugstack.ai.domain.identity.model.valobj.*;
import cn.bugstack.ai.types.enums.ResponseCode;import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;import lombok.extern.slf4j.Slf4j;import org.springframework.web.bind.annotation.*;
import java.security.Principal;import java.util.*;import java.util.function.Supplier;
import static cn.bugstack.ai.trigger.http.RequestInputs.*;
/** 自定义角色管理入口：请求不能传任意 permissions 之外的权限事实。 */
@Slf4j @RestController @RequestMapping("/api/v1/merchants/{merchantId}/rbac")
public class RoleController implements IRoleApi {
 @Resource private IAccessService access;
 @Resource private IRoleService roleService;
 @Override @GetMapping("/permissions")
 public Response<List<PermissionResponseDTO>> permissions(@PathVariable("merchantId") String merchantId,Principal principal){return exec(()->{
  access.requirePermission(actor(principal),merchantId,MerchantPermissions.ROLE_MANAGE);
  return MerchantPermissions.LABELS.entrySet().stream().sorted(Map.Entry.comparingByKey())
   .map(e->PermissionResponseDTO.builder().code(e.getKey()).label(e.getValue()).grantable(MerchantPermissions.isGrantable(e.getKey())).build()).toList();});}
 @Override @GetMapping("/roles")
 public Response<List<RoleResponseDTO>> roles(@PathVariable("merchantId") String merchantId,Principal principal){return exec(()->roleService.roles(actor(principal),merchantId).stream().map(this::view).toList());}
 @Override @PostMapping("/roles")
 public Response<RoleResponseDTO> createRole(@PathVariable("merchantId") String merchantId,@RequestBody RoleRequestDTO request,Principal principal){return exec(()->view(roleService.saveRole(actor(principal),merchantId,null,required(request).getName(),request.getPermissions())));}
 @Override @PutMapping("/roles/{code}")
 public Response<RoleResponseDTO> updateRole(@PathVariable("merchantId") String merchantId,@PathVariable("code") String code,@RequestBody RoleRequestDTO request,Principal principal){return exec(()->view(roleService.saveRole(actor(principal),merchantId,code,required(request).getName(),request.getPermissions())));}
 @Override @DeleteMapping("/roles/{code}")
 public Response<Void> deleteRole(@PathVariable("merchantId") String merchantId,@PathVariable("code") String code,Principal principal){return exec(()->{roleService.deleteRole(actor(principal),merchantId,code);return null;});}
 @Override @PutMapping("/members/{userId}/role")
 public Response<Void> assign(@PathVariable("merchantId") String merchantId,@PathVariable("userId") String userId,@RequestBody RoleAssignmentRequestDTO request,Principal principal){return exec(()->{roleService.assignRole(actor(principal),merchantId,userId,required(required(request).getRoleCode()));return null;});}
 private RoleResponseDTO view(MerchantRoleVO role){return RoleResponseDTO.builder().code(role.code()).name(role.name()).permissions(role.permissions()).builtin(role.builtin()).build();}
 private <T> Response<T> exec(Supplier<T> job){try{return Response.<T>builder().code(ResponseCode.SUCCESS.getCode()).info(ResponseCode.SUCCESS.getInfo()).data(job.get()).build();}
 catch(AppException e){return Response.<T>builder().code(e.getCode()).info(e.getInfo()).build();}
 catch(Exception e){log.error("RBAC 接口失败",e);return Response.<T>builder().code(ResponseCode.UN_ERROR.getCode()).info(ResponseCode.UN_ERROR.getInfo()).build();}}
}
