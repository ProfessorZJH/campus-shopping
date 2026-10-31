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
  void grantOwner(String merchantId, String userId, String applicationId);
  void grantClerk(String merchantId, String userId);
  void revoke(String merchantId, String userId);
  void invite(InvitationVO invitation, String inviter);
  InvitationVO invitation(String id);
  List<InvitationVO> invitations(String userId);
  void accept(String id);
  void audit(String actor, String action, String target, String merchantId, String detail);
  List<MerchantRoleVO> customRoles(String merchantId);
  MerchantRoleVO customRole(String merchantId, String code, boolean lock);
  void createRole(String merchantId, String code, String name, Set<String> permissions);
  void updateRole(String merchantId, String code, String name, Set<String> permissions);
  void deleteRole(String merchantId, String code);
  int countRoleMembers(String merchantId, String code);
  void assignRole(String merchantId, String userId, String code);
  Set<String> customPermissions(String merchantId, String code);
}
