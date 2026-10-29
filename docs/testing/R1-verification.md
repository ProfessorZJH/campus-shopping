# R1 实际验证报告

> 2026-10-28。**没有完整Maven编译、真实Spring/MySQL启动或部署通过记录。** 本报告按运行层级列出实际证据，不把静态检查和替身测试相加伪装为全栈通过率。

## 1. 实际执行的检查

| 层级 | 实际结果 | 证据 | 不能推导出的结论 |
|---|---|---|---|
| 原始生产纯Java领域类 | 56项规则检查通过，另执行5000步库存随机序列 | [domain-rules.json](evidence/domain-rules.json) | 不等于Spring/MySQL事务已测 |
| 原始生产HTTP正文订阅器 | 6项真实JDK HTTP检查通过 | [java-http-body.json](evidence/java-http-body.json) | 不等于完整Jackson/Spring网关已联调 |
| Python FastAPI/SQLite/检索 | 26项pytest通过 | [ai-unit-tests.xml](evidence/ai-unit-tests.xml) | 部分外部依赖使用明确替身，不是真实模型/Qdrant |
| 真实Uvicorn本机TCP | 6项服务身份、索引和访问边界检查通过 | [ai-http-local.json](evidence/ai-http-local.json) | 没有Java调用链参与 |
| 真实Vue + Chromium | 20项界面/交互检查通过，无JS未捕获错误 | [前端结果](evidence/frontend-contract/results.json) | fetch使用接口替身，不是真实Java后台 |
| 本地检索小样本 | 8条演示样本实测，详见JSON | [检索评测](evidence/ai-retrieval-evaluation.json) | 不是生产样本，不代表真实Embedding/LLM指标 |
| 配置生成器 | 5项随机凭据、不泄露、不覆盖与文件权限检查通过 | [配置检查](evidence/env-generator.json) | 未部署Docker |
| Java语法/接口/Mapper/DDL/POM/文档 | 最新具体数量见静态JSON | [静态结果](evidence/static-release.json) | 不做依赖解析/完整类型检查，不是Maven编译 |

Java检查使用当前环境JDK21的`--release 17`目标编译，**不是在真实JDK17运行时执行整个工程**。上述纯Java生产文件未经人工展开Lombok或替换框架后伪装编译。

## 2. 真实全栈门禁：未运行

| 门禁 | 状态 | 已准备的复现入口 |
|---|---|---|
| Maven全模块构建和JUnit | 未运行 | `mvn -B -ntp clean verify` |
| MySQL审批/库存/支付/退款并发 | 未运行 | `CommerceMySqlIntegrationTest`，专用campus_shopping_it库 |
| 真实Java/MySQL/Python完整HTTP链路 | 未运行 | `scripts/smoke-full.py` |
| 浏览器访问真实Java后台 | 未运行 | `frontend/tests/live_ui.py` |
| Docker构建与Compose启动 | 未运行 | `scripts/dev-up.py` |
| 外部模型/Embedding/Qdrant | 未运行 | 服务端环境配置与真实HTTP验收 |
| 生产压测/安全/备份恢复 | 未运行 | 生产发布前另行验收 |
| 远程CI | 未触发 | `.github/workflows/full-release.yml` |

## 3. 环境阻塞事实

本工作区有JDK21、Python和Chromium；没有Maven、MySQL或Docker，没有可用Maven依赖缓存。尝试下载官方Maven和依赖时DNS/访问失败。浏览器策略禁止直接导航本地HTTP，因此前端使用真实浏览器加载本地DOM并明确替换API响应；这项结果没有包装成后端联调。

没有写入用户Windows项目、没有推送远程仓库、没有部署服务，也没有复用用户历史API密钥。受控测试所创建的临时文件和Uvicorn进程均在执行结束后清理。

## 4. 真实竞争测试已写但未执行

覆盖最后一件库存争抢、同请求并发下单、支付/取消、退款/核销、审核冲突、Owner授权失败回滚、重复补货、重复提案确认、过期订单和权限撤销。没有配置MYSQL_TEST_URL时测试类明确跳过；跳过不是通过。

## 5. 图片证据的含义

`evidence/frontend-contract/`的截图是实际Vue渲染，但商品、账号和订单来自标注清楚的测试替身。生产页面没有这些固定测试回答；截图不能证明MySQL已经写入交易。

本交付应标记为**整套源码已覆盖、分层验证部分通过、全栈验收被环境阻塞**，不能标记“整个系统已经跑通没问题”。