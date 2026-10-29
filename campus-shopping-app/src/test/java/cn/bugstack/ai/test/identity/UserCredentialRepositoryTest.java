package cn.bugstack.ai.test.identity;

import cn.bugstack.ai.infrastructure.adapter.repository.UserAccountRepository;
import cn.bugstack.ai.infrastructure.dao.IUserAccountDao;
import cn.bugstack.ai.infrastructure.dao.po.UserAccountPO;
import cn.bugstack.ai.domain.identity.model.valobj.UserAccountStatusEnumVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 调用真实 BCrypt，DAO 使用测试替身；不是 MySQL 集成测试。 */
class UserCredentialRepositoryTest {
    private final IUserAccountDao dao = mock(IUserAccountDao.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final UserAccountRepository repository = new UserAccountRepository();

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(repository, "userAccountDao", dao);
        ReflectionTestUtils.setField(repository, "passwordEncoder", encoder);
        repository.initializeMissingUserHash();
    }

    private UserAccountPO stored() {
        return UserAccountPO.builder().id("user-1").username("student001").displayName("用户")
                .passwordHash(encoder.encode("correct-password")).status("DISABLED").version(3L).build();
    }

    @Test
    void matchesPasswordAndKeepsDisabledState() {
        when(dao.selectByUsername("student001")).thenReturn(stored());
        var user = repository.findByCredentials("student001", "correct-password").orElseThrow();
        assertEquals(UserAccountStatusEnumVO.DISABLED, user.getStatus());
        assertEquals(3L, user.getVersion());
        assertEquals("user-1", user.getUserId());
    }

    @Test
    void wrongPasswordAndMissingAccountBothReturnEmpty() {
        when(dao.selectByUsername("student001")).thenReturn(stored());
        assertTrue(repository.findByCredentials("student001", "incorrect-password").isEmpty());
        assertTrue(repository.findByCredentials("missing", "incorrect-password").isEmpty());
    }

    @Test
    void queryByIdDoesNotNeedHash() {
        UserAccountPO po = stored();
        po.setPasswordHash(null);
        when(dao.selectById("user-1")).thenReturn(po);
        assertEquals("user-1", repository.findById("user-1").orElseThrow().getUserId());
    }

    @Test
    void poToStringDoesNotLeakHash() {
        UserAccountPO po = stored();
        assertFalse(po.toString().contains(po.getPasswordHash()));
    }
}
