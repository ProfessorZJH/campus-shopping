# 测试证据副作用隔离

## 1. 根因

测试同时承担“断言”和“发布验收证据”两项职责，多个脚本把截图与 JSON 默认写入已跟踪的 `docs/testing/evidence/`。普通本地回归因此反复修改 Git 工作区，失败或中断还会留下只反映本机环境的文件。

本次复现：运行 `ui_copy_polish.py` 与 `ui_three_pages.py` 会修改已跟踪截图和 `results.json`，但测试本身通过。

## 2. 修复

- 新增 `scripts/evidence.py`：本地默认根目录为忽略目录 `var/verify/`。
- CI 在工作流级设置 `CAMPUS_EVIDENCE_DIR=${{ github.workspace }}/docs/testing/evidence`，只有 CI 或显式发布任务才写跟踪证据目录。
- `browser_transport.py` 统一导出证据路径能力，浏览器测试不再各自硬编码跟踪路径。
- 迁移所有测试和验收脚本的默认输出：旧版/现行浏览器契约、真实页面矩阵、HTTP、Redis、Agent、迁移、容器和本地联调脚本。
- 保留 Agent M1 E2E 对历史真实工具证据的只读引用；该引用不是输出路径。
- 修复 `ui_remaining.py` 把 Chromium 固定为 `/usr/bin/chromium` 的跨平台缺陷，统一使用 `CHROMIUM_PATH` 或 PATH。
- 修复 `ui_remaining_contract.py` 的同类 Chromium 路径问题，并按现行两阶段结算、知识库角色隔离和唯一测试实体 ID 更新断言；两个扩展套件已加入 CI 浏览器矩阵。
- 新增 `scripts/tests/test_evidence_paths.py`，锁住默认目录、CI 覆盖、相对路径解析和禁止硬编码输出。

## 3. 验证

| 检查 | 结果 |
|---|---|
| 证据路径单测 | PASS，4/4 |
| `scripts/tests` 全量 | PASS，41/41 |
| `ui_three_pages.py` | PASS，23 项 |
| `ui_copy_polish.py` | PASS，4 项 |
| `contract_ui.py` | PASS，20 项 |
| `ui_audit_contract.py` | PASS，4 项 |
| `ui_remaining.py` | PASS，32 项 |
| `ui_remaining_contract.py` | PASS，9 项 |
| 六次浏览器运行后的 Git 证据差异 | 0；截图与 JSON 全部位于 `var/verify/` |
| Python 语法编译 | PASS |
| 前端格式、API/Schema/DDL、源码边界、Markdown 链接、YAML | PASS |

## 4. 边界

- `live_ui.py`、`live_m2_fulfillment.py`、`live_final_matrix.py` 和 Agent 真实环境脚本需要隔离后端或外部依赖，本次只完成路径策略、编译和静态迁移验证，未在对应真实环境重跑。
- 本修复不改变业务 API、数据库、交易规则或测试断言；只改变中间产物的写入位置和发布时机。

## 5. 结论

**代码完成，本地相关测试通过。** 普通本地测试不再污染已跟踪证据；CI 证据发布行为保持不变。
