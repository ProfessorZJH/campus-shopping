package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.identity.adapter.repository.IUserAccountRepository;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.model.valobj.UserAccountStatusEnumVO;
import cn.bugstack.ai.infrastructure.dao.IUserAccountDao;
import cn.bugstack.ai.infrastructure.dao.po.UserAccountPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.Resource;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Repository;

/** 本地用户账号仓储实现；使用 @Resource 注入 MyBatis DAO。 */
@Repository
public class UserAccountRepository implements IUserAccountRepository {

    @Resource
    private IUserAccountDao userAccountDao;

    @Resource
    private PasswordEncoder passwordEncoder;

    // 不存在的账号也执行一次匹配，降低明显的时间差异；不是系统登录密码。
    private String missingUserHash;

    @PostConstruct
    public void initializeMissingUserHash() {
        missingUserHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Override
    public void save(UserAccountAggregate account, String rawPassword) {
        // 聚合 -> PO：仅在 Infrastructure 中处理字段映射。
        // 仅在本地持久化边界生成密码摘要，绝不能将明文密码写入数据库。
        String passwordHash = passwordEncoder.encode(rawPassword);
        UserAccountPO po = UserAccountPO.builder()
            .id(account.getUserId())
            .username(account.getUsername())
            .passwordHash(passwordHash)
            .displayName(account.getDisplayName())
            .status(account.getStatus().getCode())
            .version(account.getVersion())
            .build();

        try {
            userAccountDao.insert(po);
        } catch (DuplicateKeyException e) {
            // 即使并发请求同时通过前置检查，数据库唯一索引仍可拦住第二次写入。
            if (userAccountDao.countByUsername(account.getUsername()) > 0) {
                throw new AppException(ResponseCode.AUTH_USERNAME_EXISTS.getCode(), ResponseCode.AUTH_USERNAME_EXISTS.getInfo(), e);
            }
            // 不是用户名重复（例如 UUID 主键冲突），不要假装成业务错误。
            throw e;
        }
    }

    @Override
    public Optional<UserAccountAggregate> findByCredentials(String username, String rawPassword) {
        UserAccountPO po = userAccountDao.selectByUsername(username);
        String hash = po == null ? missingUserHash : po.getPasswordHash();
        boolean matches = passwordEncoder.matches(rawPassword, hash);
        return po != null && matches ? Optional.of(toAggregate(po)) : Optional.empty();
    }

    @Override
    public Optional<UserAccountAggregate> findById(String userId) {
        return Optional.ofNullable(userAccountDao.selectById(userId)).map(this::toAggregate);
    }

    @Override
    public Optional<UserAccountAggregate> findByUsername(String username) {
        return Optional.ofNullable(userAccountDao.selectByUsername(username)).map(this::toAggregate);
    }

    /** 按原状态重建，存储数据异常不可默认为 ACTIVE。 */
    private UserAccountAggregate toAggregate(UserAccountPO po) {
        return UserAccountAggregate.reconstitute(
            po.getId(),
            po.getUsername(),
            po.getDisplayName(),
            UserAccountStatusEnumVO.valueOf(po.getStatus()),
            po.getVersion()
        );
    }
}
