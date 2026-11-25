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

## 当前治理边界

- Controller 只做协议、可信主体、输入校验和响应映射；跨域事务由 Case 编排，业务规则留在 Domain。
- 知识发布必须使用最新且 `READY` 的版本；Repository 在同事务内取发布快照并执行写入。
- 不进行全仓盲目格式化或为“看起来 DDD”创建空接口。涉及热点文件时按实际业务变化渐进收敛。
- 当类同时承担持久化、远程 I/O、业务规则或协议映射中的多项职责时，应先用测试固定行为，再按真实变化轴拆分。

## 可靠性检查

```bash
python scripts/verify-java-readability.py
mvn -B -ntp clean verify
```

GitHub Actions 执行格式、领域/DDD、契约、真实 MySQL/Redis、HTTP、浏览器和镜像检查。具体数量与环境以对应提交的 CI/报告为准；自动化通过不代表生产已部署或外部 AI 已验收。

## 整合后的自动格式化

Java 的 Prettier override 统一为 4 空格、160 列，前端为 2 空格、100 列。运行 `npm run format --prefix frontend`，CI 运行 `format:check`；核心类可读性门禁继续保留。纯排版文件按 Java 语法树核对后单独提交。
