# Git 分支与 worktree 整理记录

日期：2026-11-11。用户授权整理并清理、合并可安全收口的旧分支与 worktree。

## 整理结果

以下为分类图标 PR 合并后的核对快照，主线提交为 `913badd9009abd98789101164c3a2fb28cd932b6`；本记录通过独立文档 PR 进入主线。

| 项目 | 整理前 | 整理后 |
|---|---|---|
| 本地 worktree | 16 个 | 1 个：`G:\develop\campus-shopping` |
| 本地分支 | 24 个 | 1 个：`main` |
| 根目录版本 | 旧分支 `639c9a3`，落后原主线 152 个提交 | `main`，与 `origin/main` 一致 |
| 未提交工作 | 根目录与两个旧调试工作区等存在改动 | 旧工作已备份归档，根目录工作区干净 |
| 远端旧开发分支 | 历史阶段分支混杂 | 删除 22 个已合并、补丁等价或已确认 squash 合并的旧分支 |

分类图标已通过 PR #76 合并，新建的图标分支及工作树也已删除。保留现有 stash、归档标签与内部快照引用。

## 备份与恢复

备份位置：`G:\develop\campus-shopping-archive\cleanup-20261111-160712`，位于仓库之外，未提交至 Git。

- `repository-before.bundle`：整理前全部 Git 引用和完整可达历史，`git bundle verify` 通过。
- `refs-before.txt`：原始引用及提交 SHA。
- `inventory.json` 与每个工作区对应的 `.zip`、`.manifest.json`、`.patch`、`.status.txt`：保留源码、未提交文件、报告及私有配置；ZIP CRC 与清单中每个文件的 SHA-256 均已核验。
- `branch-cleanup-plan.json` / `branch-cleanup-result.json`：逐分支记录原提交及删除依据。
- `root-untracked/`：根目录未跟踪文件的独立归档。

`node_modules`、虚拟环境、`target`、缓存等可重建目录不属于工作区 ZIP 备份；根目录当前运行需要的 JAR、私有 `.env` 和 `var` 留在原位。恢复私有快照时应解压到独立目录再检查，避免覆盖当前环境。

恢复原本地分支示例：

```powershell
git fetch 'G:\develop\campus-shopping-archive\cleanup-20261111-160712\repository-before.bundle' 'refs/heads/codex/pilot-run-20261108:refs/heads/restore/pilot-run-20261108'
```

## 独有工作与保留分支

旧本地 `ci-playwright-install-resilience`、`docs-current-status-20261109`、`legacy-db-upgrade-baseline`、`pilot-run-20261108` 分支存在不与当前主线逐补丁等价的历史内容，已由 bundle 保留后删除本地分支，未把旧版本整段覆盖回主线。

两个 detached 调试工作树 `m5-knowledge-debug` 与 `phase1-fixes` 的未提交源码和测试也已保存在对应 ZIP 与补丁中。它们含仍需单独审查的知识索引调试字段、约束短路与请求生命周期实验；本次未将这些实验认定为主线已实现功能。

以下远端分支保留：

- `codex/agent-v1-design-freeze-20261106`：PR #55 仍为草案，包含主线尚无的设计文档。
- `feat/ai-guide-frontend-phase1`：存在 5 个独有提交，未证明可无损合入当前导购实现，未强行合并或删除。
- Dependabot 分支：依赖升级需按兼容性单独验证，本次整理未合并。

七牛旧分支 `codex/qiniu-image-storage-phase2` 已确认由 PR #53 squash 合并为 `c9cd43f`，删除该分支不影响主线七牛实现。

## 实际验证与范围

- 分类图标 PR #76，head `955d8b9`，squash 提交 `913badd`。
- GitHub Actions `Campus Shopping - Real Acceptance` run `42990747343` / #374：`Quick quality gates`、两项 Chromium contract、`Maven / MySQL / FastAPI / Browser E2E` 和 `Actual delivery images / isolated Compose transaction chain` 均成功；可选外部 AI smoke 为 skipped，不计作通过。
- 图标定向验证见 [分类图标报告](CATEGORY-ICONS-20261111.md)，另已通过前端 typecheck、35 项 Node 测试、75 项 schema 检查与 56 项领域检查。
- `git status --short` 无输出；`git rev-list --left-right --count main...origin/main` 为 `0 0`；`git worktree list` 与 `git branch` 均只剩根目录 `main`。
- `git fsck --full --no-reflogs --unreachable` exit 0；输出含历史不可达对象，未执行对象清理或回收。
- 根目录 `.env` SHA-256 与备份清单一致，未输出配置值。
- 本地 `127.0.0.1:8091` 首页与六张分类图标均为 HTTP 200，图标资源大小与已提交资源一致。

本次未迁移业务库、未重启或替换正在运行的服务、未修改七牛对象。运行中的预览仍是此前构建的 Java 配合静态覆盖目录；源码切回最新主线不代表运行进程已升级，也不代表生产、性能或真实供应商效果验收完成。
