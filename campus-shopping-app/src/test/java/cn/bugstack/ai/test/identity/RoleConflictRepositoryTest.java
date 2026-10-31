package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.infrastructure.adapter.repository.AccessRepository;
import cn.bugstack.ai.infrastructure.dao.IAccessDao;
import cn.bugstack.ai.types.exception.AppException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.test.util.ReflectionTestUtils;

class RoleConflictRepositoryTest {

  private AccessRepository repository(IAccessDao dao) {
    var repository = new AccessRepository();
    ReflectionTestUtils.setField(repository, null, dao, IAccessDao.class);
    return repository;
  }

  @Test
  void knownRoleNameIndexReturnsSafeBusinessCodeWithOriginalCause() {
    var dao = mock(IAccessDao.class);
    var error = new DuplicateKeyException(
      "insert",
      new SQLIntegrityConstraintViolationException(
        "Duplicate entry for key 'iam_merchant_role.uk_merchant_role_name'",
        "23000",
        1062
      )
    );
    doThrow(error).when(dao).createRole("m", "code", "name");
    var thrown = assertThrows(AppException.class, () ->
      repository(dao).createRole("m", "code", "name", Set.of("product.read"))
    );
    assertEquals("M0006", thrown.getCode());
    assertEquals("本商户已存在同名角色", thrown.getInfo());
    assertSame(error, thrown.getCause());
    verify(dao, never()).insertPermissions(anyString(), anyString(), anySet());
  }

  @Test
  void otherUniqueConflictIsNotMisreportedAndDoesNotChangePermissions() {
    var dao = mock(IAccessDao.class);
    var error = new DuplicateKeyException("Duplicate entry for key 'PRIMARY'");
    doThrow(error).when(dao).updateRole("m", "code", "name");
    assertSame(
      error,
      assertThrows(DuplicateKeyException.class, () ->
        repository(dao).updateRole("m", "code", "name", Set.of("product.read"))
      )
    );
    verify(dao, never()).deletePermissions(anyString(), anyString());
    verify(dao, never()).insertPermissions(anyString(), anyString(), anySet());
  }
}
