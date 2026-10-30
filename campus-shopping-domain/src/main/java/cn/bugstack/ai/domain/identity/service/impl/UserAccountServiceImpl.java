package cn.bugstack.ai.domain.identity.service.impl;

import cn.bugstack.ai.domain.identity.adapter.repository.IUserAccountRepository;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * 账号领域服务：注册、凭据认证和账号状态复验。
 * final 依赖通过手写构造器注入，符合当前练习选定的编码风格。
 * 一次注册只有一条 INSERT，不需要为了演示而人为引入 Case 模块。
 */
@Service
public class UserAccountServiceImpl implements IUserAccountService {

    private final IUserAccountRepository repository;

    public UserAccountServiceImpl(IUserAccountRepository repository) {
        this.repository = repository;
    }

    @Override
    public UserAccountAggregate register(String username, String password, String displayName) {
        // 1. 用户名统一小写，规避大小写差异造成的重复账号。
        String normalizedUsername = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        if (!normalizedUsername.matches("[a-z][a-z0-9_]{3,31}")) {
            throw invalid("用户名必须为 4~32 位，以字母开头，仅含小写字母、数字和下划线");
        }

        // 2. 密码绝对不能 trim；限制长度及 BCrypt 的 72 字节输入上限。
        if (password == null || password.length() < 8 || password.length() > 64 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw invalid("密码须为 8~64 个字符，UTF-8 不超过 72 字节");
        }

        // 3. 显示名称是用户资料，不是 username。
        String normalizedDisplayName = displayName == null ? "" : displayName.trim();
        if (normalizedDisplayName.isEmpty() || normalizedDisplayName.length() > 50) {
            throw invalid("显示名称必须为 1~50 个字符");
        }

        // 4. 创建账号聚合：只保存账号身份与业务状态，不保存密码。
        UserAccountAggregate account = UserAccountAggregate.register(UUID.randomUUID().toString(), normalizedUsername, normalizedDisplayName);

        // 5. 调用本地仓储：写入数据库前才把临时密码转换成哈希。
        repository.save(account, password);
        return account;
    }

    /** 账号不存在与密码错误使用相同的对外结果。 */
    @Override
    public UserAccountAggregate authenticate(String username, String rawPassword) {
        String normalized = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        if (
            !normalized.matches("[a-z][a-z0-9_]{3,31}") ||
            rawPassword == null ||
            rawPassword.length() < 8 ||
            rawPassword.length() > 64 ||
            rawPassword.getBytes(StandardCharsets.UTF_8).length > 72
        ) {
            throw new AppException(ResponseCode.AUTH_BAD_CREDENTIALS);
        }
        UserAccountAggregate account = repository
            .findByCredentials(normalized, rawPassword)
            .orElseThrow(() -> new AppException(ResponseCode.AUTH_BAD_CREDENTIALS));
        account.ensureActive();
        return account;
    }

    @Override
    public UserAccountAggregate requireActive(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new AppException(ResponseCode.AUTH_UNAUTHENTICATED);
        }
        UserAccountAggregate account = repository.findById(userId).orElseThrow(() -> new AppException(ResponseCode.AUTH_UNAUTHENTICATED));
        account.ensureActive();
        return account;
    }

    @Override
    public String findUserId(String username) {
        String normalized = username == null ? "" : username.strip().toLowerCase(Locale.ROOT);
        UserAccountAggregate user = repository.findByUsername(normalized).orElseThrow(() -> new AppException(ResponseCode.NOT_FOUND));
        user.ensureActive();
        return user.getUserId();
    }

    private static AppException invalid(String info) {
        return new AppException(ResponseCode.ILLEGAL_PARAMETER.getCode(), info);
    }
}
