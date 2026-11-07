# M5.2/M5.3 检索调试定向验证（2026-11-07）

## 已实现范围

- 新增只读 `POST /api/v1/ai/debug/retrieval`，复用正式知识可见范围、检索和回答端口，不创建会话、不产生提案。
- 服务端在返回前重新核对可读范围、文档根版本和发布/索引状态；命中返回文档、版本、片段、排名、分数类型、检索/回答模式及可选回答预览。
- 通过 AI 用户/全局限流保护调试入口；商户与平台工作区均提供调试页和导航入口。

## 定向验证

| 命令 | 结果 |
|---|---|
| `./mvnw -q -pl campus-shopping-trigger -am -DskipTests compile` | 通过 |
| `./mvnw -q -pl campus-shopping-app -am '-Dtest=AiGatewayProtocolTest' '-Dsurefire.failIfNoSpecifiedTests=false' test` | 通过 |
| `python scripts/generate-api-contract.py` | 通过 |
| `python scripts/verify-api-contract.py` | 通过 |
| `python scripts/verify-api-schemas.py` | PASS，75 项 |
| `python scripts/build-ui-bundle.py --check` | 通过 |

真实 Python/Redis/向量服务、跨租户数据和浏览器调试页矩阵留待 M5.4/M6；本报告不把本地替身模式当成真实语义效果证明。
