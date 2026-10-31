package cn.bugstack.ai.domain.merchant.service;

import cn.bugstack.ai.domain.merchant.model.aggregate.MerchantApplicationAggregate;

/** 商户申请的领域业务能力。 */
public interface IMerchantApplicationService {
  MerchantApplicationAggregate submit(
    String applicantUserId,
    String merchantName,
    String requestKey
  );
  MerchantApplicationAggregate submitDetailed(
    String applicantUserId,
    cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity command,
    String requestKey
  );
  cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO approveAndOpen(
    String applicationId,
    String reviewerId
  );
  void reject(String applicationId, String reviewerId, String reason);
  java.util.List<MerchantApplicationAggregate> list(
    String userId,
    String status,
    int page,
    int size
  );
  java.util.List<MerchantApplicationAggregate> list(
    String userId,
    String status,
    int page,
    int size,
    String q
  );
  long count(String userId, String status);
  long count(String userId, String status, String q);
  String applicantOf(String id);
}
