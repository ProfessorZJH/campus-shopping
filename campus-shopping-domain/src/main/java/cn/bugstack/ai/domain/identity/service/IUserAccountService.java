package cn.bugstack.ai.domain.identity.service;

import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;

/** 账号领域能力；不感知 HTTP、Session 或 Spring Security 的类型。 */
public interface IUserAccountService {
  UserAccountAggregate register(String username, String password, String displayName);
  /** 校验登录凭据与账号状态，不负责建立浏览器会话。 */
  UserAccountAggregate authenticate(String username, String rawPassword);
  /** 重新读取并检查已登录账号的当前状态。 */
  UserAccountAggregate requireActive(String userId);
  String findUserId(String username);
}
