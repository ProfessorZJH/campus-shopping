package cn.bugstack.ai.domain.merchant.service.impl;

import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantStatusEnumVO;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import java.util.*;

/** 新交易持有商户行锁，与停用操作形成明确的先后顺序。 */
@Service
public class MerchantServiceImpl implements IMerchantService {
    private final IMerchantRepository repository;
    public MerchantServiceImpl(IMerchantRepository repository) {
        this.repository = repository;
    }

    public MerchantVO find(String id) {
        MerchantVO m = repository.find(id, false);
        Checks.require(m != null, ResponseCode.NOT_FOUND);
        return m;
    }
    /** 锁住商户状态行后检查 ACTIVE，和停业操作建立确定的先后顺序。 */
    public MerchantVO requireActiveForNewTrade(String id) {
        MerchantVO m = repository.find(id, true);
        Checks.require(m != null, ResponseCode.NOT_FOUND);
        Checks.require(m.statusEnum() == MerchantStatusEnumVO.ACTIVE, ResponseCode.MERCHANT_SUSPENDED);
        return m;
    }

    public List<MerchantVO> list(int page, int size, boolean activeOnly) {
        return list(page, size, activeOnly, "");
    }

    public List<MerchantVO> list(int page, int size, boolean activeOnly, String q) {
        return repository.list(Checks.offset(page, size), size, activeOnly, Checks.optional(q, 100));
    }

    public long count(boolean activeOnly) {
        return count(activeOnly, "");
    }

    public long count(boolean activeOnly, String q) {
        return repository.count(activeOnly, Checks.optional(q, 100));
    }

    public void changeStatus(String id, boolean active) {
        MerchantVO m = repository.find(id, true);
        Checks.require(m != null, ResponseCode.NOT_FOUND);
        repository.setStatus(id, (active ? MerchantStatusEnumVO.ACTIVE : MerchantStatusEnumVO.SUSPENDED).name());
    }
    /** 先验证所有字段，再锁定并写入商户与门店，避免失败时留下部分变更。 */
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation
        .MANDATORY)
    public void updateProfile(String id, String name, String storeName, String location) {
        String checkedName = Checks.text(name, "商户名称", 100), checkedStore = Checks.text(storeName, "门店名称", 100), checkedLocation = Checks
            .text(location, "自提位置", 200);
        Checks.require(repository.find(id, true) != null, ResponseCode.NOT_FOUND);
        repository.updateProfile(id, checkedName, checkedStore, checkedLocation);
    }
}
