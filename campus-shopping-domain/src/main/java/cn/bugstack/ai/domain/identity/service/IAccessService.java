package cn.bugstack.ai.domain.identity.service;

import cn.bugstack.ai.domain.identity.model.valobj.*;
import java.util.*;

/** 公开身份授权能力，跨领域用例不得直接读成员表。 */
public interface IAccessService {
    boolean isAdmin(String userId);
    void requireAdmin(String userId);
    void requireMember(String userId, String merchantId, boolean ownerOnly);
    List<MembershipVO> memberships(String userId);
    List<MembershipVO> members(String actor, String merchantId);
    void grantInitialOwner(String merchantId, String userId, String applicationId);
    void bootstrapAdmin(String userId);
    InvitationVO invite(String actor, String merchantId, String username);
    void accept(String actor, String invitationId);
    List<InvitationVO> invitations(String actor, int page, int size);
    void revoke(String actor, String merchantId, String targetUserId);
    void audit(String actor, String action, String target, String merchantId, String detail);
    /** 所有商户敏感读写均通过当前数据库成员关系与角色实时复权。 */
    void requirePermission(String actor, String merchantId, String permission);
    Set<String> permissions(String actor, String merchantId);
    Map<String, Set<String>> workspacePermissions(String actor, List<MembershipVO> memberships);
}
