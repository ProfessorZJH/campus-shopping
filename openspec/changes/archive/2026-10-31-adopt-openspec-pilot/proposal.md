# Proposal

## Why

现有 AI 开发流程已覆盖设计、实现和验收，但缺少统一的需求变更目录与任务进度。用户已授权安装并试用 OpenSpec，本次用工具接入自身验证流程，不扩大到业务开发。

## What Changes

- 安装 OpenSpec 1.16.0，生成 Codex 的项目级 Skills。
- 配置中文产物、项目上下文和与既有 PRD/SDD/ADR 的职责关系。
- 增加使用说明并链接现有开发入口，实际验证规划、任务追踪、严格校验和归档。
- 本次只修改开发工具与文档，因此声明 `skip_specs: true`，不创建虚构业务需求。

## Capabilities

### New Capabilities

无。此次没有产品行为变化，尚不建立新的业务规格基线。

### Modified Capabilities

无。保留现有业务规格、API、数据库、交易与权限语义。

## Impact

影响 `openspec/`、`.agents/skills/`、`AGENTS.md` 和开发文档；本机安装全局 npm CLI。复用 Node 22.16.0，不改变应用依赖与锁文件，不访问业务库或外部模型。当前分支继承尚未合并的 AI 治理提交，后续发布时须处理这一依赖；本地归档不代表 PR 已合并。
