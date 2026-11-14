# 下单到模拟支付 · 代码地图

打开 [交互式代码地图](campus-shopping-order-payment-20261112.html)，从顶部“跟流程走一遍”开始，或点击左侧工程树、中间图节点和右侧说明卡查看三栏联动。右侧说明卡还包含指向项目源码的链接。

本图基于 `main` 分支 `ea1bf0c8968173597351fb8891f34d9e9b5c599f` 的源码，生成日期为 2026-11-12。它聚焦下单、库存预占、模拟支付、取消和到期；源码走读与浏览器渲染检查不代表本次执行了真实 MySQL 业务验收。

地图来自 `xfg-coding-map-skills` 的模板。图例中的“1-3 复用”是模板保留的示例文字，本图中的灰色节点表示已有代码，并非项目的 1-3 版本；蓝色节点表示 MySQL 依赖，并非支付网关。HTML 依赖同目录 `vendor/mermaid.min.js`，移动或分享时请一并保留；源码链接在保持项目目录结构时可用。

## 更新和验证

`map-data.json` 是地图数据源。调整源码说明后，在项目根目录用 PowerShell 重新生成：

```powershell
$skill = Join-Path $HOME '.codex\skills\xfg-coding-map-skills'
node (Join-Path $skill 'scripts\build-map.mjs') --data 'docs\code-map\order-payment\map-data.json' --out 'docs\code-map\order-payment' --force
node 'docs\code-map\order-payment\render-map-compat.mjs' --html 'docs\code-map\order-payment\campus-shopping-order-payment-20261112.html' --force
```

`--force` 会覆盖本目录中的同名生成文件，重生成前应检查已有修改。构建脚本会执行静态校验；渲染检查需要 Node.js 22+ 和 Chrome/Chromium，并输出 SVG、PNG 及渲染验证 JSON。

上游渲染脚本默认用“新增”筛选卡片，而本图只标记已有代码和测试。`render-map-compat.mjs` 在运行时选择一个实际有内容的筛选项，仍检查筛选前后有隐藏卡片、可见卡片及恢复结果；导出 SVG 时使用 XML 序列化，避免 HTML 换行标签产生无效 XML。该适配不修改地图模板或上游技能文件。
