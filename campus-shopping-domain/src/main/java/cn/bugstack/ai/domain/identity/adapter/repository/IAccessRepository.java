package cn.bugstack.ai.domain.identity.adapter.repository;

import cn.bugstack.ai.domain.identity.model.valobj.*;
import java.util.*;

/** 本地授权事实与审计存储；不依赖用户提交的角色字段。 */
public interface IAccessRepository {
    boolean isAdmin(String userId);
    void grantAdmin(String userId);
    MembershipVO member(String userId, String merchantId, boolean lock);
    List<MembershipVO> memberships(String userId);
    List<MembershipVO> members(String merchantId);
    Map<String, Set<String>> activeCustomPermissions(String userId);
    void grantOwner(String merchantId, String userId, String applicationId);
    void grantClerk(String merchantId, String userId);
    void revoke(String merchantId, String userId);
    void invite(InvitationVO invitation, String inviter);
    InvitationVO invitation(String id);
    List<InvitationVO> invitations(String userId, int offset, int size);
    void accept(String id);
    void cancelPendingInvitations(String merchantId, String userId);
    void audit(String actor, String action, String target, String merchantId, String detail);
}
