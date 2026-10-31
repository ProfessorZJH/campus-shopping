# OpenSpec 接入试点（2026-10-31）

## 范围与版本

用户授权安装并试用 OpenSpec。本机通过 npm 安装 `@fission-ai/openspec@1.16.0`，使用现有 Node 22.16.0/npm 10.9.2；仅初始化 Codex 的 6 个项目级 Skills。变更在 `codex/openspec-pilot` 开展，基于前序治理提交 `65b9aa2`；当时远端 main 为 `b923d63`，前序治理仍在 PR #12 中。

配置与使用说明明确复用既有 PRD/SDD/ADR 和验收流程；尚未迁移的业务保持原规格归属。首个变更 `adopt-openspec-pilot` 只涉及工具和文档，显式设置 `skip_specs: true`，不杜撰产品行为来填满规格目录。

## 实际检查

| 检查 | 实际结果 |
|---|---|
| `openspec --version` | 1.16.0 |
| `openspec context --json` / `doctor --json` | 根目录解析到本工作区；healthy=true，无诊断问题 |
| `openspec status --change adopt-openspec-pilot --json` | proposal/design/tasks 齐全；specs 按元数据明确跳过 |
| `openspec instructions apply --change adopt-openspec-pilot --json` | 能读取项目上下文、operation guidance 及 4 项任务，并识别逐项进度变化 |
| `openspec validate adopt-openspec-pilot --strict --no-interactive --json` | 1 个变更通过，0 失败；仅有 skip_specs 的正常 INFO 提示 |
| `openspec update --dry-run --json` | changes/notes/failures 全为空，官方生成的 Skills 无漂移 |
| 文档入口相对链接检查 | 最终含归档入口共 73 个目标存在，0 缺失 |
| 生成 Skills 与变更范围检查 | 6 个 SKILL.md；变更均在工具、配置和文档范围，无业务/依赖/锁文件改动 |
| `git diff --check` | 通过 |

以上检查仅证明工具接入和文档一致性。

## 归档结果

- 归档前 `instructions apply` 返回 `state=all_done`，4/4 项完成；`openspec list --json` 同样识别 complete。
- 实际执行 `openspec archive adopt-openspec-pilot --yes --json`，返回 `archivedAs=2026-10-31-adopt-openspec-pilot`、`specsUpdated=false`，与纯工具变更范围一致。
- [归档产物](../../openspec/changes/archive/2026-10-31-adopt-openspec-pilot/proposal.md)包含 proposal/design/tasks 和元数据。
- `openspec validate --archived --strict --no-interactive --json`：1 个归档通过，0 失败，0 issues。
- 归档后 `openspec list --json` 返回空的进行中变更列表。

这次没有业务 delta，所以验证了无规格变化的生命周期；业务增量规格同步与真实业务开发尚未试用，不能宣称这部分也已验收。

## 验收边界

本次未修改 Java/Python/Vue 业务代码、API、数据库、应用依赖或 CI 检查，也未操作业务库、Redis 或远程模型。未重跑 Maven/MySQL、pytest、HTTP、浏览器及远端 Actions；不能把本次工具接入验收写成业务全栈通过。

本地归档表示工具试点任务完成，不表示 PR 合并或部署完成。仓库配置目前仅在此工作分支；其他工作区需取得变更后才具有同样项目接入。本机全局 CLI 已可用，匿名使用统计已关闭。
