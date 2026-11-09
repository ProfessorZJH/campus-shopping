# Agent v1.1 M1 真实运行时验收矩阵

> 日期：2026-11-09  
> 变更：`agent-v1-1`  
> 基线：`main` `7408926`  
> 状态：矩阵与独立运行时已实现；2026-11-09 私有配置运行总体为 `DEGRADED`，真实模型/Embedding 结果、Milvus TLS 门禁和 Java/MySQL 未运行项见实际报告。

## 证据状态

| 状态 | 含义 | 可以宣称什么 |
| --- | --- | --- |
| `REAL` | 真实模型/HTTP/Milvus/事实复验链路完成 | 仅宣称报告中列出的具体样本通过 |
| `STUB` | 受控模型或向量替身 | 只证明协议和边界，不证明供应商效果 |
| `DEGRADED` | 真实链路发生可识别故障并安全回退 | 证明失败处理，不证明成功质量 |
| `NOT_RUN` | 依赖未配置、未授权或本轮未执行 | 不得解释为通过或失败 |

报告必须同时记录运行标识、模型/Embedding/向量服务配置标识、总时长、工具次数、Token/成本、故障类型、集合清理结果和未运行原因。凭据、授权头、完整提示词、私有正文和下游异常正文不得进入日志或报告。

## M1 场景

| 场景 | 入口/证据 | 通过条件 | 阻断条件 |
| --- | --- | --- | --- |
| 原生 Tool Calling | `OpenAICompatibleToolModel.complete` + `AgentRuntime.run` | 响应包含原生 `tool_calls`，Schema 校验通过，工具回执后模型继续回答 | 只输出“调用工具”的文本；未知/非法调用被执行 |
| JSON Schema | `ToolSpec.definition()`、Pydantic strict 校验 | 必填字段、类型、范围和额外字段可判定 | 参数被默默截断或转换后执行 |
| 流式工具参数 | `OpenAICompatibleToolModel.stream` + `ToolCallAccumulator` | 分片 JSON 完成后只执行一次，断线/未闭合 JSON 安全失败 | 重复执行、伪造成功回执、异常正文外泄 |
| 真实模型故障 | 429、5xx、超时、连接中断 | 记录安全错误码，按策略 `DEGRADED` 或安全失败 | 错误被包装成成功工具回执 |
| Milvus 隔离生命周期 | 随机 `campus_agent_products_<hex>` 集合 | 写入、检索、更新、删除、清理均有证据；生产集合不变 | 使用 `campus_products_v1`、清理失败或访问未授权集合 |
| Java/MySQL 事实复验 | 真实商品 ID 回到 Java/MySQL 查询 | 下架、无库存、SKU/经营资格/价格版本失效候选被移除 | Milvus 结果直接作为可交易事实 |
| 旧导购回退 | 既有 `/ai/chat` / RAG | Agent 未启用或不兼容时旧链路行为不变 | 新实验路由改变旧 API、Proposal 或 SSE 语义 |
| 成本与时延 | 运行报告 | 记录总时长、工具次数、Token/成本；不预设质量阈值 | 缺少分母、把替身结果写成真实质量 |

## 执行命令

受控协议回归：

```powershell
python -m pytest -q ai-service/tests/test_agent_runtime.py ai-service/tests/test_agent_provider.py ai-service/tests/test_agent_evidence.py
```

真实运行脚本（只从私有 `.env` 或环境变量读取，不打印值）：

```powershell
python scripts/smoke-agent-v1-1.py --env-file .env --output docs/testing/evidence/agent-v1.1.json
```

未配置真实供应商时脚本必须生成 `NOT_RUN` 证据并说明原因；只有具备真实 NVIDIA/讯飞、Embedding、隔离 Milvus 和 Java/MySQL 环境时，相关样本才可记录 `REAL`。

## 当前未决运行项

2026-11-09 私有配置运行已取得真实讯飞 Tool Calling 和 NVIDIA Embedding 证据；流式样本首轮失败、定向重试通过，必须同时保留。Milvus 配置的公网 `http` 地址未通过 TLS 校验，HTTPS 证书也与域名不匹配，因此隔离集合生命周期为 `NOT_RUN`；Java/MySQL 事实复验和完整端到端链路没有受控入口，保持 `NOT_RUN`。历史报告只作为背景，不自动合并到本次 M1 结果。
