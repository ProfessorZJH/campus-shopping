# UI 构建跨平台一致性修复

`a3fa07c` 的本地隔离验收通过后，[远端 Actions](https://github.com/ProfessorZJH/campus-shopping/actions/runs/40914299566)在生成资源检查阶段失败，后续 Maven/HTTP/浏览器步骤没有运行。同一轮的独立 Docker 镜像及 Compose 交易链路任务通过，可选远程 AI 任务跳过。不能将这轮 CI 写成全量通过。

## 原因与修复

Windows 现有工作区的部分文本仍使用 CRLF，而 Git 按 `.gitattributes` 提交 LF。旧构建脚本直接对文件原始字节求摘要，所以本地生成并校验一致的 `ui-build.json` 在干净检出后不一致。父任务从旧提交的 Git 索引导出全新目录，安装锁定依赖后实际复现 `UI artifact drift: frontend/ui-build.json`；格式与 npm audit 检查均通过。

新的 `frontend/scripts/build-files.mjs` 对明确的 UTF-8 文本类型和 LICENSE 采用 LF，按统一 `/` 分隔的相对路径排序后计算摘要。实际生成文本也统一为 LF；图片等二进制按原字节处理。没有放宽漂移检查，也没有忽略文本内容或二进制变更。生成快照由正式构建脚本重新生成。

增加三项生产函数回归，并纳入 CI：

- LF/CRLF 输入摘要一致，路径顺序与输入列表顺序无关。
- 二进制字节保持原样，内容变化必然改变摘要。
- 输出文本统一 LF，二进制不变，重复归一化结果稳定。

## 验证与证据

三项 Node 测试通过。最终暂存版本经 `git checkout-index --all --prefix=<全新临时目录>/` 导出，执行锁定安装、格式检查、依赖审计、UI 生成校验、Schema 校验全部通过；临时目录已清理。依赖审计为 0 漏洞。本次没有改动 Java 业务源码或迁移内容。

[原 CI 各任务结果](evidence/ci-followup-20261030/ci-before-fix.json)、[干净检出修复前](evidence/ci-followup-20261030/clean-checkout-before.json)、[干净检出修复后](evidence/ci-followup-20261030/clean-checkout-after.json)、[Node 回归结果](evidence/ci-followup-20261030/build-reproducibility.txt)。远端 Linux、Docker 和完整业务验收结果以本修复提交对应的 Actions 为准，以上本地记录不代替远端结果。

复现新增回归与构建检查：

```powershell
node --test frontend/tests/build-reproducibility.test.mjs
python -X utf8 -B scripts/build-ui-bundle.py --check
```

原有 [175 项 Java 等验收](CODE-QUALITY-20261030.md)保持当时范围。图片存储解耦、生产多实例故障演练与性能验收仍未完成；上线前还需维护窗口内备份和显式迁移。
