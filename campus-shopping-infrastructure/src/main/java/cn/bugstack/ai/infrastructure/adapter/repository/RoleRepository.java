package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.identity.adapter.repository.IRoleRepository;
import cn.bugstack.ai.domain.identity.model.valobj.MerchantRoleVO;
import cn.bugstack.ai.infrastructure.dao.IAccessDao;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;

/** 角色与授权关系的 MyBatis 映射；不保存或读取用户密码。 */
@Repository
public class RoleRepository implements IRoleRepository {
    @Resource
    private IAccessDao dao;

    @Override
    public List<MerchantRoleVO> customRoles(String merchantId) {
        return dao.roles(merchantId).stream()
                .map(role -> new MerchantRoleVO(role.getRoleCode(), role.getName(),
                        dao.rolePermissions(merchantId, role.getRoleCode()), false)).toList();
    }

    @Override
    public MerchantRoleVO customRole(String merchantId, String code, boolean lock) {
        var role = dao.role(merchantId, code, lock);
        return role == null ? null : new MerchantRoleVO(
                code, role.getName(), dao.rolePermissions(merchantId, code), false);
    }

    @Override
    public Set<String> customPermissions(String merchantId, String code) {
        return dao.rolePermissions(merchantId, code);
    }

    @Override
    public void createRole(String merchantId, String code, String name, Set<String> permissions) {
        dao.createRole(merchantId, code, name);
        dao.insertPermissions(merchantId, code, permissions);
    }

    @Override
    public void updateRole(String merchantId, String code, String name, Set<String> permissions) {
        dao.updateRole(merchantId, code, name);
        dao.deletePermissions(merchantId, code);
        dao.insertPermissions(merchantId, code, permissions);
    }

    @Override
    public void deleteRole(String merchantId, String code) {
        dao.deletePermissions(merchantId, code);
        dao.deleteRole(merchantId, code);
    }

    @Override
    public int countRoleMembers(String merchantId, String code) {
        return dao.countRoleMembers(merchantId, code);
    }

    @Override
    public void assignRole(String merchantId, String userId, String code) {
        dao.assignRole(merchantId, userId, code);
    }
}
