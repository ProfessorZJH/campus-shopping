# 全仓结构、文档与冗余清理审查

## 1. 目标与范围

- 目标：审查全部源码、脚本、文档、配置和本地过程目录，统一当前事实口径，删除可再生成或已废弃内容，保留不可重建的交易规则、ADR、发布迁移和测试证据。
- 基线：分支 `codex/defense-review-fixes`；清理前约 1,896 个 Git 跟踪文件、449 个 Java 生产源文件、277 个 Markdown 文件；工作区仅有未跟踪 `.claude/settings.local.json`。
- 不改变业务契约：价格、库存、权限、订单、售后、AI 提案、数据库 schema 与 HTTP 路由均未改变。

## 2. 发现的问题

1. **当前与历史文档混排**：主索引同时列当前规范、逐阶段报告和教程，容易让 AI 把已完成事项重新当待办。
2. **完成态 OpenSpec 未归档**：14 个任务全完成的变更留在 active；其中评测变更仍有 2 项人工验收任务。
3. **文档状态过期**：部分领域仍写“未实现/待确认”，AI 回复仍写“不支持 SSE”，已解决问题与新源码冲突。
4. **统计漂移**：根 README/论文手册把 20 个版本迁移写成 33 个，`campus-shopping-app` 源文件数写成 27（实际 13）。
5. **层级偏差**：`MediaAssetController` 位于 `app/config`，但 HTTP 入口应属于 Trigger；移动后其非 JSON 语义又使契约生成器误识别，需命名为 `MediaAssetEndpoint`。
6. **CI 漂移**：脚本测试只显式运行 2 个文件；浏览器矩阵漏跑 `ui_copy_polish.py`、`ui_three_pages.py`、`ui_permission_correctness.py` 和 `ui_design_system.py`。
7. **旧脚手架入口**：模块内 `build.sh`、`push.sh` 和旧 Dockerfile 指向过时镜像名/部署方式，与根 Dockerfile 和 Compose 重复。
8. **本地过程堆积**：忽略目录 `var/` 有约 24,951 个文件、约 1.63 GB，包括旧虚拟环境、Redis 源码、PR/CI JSON、日志、构建目录和一次性脚本。
9. **显式废弃草案**：未再被运行链路使用的 P1 schema 草案、重复工程对齐稿、旧 UI 信息架构和旧论文材料仍占用现行文档空间。

## 3. 已执行清理

### 3.1 文档与生命周期

- 重写当前文档入口、交付状态、路线图、需求追踪和本地开发入口。
- 将业务决定收敛为已冻结规则与真实剩余边界；修正七个领域状态、SSE、Milvus/Qdrant、事务与 Outbox 说明。
- 新增 ADR-023，明确现行文档、历史证据和 AI 过程记录的保留边界。
- 删除 `p1-schema-draft.deprecated.txt`、重复的 `engineering-alignment.md`、旧 `ui-information-architecture.md`、旧论文材料和无引用 R1 tasks 文件。
- 归档 13 个已完成 OpenSpec 变更到 `openspec/changes/archive/2026-11-21-*`，使用 `--skip-specs` 保持 SDD/ADR 为业务权威。
- 保留 `legacy-db-upgrade-baseline`：其路径仍被历史迁移证据引用，直接移动会破坏只追加报告；保留评测变更：`7.1`、`7.3` 人工任务未完成。

### 3.2 代码与工程结构

- 将媒体入口从 `app/config` 移到 `trigger/http`，并将类名从 `MediaAssetController` 调整为 `MediaAssetEndpoint`，准确区分 JSON API Controller 与 302 资产端点。
- `CartQueryCaseImpl` 改依赖窄接口 `ICatalogReadService`；`ShoppingAiCaseImpl` 清理全限定名和陈旧字段名；Catalog 事务注解改用标准 import。
- 删除模块内过时 `build.sh`、`push.sh` 和 Dockerfile，统一使用根 Dockerfile/Compose。
- 把脚本单测改为目录发现，并补回 4 个现行 Chromium 套件。
- `.gitignore` 增加 `.claude/`，避免本地代理配置再次进入工作区。

### 3.3 本地过程数据

- 删除 `var/` 中除 `uploads` 外的 23 个目录和 133 个顶层临时文件，约 1.63 GB、24,951 个文件。
- 删除根 `.pytest_cache`、前端 `dist` 和空 `artifacts/tmp`。
- 保留 `var/uploads`，因为它是应用运行时文件目录，不属于可安全丢弃的测试过程。

## 4. 本次实际验证

| 检查 | 结果 |
|---|---|
| Java 定向回归（媒体端点、Catalog、购物车、DDD、AI 边界） | PASS，56/56 |
| Java 全量本地测试发现 | PASS，442 项：0 fail / 0 error / 111 skipped；跳过项需隔离 MySQL/Redis/独立进程 |
| Python 锁定 `.venv` | PASS，412 passed / 1 warning |
| 前端格式、类型、Node 单测 | PASS；35/35 Node 测试 |
| UI 构建与生成副本 | PASS，56 modules、artifact 一致 |
| 4 个此前漏跑浏览器套件 | PASS：copy polish 4、three pages 23、permission 10、design 27 |
| API/OpenAPI/schema/DDL/供应链/Mapper | PASS：102 路由、75 schema、13 mapper、0 越界 |
| DDD 边界与 Java 可读性 | PASS：449 个 Java 源文件，0 边界错误 |
| scripts 单测 | PASS，37/37 |
| Python 语法编译 | PASS，`app`、`evaluation`、`tests` 全部可编译 |
| 结构化资源解析 | PASS：435 JSON、6 JSONL、26 YAML、38 XML，0 错误 |
| 图片资源完整性 | PASS：91 PNG、39 WebP、9 SVG，全部可解析 |
| Markdown 链接 | PASS，仓库内 277 个 Markdown 文件、0 断链 |
| OpenSpec active 严格校验 | PASS；剩余 2 个变更，评测变更 23/25 |
| YAML 解析 | PASS：workflow、两份 Compose |

## 5. 未验证与保留的潜在问题

- 本次未在最新工作树重跑隔离 MySQL/Redis、运行中的 Spring/Python、完整真实 HTTP 和全部真实后端浏览器链路；这些状态记为 `NOT_RUN`，不能用本报告的单元/静态结果扩大解释。
- 未调用外部真实 LLM、Embedding 或云端 Milvus；生产部署、HA、SLO、备份恢复和持续压测仍未验收。
- 120 例训练/评测数据仍为 `DRAFT`；人工 gold、回答语义与推荐解释评审是正式质量结论前的硬缺口。
- 审计目前仍只有写入，没有平台/商户查询与导出入口；若需要应另立 API/权限规格。
- `AiGatewayService`、`CatalogServiceImpl` 和两个大型前端页面仍较大。现有窄接口与测试已把交易边界固定，未在没有性能/变化热点证据时做高风险拆包；后续只按实际收益继续拆分。
- legacy 静态页面、生成 UI 快照、历史测试证据和已发布迁移继续保留，它们分别承担兼容、可复现构建、审计追溯和升级安全。
- `.gitattributes` 已要求文本 LF，但部分既有工作区文件仍是 CRLF。本次没有执行全仓 `renormalize`，避免把数千行纯换行变化混入功能差分；文件在下一次 Git 规范化时写入 LF。

## 6. 结论

**代码完成。** 本次清理和定向/全量本地测试通过；当前工作树仍未完成最新隔离全栈、真实外部 AI、生产环境及人工评测验收。
