package cn.bugstack.ai.domain.identity.adapter.repository;

import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import java.util.Optional;

/** 本地账号仓储：凭据摘要的生成和匹配仅在基础设施层完成。 */
public interface IUserAccountRepository {
  void save(UserAccountAggregate account, String rawPassword);

  /** 凭据不匹配或账号不存在时均返回空；不对 Domain 暴露密码摘要。 */
  Optional<UserAccountAggregate> findByCredentials(String username, String rawPassword);

  /** 按信任的用户 ID 读取当前账号状态，不读取密码摘要。 */
  Optional<UserAccountAggregate> findById(String userId);
  Optional<UserAccountAggregate> findByUsername(String username);
}
