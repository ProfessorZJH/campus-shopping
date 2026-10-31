package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.UserAccountPO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** MyBatis Mapper 接口：只声明 SQL 行为，不编写业务判断。 */
@Mapper
public interface IUserAccountDao {
  int insert(UserAccountPO user);

  /** 唯一键冲突后再次确认具体是 username 重复，避免误报主键冲突。 */
  int countByUsername(@Param("username") String username);

  /** 登录校验使用，只允许 Repository 读取凭据摘要。 */
  UserAccountPO selectByUsername(@Param("username") String username);

  /** 日常查询不选取 password_hash 列。 */
  UserAccountPO selectById(@Param("userId") String userId);
}
