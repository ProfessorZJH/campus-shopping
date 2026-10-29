package cn.bugstack.ai.domain.identity.adapter.repository;

import cn.bugstack.ai.domain.identity.model.valobj.MerchantRoleVO;
import java.util.List;
import java.util.Set;

/** 角色定义及权限映射的本地持久化抽象，不管理邀请和账号。 */
public interface IRoleRepository {
    List<MerchantRoleVO> customRoles(String merchantId);
    MerchantRoleVO customRole(String merchantId, String code, boolean lock);
    Set<String> customPermissions(String merchantId, String code);
    void createRole(String merchantId, String code, String name, Set<String> permissions);
    void updateRole(String merchantId, String code, String name, Set<String> permissions);
    void deleteRole(String merchantId, String code);
    int countRoleMembers(String merchantId, String code);
    void assignRole(String merchantId, String userId, String code);
}
