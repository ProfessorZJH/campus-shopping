# PR #11 审查收口 · 2026-10-31

## 发现与修复

以已验收整合提交 `1e4c244` 为基线复核两项 P2。

1. `ROADMAP.md`、`DELIVERY-R1.md` 仍把共享会话列为未交付，文档索引未指向 SDD-12。现已更新当前交付范围、版本日期、整合报告和运行手册入口；历史报告保留原日期和验证范围。共享会话支持多个 Java 实例连接同一 MySQL/Redis 与单 Python 服务，不扩展为生产 HA、多 Python 或性能承诺。
2. `/v1/extract` 和知识索引 `DELETE /v1/index/{document_id}` 未领取 Python 共享执行许可。现与其他六条资源操作使用同一个非阻塞 `BoundedSemaphore`，饱和返回429；`finally` 在实际执行返回后释放，包括依赖失败、输入错误和 PDF 超时。PDF 许可覆盖解码、子进程启动、等待及结果处理，子进程仍保留8秒超时。商品索引删除原本已有保护，未混记为此次新增。

## 实际验证

| 验证 | 实际结果 | 证据 |
|---|---|---|
| 修复前复现 | 新增用例中的知识删除/PDF提取4项失败，12项未选中；未记为通过 | [修复前JUnit](evidence/redis-capacity-review/before.xml) |
| 修复后 Python 全套 | 65项通过（原49项 + 新16项），1条已有python_multipart弃用提示 | [修复后JUnit](evidence/redis-capacity-review/after.xml) |
| 真实Uvicorn TCP/HTTP | 8项通过，本地SQLite检索，无远程模型 | [HTTP结果](evidence/redis-capacity-review/ai-http-local.json) |
| 源码、文档链接及DDD边界 | 通过 | [源码结果](evidence/redis-capacity-review/static-release.json)、[边界结果](evidence/redis-capacity-review/boundaries.json) |
| 历史页面契约 | CI首轮在发送按钮禁用处超时；补充页面可交互等待后，本地20项通过，无JS错误 | [远端原始检查结果](evidence/redis-capacity-review/legacy-ci-before.json)、[本地复验](evidence/redis-capacity-review/legacy-local-after.json) |

16项新增回归分别让8条资源接口实际进入受控阻塞执行，在容量为1时对全部8条接口发起竞争请求并要求429；健康检查保持可用，未授权提取仍返回401。每条操作均覆盖成功和失败后再次执行成功，PDF失败使用受控子进程超时。模型、索引与阻塞PDF执行使用明确的测试替身；既有空白PDF用例仍执行真实解析子进程，不能将并发替身测试声称为真实模型或压力验收。

提交 `528aca5` 的 [CI首轮](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41162061204) 中，全栈、当前页面契约、交付镜像通过，历史页面契约失败。原始日志显示已完成12项检查、没有JS错误或未定义请求，填写购物需求后“发送”按钮保持禁用，未发出聊天请求。本地同版复跑20项通过。历史页面加载时主区域有 `inert`，测试此前没有等待异步加载结束；补充真实可交互状态、输入值及按钮启用断言，不删除或跳过既有行为检查，不修改产品UI。完整远端成功必须以修正后提交的重新运行结果为准。

本轮不升级现有业务库、不替换本机运行服务、不启动本机Docker。Java/MySQL整合的189项及历史HTTP/双实例/浏览器数字来自[前一轮整合](REDIS-MAIN-INTEGRATION-20261031.md)，本轮最新远端结果以PR #11对应提交的Actions为准。PR继续保留待审，不自动合并主线或删除分支。
