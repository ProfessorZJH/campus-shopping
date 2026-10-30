package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.identity.adapter.repository.IAccessRepository;
import cn.bugstack.ai.domain.identity.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.IAccessDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.util.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Repository;

/**
 * 授权仓储只做数据库映射，权限规则留在领域服务。
 */
@Repository
public class AccessRepository implements IAccessRepository {

    @Resource
    private IAccessDao accsessDao;

    public boolean isAdmin(String userId) {
        return accsessDao.countAdmin(userId) > 0;
    }

    public void grantAdmin(String userId) {
        accsessDao.grantAdmin(userId);
    }

    public MembershipVO member(String userId, String merchantId, boolean lock) {
        return toMember(accsessDao.member(userId, merchantId, lock));
    }

    public List<MembershipVO> memberships(String userId) {
        return accsessDao.memberships(userId).stream().map(this::toMember).toList();
    }

    public List<MembershipVO> members(String merchantId) {
        return accsessDao.members(merchantId).stream().map(this::toMember).toList();
    }

    public Map<String, Set<String>> activeCustomPermissions(String userId) {
        Map<String, Set<String>> permissions = new HashMap<>();
        for (PermissionGrantPO row : accsessDao.activeCustomPermissions(userId)) {
            permissions.computeIfAbsent(row.getMerchantId(), ignored -> new HashSet<>()).add(row.getPermission());
        }
        return permissions;
    }

    public void grantOwner(String merchantId, String userId, String applicationId) {
        accsessDao.grantOwner(merchantId, userId, applicationId);
    }

    public void grantClerk(String merchantId, String userId) {
        accsessDao.grantClerk(merchantId, userId);
    }

    public void revoke(String merchantId, String userId) {
        accsessDao.cancelInvitations(merchantId, userId);
        accsessDao.revoke(merchantId, userId);
    }

    public void invite(InvitationVO i, String inviter) {
        accsessDao.invite(
            InvitationPO.builder().id(i.id()).merchantId(i.merchantId()).targetUserId(i.targetUserId()).status(i.status()).expiresAt(i.expiresAt()).build(),
            inviter
        );
    }

    public InvitationVO invitation(String id) {
        return toInvitation(accsessDao.invitation(id));
    }

    public List<InvitationVO> invitations(String userId, int offset, int size) {
        return accsessDao.invitations(userId, offset, size).stream().map(this::toInvitation).toList();
    }

    public void accept(String id) {
        accsessDao.accept(id);
    }

    public void cancelPendingInvitations(String merchantId, String userId) {
        accsessDao.cancelInvitations(merchantId, userId);
    }

    public void audit(String actor, String action, String target, String merchantId, String detail) {
        accsessDao.audit(UUID.randomUUID().toString(), actor, action, target, merchantId, detail);
    }

    /** 仅翻译已知的角色名唯一索引，主键等其他冲突不能误报为同名。 */

    private MembershipVO toMember(MembershipPO p) {
        return p == null ? null : new MembershipVO(p.getMerchantId(), p.getUserId(), p.getRole(), p.getStatus());
    }

    private InvitationVO toInvitation(InvitationPO p) {
        return p == null ? null : new InvitationVO(p.getId(), p.getMerchantId(), p.getTargetUserId(), p.getStatus(), p.getExpiresAt());
    }
}
