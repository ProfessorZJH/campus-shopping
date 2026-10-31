package cn.bugstack.ai.cases.merchant.impl;

import cn.bugstack.ai.cases.merchant.IMerchantAdmissionCase;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.*;
import cn.bugstack.ai.types.common.Checks;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 申请、商户、首店和 Owner 关系只能全部提交或全部回滚。 */
@Service
public class MerchantAdmissionCaseImpl implements IMerchantAdmissionCase {

  private final IMerchantApplicationService applications;
  private final IMerchantService merchants;
  private final IAccessService access;

  public MerchantAdmissionCaseImpl(
    IMerchantApplicationService applications,
    IMerchantService merchants,
    IAccessService access
  ) {
    this.applications = applications;
    this.merchants = merchants;
    this.access = access;
  }

  @Transactional(rollbackFor = Exception.class)
  public MerchantVO approve(String actor, String id) {
    access.requireAdmin(actor);
    MerchantVO m = applications.approveAndOpen(id, actor);
    // 通过公开申请查询取归属，不能由客户端指定将 Owner 授给谁。
    String applicant = applications.applicantOf(id);
    access.grantInitialOwner(m.id(), applicant, id);
    access.audit(actor, "MERCHANT_APPROVED", id, m.id(), "审核通过并原子开通");
    return m;
  }

  @Transactional(rollbackFor = Exception.class)
  public void reject(String actor, String id, String reason) {
    access.requireAdmin(actor);
    applications.reject(id, actor, reason);
    access.audit(actor, "MERCHANT_REJECTED", id, null, reason);
  }

  @Transactional(rollbackFor = Exception.class)
  public void setActive(String actor, String id, boolean active, String reason) {
    access.requireAdmin(actor);
    reason = Checks.text(reason, "状态变更原因", 500);
    merchants.changeStatus(id, active);
    access.audit(actor, active ? "MERCHANT_RESUMED" : "MERCHANT_SUSPENDED", id, id, reason);
  }

  /** 停用商户也可以纠正经营资料；这不会恢复其新交易资格。 */
  @Transactional(rollbackFor = Exception.class)
  public MerchantVO updateProfile(
    String actor,
    String id,
    String name,
    String storeName,
    String location
  ) {
    access.requirePermission(actor, id, "store.manage");
    merchants.updateProfile(id, name, storeName, location);
    access.audit(actor, "MERCHANT_PROFILE_CHANGED", id, id, "更新商户和自提门店资料");
    return merchants.find(id);
  }
}
