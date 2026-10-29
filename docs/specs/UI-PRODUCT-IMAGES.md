# SDD · 商品主图上传与展示（IMG-01）

日期：2026-10-28。范围：现有商户商品管理与消费者图片展示；本批不新增数据库表或 Java API。

## 已确认规格

| 编号 | 规则 | 前后端实现 |
|---|---|---|
| IMG-01 | 商户拥有权限时可在新建商品上传一张主图；图片可选 | `Merchant.js / ProductImageField.js`；Java `CatalogCaseImpl.image` 复验成员/商户状态 |
| IMG-02 | 编辑商品支持换图、移除主图；未点“保存修改”不改变产品记录 | `PUT /api/v1/merchants/{merchantId}/products/{productId}`，传 `imageUrl` 和 `expectedVersion` |
| IMG-03 | 支持 JPG、PNG、GIF，不接受 SVG；文件大小最多 **2,000,000 字节** | 浏览器前置检查；后端字节、图片解码和 1200 万像素上限二次检查 |
| IMG-04 | 上传先由 Java 重新编码为 PNG，返回 `/media/{uuid}.png`，只保存图片 URL 不保存 base64 | `POST /api/v1/merchants/{merchantId}/images`，会话及 CSRF 校验，JSON DTO `{filename,contentType,base64}` |
| IMG-05 | 用户端商品、AI 推荐、购物车、订单及商户/平台列表显示真实 `imageUrl` | 复用 `ProductImage`；空地址或加载失败时展示统一“暂无图片”占位图 |
| IMG-06 | `?demo=1` 为设计预览，可选择文件查看本地预览，但禁止网络上传和写入 | `ProductImageField.js` 与现有 `preview` 开关 |

## 完整业务路径

```text
商户选择 JPG/PNG/GIF
 → 前端校验类型与字节数
 → 使用 Blob URL 在本地预览
 → FileReader 转 base64
 → POST /api/v1/merchants/{merchantId}/images (Session + CSRF)
 → Java 校验当前成员、商户状态、真实图像与像素尺寸，重编码 PNG 存 ./var/uploads
 → 响应 {url:"/media/{uuid}.png"}
 → 前端保存待提交的 imageUrl
 → 新建 POST /products 或编辑 PUT /products/{id} (含 expectedVersion)
 → Repository 写入商品 image_url
 → 公开 GET /products / GET /products/{id} 返回 imageUrl
 → 页面使用同源 /media/** 获取图像；不可获取则回退统一占位图
```

设计边界：图片上传操作本身和商品写入不在同一数据库事务中。用户取消商品编辑后可能存在未引用的 PNG 文件，需要运维周期性清理未被引用的历史图片；本批**不实现自动删除**，避免误删仍被引用的图片。

## 不包含

多图相册、SKU 独立图片、商品视频、自动裁切、CDN/对象存储迁移、图片识别审核。单商品主图满足首版 PRD，不额外虚构这些能力。

## 验收

- 允许选择并上传有效图片，显示预览、上传进度状态及结果。
- 上传失败/文件无效时禁止误提交空图，用户可重新选择或明确移除。
- 商品创建携带返回的 `imageUrl`；商品修改携带新值与乐观锁版本；移除后保存空字符串。
- 公开端真实 `/media/**` 路径可展示；缺图和损坏链接都有一致占位。
- 预览模式不发网络写入；非法格式、超大文件被前端拒绝，后端依然独立校验。
- 实际测试与未验证范围见 [验收报告](../testing/UI-PRODUCT-IMAGES-VERIFICATION.md)。
