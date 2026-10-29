package cn.bugstack.ai.domain.identity.service;

import cn.bugstack.ai.domain.identity.model.valobj.MerchantRoleVO;
import java.util.List;
import java.util.Set;

/** 商户自定义角色治理：角色定义、权限依赖与成员角色分配。 */
public interface IRoleService {
    List<MerchantRoleVO> roles(String actor, String merchantId);
    MerchantRoleVO saveRole(String actor, String merchantId, String code, String name, Set<String> permissions);
    void deleteRole(String actor, String merchantId, String code);
    void assignRole(String actor, String merchantId, String targetUserId, String roleCode);
}
