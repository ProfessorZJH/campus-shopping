package cn.bugstack.ai.domain.merchant.service.impl;

import cn.bugstack.ai.domain.merchant.adapter.port.IStoreImagePort;
import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantStatusEnumVO;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 新交易持有商户行锁，与停用操作形成明确的先后顺序。 */
@Service
public class MerchantServiceImpl implements IMerchantService {

    private final IMerchantRepository repository;
    private final IStoreImagePort images;

    public MerchantServiceImpl(IMerchantRepository repository, IStoreImagePort images) {
        this.repository = repository;
        this.images = images;
    }

    public List<MerchantVO> findAll(List<String> ids) {
        Checks.require(ids != null && ids.size() <= 100, ResponseCode.ILLEGAL_PARAMETER);
        return repository.findAll(ids);
    }

    public MerchantVO publicDisplay(String id) {
        var m = repository.publicDisplay(id);
        Checks.require(m != null, ResponseCode.NOT_FOUND);
        Checks.require("ACTIVE".equals(m.status()), ResponseCode.MERCHANT_SUSPENDED);
        return m;
    }

    public MerchantVO find(String id) {
        MerchantVO m = repository.find(id, false);
        Checks.require(m != null, ResponseCode.NOT_FOUND);
        return m;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public MerchantVO requireActiveForNewTrade(String id) {
        MerchantVO m = repository.find(id, true);
        Checks.require(m != null, ResponseCode.NOT_FOUND);
        Checks.require(m.state() == MerchantStatusEnumVO.ACTIVE, ResponseCode.MERCHANT_SUSPENDED);
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

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean changeStatus(String id, boolean active) {
        MerchantVO m = repository.find(id, true);
        Checks.require(m != null, ResponseCode.NOT_FOUND);
        MerchantStatusEnumVO state = active ? MerchantStatusEnumVO.ACTIVE : MerchantStatusEnumVO.SUSPENDED;
        if (m.state() == state) return false;
        repository.setStatus(id, state.getCode());
        return true;
    }

    /** 旧调用只更新既有字段；新字段传 null，由加锁后的当前行保留原值。 */
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void updateProfile(String id, String name, String storeName, String location) {
        updateProfile(id, name, storeName, location, null, null, null);
    }

    /** 先验证所有字段和图片归属，再锁定并写入商户与门店，避免失败时留下部分变更。 */
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void updateProfile(String id, String name, String storeName, String location, String description, String businessHours, String imageUrl) {
        String checkedName = Checks.text(name, "商户名称", 100),
            checkedStore = Checks.text(storeName, "门店名称", 100),
            checkedLocation = Checks.text(location, "自提位置", 200);
        MerchantVO current = repository.find(id, true);
        Checks.require(current != null, ResponseCode.NOT_FOUND);
        // 旧客户端未提交新字段时保留原值；显式空串才表示清空。
        String checkedDescription = description == null ? current.description() : Checks.optional(description, 2000),
            checkedHours = businessHours == null ? current.businessHours() : Checks.optional(businessHours, 200),
            checkedImage = imageUrl == null ? current.imageUrl() : Checks.optional(imageUrl, 255);
        if (!checkedImage.isBlank() && !checkedImage.equals(current.imageUrl())) images.requireOwned(id, checkedImage);
        repository.updateProfile(id, checkedName, checkedStore, checkedLocation, checkedDescription, checkedHours, checkedImage);
    }

    /** 门店图片可先上传后保存资料；上传本身不改变营业状态。 */
    public String storeImage(String merchantId, byte[] bytes) {
        Checks.require(merchantId != null && !merchantId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        Checks.require(repository.find(merchantId, false) != null, ResponseCode.NOT_FOUND);
        return images.storeImage(bytes, merchantId);
    }
}
