package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.identity.adapter.repository.IUserAccountRepository;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.model.valobj.UserAccountStatusEnumVO;
import cn.bugstack.ai.domain.identity.service.impl.UserAccountServiceImpl;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** 领域登录规则测试：不依赖安全容器或数据库。 */
class UserAccountAuthenticationTest {

    private final IUserAccountRepository repository = mock(IUserAccountRepository.class);
    private final UserAccountServiceImpl service = new UserAccountServiceImpl(repository);

    @Test
    void loginNormalizesUsernameButDoesNotTrimPassword() {
        UserAccountAggregate user = UserAccountAggregate.register("user-1", "student001", "用户");
        when(repository.findByCredentials("student001", " pass-with-spaces ")).thenReturn(Optional.of(user));
        assertSame(user, service.authenticate(" Student001 ", " pass-with-spaces "));
    }

    @Test
    void badCredentialsDoNotExposeWhetherUserExists() {
        when(repository.findByCredentials("student001", "incorrect-password")).thenReturn(Optional.empty());
        AppException e = assertThrows(AppException.class, () -> service.authenticate("student001", "incorrect-password"));
        assertEquals(ResponseCode.AUTH_BAD_CREDENTIALS.getCode(), e.getCode());
    }

    @Test
    void overlongPasswordRejectedBeforeDatabase() {
        assertThrows(AppException.class, () -> service.authenticate("student001", "x".repeat(73)));
        verifyNoInteractions(repository);
    }

    @Test
    void disabledAccountCannotAuthenticateEvenWithValidCredentials() {
        UserAccountAggregate user = UserAccountAggregate.reconstitute("user-1", "student001", "用户", UserAccountStatusEnumVO.DISABLED, 2L);
        when(repository.findByCredentials("student001", "valid-password")).thenReturn(Optional.of(user));
        AppException e = assertThrows(AppException.class, () -> service.authenticate("student001", "valid-password"));
        assertEquals(ResponseCode.AUTH_ACCOUNT_DISABLED.getCode(), e.getCode());
    }

    @Test
    void requireActiveReadsCurrentStatusAndRejectsDeletedAccount() {
        when(repository.findById("removed-user")).thenReturn(Optional.empty());
        AppException e = assertThrows(AppException.class, () -> service.requireActive("removed-user"));
        assertEquals(ResponseCode.AUTH_UNAUTHENTICATED.getCode(), e.getCode());
    }

    @Test
    void reconstitutionPreservesStatusAndVersion() {
        UserAccountAggregate user = UserAccountAggregate.reconstitute("user-1", "student001", "用户", UserAccountStatusEnumVO.DISABLED, 9L);
        assertEquals(9L, user.getVersion());
        assertThrows(AppException.class, user::ensureActive);
    }

    @Test
    void repositoryOutageIsNotReportedAsWrongPassword() {
        when(repository.findByCredentials("student001", "valid-password")).thenThrow(new IllegalStateException("storage"));
        assertThrows(IllegalStateException.class, () -> service.authenticate("student001", "valid-password"));
    }
}
