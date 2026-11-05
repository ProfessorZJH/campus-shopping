# SDD · 商品图片上传与多图展示（IMG-01）

首版日期：2026-10-28；多图增量：2026-11-03；上传对象归属补充：2026-11-04；编辑兼容与逐文件失败收尾：2026-11-05；七牛对象存储（QINIU）接入：2026-11-05。延续原有商户权限、上传安全和订单快照规则，以本文件维护单图兼容与多图规则，不另行维护重复规格。多图新增图片引用表 `cat_product_image` 与上传对象归属表 `cat_product_image_upload` 及响应字段；旧库升级须显式执行经确认的迁移，本文不表示迁移已部署。QINIU 只增加对象存储实现与媒体投影，默认仍为 LOCAL，且不新增数据库迁移。

## 已确认规格

| 编号 | 规则 | 前后端实现 |
|---|---|---|
| IMG-01 | 有商品写权限的商户可为商品保存 0–8 张不重复的图片，按顺序展示，第一张为主图 | `Merchant.js / ProductImageListField.js`；Java 独立复验商户权限、状态和图片地址 |
| IMG-02 | 编辑支持添加、排序和移除；未点“保存修改”不改变商品记录 | 商品创建/编辑接受有序 `imageUrls`；编辑仍要求 `expectedVersion` |
| IMG-03 | 支持 JPG、PNG、GIF，不接受 SVG；文件大小最多 **2,000,000 字节** | 浏览器前置检查；后端字节、图片解码和 1200 万像素上限二次检查 |
| IMG-04 | 上传先由 Java 重新编码为 PNG，返回服务端稳定引用：LOCAL 为 `/media/{uuid}.png`，QINIU 为 `/media/qiniu/{uuid}.png`，并登记该对象属于当前商户；只保存图片 URL 不保存 base64 | `POST /api/v1/merchants/{merchantId}/images`，会话及 CSRF 校验，JSON DTO `{filename,contentType,base64}`；写入 `cat_product_image_upload` |
| IMG-05 | 商品响应返回有序 `images` 和兼容字段 `imageUrl`；`imageUrl` 为首图或空串。购物车、提案使用当前主图，订单保留下单时主图快照 | `ProductImage`；空地址或加载失败使用统一占位图 |
| IMG-06 | `?demo=1` 仅允许本地 Blob 预览，不发上传或其他写请求，也不写真实表单数据；预览对象在移除、上下文切换及卸载时释放 | `ProductImageListField.js` 与现有 `preview` 开关 |
| IMG-07 | 逐文件校验与上传，部分成功不丢已成功图片；失败项显示文件名与原因，可单项重试或移除，重试仍先校验；未解决失败（含重挂载时的 `invalid` 兜底）阻断保存，显式放弃保留已成功图。图片引用只能来自服务生成的 LOCAL 或 QINIU 稳定引用 | `ProductImageListField.js` 的 `failures/retry/removeFailed/clearInvalid`；旧商户、商品、身份或已卸载组件的迟到结果不得写入新表单；`ProductImageRepository` 对 LOCAL 复验文件存在与安全路径，对 QINIU 只认上传时登记的对象行，并通过 `cat_product_image_upload` 认领对象（同一对象仅能归属一个商品） |
| IMG-08 | 图片 provider 默认 `LOCAL`，只有显式选择 `QINIU` 才上传云端；两者共用 `/media` 前缀，QINIU 使用 `qiniu/{小写UUID}.png` 独立命名空间，无需查库即可区分 provider。请求中的图片地址只接受旧 LOCAL `/media/{object}.png` 或严格小写 UUID 的 `/media/qiniu/{uuid}.png`；绝对外链、query、编码绕过与路径穿越一律拒绝 | `ProductImageStorageProperties.normalizedProvider`、`ProductImageRef.of/accepts`；`scripts/api_contract_rules.py` 的图片地址 pattern 与生成契约同步 |
| IMG-09 | 商品只保存服务端生成的稳定引用 `/media/qiniu/{uuid}.png`，不保存签名或 CDN 临时地址；读取时 `GET /media/qiniu/{uuid}.png` 返回 302 `Location` 与 `Cache-Control: no-store`，目标地址完全由服务端配置构建。默认与生产均为 HTTPS；仅 IMG-15 的本机公开测试例外生效时，302 目标才为无签名明文 HTTP | `MediaAssetController`；`QiniuObjectGateway.downloadUrl` 的 `DownloadUrl` 只接收纯 DNS host，协议由 `QiniuPublicHttpPolicy` 决定（默认 HTTPS） |
| IMG-10 | 旧 LOCAL 地址 `/media/{object}.png` 继续由静态资源路由提供，状态与缓存语义不变；QINIU 引用不走静态目录，历史 LOCAL 地址不会被改写为云地址 | `WebAssetsConfig` 与 `ProductImageRepository`；页面按引用前缀分别加载 |
| IMG-11 | 七牛字段全空表示未启用；选择 `QINIU` 但缺少必填项、只填部分、bucket/下载 host/TTL/超时/重试/region 非法时启动失败，不静默降级为 LOCAL。上传必须显式固定区域（`z0`/`z1`/`z2`/`na0`/`as0`/`cn-east-2`），不支持 `auto` 或留空：SDK 的 autoRegion 会联网发现区域并在失败时内部打印异常栈。access-key 限定 `[A-Za-z0-9_-]`。LOCAL 上传时若保留完整七牛配置，仍可为历史云图生成下载地址 | `ProductImageStorageProperties.validateAndEnabled`；启动即校验，运行期不自动切换 provider |
| IMG-12 | 私有桶默认开启，下载签名有效期默认 300 秒、允许 30–3600 秒；签名只为一次即时跳转生成，不持久化、不写入响应正文或日志 | `ProductImageStorageProperties.Qiniu`；`ProductImageRef` 不保存签名 |
| IMG-13 | 云端上传失败不返回可认领 URL、不 fallback 到 LOCAL、不写入商品图片；失败只返回脱敏业务错误 | `QiniuObjectGateway.upload` 与 `ProductImageRepository.storeImage`；上传失败不登记对象归属 |
| IMG-14 | 商品创建/编辑事务只在本库认领对象并写入商品图片引用，不访问云端；沿用既有 `cat_product_image` / `cat_product_image_upload`，本次不需要数据库迁移 | `CatalogServiceImpl` 与 `ProductImageRepository.claimObjects`；QINIU 只认上传时登记的对象行 |
| IMG-15 | 本机开发测试例外默认关闭（`campus.images.qiniu.public-http-download=false`）：开启后仅当「有效 profile 只有单独 dev」且「`server.address` 为精确回环字面值 `127.0.0.1` 或 `::1`」且「公有桶 `private-bucket=false`」且「下载域名匹配严格七牛公有测试域名形状」时，下载展示地址才为无签名明文 HTTP；任一条件不满足即启动失败，不静默降级。上传始终 HTTPS，不改上传域名/超时/重试/区域；正式与生产环境仍要求 HTTPS | `QiniuPublicHttpPolicy`（网关与 CSP 共用同一策略实例）、`ProductImageStorageConfig` 装配期创建；`QiniuObjectGateway.downloadUrl` 的明文分支校验无查询串/无 token |
| IMG-16 | CSP `img-src` 默认只含 `'self' data:` 与已校验的 HTTPS 下载 host；仅 IMG-15 生效时额外追加且只追加一个精确的 `http://<测试host>`，其余指令逐字不变；任何不是该精确 host 的 HTTP 源不得出现 | `SessionSecurityConfig.cspPolicy`；`QiniuPublicHttpPolicy.cspImageSource()` |
| IMG-17 | `QINIU_KEY_PREFIX` 当前**不生效**：对象命名空间固定为 `qiniu/{小写UUID}.png`，不从环境变量拼接前缀，配置该变量不会改变 key 形状 | 代码不读取该键；以本规格为准，避免运维误以为前缀可改 |

## 完整业务路径

```text
商户选择 JPG/PNG/GIF
 → 前端校验类型与字节数
 → 演示模式只用 Blob URL 本地预览并结束；真实模式继续上传
 → FileReader 转 base64
 → POST /api/v1/merchants/{merchantId}/images (Session + CSRF)
 → Java 校验当前成员、商户状态、真实图像与像素尺寸，重编码为 PNG
 → provider=LOCAL：写入 ./var/uploads；provider=QINIU：上传 qiniu/{uuid}.png 并返回 /media/qiniu/{uuid}.png 稳定引用
 → 两者均登记对象归属当前商户
 → 响应 {url:"/media/{uuid}.png"} 或 {url:"/media/qiniu/{uuid}.png"}
 → 前端暂存有序 imageUrls（旧客户端可只传 imageUrl）
 → 新建 POST /products 或编辑 PUT /products/{id} (含 expectedVersion)
 → CatalogServiceImpl 校验数量/格式/去重；图片适配器 LOCAL 复验文件存在，QINIU 复验已登记对象归属；同库认领并写入 cat_product_image
 → 商品记录与 cat_product_image 图片引用在同库事务中更新；主图为第一张或空串
 → 公开 GET /products / GET /products/{id} 返回 imageUrl 及有序 images
 → 页面使用同源 /media/** 获取图像；QINIU 引用经 302 跳转到配置的下载域名：默认与生产为 HTTPS（私有桶附签名），仅 IMG-15 本机公开测试例外生效时为无签名明文 HTTP；不可获取则回退统一占位图
```
设计边界：图片上传操作本身和商品写入不在同一数据库事务中。用户取消商品编辑后可能存在未引用的 PNG 文件，需运维周期性清理未被引用的历史图片；本批**不实现自动删除**，避免误删仍被引用的图片。上传对象已登记商户，可作为将来孤儿对象识别的依据，但**自动删除、对象释放与复用、跨商品迁移、历史对象迁移本次均未实现、也未验收**；不存在“第二阶段将自动释放/回收”的承诺。归属关系在一次认领后本阶段不释放：从商品移除的图片仍只能回到同一商品，不得被其他商品复用。运维不得据此删除线上对象。

新增 SKU 的写事务先锁定商品及规格，再以当前读取得响应所需的聚合、库存和图片，避免旧事务快照与最新商品拼成不一致响应；普通商品查询仍使用同一只读快照。新商品或商品锁内确认原本无主图时，图片只做插入、不先删除空范围，避免不同商品之间的间隙锁死锁；已有图片的替换仍在商品锁内完成。

## 第二阶段范围与现实状态

本批（2026-11-05）只落地 QINIU 对象存储实现、稳定引用与媒体投影：默认仍为 LOCAL，旧 LOCAL 地址与数据库结构不变，无新增迁移；配置、环境变量与启动失败条件见[七牛图片配置说明](../operations/QINIU-IMAGES.md)，代码测试范围见[第二阶段报告](../testing/QINIU-IMAGES-PHASE2-20261105.md)。

明确**未实现、未验收**：自动删除与对象生命周期回收、释放后跨商品复用、跨商品迁移、历史 LOCAL 或历史云对象迁移、批量清理工具、CDN 加速与图片裁切瘦身、SKU 独立图片、图片识别审核。以上不因 QINIU 接入而自动具备，未授权前也不得对既有业务库或线上对象执行清理。真实云抽样已完成第一轮（真实上传、只读 stat、匿名 HTTP 内容一致、真实 Chromium 解码与本机公开测试模式下的商品页 302 + 解码），见[第一轮真实联调报告](../testing/QINIU-IMAGES-LIVE-ROUND1-20261105.md)；正式 HTTPS、私有桶签名、生产与性能仍未验收。

本机公开测试域名例外（IMG-15/IMG-16）不属于上述能力，是**限定范围的本机公有 HTTP 验收**手段：默认关闭、只对单独 `dev` + 回环 + 公有桶 + 严格测试域名生效，不提供任何生产放行手段；可作该范围结论，但不能替代正式 HTTPS 验收，正式 HTTPS 下载与浏览器展示仍需自有域名备案后补验。

## 验收

- 允许选择并上传有效图片，显示预览、上传进度状态及结果。
- 上传失败/文件无效时禁止误提交空图，用户可重新选择或明确移除。
- 创建和新增 SKU 的商品响应及编辑后的查询均包含当前有序图片；调整顺序、删除及事务回滚保持主图和图片列表一致。
- 未传或传 null 的 `imageUrls` 兼容旧 `imageUrl`；显式空数组清空图片。重复、超过 8 张或非同源 `/media/*.png` 地址由 Java 拒绝。
- **编辑兼容（2026-11-05）**：`imageUrls` 非 null 时优先，`[]` 清空；`imageUrls` 为 null 时 `imageUrl` 也为 null 表示不改图片，与当前主图相同保留相册，空串或全空白字符串清空，其它有效地址替换首图并保留原副图，已在相册则升首位并保留全部图片（不重复、最多 8 张）。创建逻辑不变。
- **逐文件失败（2026-11-05）**：每文件单独校验与上传，合法文件成功即保留在表单；失败项列出文件名与原因并可逐项重试/移除；非法类型、空文件、超 2,000,000 字节不发上传请求，重试也不绕过校验；同一批按 `name+size+type` 判重（不是内容哈希），重复项只上传一次并作为可移除失败项提示。未解决失败或重挂载时 `invalid` 仍阻断保存，只有逐项移除、重试成功、显式放弃或上下文重置才恢复；放弃保留已成功图片；迟到结果按商户/商品/身份/路由/卸载隔离。
- 服务端拒绝不存在、不属于当前商户、已属于其他商品或伪造的 `/media` 引用；事务失败或 `expectedVersion` 冲突不留下部分商品图片引用。
- 公开端真实 `/media/**` 路径可展示；缺图和损坏链接都有一致占位；详情轮播支持缩略图、按钮和移动端触摸切换。
- 预览模式不发网络写入；非法格式、超大文件被前端拒绝，后端依然独立校验。
- **QINIU（2026-11-05）**：默认 LOCAL 时行为与第一阶段一致；显式选择 QINIU 且配置完整时才上传云端；成功响应返回稳定的 `/media/qiniu/{小写UUID}.png`，失败不返回 URL、不 fallback；读取该引用返回 302 + `no-store`，非法引用 404，未配置或运行故障 503；商品保存事务内不发生云端调用。编写时已执行的测试、未验证范围与后续结果以[第二阶段报告](../testing/QINIU-IMAGES-PHASE2-20261105.md)及对应 PR 最新 Checks 为准。
- **本机公开 HTTP 测试例外（2026-11-05）**：开关默认关闭；开启后仅当单独 `dev` profile、回环字面值绑定、公有桶、严格七牛公有测试域名形状同时成立时，`/media/qiniu/{uuid}.png` 302 目标为无签名、无查询串的明文 HTTP，且 CSP 的 `img-src` 恰好额外包含一个该 host 的 `http://` 源；任一条件不满足（含 `dev` 与 `prod` 混开、非回环地址、私有桶、`<label>.clouddn.com` 或任意自有域名）必须在启动阶段失败。上传仍 HTTPS，生产仍要求 HTTPS。该范围的实测结果见[第一轮真实联调报告](../testing/QINIU-IMAGES-LIVE-ROUND1-20261105.md)，不替代正式 HTTPS 验收。
- 实际测试与未验证范围见[第一阶段收尾报告](../testing/PRODUCT-IMAGES-PHASE1-COMPLETION-20261105.md)与[第二阶段报告](../testing/QINIU-IMAGES-PHASE2-20261105.md)；历史单图与两线整合记录见[验证报告](../testing/UI-PRODUCT-IMAGES-VERIFICATION.md)，其数字属当时范围。
