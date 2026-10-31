package cn.bugstack.ai.domain.identity.adapter.repository;

/** 请求额度；返回0表示准入，正数表示建议重试秒数。主体不得包含密码或会话。 */
public interface IRequestQuotaRepository {
  long acquire(String policy, String subject, int permits, int intervalSeconds);
}
