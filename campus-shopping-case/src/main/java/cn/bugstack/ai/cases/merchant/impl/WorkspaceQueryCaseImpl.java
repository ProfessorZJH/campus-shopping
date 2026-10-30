package cn.bugstack.ai.cases.merchant.impl;

import cn.bugstack.ai.cases.merchant.IWorkspaceQueryCase;
import cn.bugstack.ai.cases.merchant.model.WorkspaceSnapshot;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
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
        Map<String, MerchantVO> merchantById = merchants.findAll(merchantIds).stream().collect(Collectors.toMap(MerchantVO::id, Function.identity()));
        List<MerchantVO> orderedMerchants = merchantIds.stream().map(id -> {
            MerchantVO merchant = merchantById.get(id);
            if (merchant == null) throw new IllegalStateException("工作台商户信息丢失");
            return merchant;
        }).toList();
        Map<String, Set<String>> permissions = merchantIds.stream().collect(Collectors.toMap(Function.identity(), id -> access.permissions(actor, id)));
        return new WorkspaceSnapshot(access.isAdmin(actor), memberships, permissions, orderedMerchants);
    }
}
