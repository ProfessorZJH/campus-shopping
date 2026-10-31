package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantApplicationRepository;
import cn.bugstack.ai.domain.merchant.model.aggregate.MerchantApplicationAggregate;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantApplicationStatusEnumVO;
import cn.bugstack.ai.infrastructure.dao.IMerchantApplicationDao;
import cn.bugstack.ai.infrastructure.dao.po.MerchantApplicationPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import java.util.*;
import org.springframework.stereotype.Repository;

/** 入驻申请数据库映射，审核资格与状态转换不在仓储中决定。 */
@Repository
public class MerchantApplicationRepository implements IMerchantApplicationRepository {

  @Resource
  private IMerchantApplicationDao merchantApplicationDao;

  public void insertIfAbsent(MerchantApplicationAggregate a, String requestKey) {
    MerchantApplicationPO p = toPO(a);
    p.setRequestKey(requestKey);
    merchantApplicationDao.insertIfAbsent(p);
  }

  public Optional<MerchantApplicationAggregate> findByApplicantAndRequestKey(
    String user,
    String key
  ) {
    return Optional.ofNullable(merchantApplicationDao.queryByApplicantAndRequestKey(user, key)).map(
      this::fromPO
    );
  }

  public MerchantApplicationAggregate lock(String id) {
    MerchantApplicationPO p = merchantApplicationDao.lock(id);
    return p == null ? null : fromPO(p);
  }

  public void saveReview(MerchantApplicationAggregate a) {
    if (merchantApplicationDao.saveReview(toPO(a)) != 1) throw new AppException(
      ResponseCode.STATE_CONFLICT
    );
  }

  public List<MerchantApplicationAggregate> list(
    String user,
    String status,
    int offset,
    int limit
  ) {
    return list(user, status, offset, limit, "");
  }

  public List<MerchantApplicationAggregate> list(
    String user,
    String status,
    int offset,
    int limit,
    String q
  ) {
    return merchantApplicationDao
      .list(user, status, offset, limit, q)
      .stream()
      .map(this::fromPO)
      .toList();
  }

  public long count(String user, String status) {
    return count(user, status, "");
  }

  public long count(String user, String status, String q) {
    return merchantApplicationDao.count(user, status, q);
  }

  private MerchantApplicationAggregate fromPO(MerchantApplicationPO p) {
    return MerchantApplicationAggregate.restoreDetailed(
      p.getApplicationId(),
      p.getApplicantUserId(),
      p.getMerchantName(),
      MerchantApplicationStatusEnumVO.valueOf(p.getStatus()),
      p.getReviewerUserId(),
      p.getRejectionReason(),
      new AdmissionCommandEntity(
        p.getMerchantName(),
        p.getCategory(),
        p.getContactName(),
        p.getContactPhone(),
        p.getStoreName(),
        p.getCampusLocation()
      ),
      p.getOpenedMerchantId(),
      p.getVersion()
    );
  }

  private MerchantApplicationPO toPO(MerchantApplicationAggregate a) {
    MerchantApplicationPO p = MerchantApplicationPO.builder()
      .applicationId(a.getApplicationId())
      .applicantUserId(a.getApplicantUserId())
      .merchantName(a.getMerchantName())
      .status(a.getStatus().name())
      .reviewerUserId(a.getReviewerUserId())
      .rejectionReason(a.getRejectionReason())
      .openedMerchantId(a.getOpenedMerchantId())
      .version(a.getVersion())
      .build();
    AdmissionCommandEntity c = a.getDetails();
    if (c != null) {
      p.setCategory(c.category());
      p.setContactName(c.contactName());
      p.setContactPhone(c.contactPhone());
      p.setStoreName(c.storeName());
      p.setCampusLocation(c.location());
    }
    return p;
  }
}
