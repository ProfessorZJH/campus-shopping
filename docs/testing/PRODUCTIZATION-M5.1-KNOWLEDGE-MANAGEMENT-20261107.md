# M5.1 知识管理定向验证（2026-11-07）

## 已确认范围

- 知识库、文档和版本页面支持上传、预览、发布、撤回、索引状态展示与失败重试。
- 当前 `index_attempt`、发布状态和失败类别由服务端事实驱动；旧尝试不能覆盖新尝试，诊断不回显下游正文。
- 页面按当前身份和工作区切换取消旧请求，避免旧版本或旧身份覆盖当前状态。

## 定向验证

| 命令 | 结果 |
|---|---|
| `./mvnw -q -pl campus-shopping-app -am '-Dtest=KnowledgePublicationPolicyTest,ProductVectorSyncJobTest,AiGatewayProductIndexTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dfrontend.skip=true' test` | 15 tests / 0 failures / 0 errors / 0 skipped |
| `python frontend/tests/ui_sdd_integration.py` | PASS，15 个浏览器检查 |

本轮未执行真实 Python/Redis/向量服务联调；对应重试和权限边界由隔离整合任务覆盖。
