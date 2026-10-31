# OpenSpec 试用

OpenSpec 用于较大需求变更的提案、行为规格、设计、任务追踪及归档；工程约束、实现验证和交付继续遵循 [AI 开发流程](AI-WORKFLOW.md)。简单文案、样式和局部修复仍可只写 PR，不强制建立变更目录。

## 安装与接入范围

本次试用版本为 **1.16.0**，npm 要求 Node >=22.12.0，仓库现用 Node 22.16.0 满足要求。CLI 安装在本机，仓库内的配置与 Skills 随 Git 管理；其他工作区或电脑需取得这些文件，安装全局 CLI 并检查版本：

```powershell
npm install -g @fission-ai/openspec@1.16.0
openspec --version
```

已初始化的仓库无需重复 init。本次初始化使用 `openspec init --tools codex --language zh-CN --profile core --no-animation`，仅生成 Codex 的 6 个项目级 Skills，不修改前端/Java/Python 依赖。项目根为包含 `openspec/config.yaml` 的仓库目录，可用 `openspec context --json` 核对；在其他检出目录运行前先确认项目根。

本机已通过 `openspec config set telemetry.enabled false` 关闭匿名使用统计；这是本机设置，不随仓库分发。升级 CLI 后先审查 `openspec update --dry-run --json`，再决定更新生成的 Skills，避免手改后被覆盖。

## 资料归属

| 内容 | 维护位置 |
|---|---|
| 工程约束与开发交付流程 | `AGENTS.md`、`docs/development/AI-WORKFLOW.md` |
| 原始需求、已接受设计与架构取舍 | `docs/requirements/`、`docs/specs/`、`docs/architecture/decisions.md` |
| 已明确纳入 OpenSpec 的能力行为基线 | `openspec/specs/<capability>/spec.md` |
| 本次拟议变化与实现任务 | `openspec/changes/<change>/` |
| 实际验收证据与历史范围 | `docs/testing/` |

尚未迁移的业务继续以已有已接受规格为准。首次对已有能力建立 OpenSpec 基线时，先核对相关 SDD、源码和生成契约，明确新目录维护哪些行为，再将旧文档相应段落改为引用；原设计细节与 ADR 继续保留。既有行为先建立完整基线，再用 MODIFIED delta 修改；新能力使用 ADDED，不把旧业务改动伪装成新能力。遇到规则冲突须先解决，不能以自动生成内容静默覆盖。

本次纯工具和文档接入在变更元数据中设置 `skip_specs: true`，不创建产品行为规格；这不是业务变更免写规格的通道，也没有批量迁移历史 SDD。

## 日常怎么用

你可以直接说“用 OpenSpec 规划多轮导购的预算与约束继承”，由 AI 读取现状并整理提案。默认提案阶段只规划；你看过后说“按这个方案实现”，再按任务推进。如果已明确授权完整实施，则按当次授权处理，不因工具模板重复索取已有授权。

Codex 新一轮消息中可加载这些项目 Skills；桌面版也可在 Skills 入口选择。CLI/IDE 的技能名称如下：

| 用途 | Skill |
|---|---|
| 探索问题与方案 | `$openspec-explore` |
| 生成提案、规格、设计和任务 | `$openspec-propose` |
| 实施既有任务 | `$openspec-apply-change` |
| 调整进行中的变更 | `$openspec-update-change` |
| 同步增量规格到能力基线 | `$openspec-sync-specs` |
| 检查并归档完成的变更 | `$openspec-archive-change` |

按实际变更名执行检查，以下 `change-name` 为占位符，不能原样当作现有任务：

```powershell
openspec list --json
openspec status --change change-name --json
openspec instructions apply --change change-name --json
openspec validate change-name --strict --no-interactive
```

`status` 的产物完成只表示文件齐全；任务进度要看 `instructions apply`。`validate` 校验规格结构，不执行 Java/Python/浏览器业务回归。订单、库存、模拟支付、权限、迁移等仍须按现有流程验证真实事务、并发、幂等及越权，并通过对应 Actions。

归档前核对任务、实际结果和规格差异；涉及能力 delta 时同步基线。`openspec archive change-name --yes` 是 CLI 的非交互方式，仅在已确认范围和完成条件时使用，不以该选项绕过未完成任务或未解决的规格冲突。归档记录在 `openspec/changes/archive/`，它表示变更记录已整理，不代表 PR 已获审核、已合并或已部署。

## 本次试点与退出

首个变更为 `adopt-openspec-pilot`：只完成安装、项目上下文、入口文档及 CLI 生命周期核验。实际结果见 [试点记录](../testing/OPENSPEC-PILOT-20261031.md)。后续可选一个真实业务需求继续试用，本次没有默认启动 AI 功能开发。

若停止试用，可按 Git 差异撤销此次接入文件及文档引用；需要移除本机 CLI 时执行 `npm uninstall -g @fission-ai/openspec`。保留需要追溯的规格与归档记录。业务数据和运行服务不依赖 OpenSpec。

官方资料：[仓库](https://github.com/Fission-AI/OpenSpec)、[安装](https://github.com/Fission-AI/OpenSpec/blob/main/docs/installation.md)、[CLI](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md)。命令选项以本机固定版本的 `--help` 为准。
