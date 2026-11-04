# PR #50 商品多图审查修复与局部验证

## 目标与范围

以 PR 原提交 `fb9ed0f` 为基线修复多图交付：演示模式只做本地预览；旧商品/商户/身份的迟到上传不能写入新表单；失败状态必须保留到重试或明确放弃；上传响应的 `url` 必填且非 null；新增 SKU 对聚合、库存和图片做当前读；新商品及无图商品首次加图避免空范围删除导致的跨商户死锁；商品查询不能因缺少图片依赖而伪装为空列表。补充多图与单图兼容规格、迁移回填及回归测试。

原提交的 UI 静态副本与源码不一致，已通过 `scripts/build-ui-bundle.py` 重新生成，而非手改生成文件。实际文件上传与商品保存仍是两个步骤；商品和图片引用的数据库写入在同库事务内完成。

## 本次实际执行

| 检查 | 实际结果与边界 |
|---|---|
| `npm run format:check --prefix frontend` | PASS；Node 22.16.0。 |
| `python scripts/build-ui-bundle.py` 及 `--check` | PASS；从当前源码生成并比对静态副本。 |
| `node --test frontend/tests/*.test.mjs` | PASS，14 项；包含演示零请求、图片数量、错误状态和异步上下文测试。 |
| `python frontend/tests/ui_product_images.py` | PASS，13 项；真实 Chromium + 明确的 API 契约替身，覆盖无图放弃、八图限制、上传、排序和移除。 |
| `python frontend/tests/ui_r1_correctness.py` | PASS；真实 Chromium + API 契约替身，覆盖切换标签、重选当前商品及搜索切换商品时的图片错误与迟到响应。 |
| `python scripts/generate-api-contract.py`、`verify-api-contract.py`、`verify-api-schemas.py --output var/pr50-api-schemas.json` | PASS；61 项 schema 样例，包含上传 `url` 缺失和 null 的拒绝。 |
| `python scripts/schema_contract.py --check`、`verify-java-readability.py`、`verify-release.py` | PASS；为静态契约、源码与 DDD 检查，不代表完整部署。 |
| `mvnw.cmd -B -ntp -pl campus-shopping-app -am test -Dtest=CatalogCartReadModelTest,CatalogPageSkuBatchTest,DddRulesTest -Dsurefire.failIfNoSpecifiedTests=false` | PASS，29 项、0 失败、0 跳过；包含用例单元与架构规则测试，不代表真实数据库。 |
| 临时 MySQL 8.0.31 + `python scripts/verify-migrations.py --host 127.0.0.1 --port <隔离端口> --output <临时报告>` | PASS，9 项；在新建随机端口实例使用与 CI 等价的受限账号，包含原本没有多图表的旧库升级、主图回填、两次 SQL 重放、迁移历史和新旧库结构对照；再次调用拒绝非空目标库。 |
| 同一类隔离 MySQL + `mvnw.cmd -B -ntp -pl campus-shopping-app -am test -Dtest=CommerceMySqlIntegrationTest#productImagesRemainConsistentAcrossWritesRollbackAndLegacyRequests+concurrentImageEditAndSkuAdditionReturnOneCurrentImageSnapshot+concurrentSkuChangesAndAdditionReturnCurrentSkuAndStock+concurrentNewProductsWithImagesDoNotDeadlock+concurrentFirstImageEditsDoNotDeadlock+addSkuViewFailureRollsBackNewSkuAndProductVersion+creationViewUsesKnownFactsWithoutReadingInventoryAfterCommit -Dsurefire.failIfNoSpecifiedTests=false` | PASS，7 项、0 失败、0 跳过；验证商品图、SKU 写响应、库存、排序、删除、旧接口兼容、响应失败回滚、REPEATABLE READ 并发当前读，以及跨商户并发新建和首次加图。使用合成图片 URL，不代表真实文件上传或全链路验收。 |
| 隔离 MySQL 上已有图片替换的 SQL 级并发探针 | 5 轮两个删除均并发到达插入阶段，未观察到死锁；仅是有限探针，不等于压力或全面并发验证。 |

修复前，隔离 MySQL 双事务测试实际复现主图与图片列表不一致、并发新增 SKU 响应库存滞后各 1 项断言失败；另外两项跨商户并发测试均复现死锁（Maven 退出码 1）。调整锁后读和空范围写入方式，再执行上述 7 项均通过。初次结果保留为本记录及会话中的脱敏测试计数，未保留原始日志正文。

临时 MySQL 使用独立数据目录、随机 loopback 端口和新建测试库，核对实例目录后才写入；测试结束仅关闭并删除该次创建的实例目录。未使用现有业务库或现有 Redis，未调用真实外部 AI。

## 未完成与合并阻塞

- PR #49 和 #50 的两份不同迁移同为 `V20261102_01`。在确认迁移是否已发布或应用于隔离测试之外的环境前，不改写或重编号历史；两项变更不能直接先后合并。
- 本地未执行包含隔离 Redis 的完整 `mvnw clean verify`，未在本次最终源码上执行真实 HTTP 上传/浏览器全链路；上述替身和单项 MySQL 结果不冒充这些验收。提交后以该提交的 GitHub Actions 和必要的真实链路验证为准。
- 历史 `UI-PRODUCT-IMAGES-VERIFICATION.md` 与 PR 原始报告只描述各自当时的源码和环境，不作为本次增量通过证明。
