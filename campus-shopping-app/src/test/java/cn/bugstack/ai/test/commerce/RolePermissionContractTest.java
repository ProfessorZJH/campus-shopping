package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import cn.bugstack.ai.domain.identity.adapter.repository.IAccessRepository;
import cn.bugstack.ai.domain.identity.adapter.repository.IRoleRepository;
import cn.bugstack.ai.domain.identity.model.valobj.MerchantPermissionEnumVO;
import cn.bugstack.ai.domain.identity.model.valobj.MerchantRoleVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.impl.RoleServiceImpl;
import cn.bugstack.ai.trigger.http.RoleController;
import cn.bugstack.ai.types.exception.AppException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 固定权限字典、创建/修改领域入口和 HTTP 入口必须保留同一错误语义。 */
class RolePermissionContractTest {

    private static final String ROLE_CODE = "R0123456789ab";
    private static final String ROLE_PATH = "/api/v1/merchants/m/rbac/roles";
    private final ObjectMapper mapper = new ObjectMapper();
    private IRoleRepository repository;
    private IAccessRepository members;
    private IAccessService access;
    private RoleServiceImpl service;
    private MockMvc http;

    @BeforeEach
    void setUp() {
        repository = mock(IRoleRepository.class);
        members = mock(IAccessRepository.class);
        access = mock(IAccessService.class);
        service = new RoleServiceImpl(repository, members, access);
        var controller = new RoleController();
        ReflectionTestUtils.setField(controller, "roleService", service);
        ReflectionTestUtils.setField(controller, "authorization", access);
        http = MockMvcBuilders.standaloneSetup(controller).build();
    }

    static Stream<Arguments> invalidGrants() {
        List<Arguments> cases = new ArrayList<>();
        cases.add(Arguments.of("null collection", null, "0002"));
        cases.add(Arguments.of("empty collection", Set.of(), "0002"));
        cases.add(Arguments.of("null element", new LinkedHashSet<>(Arrays.asList("product.read", null)), "0002"));
        cases.add(Arguments.of("unknown permission", Set.of("unknown"), "A0006"));
        cases.add(Arguments.of("missing dependency before unknown", new LinkedHashSet<>(List.of("product.write", "unknown")), "A0006"));
        cases.add(Arguments.of("unknown before missing dependency", new LinkedHashSet<>(List.of("unknown", "product.write")), "A0006"));
        for (var permission : MerchantPermissionEnumVO.values()) {
            if (!permission.isGrantable()) {
                cases.add(Arguments.of("protected " + permission.getCode(), Set.of(permission.getCode()), "A0006"));
            } else if (permission.prerequisite() != null) {
                cases.add(Arguments.of("missing prerequisite for " + permission.getCode(), Set.of(permission.getCode()), "0002"));
            }
        }
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidGrants")
    void invalidGrantsHaveConsistentErrorsBeforeAnyWrite(String label, Set<String> permissions, String expectedCode) throws Exception {
        assertEquals(expectedCode, assertThrows(AppException.class, () -> MerchantPermissionEnumVO.validateGrant(permissions)).getCode());
        for (String roleCode : new String[] { null, ROLE_CODE }) {
            assertEquals(expectedCode, assertThrows(AppException.class, () -> service.saveRole("owner", "m", roleCode, "角色", permissions)).getCode());
        }
        assertHttpCode(permissions, expectedCode);
        verifyNoInteractions(repository, members);
        verify(access, never()).audit(anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void validGrantCanBeCreatedAndUpdatedWithoutChangingItsPermissions() throws Exception {
        Set<String> permissions = new LinkedHashSet<>();
        for (var permission : MerchantPermissionEnumVO.values()) if (permission.isGrantable()) permissions.add(permission.getCode());
        var checked = MerchantPermissionEnumVO.validateGrant(permissions);
        assertEquals(permissions, checked);
        assertThrows(UnsupportedOperationException.class, () -> checked.add("unknown"));
        when(repository.customRole("m", ROLE_CODE, true)).thenReturn(new MerchantRoleVO(ROLE_CODE, "旧角色", Set.of("product.read"), false));
        assertEquals(permissions, service.saveRole("owner", "m", null, "角色", permissions).permissions());
        assertEquals(permissions, service.saveRole("owner", "m", ROLE_CODE, "角色", permissions).permissions());
        assertHttpCode(permissions, "0000");
        verify(repository, times(2)).createRole(eq("m"), anyString(), eq("角色"), eq(permissions));
        verify(repository, times(2)).updateRole("m", ROLE_CODE, "角色", permissions);
    }

    private void assertHttpCode(Set<String> permissions, String code) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "角色");
        body.put("permissions", permissions);
        byte[] json = mapper.writeValueAsBytes(body);
        for (var request : List.of(post(ROLE_PATH), put(ROLE_PATH + "/" + ROLE_CODE))) {
            http.perform(
                request
                    .principal(() -> "owner")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json)
            )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(code));
        }
    }
}
