package cn.bugstack.ai.config;

import cn.bugstack.ai.domain.identity.service.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 受控初始化：密码仅来自部署环境，永不写入 SQL/日志，也不开放赋予管理员的 HTTP 接口。 */
@Component
@ConditionalOnProperty(name = "campus.bootstrap.enabled", havingValue = "true")
public class AdminBootstrap implements ApplicationRunner {

    private final IUserAccountService accounts;
    private final IAccessService access;

    @Value("${campus.bootstrap.username}")
    private String username;

    @Value("${campus.bootstrap.password}")
    private String password;

    public AdminBootstrap(IUserAccountService accounts, IAccessService access) {
        this.accounts = accounts;
        this.access = access;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void run(ApplicationArguments args) {
        String userId;
        try {
            userId = accounts.findUserId(username);
            // 管理员已初始化且仍具备平台管理员角色时直接幂等放行，允许部署后轮换密码而不阻断重启。
            if (access.isAdmin(userId)) {
                return;
            }
            if (password == null || password.length() < 16) {
                throw new IllegalStateException("管理员初始化密码至少 16 位，必须通过环境变量设置");
            }
            // 同名普通账号须凭初始化密码核验身份，禁止静默提权已有非管理员用户。
            accounts.authenticate(username, password);
        } catch (AppException e) {
            if (!ResponseCode.NOT_FOUND.getCode().equals(e.getCode())) throw e;
            if (password == null || password.length() < 16) {
                throw new IllegalStateException("管理员初始化密码至少 16 位，必须通过环境变量设置");
            }
            userId = accounts.register(username, password, "平台管理员").getUserId();
        }
        if (!access.isAdmin(userId)) {
            access.bootstrapAdmin(userId);
            access.audit(userId, "PLATFORM_ADMIN_BOOTSTRAPPED", userId, null, "部署时受控初始化");
        }
    }
}
