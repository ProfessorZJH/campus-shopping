# Git 整理与工作区复核（2026-11-14）

## 范围与整理

本次从 `main` / `origin/main` 的 `ea1bf0c8968173597351fb8891f34d9e9b5c599f` 出发，整理根目录未提交的工程改动和两份代码地图。没有更改已发布迁移、现有业务库或运行中的服务。

- Git 当前仅登记根目录一个 worktree。根目录的改动先以 ZIP、逐文件 SHA-256 清单和 Git 补丁备份，校验通过后移至 `codex/local-git-integration-20261114` 分支。备份位于 `G:\develop\campus-shopping-archive\cleanup-current-20261114-094136`，不进入版本库。
- `G:\develop\campus-shopping-product-images-fix` 是未登记的旧目录，其 `.git` 指针已失效。以 `refs/archive/wip-product-images-fix` 为参考，有 93 个非忽略文件存在工作树差异；其中 64 个与当前主线不同、26 个在当前主线不存在、3 个与主线相同。该目录包含旧图片存储与迁移草稿，不能直接覆盖现行实现或已发布迁移。上述文件已另存并核验，忽略文件仍留在原目录；原目录没有删除。
- 两个现有 stash 保留。其中 `stash@{0}` 的图片审计文件与主线同 blob；`stash@{1}` 是旧索引文字，现行索引已包含相应报告链接。此前的 bundle、archive refs 和旧工作区备份继续保留。
- 远端 Agent 设计 PR #55 仍为草稿；旧导购前端分支仍有未证明可无损合入的独有提交。两者以及 Dependabot 升级均未强行合并或删除。

## 改动复核

- 商品查询的 SELECT/COUNT 共用原有过滤片段；相应静态回归检查要求无条件引用同一片段，并对照完整过滤和原有关键字断言。缺失引用、条件化引用和不一致过滤有拒绝测试。
- Mapper 子串检查使用 XML 结构递归展开片段，动态条件不能证明无条件收窄；对顶层 `OR`、任意列别名、正则匹配、嵌套或未知片段、`LIKE CONCAT('%', ...)` 和常见前导通配符 `bind` 有回归测试。例外名单按仓库相对路径和语句 ID 匹配。该检查是启发式，不解析所有 OGNL 或运行时参数，也不代替 SQL 语义、索引或执行计划审查。订单查询的四项例外到期日为 2026-12-31，其他例外为 2027-03-31，到期后检查将失败并要求重新评审。
- 库存完成路径对预占记录再次按 SKU 排序，增加释放与核销锁序测试。`iinventorydao_mapper.xml` 原本已对预占记录使用 `ORDER BY sku_id FOR UPDATE`；这里是领域层防御性约束。**此结论替代 [Wave 0 报告](ENGINEERING-WAVE0-20261112.md)中关于原查询未排序、已修复锁序不一致的表述。** 新建订单预占和已存在订单完成在预占记录、库存行之间仍有顺序差异，适用前提及风险见 [锁顺序文档](../architecture/lock-ordering.md)。
- 订单过期扫描在存在逾期积压时逐轮记录，无积压时采样；新增审计缺口与业务参数盘点。JaCoCo profile 按需启用，不等于已经设置覆盖率阈值或自动执行依赖卫生门禁。
- 两份代码地图保留 2026-11-12 的源码基线。浏览器导出由 HTML 序列化改为 XML 序列化，避免 SVG 的换行标签无效；六张 SVG 重新生成并检查 XML。
- 原工作区已有的历史证据 JSON 时间戳差异已保存在上述 ZIP；检查生成的历史证据副作用已恢复，遵循只追加历史记录的规则。

## 本次验证

| 检查 | 实际结果 |
|---|---|
| `npm run format:check --prefix frontend`、`npm run typecheck --prefix frontend` | PASS；Java、前端格式及前端类型检查 |
| `node --test frontend/tests/*.test.mjs` | PASS，35 项 |
| `python scripts/build-ui-bundle.py`，随后 `--check` | PASS，源文件与生成静态资源一致 |
| `python -m unittest scripts.tests.test_verify_mapper_scan scripts.tests.test_verify_fix_regressions` | PASS，18 项；包括条件、嵌套引用、过滤不一致、未知引用、前导通配符和 `OR` 分支的场景 |
| `verify-mapper-scan.py`、`verify-fix-regressions.py`、`verify-source.py`、`verify-release.py`、`verify-domain.py` | PASS；静态检查与 56 项领域探针，不代表真实服务验收 |
| API/DDL/供应链检查及 Java 可读性检查 | PASS；`verify-api-schemas.py` 为 75 项 |
| Maven 目标测试 | PASS，`InventoryFinishLockOrderTest`、`OrderExpiryDiagnosticsTest`、`CatalogCartReadModelTest` 共 18 项；使用 `-Dfrontend.skip=true`，前端已单独构建并检查 |
| `-Pstatic-analysis` 目标测试 | PASS，库存锁序测试 2 项并生成 app 模块 JaCoCo 报告；未配置覆盖率门槛 |
| `CommerceMySqlIntegrationTest` | 独立 MySQL 8 容器中 Surefire 报告 97 项、0 失败、0 错误、1 跳过；测试结束后外层进程捕获输出因 Windows 字符解码失败，未取得该次 Maven 退出码。跳过项随后在另建 MySQL 和两个独立 Redis 容器中单独运行，1 项 PASS、Maven exit 0。两次运行不能表述为一次完整的 97 项零跳过运行。 |
| `ai-service` 的 `python -m pytest -q` | 系统 Python 环境先因 Pydantic 2.8.2 与锁文件不一致出现 1 项 schema 失败；隔离环境按 `requirements-dev.lock` 安装 Pydantic 2.13.5 后，404 项 PASS，1 warning。 |
| 两份交互地图浏览器渲染与 SVG XML 解析 | 两图渲染及联动检查 PASS，六个导出 SVG XML 可解析；与真实业务验收无关 |
| `git diff --check` | 自有改动 PASS；两份 Mermaid 第三方压缩文件含上游尾随空格，完整差异检查会提示这些行。保留分发文件原内容，并以实际浏览器渲染验证。 |

## 未验证范围

本次未执行完整 `mvnw clean verify`、旧库迁移/重放、完整真实后端浏览器链路、发布镜像或真实外部 AI 验收；不得将本地目标测试视为完整发布验收。测试 MySQL 和 Redis 容器使用随机端口与命名空间，已删除；未连接或清理用户现有 Redis。以上报告仅记录本次实际执行，远端 PR 的最新提交及 CI 状态以 GitHub 实际结果为准。
