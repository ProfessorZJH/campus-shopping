# R1 六批整改记录

输入为用户提供的完整整改方案。起点重新核对 `origin/main@ba735fa`（PR #15 已合并，已包含 `589826a`），旧报告的未修复状态不能直接视为当前状态。

| 批次 | 范围 | 状态 |
|---|---|---|
| A | CI 密钥边界、地址安全、context-path、生产配置、旧部署模板 | 完整远端验收通过（下述范围） |
| B | AI 预算/数量最终复核、无报价文案、评测阶段/来源/cleanup、HTML XSS | 完整远端验收通过（下述范围） |
| C | 知识索引 claim/lease/完成、发布并发、商户配额 | 实现完成，隔离 MySQL 验证中 |
| D | 身份/请求隔离、幂等、表单/图片上下文、路由、分页、无障碍/窄屏 | 待实施 |
| E | 订单/商品同步扫描、恢复、readiness、响应上限、外发与指标 | 待实施 |
| F | 镜像固定、SBOM、最终真实联调、容量/故障与发布边界 | 待实施 |

## A 实际验证

- Python 全量 `python -m pytest -q`：188 PASS；包含公网明文、URL 凭据、错误端口/片段、未列入名单的内网对端及合法 HTTPS/回环/显式内网。
- Maven 定向 `ContextPathQuotaTest,ProductionSecurityGuardTest,ProtocolBoundaryTest`：6 PASS，0 skipped。验证根路径及 `/campus` 下四类额度、商户身份、不安全生产参数拒绝。
- `verify-release.py`、`verify-java-readability.py`：PASS（静态检查）。首次 Maven 参数被 PowerShell 拆分后未执行测试，修正参数引用后上述结果通过。
- Docker Engine 本机不可用：本地镜像链路 NOT_RUN，交由对应提交的远端 CI 验收。
- 首次远端完整运行 `41197651139`：快速、完整 Maven/MySQL/FastAPI/浏览器及两个 Chromium 契约任务通过；镜像链路失败。日志确认本地覆盖使用 dev profile 后仅监听容器内回环地址，宿主映射端口请求被重置，0项HTTP执行。修复为容器内 `SERVER_ADDRESS=0.0.0.0`，宿主仍只映射127.0.0.1。须以修复后的完整运行替代首次失败，不能计为全部通过。
- 修复后 `f341fe2` 的[完整远端验收](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41198074538)五个普通任务全部成功：快速、Maven/MySQL/FastAPI/Redis/HTTP/浏览器、current/legacy Chromium 契约、真实交付镜像。可选真实 AI 跳过。对应 [PR #16](https://github.com/ProfessorZJH/campus-shopping/pull/16) 仍为 Draft，未自动合并。
- 已创建 GitHub Environment `external-ai` 并设置唯一部署分支 `main`。新名 `LIVE_NVIDIA_API_KEY/LIVE_XFYUN_API_KEY/LIVE_MILVUS_URI/LIVE_MILVUS_TOKEN` 尚未配置，不执行真实供应商请求。现有仓库密钥未读取、未删除或轮换，迁移仍需维护者操作。
- 生产可信 CA、反向代理及公网部署 NOT_RUN；本次不修改现有服务和业务数据库。

原始诊断在忽略目录 `var/r1/`；历史测试报告不覆写成当前证据。最终验收只统计对应提交且真实执行的结果。

## B 实际验证

- Java `SkuConstraintPolicyTest,PurchaseConstraintTest,AiConversationBoundaryTest`：9 PASS，0 skipped；含共享预算/数量22例、SKU30例、累计预算与数量不符/溢出拒绝。首次回归发现数量前缀处理将“要两支考试黑色签字笔”误当规格，已修复并保留原正常搜索回归。
- Python 全量200 PASS：含模型无报价伪称交易完成、阶段缺失/错误类型、虚假成功来源、清理失败、DRAFT 严格发布拒绝与复核 HTML 恶意 ID。
- 未执行真实外部模型，不代表语义质量或生产容量验收。
- `ae12e22` 的[完整远端运行](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41198423134)五个普通任务全部成功，可选真实 AI 跳过。[PR #17](https://github.com/ProfessorZJH/campus-shopping/pull/17)依赖 PR #16，未合并。

## C 实际验证

- `verify-mysql-isolated.py --mysql-bin D:\develop\mysql-8.0.31-winx64\bin --maven .\mvnw.cmd` 在全新临时 MySQL8.0.31 完成升级、重放、历史数据保留、校验和拒绝及新旧元数据等价；Maven clean verify 退出0，JUnit206成功、2个Redis测试类未配置依赖而跳过，因此脚本按零跳过要求最终报告FAIL，不能写成完整验收通过。
- 其中真实 `CommerceMySqlIntegrationTest`44项全部成功，含新索引claim竞争、过期重试、晚到完成、版本不符、计数/字节预占回滚、索引并发与频率上限。随后增加的“缓存PENDING后并发READY再发布”专项由最终远端验收验证。
- 本机 Redis 未确认为测试专用，没有复用现有实例；远端使用独立Redis补齐验证。不放宽脚本零跳过门槛。
- API/schema/DDD静态检查通过；无HTTP契约变化。迁移仅在临时库执行。
