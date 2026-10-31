package cn.bugstack.ai.domain.identity.model.aggregate;

import cn.bugstack.ai.domain.identity.model.valobj.UserAccountStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.Objects;
import lombok.Getter;

/** 账号聚合：只拥有身份与状态，不持有任何密码字段。 */
@Getter
public class UserAccountAggregate {

  private final String userId;
  private final String username;
  private final String displayName;
  private final UserAccountStatusEnumVO status;
  private final long version;

  private UserAccountAggregate(
    String userId,
    String username,
    String displayName,
    UserAccountStatusEnumVO status,
    long version
  ) {
    if (
      userId == null ||
      userId.isBlank() ||
      username == null ||
      username.isBlank() ||
      displayName == null ||
      displayName.isBlank() ||
      version < 0
    ) {
      throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
    }
    this.userId = userId;
    this.username = username;
    this.displayName = displayName;
    this.status = Objects.requireNonNull(status, "账号状态不能为空");
    this.version = version;
  }

  /** 注册新账号：始终初始化为正常状态，不授予商户权限。 */
  public static UserAccountAggregate register(String userId, String username, String displayName) {
    return new UserAccountAggregate(
      userId,
      username,
      displayName,
      UserAccountStatusEnumVO.ACTIVE,
      0L
    );
  }

  /** 从存储重建聚合：不能通过 register 把停用账号错误恢复为正常。 */
  public static UserAccountAggregate reconstitute(
    String userId,
    String username,
    String displayName,
    UserAccountStatusEnumVO status,
    long version
  ) {
    return new UserAccountAggregate(userId, username, displayName, status, version);
  }

  /** 登录和后续受保护访问都需核对当前账号状态。 */
  public void ensureActive() {
    if (status != UserAccountStatusEnumVO.ACTIVE) {
      throw new AppException(ResponseCode.AUTH_ACCOUNT_DISABLED);
    }
  }
}
