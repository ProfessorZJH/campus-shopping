# R1 六批整改记录

输入为用户提供的完整整改方案。起点重新核对 `origin/main@ba735fa`（PR #15 已合并，已包含 `589826a`），旧报告的未修复状态不能直接视为当前状态。

| 批次 | 范围 | 状态 |
|---|---|---|
| A | CI 密钥边界、地址安全、context-path、生产配置、旧部署模板 | 实现及本地回归完成，远端完整验收待执行 |
| B | AI 预算/数量最终复核、无报价文案、评测阶段/来源/cleanup、HTML XSS | 本地回归完成，远端完整验收待执行 |
| C | 知识索引 claim/lease/完成、发布并发、商户配额 | 待实施 |
| D | 身份/请求隔离、幂等、表单/图片上下文、路由、分页、无障碍/窄屏 | 待实施 |
| E | 订单/商品同步扫描、恢复、readiness、响应上限、外发与指标 | 待实施 |
| F | 镜像固定、SBOM、最终真实联调、容量/故障与发布边界 | 待实施 |

## A 实际验证

- Python 全量 `python -m pytest -q`：188 PASS；包含公网明文、URL 凭据、错误端口/片段、未列入名单的内网对端及合法 HTTPS/回环/显式内网。
- Maven 定向 `ContextPathQuotaTest,ProductionSecurityGuardTest,ProtocolBoundaryTest`：6 PASS，0 skipped。验证根路径及 `/campus` 下四类额度、商户身份、不安全生产参数拒绝。
- `verify-release.py`、`verify-java-readability.py`：PASS（静态检查）。首次 Maven 参数被 PowerShell 拆分后未执行测试，修正参数引用后上述结果通过。
- Docker Engine 本机不可用：本地镜像链路 NOT_RUN，交由对应提交的远端 CI 验收。
- 首次远端完整运行 `41197651139`：快速、完整 Maven/MySQL/FastAPI/浏览器及两个 Chromium 契约任务通过；镜像链路失败。日志确认本地覆盖使用 dev profile 后仅监听容器内回环地址，宿主映射端口请求被重置，0项HTTP执行。修复为容器内 `SERVER_ADDRESS=0.0.0.0`，宿主仍只映射127.0.0.1。须以修复后的完整运行替代首次失败，不能计为全部通过。
- 已创建 GitHub Environment `external-ai` 并设置唯一部署分支 `main`。新名 `LIVE_NVIDIA_API_KEY/LIVE_XFYUN_API_KEY/LIVE_MILVUS_URI/LIVE_MILVUS_TOKEN` 尚未配置，不执行真实供应商请求。现有仓库密钥未读取、未删除或轮换，迁移仍需维护者操作。
- 生产可信 CA、反向代理及公网部署 NOT_RUN；本次不修改现有服务和业务数据库。

原始诊断在忽略目录 `var/r1/`；历史测试报告不覆写成当前证据。最终验收只统计对应提交且真实执行的结果。

## B 实际验证

- Java `SkuConstraintPolicyTest,PurchaseConstraintTest,AiConversationBoundaryTest`：9 PASS，0 skipped；含共享预算/数量22例、SKU30例、累计预算与数量不符/溢出拒绝。首次回归发现数量前缀处理将“要两支考试黑色签字笔”误当规格，已修复并保留原正常搜索回归。
- Python 全量200 PASS：含模型无报价伪称交易完成、阶段缺失/错误类型、虚假成功来源、清理失败、DRAFT 严格发布拒绝与复核 HTML 恶意 ID。
- 未执行真实外部模型，不代表语义质量或生产容量验收。
