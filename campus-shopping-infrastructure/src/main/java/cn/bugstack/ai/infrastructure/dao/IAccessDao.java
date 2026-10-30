package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.*;
import java.time.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface IAccessDao {
    int countAdmin(@Param("userId") String userId);
    int grantAdmin(@Param("userId") String userId);
    MembershipPO member(@Param("userId") String userId, @Param("merchantId") String merchantId, @Param("lock") boolean lock);
    List<MembershipPO> memberships(@Param("userId") String userId);
    List<MembershipPO> members(@Param("merchantId") String merchantId);
    int grantOwner(@Param("merchantId") String merchantId, @Param("userId") String userId, @Param("applicationId") String applicationId);
    int grantClerk(@Param("merchantId") String merchantId, @Param("userId") String userId);
    int revoke(@Param("merchantId") String merchantId, @Param("userId") String userId);
    int invite(@Param("po") InvitationPO po, @Param("inviter") String inviter);
    InvitationPO invitation(@Param("id") String id);
    List<InvitationPO> invitations(@Param("targetUserId") String targetUserId);
    int accept(@Param("id") String id);
    int cancelInvitations(@Param("merchantId") String merchantId, @Param("targetUserId") String targetUserId);
    List<MerchantRolePO> roles(@Param("merchantId") String merchantId);
    MerchantRolePO role(@Param("merchantId") String merchantId, @Param("code") String code, @Param("lock") boolean lock);
    Set<String> rolePermissions(@Param("merchantId") String merchantId, @Param("code") String code);
    int createRole(@Param("merchantId") String merchantId, @Param("code") String code, @Param("name") String name);
    int updateRole(@Param("merchantId") String merchantId, @Param("code") String code, @Param("name") String name);
    int deleteRole(@Param("merchantId") String merchantId, @Param("code") String code);
    int deletePermissions(@Param("merchantId") String merchantId, @Param("code") String code);
    int insertPermissions(@Param("merchantId") String merchantId, @Param("code") String code, @Param("permissions") Set<String> permissions);
    int countRoleMembers(@Param("merchantId") String merchantId, @Param("code") String code);
    int assignRole(@Param("merchantId") String merchantId, @Param("userId") String userId, @Param("code") String code);
    int audit(
        @Param("id") String id,
        @Param("actor") String actor,
        @Param("action") String action,
        @Param("target") String target,
        @Param("merchantId") String merchantId,
        @Param("detail") String detail
    );
}
