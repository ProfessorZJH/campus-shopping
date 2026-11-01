package cn.bugstack.ai.infrastructure.dao.po;

import lombok.*;

/** 商户角色列表的一次性权限投影；实时鉴权仍使用单角色读取。 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RolePermissionPO {

    private String roleCode;
    private String permission;
}
