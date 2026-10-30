package cn.bugstack.ai.infrastructure.dao.po;

import lombok.*;

/** 工作台自定义角色权限的批量查询行。 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PermissionGrantPO {

    private String merchantId;
    private String permission;
}
