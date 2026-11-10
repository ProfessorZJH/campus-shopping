# 旧库升级基线与漂移审计完整验收（2026-11-10）

本轮完成 `legacy-db-upgrade-baseline` 的实现与隔离验收。所有数据库、Maven 构建和 Redis 实例均由验收脚本在临时目录和随机命名空间中创建，未连接或修改既有业务库，也未读取项目 `.env`。

## 实际结果

| 检查 | 结果 |
|---|---|
| `python -X utf8 scripts/schema_contract.py --check` | PASS |
| `python -X utf8 scripts/verify-api-contract.py` | PASS |
| `python -X utf8 scripts/verify-api-schemas.py` | PASS |
| `python -X utf8 scripts/verify-release.py` | PASS |
| `openspec validate legacy-db-upgrade-baseline --strict --no-interactive` | PASS |
| 隔离 MySQL 基线回放 | PASS，MySQL 8.0.31；三份发布基线全部收敛到 `6c77e8dc45f0c5c541f7bad79702e9c609ce8a13794f7b359178db1b806ed6e3` |
| 隔离 Maven 构建 | PASS，443 tests、0 failures、0 errors、0 skipped；Agent Runtime Uvicorn 进程契约已执行 |
| Redis 双实例回归 | PASS；缓存/安全实例隔离、跨实例 Cookie Session、CSRF、登出、限流和单实例故障降级均通过 |
| 交付物一致性 | PASS；隔离构建 JAR 内 UI 与本次源码构建一致，649 个源码摘要与工作树一致 |

完整结构化证据见 [`legacy-full-redis-final.json`](evidence/legacy-db-upgrade-baseline-final-20261110.json)。其中记录了三份基线的目标指纹、MySQL 版本、443 项 JUnit 汇总、临时数据库清理和源码一致性结果。

## 回放覆盖

- 空库初始化、已发布前缀续迁和缺历史补登记。
- 三份不可变发布基线的重复回放、迁移历史和目标指纹等价。
- 缺少 `trd_cart_item` / `ful_pickup_task` 的残缺库在任何 DDL 前拒绝，显式准入写入漂移审计后才继续。
- 重复迁移幂等、迁移校验和篡改、脏数据 CHECK、历史数据保留和漂移审计。
- Java/MySQL 商品、订单、权限集成测试，以及 Python Agent Runtime 真实 Uvicorn 进程契约。

## 未验证范围

本机可用的 MySQL 版本只有 8.0.31；MySQL 8.0.16 和 8.4 的跨版本指纹复验记录为 `NOT_RUN`，没有将单版本结果外推为跨版本通过。真实生产数据库迁移、生产 Redis、外部 AI 供应商和部署验收不在本轮范围内。

验收结束后临时 MySQL 数据目录、临时数据库、两个 Redis 容器和临时 Maven 构建目录均已清理；没有执行 `FLUSHDB`、`FLUSHALL` 或业务数据清理。
