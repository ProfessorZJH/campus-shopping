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
    private final cn.bugstack.ai.domain.identity.adapter.repository.IRoleRepository roles;
    private final IUserAccountService accounts;
    private final Clock clock;

    public AccessServiceImpl(
        IAccessRepository repository,
        cn.bugstack.ai.domain.identity.adapter.repository.IRoleRepository roles,
        IUserAccountService accounts,
        Clock clock
    ) {
        this.repository = repository;
        this.roles = roles;
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
        require(m != null && m.state() == MembershipStatusEnumVO.ACTIVE && (!ownerOnly || "OWNER".equals(m.role())), ResponseCode.AUTH_FORBIDDEN);
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
        require(m != null && "OWNER".equals(m.role()) && m.state() == MembershipStatusEnumVO.ACTIVE, ResponseCode.STATE_CONFLICT);
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
        require(m == null || m.state() != MembershipStatusEnumVO.ACTIVE, ResponseCode.STATE_CONFLICT);
        Instant expiresAt = clock.instant().plus(Duration.ofHours(24));
        InvitationVO invite = new InvitationVO(UUID.randomUUID().toString(), merchantId, target, InvitationStatusEnumVO.PENDING.getCode(), expiresAt);
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
        if (i.state() == InvitationStatusEnumVO.ACCEPTED) return;
        require(i.state() == InvitationStatusEnumVO.PENDING && clock.instant().isBefore(i.expiresAt()), ResponseCode.STATE_CONFLICT);
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
        require(permission != null && MerchantPermissions.LABELS.containsKey(permission), ResponseCode.AUTH_FORBIDDEN);
        require(permissions(actor, merchantId).contains(permission), ResponseCode.AUTH_FORBIDDEN);
    }

    public Set<String> permissions(String actor, String merchantId) {
        accounts.requireActive(actor);
        MembershipVO m = repository.member(actor, merchantId, false);
        if (m == null || m.state() != MembershipStatusEnumVO.ACTIVE) return Set.of();
        return switch (m.role()) {
            case "OWNER" -> MerchantPermissions.OWNER;
            case "CLERK" -> MerchantPermissions.CLERK;
            default -> roles.customPermissions(merchantId, m.role());
        };
    }
}
