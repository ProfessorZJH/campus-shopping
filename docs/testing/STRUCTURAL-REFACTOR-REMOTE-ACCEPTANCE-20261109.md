# 结构重构远端真实验收记录

> 日期：2026-11-09
> Pull Request：[PR #63](https://github.com/ProfessorZJH/campus-shopping/pull/63)
> 代码提交：`afe7ce4`
> 合并提交：`89e2981`
> GitHub Actions：[Campus Shopping - Real Acceptance #324](https://github.com/ProfessorZJH/campus-shopping/actions/runs/42547947832)

## 结果

PR #63 对应的远端真实验收已通过。必需检查均为 `success`：Quick quality gates、Maven / MySQL / FastAPI / Browser E2E、Chromium contract（current、legacy）和 Actual delivery images / isolated Compose transaction chain。

## 环境与范围

- GitHub Actions runner：`ubuntu-24.04`。
- Java：Temurin 17；Maven Wrapper 执行真实 `clean verify` 和 MySQL 测试。
- Python：3.11；执行 FastAPI、AI 单测、评测与本地 HTTP 容量/重启检查。
- Node：22.16.0；执行前端格式、类型、Node 测试、UI bundle 校验和 Chromium 契约。
- 数据基础设施：隔离 MySQL `8.0.36`、Redis `7.4.2`、独立 Qdrant；运行结束后清理隔离服务。
- 业务范围：迁移新库/升级/重放/校验和、Java/MySQL、跨服务 HTTP、双 Java/共享 Redis、Spring 前端浏览器、M2 履约浏览器、容器交付镜像。

## 结果边界

- 真实 NVIDIA、XFYUN、Milvus smoke 按工作流配置跳过，不能由本次结果推断真实外部供应商效果。
- 生产部署、生产数据、长期运行、性能目标和真实支付仍需各自验收。
- 本记录是远端运行证据摘要；详细日志与报告由上述 Actions run 保留，仓库中的摘要用于在 artifact retention 到期后维持可追溯性。
