# Design

## Context

动机见 [proposal.md](proposal.md)。仓库已有 PRD、SDD、ADR、生成 API 契约及 AI 开发流程，本机已有 Node 22.16.0/npm；主线尚未包含前序治理提交，本试点基于该提交开展。

## Goals / Non-Goals

**Goals:** 用最小接入确认 OpenSpec 能读取项目上下文、管理变更产物、解析任务、执行严格校验并归档。

**Non-Goals:** 不迁移全部历史 SDD、不新增业务功能、不调整 DDD、不改 CI 必需检查、不自动合并或部署。

## Decisions

1. 使用全局 npm 固定安装 `@fission-ai/openspec@1.16.0`，只对仓库执行 `init --tools codex --language zh-CN --profile core`。不用前端依赖安装开发流程工具，保持应用锁文件稳定。
2. 保留官方生成的 6 个 Skills，不修改其内容；项目特有约束放在 `openspec/config.yaml` 和使用说明中。官方默认提案只做规划；用户明确授权的安装与试用覆盖本次工具接入实施，未来业务任务按当次授权推进。
3. PRD/已接受 SDD/ADR 继续约束业务；后续试点对明确能力建立 OpenSpec 行为规格时，同步原文档引用和权威归属，避免双份规范。没有既有行为基线时，先核对源码、契约和已接受规格再声明修改。
4. 本次为工具/文档变更，使用官方支持的 `skip_specs: true`，仍保留 proposal/design/tasks 并验证生命周期；不为满足校验杜撰产品需求。
5. 本地归档保留试点证据，表示工具与文档任务完成，不表示 PR/主线发布完成。以真实 CLI 返回值及 Git 差异核对验收边界。

## Risks / Trade-offs

- 工具版本与官方 main 文档不一致 → 使用已安装 1.16.0 的 `--help` 和实际输出确认命令，升级先审查生成文件差异。
- 新旧规格冲突 → 未迁移业务维持原权威，迁移能力须显式说明范围与引用；冲突先澄清，不以自动生成结果覆盖规则。
- 将规格校验误认为业务验收 → 文档明确严格校验只检查结构；实际业务测试、Actions 和人工合并决策继续执行。

## Migration Plan

本机 CLI 可用后提交仓库配置/Skills/说明供后续审阅；其他工作区须取得这些文件才有项目接入。回退时撤销本次接入文件与入口，再按需执行 `npm uninstall -g @fission-ai/openspec`；业务数据与运行服务不受影响。
