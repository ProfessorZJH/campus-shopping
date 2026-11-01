package cn.bugstack.ai.test.identity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.infrastructure.adapter.repository.RoleRepository;
import cn.bugstack.ai.infrastructure.dao.IAccessDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class RoleListBatchTest {

    @Test
    void hundredRolesUseTwoQueriesAndKeepOrderAndEmptyPermissions() {
        var dao = mock(IAccessDao.class);
        var repository = new RoleRepository();
        ReflectionTestUtils.setField(repository, "accsessDao", dao);
        var roles = new ArrayList<MerchantRolePO>();
        var grants = new ArrayList<RolePermissionPO>();
        for (int n = 0; n < 100; n++) {
            roles.add(new MerchantRolePO("merchant", "r" + n, "角色" + n));
            if (n > 0) grants.add(new RolePermissionPO("r" + n, "product.read"));
        }
        when(dao.roles("merchant")).thenReturn(roles);
        when(dao.rolePermissionRows("merchant")).thenReturn(grants);
        var result = repository.customRoles("merchant");
        assertEquals(100, result.size());
        assertTrue(result.get(0).permissions().isEmpty());
        for (int n = 1; n < 100; n++) {
            assertEquals("r" + n, result.get(n).code());
            assertEquals(Set.of("product.read"), result.get(n).permissions());
        }
        verify(dao).roles("merchant");
        verify(dao).rolePermissionRows("merchant");
        verifyNoMoreInteractions(dao);
    }

    @Test
    void noRolesSkipPermissionReadAndSingleRoleAuthorizationRemainsLive() {
        var dao = mock(IAccessDao.class);
        var repository = new RoleRepository();
        ReflectionTestUtils.setField(repository, "accsessDao", dao);
        assertTrue(repository.customRoles("empty").isEmpty());
        verify(dao).roles("empty");
        verifyNoMoreInteractions(dao);
        when(dao.rolePermissions("m", "r")).thenReturn(Set.of("product.read"), Set.of());
        assertEquals(Set.of("product.read"), repository.customPermissions("m", "r"));
        assertTrue(repository.customPermissions("m", "r").isEmpty());
        verify(dao, times(2)).rolePermissions("m", "r");
    }
}
