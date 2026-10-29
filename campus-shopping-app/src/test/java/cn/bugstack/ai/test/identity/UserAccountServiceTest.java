package cn.bugstack.ai.test.identity;

import cn.bugstack.ai.domain.identity.adapter.repository.IUserAccountRepository;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.model.valobj.UserAccountStatusEnumVO;
import cn.bugstack.ai.domain.identity.service.impl.UserAccountServiceImpl;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

/** 领域服务单元测试：使用模拟仓储，不启动 Spring 容器或真实数据库。 */
class UserAccountServiceTest {

    @Test
    void registerNormalizesFieldsAndDoesNotStorePasswordInAggregate() {
        FakeRepository repository = new FakeRepository();
        UserAccountServiceImpl service = new UserAccountServiceImpl(repository);
        UserAccountAggregate user = service.register(
                " Student001 ", "MySecurePass123!", " 校园用户 ");

        assertEquals("student001", user.getUsername());
        assertEquals("校园用户", user.getDisplayName());
        assertEquals(UserAccountStatusEnumVO.ACTIVE, user.getStatus());
        assertEquals(0L, user.getVersion());
        assertNotNull(user.getUserId());
        assertSame(user, repository.saved);
        assertTrue(repository.receivedExpectedCredential);
        // 聚合不允许暴露明文密码字段，也不能暴露密码摘要字段。
        assertFalse(java.util.Arrays.stream(UserAccountAggregate.class.getDeclaredFields())
                .anyMatch(field -> field.getName().toLowerCase().contains("password")));
    }

    @Test
    void invalidFieldsAreRejectedBeforePersistence() {
        FakeRepository repository = new FakeRepository();
        UserAccountServiceImpl service = new UserAccountServiceImpl(repository);
        AppException badUsername = assertThrows(AppException.class,
                () -> service.register("a", "MySecurePass123!", "测试用户"));
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), badUsername.getCode());
        AppException badPassword = assertThrows(AppException.class,
                () -> service.register("student001", "123", "测试用户"));
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), badPassword.getCode());
        assertNull(repository.saved);
    }

    @Test
    void duplicateUsernameIsRejectedThroughRepositoryContract() {
        FakeRepository repository = new FakeRepository();
        UserAccountServiceImpl service = new UserAccountServiceImpl(repository);
        service.register("student001", "MySecurePass123!", "首次注册");
        AppException exception = assertThrows(AppException.class,
                () -> service.register("STUDENT001", "MySecurePass123!", "重复注册"));
        assertEquals(ResponseCode.AUTH_USERNAME_EXISTS.getCode(), exception.getCode());
    }

    static class FakeRepository implements IUserAccountRepository {
        @Override public Optional<UserAccountAggregate> findByUsername(String username) { return Optional.ofNullable(saved).filter(a -> a.getUsername().equals(username)); }
        @Override
        public Optional<UserAccountAggregate> findByCredentials(String username, String rawPassword) {
            return Optional.empty();
        }
        @Override
        public Optional<UserAccountAggregate> findById(String userId) {
            return Optional.ofNullable(saved).filter(account -> account.getUserId().equals(userId));
        }
        private final Set<String> usernames = new HashSet<>();
        UserAccountAggregate saved;
        boolean receivedExpectedCredential;
        @Override
        public void save(UserAccountAggregate account, String rawPassword) {
            if (!usernames.add(account.getUsername())) {
                throw new AppException(ResponseCode.AUTH_USERNAME_EXISTS);
            }
            saved = account;
            receivedExpectedCredential = "MySecurePass123!".equals(rawPassword);
        }
    }
}
