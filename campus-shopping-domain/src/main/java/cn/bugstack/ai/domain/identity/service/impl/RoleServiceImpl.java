package cn.bugstack.ai.domain.identity.service.impl;

import cn.bugstack.ai.domain.identity.adapter.repository.IAccessRepository;
import cn.bugstack.ai.domain.identity.adapter.repository.IRoleRepository;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.model.valobj.MerchantPermissions;
import cn.bugstack.ai.domain.identity.model.valobj.MerchantRoleVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IRoleService;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static cn.bugstack.ai.types.common.Checks.require;

/**
 * 商户角色治理领域服务。
 * 只有经营者可执行角色管理；动态角色码必须留在数据库，不能硬编码成枚举。
 * 角色权限更新后，下一次授权检查必须使用数据库实时权限，而不是会话缓存。
 */
@Service
public class RoleServiceImpl implements IRoleService {
    private final IRoleRepository roles;
    private final IAccessRepository members;
    private final IAccessService access;

    public RoleServiceImpl(IRoleRepository roles, IAccessRepository members, IAccessService access) {
        this.roles = roles;
        this.members = members;
        this.access = access;
    }

    @Override
    public List<MerchantRoleVO> roles(String actor, String merchantId) {
        access.requirePermission(actor, merchantId, MerchantPermissions.ROLE_MANAGE);
        List<MerchantRoleVO> result = new ArrayList<>();
        result.add(new MerchantRoleVO("OWNER", "经营者", MerchantPermissions.OWNER, true));
        result.add(new MerchantRoleVO("CLERK", "店员", MerchantPermissions.CLERK, true));
        result.addAll(roles.customRoles(merchantId));
        return result;
    }

    private Set<String> validPermissions(Set<String> values) {
        require(values != null && !values.isEmpty()
                        && values.size() <= MerchantPermissions.LABELS.size(),
                ResponseCode.ILLEGAL_PARAMETER);
        require(values.stream().allMatch(MerchantPermissions::isGrantable),
                ResponseCode.AUTH_FORBIDDEN);
        Map<String, String> dependencies = Map.of(
                "product.write", "product.read", "stock.replenish", "stock.read",
                "order.prepare", "order.read", "pickup.verify", "order.read",
                "aftersale.review", "aftersale.read", "knowledge.manage", "knowledge.read",
                "dashboard.read", "order.read");
        for (var pair : dependencies.entrySet()) {
            if (values.contains(pair.getKey())) {
                require(values.contains(pair.getValue()), ResponseCode.ILLEGAL_PARAMETER);
            }
        }
        return Set.copyOf(values);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MerchantRoleVO saveRole(String actor, String merchantId, String code,
                                   String name, Set<String> requested) {
        access.requirePermission(actor, merchantId, MerchantPermissions.ROLE_MANAGE);
        String label = Checks.text(name, "角色名称", 40);
        Set<String> permissions = validPermissions(requested);
        boolean creating = code == null || code.isBlank();
        String roleCode = creating
                ? "R" + UUID.randomUUID().toString().replace("-", "").substring(0, 12)
                : code;
        require(roleCode.matches("R[a-f0-9]{12}"), ResponseCode.ILLEGAL_PARAMETER);
        if (creating) {
            roles.createRole(merchantId, roleCode, label, permissions);
        } else {
            require(roles.customRole(merchantId, roleCode, true) != null, ResponseCode.NOT_FOUND);
            roles.updateRole(merchantId, roleCode, label, permissions);
        }
        access.audit(actor, creating ? "ROLE_CREATED" : "ROLE_CHANGED",
                roleCode, merchantId, label);
        return new MerchantRoleVO(roleCode, label, permissions, false);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteRole(String actor, String merchantId, String code) {
        access.requirePermission(actor, merchantId, MerchantPermissions.ROLE_MANAGE);
        require(code != null && code.matches("R[a-f0-9]{12}"), ResponseCode.ILLEGAL_PARAMETER);
        require(roles.customRole(merchantId, code, true) != null, ResponseCode.NOT_FOUND);
        require(roles.countRoleMembers(merchantId, code) == 0, ResponseCode.STATE_CONFLICT);
        roles.deleteRole(merchantId, code);
        access.audit(actor, "ROLE_DELETED", code, merchantId, "删除未分配的角色");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void assignRole(String actor, String merchantId, String targetUserId, String roleCode) {
        access.requirePermission(actor, merchantId, MerchantPermissions.ROLE_MANAGE);
        require(roleCode != null && !"OWNER".equals(roleCode), ResponseCode.AUTH_FORBIDDEN);
        if (!"CLERK".equals(roleCode)) {
            require(roles.customRole(merchantId, roleCode, true) != null, ResponseCode.NOT_FOUND);
        }
        MembershipVO member = members.member(targetUserId, merchantId, true);
        require(member != null && "ACTIVE".equals(member.status())
                        && !"OWNER".equals(member.role()), ResponseCode.AUTH_FORBIDDEN);
        roles.assignRole(merchantId, targetUserId, roleCode);
        access.audit(actor, "MEMBER_ROLE_CHANGED", targetUserId, merchantId,
                "设置角色 " + roleCode);
    }
}
