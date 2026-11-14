# 校园智能导购 · 项目全景代码地图

打开 [项目全景交互图](campus-shopping-project-overview-20261112.html)，点击顶部“跟流程走一遍”，或点击左侧工程树、中间图节点和右侧说明卡查看联动。左侧可以搜索类名；中间图支持拖动、缩放和适配窗口；说明卡包含项目源码与相关专题链接。

- **全景图**：消费者、商户、平台三个角色，Java 各模块、七个业务领域、Python AI 服务和主要数据依赖。
- **时序图**：一个智能导购会话，从页面、会话租约、Python 检索到用户确认提案并加购。
- **流程图**：按三类角色和七个业务领域展示主要业务能力。
- **专题**：如需查看订单的库存预占、模拟支付、取消与到期细节，打开 [下单到模拟支付](../order-payment/README.md)。

图中使用代表类展示模块职责和主要协作，线条有些是跨模块的抽象协作，而非逐一列出每个方法的直接调用。说明卡提供相关类、契约和运行手册入口。支付均为模拟；Milvus、Qdrant、外部模型和 Agent Runtime 是否启用以环境配置为准。

## 基线与范围

基于 `main` 分支 `ea1bf0c8968173597351fb8891f34d9e9b5c599f` 的当前工作区源码，生成日期为 2026-11-12。此图记录源码走读和地图渲染检查，不代表本次运行了业务测试，也不代表真实 MySQL、Redis、模型供应商、生产环境或性能通过了新的验收；实际范围请查阅[测试报告索引](../../README.md)。

地图模板保留了示例图例：“1-3 复用”中的 1-3 不是本项目版本；本图灰色节点代表已有代码，蓝色代表图中的外部数据或模型依赖，“外部网关”是模板原有文字。HTML 使用同目录的 `vendor/mermaid.min.js`；移动或分享时需保留该目录，源码链接则依赖原有项目目录结构。

## 更新和验证

`map-data.json` 是唯一地图数据源。源码变化后先重新核对事实、提交与日期，再在项目根目录用 PowerShell 生成：

```powershell
$skill = Join-Path $HOME '.codex\skills\xfg-coding-map-skills'
node (Join-Path $skill 'scripts\build-map.mjs') --data 'docs\code-map\project-overview\map-data.json' --out 'docs\code-map\project-overview' --force
node 'docs\code-map\order-payment\render-map-compat.mjs' --html 'docs\code-map\project-overview\campus-shopping-project-overview-20261112.html' --force
```

`--force` 会覆盖对应的生成文件，操作前应先检查已有修改。构建会运行静态校验；浏览器渲染检查需要 Node.js 22+ 和 Chrome/Chromium，成功后生成 SVG、PNG 和渲染验证 JSON。

项目共用的 `order-payment/render-map-compat.mjs` 适配上游渲染器的分类筛选，并在导出 SVG 时使用 XML 序列化：它仍验证筛选后有可见及隐藏卡片、重置后全部恢复。HTML 运行不依赖该验证脚本。
