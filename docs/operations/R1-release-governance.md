# R1 供应链与发布验收

## 固定输入及更新

Dockerfile、Compose和CI中的7种基础镜像均以tag@sha256固定，摘要及官方Registry manifest地址保存在`supply-chain/images.lock.json`。2026-10-31获取manifest原始字节，核对其SHA-256等于Registry响应头，并确认包含Linux amd64。第三方Actions继续固定40位commit SHA。`python scripts/verify-supply-chain.py`离线阻止引用与锁文件漂移。

内容摘要证明所取内容一致，不等于发布者签名、无漏洞或整个构建逐字节可复现。Docker构建中的操作系统包仍由apt仓库解析；本轮没有锁定完整Debian/Ubuntu快照。固定digest不会自动获得安全更新，依照[Docker官方建议](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions)通过审查更新。

Dependabot按周为Maven、npm、pip、Docker和Actions提交更新建议，不自动合并。维护者核对上游发布/安全公告、坐标及仓库、兼容性和新版本差异；Python用锁文件头部记录的uv命令重新生成runtime/dev哈希锁，Docker更新同时核实Registry内容并修改锁文件、Dockerfile、Compose和CI引用。审核后执行快速门禁及对应HEAD完整验收；不能仅修改tag或仅更新供应商URL。

## SBOM与证据

`python scripts/generate-sbom.py`读取实际Spring Boot JAR内依赖及其哈希、npm锁（开发工具scope=excluded）、Python运行锁和基础镜像引用，生成CycloneDX 1.5清单。无实际JAR或无法识别版本时失败，不生成空清单冒充交付。默认输出`var/supply-chain/application.cdx.json`；本地已用CycloneDX官方1.5 JSON Schema校验样例。

完整CI对实际测试JAR生成清单；交付镜像验收另从运行的app容器复制实际JAR生成清单。清单不枚举OS包、完整传递依赖边或漏洞结论，不冒充完整容器安全扫描。原始SBOM、依赖诊断、评测运行及故障证据保留CI artifact，仓库只保留规格、摘要与输入锁，冻结合成数据仍版本管理。artifact默认7天，正式发布时维护者应保存对应版本的验收与SBOM。

## 验收边界

完整CI新增隔离Qdrant容器：认证拒绝、真实向量写入/过滤查询、幂等重放、内部资料不外发、容器停止后不误记索引成功、本地检索继续、重启重试和删除。使用合成文本与本地字符向量，不调用Embedding供应商。容器仅绑定随机回环端口，清理本次随机容器及其卷，不连接已有向量服务。

`verify-ai-load-isolated.py`独立启动本地FastAPI/SQLite，12客户端、80次请求、执行容量2，记录接受/429、延迟和释放状态，然后重启验证持久化资料可检索。这是小规模真实HTTP边界/恢复演练，不是生产吞吐量、持续压力或SLO验收。订单2105笔和商品40001条覆盖由任务故障测试提供，真实MySQL另验证分页及checkpoint事实，不能将内存任务测试称作4万商品真实供应商吞吐。

以下事项仍需独立的正式环境和授权，当前NOT_RUN：生产CA/TLS及反向代理、公网网络策略、真实LLM/Embedding/Milvus、持续生产负载、灾备恢复演练、已有业务库升级和部署。真实AI只能由受保护main当前HEAD及external-ai Environment执行；旧仓库secret迁移与轮换仍由维护者完成。

审批数依单人维护决定为0；合并前要求Quick quality gates，发布前核对同一HEAD的完整MySQL/Redis/HTTP/浏览器/镜像验收。堆叠PR须先解决依赖并重新核对main差异，本轮不自动合并或部署。各批实际结果见[整改记录](../testing/R1-REMEDIATION-20261031.md)。
