# Java 可读性、中文注释与 DDD 规则归属

## 目标

本仓库遵循 Java 17、Spring Boot 3.4.3 与 `xfg-ddd-skills` 的 **API → Trigger → Case → Domain ← Infrastructure** 依赖方向。保持已有 `AppException / ResponseCode`、Spring 事务、MyBatis 数据访问，不为“DDD 文件数量”添加没有独立职责的接口。

## 编码约定

- Java 使用 4 空格、LF、UTF-8；一行只写一条普通语句；花括号按标准 Java 分行；建议行宽约 120，受 CI 保护的核心类上限 160。
- 方法、接口与构造器参数分行时注意对齐；避免一行多个 `import`、连续多个 `if/return` 以及直接压缩源码。
- 类型明确时使用具体 `VO / Aggregate / EnumVO`。Domain 内不应到处比较 `"PAID"` / `"PUBLISHED"` 状态常量；数据表、HTTP DTO 保留原状态编码，由边界完成转换。
- **中文注释解释业务原因，不解释 Java 语法**：优先记录锁顺序、隔离边界、幂等键与重试语义、审批与状态转换、失败回滚、权限复验、模型/索引不可信的原因。
- 长方法先识别业务主线和职责，再评估是否提炼私有方法。不要为了打散代码制造无用途的接口、工厂、策略/责任链。
- 涉及外部 API/向量库时，Domain 只使用 Port；Infrastructure 管理 I/O，不决定“是否允许发布/购买/退款”等业务合法性。
- 数据库事务必须覆盖同库一致性修改。AI 模型调用和文件解析/向量索引不应在持有交易行锁时执行。
- **禁止把真实密钥、密码或内部用户资料写入注释、示例、日志或文档。**

## 本批治理边界（PR4）

先恢复压缩最严重、业务责任最关键的十个 Case/Domain Service 类排版，并补充关键中文业务注释。另将知识发布时的 **READY + 最新版本**判断迁至 `KnowledgePublicationPolicy`；Repository 用同事务的 `FOR UPDATE` 取发布快照再执行 DML。

已有数百个 Java 文件，本 PR **不进行全仓盲目格式化**，因为那会掩盖交易/权限/索引规则的实质变化，并制造难以审查的大差异。新写的 Java 代码直接遵循本约定；后续只在涉及相应文件时渐进修正。

## 可靠性检查

```bash
python scripts/verify-java-readability.py
mvn -B -ntp clean verify
```

GitHub Actions 继续执行原有 Java 领域规则、Python AI、真实 MySQL、173 项 HTTP 和 8 项浏览器检查。以上测试不代表生产已部署，也不代表 NVIDIA/讯飞/Milvus 外部联通验收完成。
