package cn.bugstack.ai.domain.merchant.service;

import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantApplicationRepository;
import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository;
import cn.bugstack.ai.domain.merchant.model.aggregate.MerchantApplicationAggregate;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.model.valobj.*;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 提交商户入驻申请的领域服务。
 *
 * 通过 Spring @Service 管理领域服务，依赖 Repository 抽象而非 MyBatis DAO。
 * 通过手写构造器注入 Repository 抽象；不引入无实际用途的策略或责任链。
 */
@Service
public class MerchantApplicationServiceImpl implements IMerchantApplicationService {

  private final IMerchantApplicationRepository repository;

  private final IMerchantRepository merchants;

  public MerchantApplicationServiceImpl(
    IMerchantApplicationRepository repository,
    IMerchantRepository merchants
  ) {
    this.repository = repository;
    this.merchants = merchants;
  }

  @Override
  @Transactional(rollbackFor = Exception.class)
  public MerchantApplicationAggregate submitDetailed(
    String user,
    AdmissionCommandEntity command,
    String key
  ) {
    String validKey = requireKey(key);
    MerchantApplicationAggregate incoming = MerchantApplicationAggregate.submitDetailed(
      UUID.randomUUID().toString(),
      user,
      command
    );
    repository.insertIfAbsent(incoming, validKey);
    MerchantApplicationAggregate saved = repository
      .findByApplicantAndRequestKey(user, validKey)
      .orElseThrow(() -> new IllegalStateException("提交后未找到申请"));
    Checks.require(
      Objects.equals(saved.getDetails(), incoming.getDetails()),
      ResponseCode.MERCHANT_REQUEST_CONFLICT
    );
    return saved;
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public MerchantVO approveAndOpen(String id, String reviewer) {
    MerchantApplicationAggregate a = repository.lock(id);
    Checks.require(a != null, ResponseCode.NOT_FOUND);
    Checks.require(
      !a.getApplicantUserId().equals(reviewer),
      ResponseCode.MERCHANT_SELF_REVIEW_FORBIDDEN
    );
    if (a.getStatus() == MerchantApplicationStatusEnumVO.APPROVED) {
      MerchantVO existing = merchants.find(a.getOpenedMerchantId(), false);
      Checks.require(existing != null, ResponseCode.STATE_CONFLICT);
      return existing;
    }
    a.requireComplete();
    a.approve(reviewer);
    a.attachMerchant(UUID.randomUUID().toString());
    AdmissionCommandEntity c = a.getDetails();
    MerchantVO m = new MerchantVO(
      a.getOpenedMerchantId(),
      a.getApplicationId(),
      c.name(),
      c.category(),
      "ACTIVE",
      UUID.randomUUID().toString(),
      c.storeName(),
      c.location()
    );
    repository.saveReview(a);
    merchants.save(m);
    return m;
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public void reject(String id, String reviewer, String reason) {
    MerchantApplicationAggregate a = repository.lock(id);
    Checks.require(a != null, ResponseCode.NOT_FOUND);
    a.reject(reviewer, reason);
    repository.saveReview(a);
  }

  @Override
  public List<MerchantApplicationAggregate> list(String user, String state, int page, int size) {
    return list(user, state, page, size, "");
  }

  @Override
  public List<MerchantApplicationAggregate> list(
    String user,
    String state,
    int page,
    int size,
    String q
  ) {
    return repository.list(user, state, Checks.offset(page, size), size, Checks.optional(q, 100));
  }

  @Override
  public MerchantApplicationAggregate submit(
    String applicantUserId,
    String merchantName,
    String requestKey
  ) {
    // 1. 请求幂等键和业务字段合法性检查。
    String validKey = requireKey(requestKey);
    MerchantApplicationAggregate incoming = MerchantApplicationAggregate.submit(
      UUID.randomUUID().toString(),
      applicantUserId,
      merchantName
    );

    // 2. 并发情况下依赖数据库 UNIQUE 约束和幂等写入，避免两条申请。
    repository.insertIfAbsent(incoming, validKey);

    // 3. 读取最终落库的申请，同一个键重复提交返回同一申请 ID。
    MerchantApplicationAggregate saved = repository
      .findByApplicantAndRequestKey(incoming.getApplicantUserId(), validKey)
      .orElseThrow(() -> new IllegalStateException("提交后未查询到申请"));

    // 4. 同一键不能代表另一份申请内容（返回冲突业务码）。
    if (!saved.getMerchantName().equals(incoming.getMerchantName())) {
      throw new AppException(
        ResponseCode.MERCHANT_REQUEST_CONFLICT.getCode(),
        ResponseCode.MERCHANT_REQUEST_CONFLICT.getInfo()
      );
    }
    return saved;
  }

  @Override
  public long count(String user, String status) {
    return count(user, status, "");
  }

  @Override
  public long count(String user, String status, String q) {
    return repository.count(user, status, Checks.optional(q, 100));
  }

  @Override
  public String applicantOf(String id) {
    MerchantApplicationAggregate a = repository.lock(id);
    Checks.require(a != null, ResponseCode.NOT_FOUND);
    return a.getApplicantUserId();
  }

  private static String requireKey(String key) {
    if (key == null || key.isBlank()) {
      throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
    }
    String normalized = key.trim();
    if (normalized.length() > 64) {
      throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
    }
    return normalized;
  }
}
