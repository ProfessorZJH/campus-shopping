package cn.bugstack.ai.test.identity;

import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.infrastructure.adapter.repository.UserAccountRepository;
import cn.bugstack.ai.infrastructure.config.PasswordEncoderConfig;
import cn.bugstack.ai.infrastructure.dao.IUserAccountDao;
import cn.bugstack.ai.infrastructure.dao.po.UserAccountPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 基础设施单元测试：验证执行 DAO 插入前已完成 BCrypt 哈希。 */
class UserAccountRepositoryTest {

    private final PasswordEncoder encoder = new PasswordEncoderConfig().passwordEncoder();

    private UserAccountRepository repository(IUserAccountDao dao) {
        UserAccountRepository repository = new UserAccountRepository();
        ReflectionTestUtils.setField(repository, "userAccountDao", dao);
        ReflectionTestUtils.setField(repository, "passwordEncoder", encoder);
        return repository;
    }

    private UserAccountAggregate account() {
        return UserAccountAggregate.register("account-1", "student001", "校园用户");
    }

    @Test
    void insertWritesOnlyBCryptHashToMySqlDao() {
        IUserAccountDao dao = mock(IUserAccountDao.class);
        repository(dao).save(account(), "MySecurePass123!");
        ArgumentCaptor<UserAccountPO> captor = ArgumentCaptor.forClass(UserAccountPO.class);
        verify(dao).insert(captor.capture());
        UserAccountPO po = captor.getValue();
        assertEquals("account-1", po.getId());
        assertEquals("student001", po.getUsername());
        assertEquals("ACTIVE", po.getStatus());
        assertEquals(0L, po.getVersion());
        assertNotEquals("MySecurePass123!", po.getPasswordHash());
        assertTrue(encoder.matches("MySecurePass123!", po.getPasswordHash()));
    }

    @Test
    void duplicateUsernameIsMappedToAppException() {
        IUserAccountDao dao = mock(IUserAccountDao.class);
        when(dao.insert(any(UserAccountPO.class))).thenThrow(new DuplicateKeyException("duplicate"));
        when(dao.countByUsername("student001")).thenReturn(1);
        AppException e = assertThrows(AppException.class,
                () -> repository(dao).save(account(), "MySecurePass123!"));
        assertEquals(ResponseCode.AUTH_USERNAME_EXISTS.getCode(), e.getCode());
    }

    @Test
    void OtherUniqueConflictsAreNotMisreported() {
        IUserAccountDao dao = mock(IUserAccountDao.class);
        when(dao.insert(any(UserAccountPO.class))).thenThrow(new DuplicateKeyException("duplicate"));
        when(dao.countByUsername("student001")).thenReturn(0);
        assertThrows(DuplicateKeyException.class,
                () -> repository(dao).save(account(), "MySecurePass123!"));
    }
}
