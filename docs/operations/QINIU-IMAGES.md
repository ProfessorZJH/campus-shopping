# 商品图片存储配置（LOCAL / QINIU）

适用版本：2026-11-05 第二阶段。默认仍为 LOCAL，七牛为可选项；规则见 [IMG-01 规格](../specs/UI-PRODUCT-IMAGES.md) 与 [ADR-018](../architecture/decisions.md)。凭据只放私有环境或 secrets，不写仓库、日志、截图或报告。

## 环境变量

| 变量 | 默认 | 约束与说明 |
|---|---|---|
| `IMAGE_PROVIDER` | `LOCAL` | 仅 `LOCAL` / `QINIU`，大小写不敏感 |
| `QINIU_ACCESS_KEY` | 空 | 与下列三项同填同空；真实值不得提交 |
| `QINIU_SECRET_KEY` | 空 | 同上，仅服务端注入 |
| `QINIU_BUCKET` | 空 | 小写字母/数字/连字符，3–63 位 |
| `QINIU_DOWNLOAD_DOMAIN` | 空 | 纯 DNS host，不带 `https://`、端口、路径或 query |
| `QINIU_PRIVATE_BUCKET` | `true` | 私有桶按需签名；公开桶返回不带签名地址 |
| `QINIU_SIGNATURE_TTL_SECONDS` | `300` | 30–3600 秒 |
| `QINIU_CONNECT_TIMEOUT_SECONDS` | `5` | 1–60 秒 |
| `QINIU_READ_TIMEOUT_SECONDS` | `15` | 1–60 秒 |
| `QINIU_WRITE_TIMEOUT_SECONDS` | `15` | 1–60 秒 |
| `QINIU_RETRY_MAX` | `2` | 0–3 |
| `QINIU_REGION` | 空 | **上传必填**：`z0`/`z1`/`z2`/`na0`/`as0`/`cn-east-2`；不支持 `auto` 或留空（见下） |

## 启用与回退

- 四个必填项（access-key/secret-key/bucket/download-domain）全空且 `IMAGE_PROVIDER=LOCAL`：不启用云端，离线正常启动，`/media/qiniu/**` 返回 503，新图片继续 LOCAL。
- `IMAGE_PROVIDER=QINIU` 时即使四个必填项全空也算缺配置：启动失败，不会因为“全空”而静默离线。缺少任一必填项、只填部分、bucket/host/TTL/超时/重试/region 非法同样启动失败，不静默降级。
- **区域必须显式固定**：SDK 7.19.0 的 `autoRegion` 会在上传前联网发现区域，该路径失败时 SDK 内部会 `printStackTrace` 输出异常栈（含查询 URL），无法在不改全局 stderr、不反射 SDK 的前提下消除；固定区域不发起区域查询。因此 `provider=QINIU` 时 `region` 必填且只接受 `z0`/`z1`/`z2`/`na0`/`as0`/`cn-east-2`，留空或 `auto` 启动失败。只读历史云图（`provider=LOCAL`）可不配 `region`。
- **access-key 字符集**：只允许 `[A-Za-z0-9_-]`。上传凭证首段是 access-key 原文，含冒号/换行会让 SDK 自解析 token 失败并在内部打印异常栈。secret-key 仅作 HMAC 密钥，要求非空且不含空白/换行。
- 回退 LOCAL 上传时**保留完整七牛配置**，历史云图仍可读；删除配置等于放弃读取历史云图。
- 只需读取历史云图：provider 可保持 LOCAL，但 access-key/secret-key/bucket/download-domain 仍需完整。

## 运行特征

- 存储引用固定为 `/media/{uuid}.png`（LOCAL）与 `/media/qiniu/{uuid}.png`（QINIU），商品只存相对引用，不存域名或签名。
- 上传前校验 1–2,000,000 字节、1200 万像素并重编码 PNG；SDK 固定 7.19.0，token 限定 object key，使用 `image/png` 与 CRC 校验。
- 上传走 SDK 异步接口，网关固定等待 **60 秒**（当前不做环境变量化）；SDK 自身的连接/读写超时与重试由上表独立控制。等待超时只表示本请求不再等待，**不表示云任务已取消**；迟到响应关闭且不登记。
- 读取 `/media/qiniu/{uuid}.png`：合法引用 302 到配置 host 并 `Cache-Control: no-store`；非法引用 404；未配置或运行故障 503。CSP 只对已验证的下载 host 放行 `img-src`。
- 商品保存事务只做 MySQL 认领与引用写入，不做云端调用；失败上传不返回可认领地址。

## 示例（假值）

```bash
IMAGE_PROVIDER=LOCAL
QINIU_ACCESS_KEY=
QINIU_SECRET_KEY=
QINIU_BUCKET=
QINIU_DOWNLOAD_DOMAIN=
```

```bash
IMAGE_PROVIDER=QINIU
QINIU_ACCESS_KEY=example-access-key
QINIU_SECRET_KEY=example-secret-key
QINIU_BUCKET=example-bucket
QINIU_DOWNLOAD_DOMAIN=images.example.com
QINIU_PRIVATE_BUCKET=true
QINIU_SIGNATURE_TTL_SECONDS=300
```

## 未验证与禁止操作

- 真实七牛上传/下载、私有桶签名时效、真实 CDN 与生产性能均未在本地验证，需单独授权与证据。
- 未实现自动删除、对象释放/跨商品复用、历史对象迁移；不得以本配置上线为由批量清理既有业务库或线上对象。
