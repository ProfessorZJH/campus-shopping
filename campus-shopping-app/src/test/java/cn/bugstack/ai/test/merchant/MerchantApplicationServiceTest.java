package cn.bugstack.ai.test.merchant;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantApplicationRepository;
import cn.bugstack.ai.domain.merchant.model.aggregate.MerchantApplicationAggregate;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantApplicationStatusEnumVO;
import cn.bugstack.ai.domain.merchant.service.MerchantApplicationServiceImpl;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;

/**
 * 纯领域业务测试：放在官方脚手架的 app/src/test 下，但不启动 Spring 和 MySQL。
 * 用 FakeRepository 代替 MyBatis，验证业务逻辑与幂等语义。
 */
class MerchantApplicationServiceTest {

  @Test
  void shouldSubmitApplication() {
    var service = new MerchantApplicationServiceImpl(
      new FakeRepository(),
      org.mockito.Mockito.mock(
        cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository.class
      )
    );
    var result = service.submit("student-1", "校园水果店", "req-001");
    assertEquals("student-1", result.getApplicantUserId());
    assertEquals("校园水果店", result.getMerchantName());
    assertEquals(MerchantApplicationStatusEnumVO.SUBMITTED, result.getStatus());
    assertNotNull(result.getApplicationId());
  }

  @Test
  void sameUserAndKeyShouldReturnSameApplication() {
    var service = new MerchantApplicationServiceImpl(
      new FakeRepository(),
      org.mockito.Mockito.mock(
        cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository.class
      )
    );
    var first = service.submit("student-1", "校园水果店", "req-002");
    var second = service.submit("student-1", "校园水果店", "req-002");
    assertEquals(first.getApplicationId(), second.getApplicationId());
  }

  @Test
  void keyWithDifferentBodyShouldReturnConflict() {
    var service = new MerchantApplicationServiceImpl(
      new FakeRepository(),
      org.mockito.Mockito.mock(
        cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository.class
      )
    );
    service.submit("student-1", "校园水果店", "req-003");
    AppException error = assertThrows(AppException.class, () ->
      service.submit("student-1", "校园文具店", "req-003")
    );
    assertEquals(ResponseCode.MERCHANT_REQUEST_CONFLICT.getCode(), error.getCode());
  }

  @Test
  void approvalCannotBeRepeated() {
    var aggregate = MerchantApplicationAggregate.submit("app-1", "student-1", "校园水果店");
    aggregate.approve("admin-1");
    AppException error = assertThrows(AppException.class, () ->
      aggregate.reject("admin-2", "无效资料")
    );
    assertEquals(ResponseCode.MERCHANT_ALREADY_REVIEWED.getCode(), error.getCode());
  }

  private static final class FakeRepository implements IMerchantApplicationRepository {

    @Override
    public MerchantApplicationAggregate lock(String id) {
      return entries
        .values()
        .stream()
        .filter(a -> a.getApplicationId().equals(id))
        .findFirst()
        .orElse(null);
    }

    @Override
    public void saveReview(MerchantApplicationAggregate application) {}

    @Override
    public java.util.List<MerchantApplicationAggregate> list(
      String user,
      String status,
      int offset,
      int limit
    ) {
      return java.util.List.copyOf(entries.values());
    }

    @Override
    public java.util.List<MerchantApplicationAggregate> list(
      String user,
      String status,
      int offset,
      int limit,
      String q
    ) {
      return list(user, status, offset, limit);
    }

    @Override
    public long count(String user, String status) {
      return entries.size();
    }

    @Override
    public long count(String user, String status, String q) {
      return entries.size();
    }

    private final Map<String, MerchantApplicationAggregate> entries = new ConcurrentHashMap<>();

    @Override
    public void insertIfAbsent(MerchantApplicationAggregate application, String requestKey) {
      entries.putIfAbsent(application.getApplicantUserId() + ":" + requestKey, application);
    }

    @Override
    public Optional<MerchantApplicationAggregate> findByApplicantAndRequestKey(
      String applicantUserId,
      String requestKey
    ) {
      return Optional.ofNullable(entries.get(applicantUserId + ":" + requestKey));
    }
  }
}
