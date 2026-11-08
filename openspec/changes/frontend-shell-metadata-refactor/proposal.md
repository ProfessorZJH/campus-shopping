# Proposal

## Why

后台导航、页面标题和权限映射曾由 `BackofficeShell`、`Merchant.js` 与 `main.js` 分别维护，新增后台入口时容易出现菜单、路由和权限漂移。现在抽出共享元数据并让商品管理页复用现有壳，可以降低重复代码，同时保持现有 URL、权限过滤和页面交互。

## What Changes

- 新增后台导航、权限、标题与路由元数据模块。
- `BackofficeShell` 和 `Merchant.js` 复用同一份商户/平台导航与权限元数据。
- `Merchant.js` 复用 `BackofficeShell` 的侧栏、移动导航、商户切换和页头壳，商品管理内容与操作保持原状。
- 不改变前端 URL、API 请求、权限名称、页面数据和交易操作。

## Capabilities

### New Capabilities

无。本次是前端内部结构重构，`.openspec.yaml` 使用 `skip_specs: true`。

### Modified Capabilities

无。现有前端行为契约不变。

## Impact

- 影响 `frontend/src/services/backoffice-metadata.js`、`components/BackofficeShell.js`、`pages/Merchant.js`。
- 不修改 Java、Python、HTTP 契约或生成静态资源；需通过前端页面回归和 Node 请求竞态测试。
