package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.identity.adapter.repository.IRoleRepository;
import cn.bugstack.ai.domain.identity.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.IAccessDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.util.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Repository;

@Repository
public class RoleRepository implements IRoleRepository {

    @Resource
    private IAccessDao accsessDao;

    public List<MerchantRoleVO> customRoles(String merchantId) {
        return accsessDao
            .roles(merchantId)
            .stream()
            .map(r -> new MerchantRoleVO(r.getRoleCode(), r.getName(), accsessDao.rolePermissions(merchantId, r.getRoleCode()), false))
            .toList();
    }

    public MerchantRoleVO customRole(String merchantId, String code, boolean lock) {
        var r = accsessDao.role(merchantId, code, lock);
        return r == null ? null : new MerchantRoleVO(code, r.getName(), accsessDao.rolePermissions(merchantId, code), false);
    }

    public Set<String> customPermissions(String merchantId, String code) {
        return accsessDao.rolePermissions(merchantId, code);
    }

    public void createRole(String mid, String code, String name, Set<String> permissions) {
        try {
            accsessDao.createRole(mid, code, name);
        } catch (DuplicateKeyException e) {
            throw roleConflict(e);
        }
        accsessDao.insertPermissions(mid, code, permissions);
    }

    public void updateRole(String mid, String code, String name, Set<String> permissions) {
        try {
            accsessDao.updateRole(mid, code, name);
        } catch (DuplicateKeyException e) {
            throw roleConflict(e);
        }
        accsessDao.deletePermissions(mid, code);
        accsessDao.insertPermissions(mid, code, permissions);
    }

    private RuntimeException roleConflict(DuplicateKeyException error) {
        String detail = error.getMostSpecificCause().getMessage();
        if (detail != null && detail.contains("uk_merchant_role_name")) return new AppException(ResponseCode.MERCHANT_ROLE_NAME_EXISTS, error);
        return error;
    }

    public void deleteRole(String mid, String code) {
        accsessDao.deletePermissions(mid, code);
        accsessDao.deleteRole(mid, code);
    }

    public int countRoleMembers(String mid, String code) {
        return accsessDao.countRoleMembers(mid, code);
    }

    public void assignRole(String mid, String uid, String code) {
        accsessDao.assignRole(mid, uid, code);
    }
}
