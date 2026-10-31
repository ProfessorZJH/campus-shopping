# PR-B：边界输入与异常契约 · 2026-10-31

基于 PR-A（846de48），独立提交处理 BUG-03、BUG-04，并回归确认 PR #20 已有的 BUG-05 安全日志修复，不重复开发。

AiGatewayService.post 在统一反序列化位置拒绝 JSON null，避免 extract 解引用空值；现有空白/长度检查和上传错误分类保留，不记录响应正文。MerchantApplicationStatusEnumVO.filter 复用 EnumValues，所有 list/count 重载统一在仓储前解析状态。没有新框架、接口拆分或数据库迁移；HTTP、DTO、错误码不变，非法状态由成功空结果改为既有 ILLEGAL_PARAMETER。

## 实际验证

同 PR-A 的独立测试包装器启动随机端口全新 MySQL8.0.31与独立 Redis3.2.100，再调用 `verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke --output docs/testing/evidence/business-fixes-b/mysql.json`。不读取 .env、不连接既有业务库或6379、不替换运行服务。

- Maven clean verify：237项，零失败/错误/跳过。网关协议使用真实JDK TCP和明确标注的远端协议替身，覆盖JSON null、空/空白正文、缺失/null/空白文本、超长文本、无效JSON以及已有4xx/5xx分类；recall/query也验证统一拒绝null。
- 入驻单测覆盖全部有效枚举、空/空白、首尾空白与非法值，所有list/count重载在非法值时均不调用仓储。真实HTTP覆盖平台列表、分页非法state返回0002。
- 真实Spring/MySQL/FastAPI HTTP 201项通过，严格响应139份；双Java共享隔离Redis 9项，真实Chromium 8项通过。AI为本地检索，不将协议替身视为真实模型验收。
- OrderExpiryDiagnosticsTest 同时捕获单笔/扫描异常日志，断言无Throwable堆栈、密钥/异常正文，仅保留安全诊断，原有PR #20实现未改动。
- Python211项通过（1条既有python_multipart弃用警告）；格式、源码/DDD、可读性、56项领域检查、API契约/58项schema、schema校验和与UI生成物一致性通过。

[原始汇总](evidence/business-fixes-b/mysql.json) · [门禁记录](evidence/business-fixes-b/local-gates.json)。源码副本摘要一致，临时数据库和测试进程已清理。先前本地CRLF残留通过规定的build-ui-bundle.py重新生成同步，Git没有UI内容差异。

本地列明范围验收通过；两批PR分别核对最终HEAD完整CI。未合并、部署或迁移现有环境。远程AI/Milvus、生产HA、性能NOT_RUN；PR-C/PR-D按原方案保留为后续治理，不在本批夹带重构。
