package cn.bugstack.ai.cases.merchant.impl;

import cn.bugstack.ai.cases.merchant.IWorkspaceQueryCase;
import cn.bugstack.ai.cases.merchant.model.WorkspaceSnapshot;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkspaceQueryCaseImpl implements IWorkspaceQueryCase {

    private final IAccessService access;
    private final IMerchantService merchants;

    public WorkspaceQueryCaseImpl(IAccessService access, IMerchantService merchants) {
        this.access = access;
        this.merchants = merchants;
    }

    @Override
    public WorkspaceSnapshot workspace(String actor) {
        List<MembershipVO> memberships = access.memberships(actor);
        List<String> merchantIds = memberships.stream().map(MembershipVO::merchantId).distinct().toList();
        // 商户领域查询单批限制 100 条，用户同时加入更多商户时依然完整返回。
        List<MerchantVO> loaded = new ArrayList<>();
        for (int start = 0; start < merchantIds.size(); start += 100) {
            loaded.addAll(merchants.findAll(merchantIds.subList(start, Math.min(start + 100, merchantIds.size()))));
        }
        Map<String, MerchantVO> merchantById = loaded.stream().collect(Collectors.toMap(MerchantVO::id, Function.identity()));
        List<MerchantVO> orderedMerchants = merchantIds
            .stream()
            .map(id -> {
                MerchantVO merchant = merchantById.get(id);
                if (merchant == null) throw new IllegalStateException("工作台商户信息丢失");
                return merchant;
            })
            .toList();
        Map<String, Set<String>> permissions = access.workspacePermissions(actor, memberships);
        return new WorkspaceSnapshot(access.isAdmin(actor), memberships, permissions, orderedMerchants);
    }
}
