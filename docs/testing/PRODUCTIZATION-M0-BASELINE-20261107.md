# M0 实施基线与设计准备记录（2026-11-07）

## 基线刷新

- 当前工作分支：`codex/productization-m3-conversations`，最新提交 `31fe864`，工作树在记录时干净。
- 远端 PR #56（M1）和 PR #57（M2）已于 2026-11-06 合并到 `main`，合并提交分别为 `062d1ef`、`843a9d1`；本轮 M3/M4/M5 代码继续在独立分支开发，不修改 Claude 的其他工作树。
- 本批范围按 M3→M4→M5→M6 顺序推进；交易事实仍由 Java/MySQL 复验，Redis/Python/真实供应商与生产域名不因本地定向检查而宣称完成。

## 设计与兼容冻结

- D2 公共样式、状态面板、窄屏/键盘及加载/空态/错误/提交中清单沿用 `docs/development/FRONTEND.md`、`docs/specs/UI-THREE-PAGES.md` 和 M1 代表页面报告。
- 新增能力均保留旧 JSON/旧统计接口兼容；新增统计、库存筛选、检索调试字段和路由已同步生成 API/OpenAPI/schema/响应规则。
- 提案商品身份、订单地点快照、售后事件、会话引用与统计口径分别归属既有 SDD/行为契约；本批没有重复迁移既有业务表。

## 适用验收条件

开发阶段执行定向 Java、Python、契约、UI 生成和 Chromium/API-double 检查；真实隔离 MySQL/Redis、CI、跨端矩阵和真实供应商效果留给 4.9/5.8/6.4/7.2/7.3。
