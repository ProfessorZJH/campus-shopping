# Spec Delta

## Purpose

让知识回答的每条引用都能回溯到授权的不可变文档版本、确定性分块和真实片段位置，并在服务端和 Python 端共同阻断内部内容外泄。

## ADDED Requirements

### Requirement: Citations identify an authorized immutable chunk
引用 MUST 包含文档版本、确定性 chunk 标识、片段位置或等价的可验证定位；Java MUST 在输出前核验文档仍处于当前授权范围、版本和发布状态。公开引用还须核验片段确实来自该 chunk；内部引用以确定性 chunkId、序号和内容哈希核验定位，不要求跨服务传输原文片段。

#### Scenario: Stale version
- **WHEN** 模型返回旧文档版本的引用，而当前授权范围已发布新版本
- **THEN** Java 拒绝该回答并返回知识不可用，不向用户展示旧引用

#### Scenario: Wrong chunk
- **WHEN** chunkId 与 snippet 不属于同一文档版本
- **THEN** Java 拒绝引用，不以文档正文包含片段替代 chunk 定位

### Requirement: Internal evidence is minimized at every boundary
内部文档的原文片段、存储路径和未授权标题 MUST NOT 出现在 Python 对外响应或 Java 消费者回答；公开文档才可展示经过长度限制的可验证片段。

#### Scenario: Internal document citation
- **WHEN** 检索命中仅对商户可见的内部资料
- **THEN** Python 对未列入服务端外发名单的文档只返回受控来源标识和固定脱敏说明；Java 以 chunkId、序号与内容哈希复验定位后，再按内部资料脱敏展示，不返回内部原文

### Requirement: Knowledge answers require relevant evidence
知识回答 MUST 将引用合法性、Gold 证据覆盖和回答事实支持分别记录；仅引用合法不能被记录为证据覆盖或回答支持通过。

#### Scenario: Valid but irrelevant citation
- **WHEN** 引用来自授权文档且片段存在，但不覆盖问题所需 Gold 证据
- **THEN** citation validity 可通过，evidence recall/coverage 为 0，回答支持率保持待人工或失败
