# Design

## Context

现有 `BackofficeShell` 已被知识库、平台和运营页使用，但商品管理页仍复制侧栏、移动导航、商户切换和页头。`main.js` 继续保留组件路由选择；本次只抽元数据和共享壳，不引入 Vue Router 或全量 SFC 迁移。

## Goals / Non-Goals

**Goals:**

- 让后台共享导航和商户权限映射有唯一来源。
- 让商品管理页使用与其他后台页一致的壳组件。
- 保持现有页面内容、权限过滤、商户切换和请求生命周期。

**Non-Goals:**

- 不改 API、状态模型、路由实现或页面业务逻辑。
- 不迁移全部页面到 SFC、Pinia 或 Vue Router。

## Decisions

- 使用静态 `backoffice-metadata.js` 导出导航、权限和标题数据；数组结构保持现有壳模板使用方式，减少行为变化。
- `ICatalog` 等后端边界不参与本次变更；页面仍通过既有 `store` 和 `api` 服务工作。
- 商品页仅替换共享壳，商品表格、抽屉、弹窗和操作函数保留在页面内。

## Risks / Trade-offs

- [Risk] 壳模板与商品页头部细节存在差异 → 只将页头操作放入 `actions` 插槽，保留商品内容和按钮。
- [Risk] 元数据路径遗漏导致菜单消失 → 保留现有路径全集并运行 RBAC、修复和 Shell 回归。

## Migration Plan

直接替换前端源码即可回滚；不涉及数据或部署迁移。完成定向浏览器/Node 测试后再生成 UI bundle 检查。
