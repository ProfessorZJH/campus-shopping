# 前端全页面批次：实际验证记录

日期：2026-10-28

## 已执行并通过

| 执行命令 | 结果 | 说明 |
|---|---:|---|
| `python scripts/build-ui-bundle.py` | 通过 | 实际 Chromium Vue 模板预编译，14 个模板（含根组件）。 |
| `python frontend/tests/ui_three_pages.py` | 23 项通过 | 前三页视觉、交互与 API 契约回归，无未捕获 JS 错误。 |
| `python frontend/tests/ui_remaining.py` | 32 项通过 | 26 个页面路由渲染、消费者及商户导航、移动端横向溢出、预览禁写。 |
| `python frontend/tests/ui_remaining_contract.py` | 9 项通过 | 购物车下单幂等键、支付、审核、商户申请、补货、强制下架、知识库创建等。**后端是测试替身。** |
| `python frontend/tests/contract_ui.py` | 20 项通过 | R1 前端老功能的契约回归；只验证替身。 |
| `python scripts/verify-source.py` | 通过 | 静态源码、Java17 语法与 Mapper/DDL/POM 对应；**不是 Maven 构建**。 |

测试截图：`docs/testing/evidence/ui-rest-pages/`（购物车、待自提、账号、商户订单、库存、知识库、平台审核/争议/知识库等）。测试使用 `page.set_content` 加载真实 Vue 运行时与预编译模板，**不是使用图片生成工具制造截图**。

## 尚未通过/受环境阻塞

- `npm --prefix frontend run build`：失败 `vite: not found`，本机未安装前端依赖（源码可使用预编译发布）。
- Chromium 通过 `page.goto(http://127.0.0.1:...)` 访问临时 HTTP 服务：测试环境返回 `net::ERR_BLOCKED_BY_ADMINISTRATOR`；因此采用真正浏览器 DOM 注入和 API 测试替身，但没有宣称本机 HTTP 导航已通过。
- 完整 Maven 编译、真实 Spring Boot/MySQL 全链路、Docker、Cookie/CSRF 在真实 Servlet 容器中的联调、真实 Qdrant/LLM 仍未执行成功。

## 推荐完整验收

在具备网络、JDK17、Maven 和 MySQL 的本地/CI 环境运行：

```bash
cd frontend
npm install
npm run build
cd ..
mvn -B -ntp clean verify
python scripts/dev-up.py
python scripts/smoke-full.py
python frontend/tests/live_ui.py
```

运行前检查 `.env` 和测试数据库隔离。`dev-up.py` 需要 Docker 与能下载镜像/依赖；不把命令列出等同于已执行。
