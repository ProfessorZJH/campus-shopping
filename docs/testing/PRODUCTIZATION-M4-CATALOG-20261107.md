# M4.3 商品、SKU 与多图编辑实施记录

日期：2026-11-07。对应 OpenSpec 任务 5.3；当前代码已具备本批能力，本轮补做定向回归。

## 已确认

- 商品创建/编辑支持多个 SKU、版本号校验和多图顺序维护；SKU 价格、启停和商品上下架均走服务端权限与版本规则。
- 图片上传按商户归属校验，客户端逐文件处理成功、失败、重试、移除和上下文切换；存在未处理失败时阻断保存，避免旧商品被错误覆盖。
- 上架前要求至少一个有效 SKU；已上架商品不能停用最后一个有效 SKU；列表请求保留搜索、状态、分类、排序和当前页语义。

## 定向验证

- `./mvnw -pl campus-shopping-app -am "-Dtest=CatalogOfferLockOrderTest,ProductSkuStatusTest,CatalogPageSkuBatchTest" "-Dsurefire.failIfNoSpecifiedTests=false" "-Dfrontend.skip=true" test`：5 项通过。
- `node --test frontend/tests/product-image-list.test.mjs frontend/tests/product-image-field.test.mjs frontend/tests/identity-races.test.mjs`：27 项通过。
- `npm run build --prefix frontend`、`npm run typecheck --prefix frontend`、契约及 UI 静态产物检查已在前一轮通过。

## 未在本轮宣称

`frontend/tests/ui_product_images.py` 在 AI 推荐占位图场景现有断言处失败（`.rec-item` 实际为 0），与商品编辑/图片上传断言无关；未通过放宽断言或跳过来记为通过。真实后端图片归属和浏览器联调仍留待 5.8/M6。
