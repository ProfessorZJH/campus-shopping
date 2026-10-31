package cn.bugstack.ai.domain.identity.service.impl;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.identity.adapter.repository.IAccessRepository;
import cn.bugstack.ai.domain.identity.model.valobj.*;
import cn.bugstack.ai.domain.identity.service.*;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 平台权限和商户成员权限分开校验；撤销权限不依赖过期会话内的角色副本。 */
@Service
public class AccessServiceImpl implements IAccessService {

  private final IAccessRepository repository;
  private final IUserAccountService accounts;
  private final Clock clock;

  public AccessServiceImpl(
    IAccessRepository repository,
    IUserAccountService accounts,
    Clock clock
  ) {
    this.repository = repository;
    this.accounts = accounts;
    this.clock = clock;
  }

  public boolean isAdmin(String userId) {
    return repository.isAdmin(userId);
  }

  public void requireAdmin(String userId) {
    accounts.requireActive(userId);
    require(isAdmin(userId), ResponseCode.AUTH_FORBIDDEN);
  }

  public void requireMember(String userId, String merchantId, boolean ownerOnly) {
    accounts.requireActive(userId);
    MembershipVO m = repository.member(userId, merchantId, true);
    require(
      m != null && "ACTIVE".equals(m.status()) && (!ownerOnly || "OWNER".equals(m.role())),
      ResponseCode.AUTH_FORBIDDEN
    );
  }

  public List<MembershipVO> memberships(String userId) {
    accounts.requireActive(userId);
    return repository.memberships(userId);
  }

  public List<MembershipVO> members(String actor, String merchantId) {
    requireMember(actor, merchantId, true);
    return repository.members(merchantId);
  }

  public void grantInitialOwner(String merchantId, String userId, String applicationId) {
    accounts.requireActive(userId);
    repository.grantOwner(merchantId, userId, applicationId);
    MembershipVO m = repository.member(userId, merchantId, true);
    require(
      m != null && "OWNER".equals(m.role()) && "ACTIVE".equals(m.status()),
      ResponseCode.STATE_CONFLICT
    );
  }

  /** 仅由启动初始化用例调用，不提供 HTTP 入口。 */
  public void bootstrapAdmin(String userId) {
    repository.grantAdmin(userId);
  }

  @Transactional(rollbackFor = Exception.class)
  public InvitationVO invite(String actor, String merchantId, String username) {
    requireMember(actor, merchantId, true);
    String target = accounts.findUserId(username);
    require(!actor.equals(target), ResponseCode.ILLEGAL_PARAMETER);
    MembershipVO m = repository.member(target, merchantId, true);
    require(m == null || !"ACTIVE".equals(m.status()), ResponseCode.STATE_CONFLICT);
    InvitationVO invite = new InvitationVO(
      UUID.randomUUID().toString(),
      merchantId,
      target,
      "PENDING",
      clock.instant().plus(Duration.ofHours(24))
    );
    repository.invite(invite, actor);
    audit(actor, "MEMBER_INVITED", invite.id(), merchantId, "邀请店员");
    return invite;
  }

  @Transactional(rollbackFor = Exception.class)
  public void accept(String actor, String invitationId) {
    accounts.requireActive(actor);
    InvitationVO i = repository.invitation(invitationId);
    require(i != null, ResponseCode.NOT_FOUND);
    require(actor.equals(i.targetUserId()), ResponseCode.AUTH_FORBIDDEN);
    if ("ACCEPTED".equals(i.status())) return;
    require(
      "PENDING".equals(i.status()) && clock.instant().isBefore(i.expiresAt()),
      ResponseCode.STATE_CONFLICT
    );
    MembershipVO m = repository.member(actor, i.merchantId(), true);
    require(m == null || !"OWNER".equals(m.role()), ResponseCode.STATE_CONFLICT);
    repository.grantClerk(i.merchantId(), actor);
    repository.accept(i.id());
    audit(actor, "INVITATION_ACCEPTED", i.id(), i.merchantId(), "接受店员邀请");
  }

  public List<InvitationVO> invitations(String actor) {
    accounts.requireActive(actor);
    return repository.invitations(actor);
  }

  @Transactional(rollbackFor = Exception.class)
  public void revoke(String actor, String merchantId, String targetUserId) {
    requireMember(actor, merchantId, true);
    MembershipVO m = repository.member(targetUserId, merchantId, false);
    require(m != null && !"OWNER".equals(m.role()), ResponseCode.AUTH_FORBIDDEN);
    repository.revoke(merchantId, targetUserId);
    audit(actor, "MEMBER_REVOKED", targetUserId, merchantId, "撤销店员权限与未接受邀请");
  }

  public void audit(String actor, String action, String target, String merchantId, String detail) {
    repository.audit(actor, action, target, merchantId, Checks.optional(detail, 1000));
  }

  /** 默认拒绝未知权限；会话只存 userId，权限变更在下一次请求立即生效。 */
  public void requirePermission(String actor, String merchantId, String permission) {
    require(
      permission != null && MerchantPermissions.LABELS.containsKey(permission),
      ResponseCode.AUTH_FORBIDDEN
    );
    require(permissions(actor, merchantId).contains(permission), ResponseCode.AUTH_FORBIDDEN);
  }

  public Set<String> permissions(String actor, String merchantId) {
    accounts.requireActive(actor);
    MembershipVO m = repository.member(actor, merchantId, false);
    if (m == null || !"ACTIVE".equals(m.status())) return Set.of();
    return switch (m.role()) {
      case "OWNER" -> MerchantPermissions.OWNER;
      case "CLERK" -> MerchantPermissions.CLERK;
      default -> repository.customPermissions(merchantId, m.role());
    };
  }

  public List<MerchantRoleVO> roles(String actor, String merchantId) {
    requirePermission(actor, merchantId, MerchantPermissions.ROLE_MANAGE);
    List<MerchantRoleVO> result = new ArrayList<>();
    result.add(new MerchantRoleVO("OWNER", "经营者", MerchantPermissions.OWNER, true));
    result.add(new MerchantRoleVO("CLERK", "店员", MerchantPermissions.CLERK, true));
    result.addAll(repository.customRoles(merchantId));
    return result;
  }

  private Set<String> validPermissions(Set<String> values) {
    return cn.bugstack.ai.domain.identity.model.valobj.MerchantPermissionEnumVO.validateGrant(
      values
    );
  }

  @Transactional(rollbackFor = Exception.class)
  public MerchantRoleVO saveRole(
    String actor,
    String merchantId,
    String code,
    String name,
    Set<String> requested
  ) {
    requirePermission(actor, merchantId, MerchantPermissions.ROLE_MANAGE);
    String label = Checks.text(name, "角色名称", 40);
    Set<String> perms = validPermissions(requested);
    String roleCode =
      code == null || code.isBlank()
        ? "R" + UUID.randomUUID().toString().replace("-", "").substring(0, 12)
        : code;
    require(roleCode.matches("R[a-f0-9]{12}"), ResponseCode.ILLEGAL_PARAMETER);
    if (code == null || code.isBlank()) repository.createRole(merchantId, roleCode, label, perms);
    else {
      require(repository.customRole(merchantId, roleCode, true) != null, ResponseCode.NOT_FOUND);
      repository.updateRole(merchantId, roleCode, label, perms);
    }
    audit(
      actor,
      code == null || code.isBlank() ? "ROLE_CREATED" : "ROLE_CHANGED",
      roleCode,
      merchantId,
      label
    );
    return new MerchantRoleVO(roleCode, label, perms, false);
  }

  @Transactional(rollbackFor = Exception.class)
  public void deleteRole(String actor, String merchantId, String code) {
    requirePermission(actor, merchantId, MerchantPermissions.ROLE_MANAGE);
    require(code != null && code.matches("R[a-f0-9]{12}"), ResponseCode.ILLEGAL_PARAMETER);
    require(repository.customRole(merchantId, code, true) != null, ResponseCode.NOT_FOUND);
    require(repository.countRoleMembers(merchantId, code) == 0, ResponseCode.STATE_CONFLICT);
    repository.deleteRole(merchantId, code);
    audit(actor, "ROLE_DELETED", code, merchantId, "删除未分配的角色");
  }

  @Transactional(rollbackFor = Exception.class)
  public void assignRole(String actor, String merchantId, String targetUserId, String roleCode) {
    requirePermission(actor, merchantId, MerchantPermissions.ROLE_MANAGE);
    require(!"OWNER".equals(roleCode) && roleCode != null, ResponseCode.AUTH_FORBIDDEN);
    if (!"CLERK".equals(roleCode)) require(
      repository.customRole(merchantId, roleCode, true) != null,
      ResponseCode.NOT_FOUND
    );
    MembershipVO target = repository.member(targetUserId, merchantId, true);
    require(
      target != null && "ACTIVE".equals(target.status()) && !"OWNER".equals(target.role()),
      ResponseCode.AUTH_FORBIDDEN
    );
    repository.assignRole(merchantId, targetUserId, roleCode);
    audit(actor, "MEMBER_ROLE_CHANGED", targetUserId, merchantId, "设置角色 " + roleCode);
  }
}
