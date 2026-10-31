package cn.bugstack.ai.domain.merchant.model.aggregate;

import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantApplicationStatusEnumVO;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.Objects;
import lombok.Getter;

/**
 * 商户入驻申请聚合根。
 *
 * 负责申请自身的字段合法性和审核状态转换。
 * 完整申请、审核状态和商户关联由聚合维护。
 * 平台管理员身份与跨领域原子开通由审核用例负责。
 */
@Getter
public final class MerchantApplicationAggregate {

  private final String applicationId;
  private final String applicantUserId;
  private final String merchantName;
  private MerchantApplicationStatusEnumVO status;
  private String reviewerUserId;
  private String rejectionReason;
  private AdmissionCommandEntity details;
  private String openedMerchantId;
  private long version;

  /** 正式提交所需经营资料，老教学记录只读保留，不得凭空补齐资质。 */
  public static MerchantApplicationAggregate submitDetailed(
    String id,
    String userId,
    AdmissionCommandEntity c
  ) {
    Objects.requireNonNull(c, "入驻资料不能为空");
    AdmissionCommandEntity valid = new AdmissionCommandEntity(
      Checks.text(c.name(), "商户名称", 100),
      Checks.text(c.category(), "经营类别", 50),
      Checks.text(c.contactName(), "联系人", 50),
      Checks.text(c.contactPhone(), "联系电话", 30),
      Checks.text(c.storeName(), "门店名称", 100),
      Checks.text(c.location(), "校园位置", 200)
    );
    MerchantApplicationAggregate a = submit(id, userId, valid.name());
    a.details = valid;
    return a;
  }

  public static MerchantApplicationAggregate restoreDetailed(
    String id,
    String userId,
    String name,
    MerchantApplicationStatusEnumVO state,
    String reviewer,
    String reason,
    AdmissionCommandEntity details,
    String merchantId,
    long version
  ) {
    MerchantApplicationAggregate a = restore(id, userId, name, state, reviewer, reason);
    a.details = details;
    a.openedMerchantId = merchantId;
    a.version = version;
    return a;
  }

  public void requireComplete() {
    if (
      details == null ||
      details.category() == null ||
      details.contactName() == null ||
      details.contactPhone() == null ||
      details.storeName() == null ||
      details.location() == null
    ) throw new AppException(ResponseCode.MERCHANT_PROFILE_INCOMPLETE);
    submitDetailed(applicationId, applicantUserId, details);
  }

  public void attachMerchant(String merchantId) {
    Checks.require(
      status == MerchantApplicationStatusEnumVO.APPROVED && openedMerchantId == null,
      ResponseCode.STATE_CONFLICT
    );
    openedMerchantId = Checks.text(merchantId, "商户ID", 36);
  }

  private MerchantApplicationAggregate(
    String applicationId,
    String applicantUserId,
    String merchantName
  ) {
    this.applicationId = requireText(applicationId, "申请 ID", 64);
    this.applicantUserId = requireText(applicantUserId, "申请人 ID", 64);
    this.merchantName = requireText(merchantName, "商户名称", 100);
    this.status = MerchantApplicationStatusEnumVO.SUBMITTED;
  }

  /** 用户第一次发起申请时创建一个新的聚合。 */
  public static MerchantApplicationAggregate submit(
    String applicationId,
    String applicantUserId,
    String merchantName
  ) {
    return new MerchantApplicationAggregate(applicationId, applicantUserId, merchantName);
  }

  /**
   * 从持久化数据重建聚合。基础设施传入原状态，而不是调用 submit 后再用 Setter 篡改状态。
   */
  public static MerchantApplicationAggregate restore(
    String applicationId,
    String applicantUserId,
    String merchantName,
    MerchantApplicationStatusEnumVO status,
    String reviewerUserId,
    String rejectionReason
  ) {
    MerchantApplicationAggregate application = new MerchantApplicationAggregate(
      applicationId,
      applicantUserId,
      merchantName
    );
    application.status = Objects.requireNonNull(status, "申请状态不能为空");
    application.reviewerUserId = reviewerUserId;
    application.rejectionReason = rejectionReason;
    return application;
  }

  /** 待审核申请只能通过一次；申请人不得审核自己。 */
  public void approve(String reviewerUserId) {
    ensureSubmitted();
    this.reviewerUserId = requireIndependentReviewer(reviewerUserId);
    this.status = MerchantApplicationStatusEnumVO.APPROVED;
  }

  /** 审核驳回需要理由；已审核申请不能再次审核。 */
  public void reject(String reviewerUserId, String reason) {
    ensureSubmitted();
    String reviewer = requireIndependentReviewer(reviewerUserId);
    String checkedReason = requireText(reason, "驳回原因", 500);
    this.reviewerUserId = reviewer;
    this.rejectionReason = checkedReason;
    this.status = MerchantApplicationStatusEnumVO.REJECTED;
  }

  private void ensureSubmitted() {
    if (status != MerchantApplicationStatusEnumVO.SUBMITTED) {
      throw new AppException(
        ResponseCode.MERCHANT_ALREADY_REVIEWED.getCode(),
        ResponseCode.MERCHANT_ALREADY_REVIEWED.getInfo()
      );
    }
  }

  private String requireIndependentReviewer(String reviewerId) {
    String normalized = requireText(reviewerId, "审核人 ID", 64);
    if (normalized.equals(applicantUserId)) {
      throw new AppException(
        ResponseCode.MERCHANT_SELF_REVIEW_FORBIDDEN.getCode(),
        ResponseCode.MERCHANT_SELF_REVIEW_FORBIDDEN.getInfo()
      );
    }
    return normalized;
  }

  private static String requireText(String value, String name, int limit) {
    if (value == null || value.isBlank()) {
      throw new AppException(ResponseCode.ILLEGAL_PARAMETER.getCode(), name + "不能为空");
    }
    String result = value.trim();
    if (result.length() > limit) {
      throw new AppException(
        ResponseCode.ILLEGAL_PARAMETER.getCode(),
        name + "长度不能超过 " + limit
      );
    }
    return result;
  }
}
