# 分类图标更新与页面检查

日期：2026-11-11。分支：`codex/category-icons-20261111`，基于 main `977c2b2`。

## 目标与范围

重新设计首页分类图标，统一材质、光照、留白及小尺寸辨识度。使用内置 imagegen 生成，输出六张 256 × 256 WebP：零食、饮品、水果、文具、日用和数码。源码资源在 `frontend/public/images/category-*.webp`，离线资源同步至 `frontend/images`；Spring 静态副本由标准构建脚本生成。

实际后端当前五类为日用百货、数码配件、食品饮料、水果生鲜、文具图书。补充 `Home.js` 的 digital 映射，修复数码类误用零食兜底图。保留 drink 图标供已有饮品分类配置使用。分类名称、排序、筛选请求和交易行为不变。

## 实际验证

- `python scripts/build-ui-bundle.py`：通过。
- `python scripts/build-ui-bundle.py --check`：通过。
- `npm run format:check --prefix frontend`：通过。
- `git diff --check`：通过。
- 真实本地 Java 预览 `http://127.0.0.1:8091/`：六张资源 HTTP 200，响应内容与新资源逐字节一致。
- Chromium：1440、390、320 像素视口均显示五个分类，无横向溢出；五类对应五个不同图标，数码映射正确。数码配件点击筛选请求返回 200，再次点击可清除选中，无页面 JavaScript 异常。
- 截图人工检查：390、320 像素下图标无裁切，标签保持可读。

证据见 [检查结果](evidence/category-icons-20261111/checks.json) 与 [手机页面](evidence/category-icons-20261111/homepage-mobile.png)。

## 运行范围

正式改动位于基于 main 的独立工作区；为方便即时查看，同步相同的资源及一行 digital 映射到当时的旧分支预览，并重新生成其 UI。运行中的 Java 仍为此前版本，使用本地静态资源覆盖目录提供新图标与该版本重新构建的 bundle。上述浏览器检查发生在合并 main 之前；本次未迁移数据库，未上传或覆盖七牛商品对象。本次为展示与分类交互检查，不代表完整交易或外部 AI 验收。
