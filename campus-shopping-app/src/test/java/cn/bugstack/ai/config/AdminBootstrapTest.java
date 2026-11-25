package cn.bugstack.ai.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.test.util.ReflectionTestUtils;

class AdminBootstrapTest {

    @Test
    void existingAdminSkipsPasswordAuthenticationAfterPasswordRotation() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IAccessService access = mock(IAccessService.class);
        when(accounts.findUserId("admin")).thenReturn("u-admin");
        when(access.isAdmin("u-admin")).thenReturn(true);

        AdminBootstrap bootstrap = new AdminBootstrap(accounts, access);
        ReflectionTestUtils.setField(bootstrap, "username", "admin");
        ReflectionTestUtils.setField(bootstrap, "password", "");

        assertDoesNotThrow(() -> bootstrap.run(new DefaultApplicationArguments()));
        verify(accounts, never()).authenticate(anyString(), anyString());
        verify(access, never()).bootstrapAdmin(anyString());
    }

    @Test
    void existingNonAdminRequiresPasswordVerificationBeforePromotion() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IAccessService access = mock(IAccessService.class);
        when(accounts.findUserId("admin")).thenReturn("u-buyer");
        when(access.isAdmin("u-buyer")).thenReturn(false);
        when(accounts.authenticate("admin", "CorrectPassword123456!")).thenThrow(new AppException(ResponseCode.AUTH_BAD_CREDENTIALS));

        AdminBootstrap bootstrap = new AdminBootstrap(accounts, access);
        ReflectionTestUtils.setField(bootstrap, "username", "admin");
        ReflectionTestUtils.setField(bootstrap, "password", "CorrectPassword123456!");

        AppException thrown = assertThrows(AppException.class, () -> bootstrap.run(new DefaultApplicationArguments()));
        assertEquals(ResponseCode.AUTH_BAD_CREDENTIALS.getCode(), thrown.getCode());
        verify(access, never()).bootstrapAdmin(anyString());
    }

    @Test
    void freshAdminRegistrationRequiresAtLeastSixteenCharsAndGrantsAdmin() {
        IUserAccountService accounts = mock(IUserAccountService.class);
        IAccessService access = mock(IAccessService.class);
        when(accounts.findUserId("admin")).thenThrow(new AppException(ResponseCode.NOT_FOUND));
        UserAccountAggregate created = mock(UserAccountAggregate.class);
        when(created.getUserId()).thenReturn("u-new-admin");
        when(accounts.register("admin", "StrongAdminPassword123!", "平台管理员")).thenReturn(created);
        when(access.isAdmin("u-new-admin")).thenReturn(false);

        AdminBootstrap shortPwd = new AdminBootstrap(accounts, access);
        ReflectionTestUtils.setField(shortPwd, "username", "admin");
        ReflectionTestUtils.setField(shortPwd, "password", "too-short");
        assertThrows(IllegalStateException.class, () -> shortPwd.run(new DefaultApplicationArguments()));

        AdminBootstrap valid = new AdminBootstrap(accounts, access);
        ReflectionTestUtils.setField(valid, "username", "admin");
        ReflectionTestUtils.setField(valid, "password", "StrongAdminPassword123!");
        valid.run(new DefaultApplicationArguments());

        verify(access).bootstrapAdmin("u-new-admin");
        verify(access).audit("u-new-admin", "PLATFORM_ADMIN_BOOTSTRAPPED", "u-new-admin", null, "部署时受控初始化");
    }
}
