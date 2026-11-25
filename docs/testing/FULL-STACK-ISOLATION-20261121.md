# 隔离真实后端全栈验收

## 1. 范围与环境

- 源码：`codex/defense-review-fixes`，验证基线 `805d0b5`；验收器确认测试期间源码未变化。
- MySQL：临时 MySQL 8.0.31 数据目录，随机 loopback 端口；未连接现有 3306。
- Redis：两个独立 `redis:7.4.2-alpine` 容器，随机 loopback 端口和随机密码；未复用现有实例。
- Java：仓库源码在临时目录全量构建，JDK 17、Maven Wrapper 3.9.9。
- Python：临时 FastAPI/Uvicorn，本地检索模式；未调用外部真实 LLM/Embedding。
- 浏览器：真实 Chromium 访问真实 Spring/MySQL/FastAPI，不使用 API mock。

## 2. 执行结果

| 范围 | 结果 |
|---|---|
| 空库初始化、旧库升级、重放、漂移拒绝、校验和拒绝 | PASS |
| Maven 全量测试 | PASS，451 tests / 0 failures / 0 errors / 0 skipped |
| 真实 HTTP 业务链 | PASS，291 项 |
| OpenAPI 真实响应校验 | PASS，213 个响应 |
| 双 Java 实例共享 Redis | PASS，9 项 |
| 基础真实浏览器 | PASS，22 项 |
| 最终隔离浏览器矩阵 | PASS，26 项 |
| M2 下单/支付/备货/核销/退款浏览器 | PASS，5 项 |
| JAR 中 UI 与当前源码构建 | 逐文件一致 |
| 临时 MySQL、Java、Python 与 Redis 清理 | PASS |

首次运行暴露并修复了 Windows 下 `RedisServerFaultIsolationTest` 的子进程启动问题：Surefire 工作目录是模块目录，相对 `scripts/redis-test-server.py` 无法解析。改用绝对 Python/helper 路径后，该测试与其他 449 项 Java 测试全部通过。

## 3. 证据

本地产物位于忽略目录 `var/verify/`：

- `verify-mysql-isolated.json`：总报告。
- `full-http.json`：真实 HTTP 与 OpenAPI 响应证据。
- `redis-shared-http.json`：双实例 Redis 回归。
- `frontend-live/`、`frontend-live-final/`、`frontend-live-m2/`：浏览器结果与截图。
- `verified-build/`：本次实际测试 JAR、release manifest、source manifest 和 Surefire 报告。

这些文件默认不进入 Git；需要正式发布证据时，应在明确授权的 CI 任务中设置 `CAMPUS_EVIDENCE_DIR`。

## 4. 边界

本次通过的是列明范围的隔离真实后端验收。外部供应商语义质量、生产 HTTPS/代理、HA、SLO、备份恢复、持续负载和 120 例人工 gold 冻结仍需独立验收。
