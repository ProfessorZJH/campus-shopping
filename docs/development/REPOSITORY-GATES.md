# main 保护与 PR 门禁

仓库使用 [AI开发流程](AI-WORKFLOW.md) 和 [PR模板](../../.github/pull_request_template.md)。GitHub 的实际保护设置与代码审查共同约束合并；模板本身不能保证实现正确。

## 配置来源

[main-quality-gates.json](../../.github/rulesets/main-quality-gates.json) 是本仓库期望的 Ruleset 配置。文件存在不代表 GitHub 已启用，修改文件也不会自动更新远端；本次执行状态和证据写在PR描述，远端以仓库 Settings → Rules → Rulesets 及API读回为准。

规则仅匹配 `refs/heads/main`：

- 必须经过PR；用户明确采用个人维护模式，审批数为0，不强制独立审核、CODEOWNER或另一人批准最近推送。将来收紧审批前必须先确认独立合资格审核者。
- 未解决审查会话须先处理；合并仍由本次授权明确决定，未配置自动AI合并。
- 禁止删除main和非快进/强制推送，不设置默认绕过人员或机器人。
- 要求以最新目标分支代码测试（strict），并通过以下来自 GitHub Actions（app ID 15368）的检查：

| 必需检查名 | 用途 |
|---|---|
| Quick quality gates | 格式、可复现UI、契约/DDL、Java领域回归和完整Python测试 |

完整MySQL/Redis/HTTP、浏览器契约与实际镜像作业在main推送、每日北京时间03:00及手动运行，不作为普通PR必需检查。发布前必须核对待发布提交完整验收，不能仅凭快速检查交付。

可选 NVIDIA/讯飞/Milvus 作业按显式配置触发，不列为常规必需检查。没有要求线性历史或指定合并方法，保留依赖PR的普通Merge Commit能力。

## 工作流与保护同步

`.github/workflows/full-release.yml` 对所有PR及main推送运行，不使用工作流级路径过滤，避免AGENTS、PR模板等修改拿不到必需检查。每个PR始终产生 Quick quality gates；完整验收按上述事件运行。

工作流改名、job名称/矩阵或条件改变时，先核对实际check-run名称、来源和执行结果，再同步Ruleset。仅更新JSON不算完成配置。规则收紧前确认当前PR能产生全部必需检查，防止引入无法合并的等待。

## 管理与核验

已授权的管理员通过仓库Settings或GitHub REST API创建/更新Ruleset；已有同名规则优先更新，保留其他规则，不创建重复项。凭据由本机Git凭据管理器或secrets提供，不能写入JSON或文档。

配置后读回 `GET /repos/{owner}/{repo}/rulesets/{ruleset_id}` 和 `GET /repos/{owner}/{repo}/rules/branches/main`，核对生效范围、审批数、Quick quality gates及来源、严格基线、禁止删除/强推和绕过列表。PR最新提交须重新满足检查；main推进后必要时更新分支并复验。

规则变更、迁移与部署各自按本次授权执行。遇到阻断先定位状态检查、权限或基线问题，不为合并失败提交而绕过保护；合法的策略调整由管理员审阅后更新，并记录原因。

官方依据：[Rulesets规则](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)、[缺失/跳过的必需检查](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)、[仓库Rulesets API](https://docs.github.com/en/rest/repos/rules)。

配置文件不会自动更新GitHub。远端Actions与规则是否已生效，以对应PR最新HEAD的完整验收链接和API读回记录为准；应用规则时同步required check名称，审批数按本仓库个人维护模式保持0。
