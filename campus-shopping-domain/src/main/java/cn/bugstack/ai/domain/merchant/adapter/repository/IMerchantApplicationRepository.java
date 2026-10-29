package cn.bugstack.ai.domain.merchant.adapter.repository;

import cn.bugstack.ai.domain.merchant.model.aggregate.MerchantApplicationAggregate;
import java.util.Optional;

/**
 * 商户申请仓储抽象。
 * Domain 只声明需要的持久化能力，不认识 MyBatis、PO 或 SQL。
 */
public interface IMerchantApplicationRepository {
    /** 相同用户+幂等键最多写入一条申请，保证并发重复提交安全。 */
    void insertIfAbsent(MerchantApplicationAggregate application, String requestKey);

    /** 根据申请人及请求幂等键，读取该次请求最终保存的申请。 */
    Optional<MerchantApplicationAggregate> findByApplicantAndRequestKey(String applicantUserId, String requestKey);
    MerchantApplicationAggregate lock(String id);
    void saveReview(MerchantApplicationAggregate application);
    long count(String userId, String status);
    long count(String userId, String status, String q);
    java.util.List<MerchantApplicationAggregate> list(String userId, String status, int offset, int limit);
    java.util.List<MerchantApplicationAggregate> list(String userId, String status, int offset, int limit, String q);
}
