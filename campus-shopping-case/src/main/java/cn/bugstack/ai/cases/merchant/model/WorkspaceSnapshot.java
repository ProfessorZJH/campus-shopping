package cn.bugstack.ai.cases.merchant.model;

import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 工作台可信读快照，不包含 HTTP DTO。 */
public record WorkspaceSnapshot(
    boolean platformAdmin,
    List<MembershipVO> memberships,
    Map<String, Set<String>> merchantPermissions,
    List<MerchantVO> merchants
) {}
