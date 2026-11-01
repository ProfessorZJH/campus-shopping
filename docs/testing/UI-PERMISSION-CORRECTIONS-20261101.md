# 前端正确性、知识库授权与成员撤销整改 · 2026-11-01

## 目标与范围

在最新 origin/main `96767f0` 上建立 `codex/frontend-permission-corrections`。覆盖审查的九项整改，权限边界经本次用户确认：平台管理平台自有知识库；商户库按有效成员及 knowledge.read / knowledge.manage 授权；本轮不新增监管接口。规则归属 [SDD-05](../specs/SDD-RBAC-05.md#2026-11-01-知识经营授权与成员撤销补充)，角色需求与 R1 引用该规则。

价格、权限、交易和状态仍由 Java/MySQL 最终复验；HTTP 路径、DTO、枚举编码和数据库结构不变。没有执行既有库迁移、部署、合并或真实外部模型调用。

## 修改与可观察验收

1. 平台争议默认查询 DISPUTED；仅该状态展示裁决入口，提交处理函数再次检查当前列表记录。
2. 商户售后仅 REQUESTED 展示审核，历史原因与状态保留，提交处理函数再次检查状态。
3. 移除跨领域通用 label；订单、售后、申请、商户、成员、邀请、知识状态/索引/可见性分别映射；未知状态显示中文占位。
4. 库存流水分别展示实物增加、预占增加、预占减少以及核销时实物与预占同时减少。
5. 上传最多 2,000,000 字节且非空，文件名/标题最多120字符；售价最多100000000分；订单最多20个SKU行；注册即时提示账号格式、密码字符与UTF-8字节边界。
6. 已上架商品最后一个有效SKU不可停用；无有效SKU不可上架，界面说明原因，处理函数也检查。
7. 商户与平台商品列表复用有效SKU最低价函数，以“¥xx 起”展示，无有效规格时明确提示。
8. 平台身份只授权平台自有知识库；商户库列表、读取、上传、索引、发布、撤回按商户权限判断。平台页面只展示平台自有库。
9. 撤销SQL只更新ACTIVE成员；仓储返回实际变更结果，领域服务据此审计。重复撤销不增版本、不重复写撤权审计；新待接受邀请仍可取消并单独审计取消数量。保留原有邀请→成员写锁顺序。

## 实际验证

最终隔离全栈 **PASS**：274项Java测试（0失败、0错误、0跳过）、262项真实Java/MySQL/FastAPI HTTP检查（195份响应经OpenAPI校验）、9项Redis双Java实例检查、13项真实浏览器检查。见 [完整隔离结果](evidence/ui-permission-20261101/mysql.json)、[专项HTTP](evidence/ui-permission-20261101/full-http.json)、[Redis双实例](evidence/ui-permission-20261101/redis-shared-http.json)、[真实浏览器](evidence/ui-permission-20261101/frontend-live/results.json)。

本次隔离构建记录的504份源码与当前工作区逐字节一致，包含Java和可执行UI bundle，见 [源码核对](evidence/ui-permission-20261101/source-match.json)。MySQL临时数据目录已清理，临时Java/FastAPI已关闭，两个本轮Redis端口均已关闭，见 [Redis清理核对](evidence/ui-permission-20261101/owned-redis-cleanup.json)。

全栈复验命令（本轮由私有本地包装脚本创建两个随机端口Redis子服务后执行）：

```powershell
# REDIS_TEST_ADDRESS / REDIS_TEST_CACHE_ADDRESS 指向本轮新建的两个隔离实例，非现有服务。
# REDIS_TEST_SERVER_COMMAND 指向本轮编译的Redis7.4.2，用于故障隔离用例自行创建子实例。
python -X utf8 scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke --artifact-dir var/ui-permission-verified-build --output docs/testing/evidence/ui-permission-20261101/mysql.json
```

已执行并通过：

- `npm run format:check --prefix frontend`。
- `python scripts/build-ui-bundle.py` 及 `--check`。
- `python scripts/verify-release.py`、`verify-domain.py`、`verify-java-readability.py`。
- `python scripts/verify-api-contract.py`、`verify-api-schemas.py`、`schema_contract.py --check`。
- `python frontend/tests/ui_permission_correctness.py`：10组Chromium/Vue/API替身专项，见 [浏览器证据](evidence/ui-permission-20261101/browser-contract.json)。
- `python frontend/tests/ui_fix_regression.py`：10组现有交互回归。
- `node --test frontend/tests/identity-races.test.mjs`：4项通过。

首轮隔离 Maven 编译成功，274项测试中9项Redis测试跳过、0失败，验收脚本按门禁判FAIL且未进入HTTP；保留 [原始失败](evidence/ui-permission-20261101/initial-no-redis/mysql.json)，不计作完整验收通过。

隔离环境使用新MySQL数据目录、两个新建Redis7.4.2随机端口实例、随机命名空间及临时Java/FastAPI进程；不连接既有业务MySQL/Redis。Redis使用仓库前轮验收的固定7.4.2源码版本，下载站403后从官方GitHub源码标签获取并在WSL编译。所有临时子服务由本轮启动并在结束时关闭。

新增真实HTTP覆盖两个商户私有库：管理员及另一商户在列表/读取/上传/索引/发布/撤回入口被拒绝，平台自有库可正常维护；新增MySQL回归证明重复撤销版本/审计不变，以及实际取消新邀请的单独审计。浏览器替身检查与真实后端业务验收分别记录。

第二轮274项Java测试全部通过、0跳过，262项真实HTTP与9项双实例Redis通过；真实浏览器在“最后一个有效SKU停用按钮仍可点击”的旧断言处失败。保留 [失败报告](evidence/ui-permission-20261101/old-browser-assertion/mysql.json) 和 [浏览器原因](evidence/ui-permission-20261101/old-browser-assertion/frontend-live/results.json)。按已接受需求将该断言改为禁用及原因提示，同时增加直接HTTP请求被拒绝、商品版本不变的断言；没有放宽后端规则或移除状态检查。

## 交付状态与边界

上述列明范围业务验收通过。修改保留在本地功能分支，未提交、推送、创建PR、合并或部署。真实外部模型、生产、多Python及性能验收为NOT_RUN；不引用旧CI绿色结果代替本次运行。
