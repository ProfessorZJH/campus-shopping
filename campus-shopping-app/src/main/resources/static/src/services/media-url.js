/**
 * 上传响应地址白名单：服务端只会返回本服务的 /media 路径。
 * - LOCAL：历史 `/media/{object}.png`，保持既有宽松字符集以兼容旧对象名。
 * - QINIU：`/media/qiniu/{小写分组 UUID}.png`，独立命名空间，不允许 `..`、外链、大小写混写。
 * 其他形状（https、blob、相对路径、大写 UUID）一律拒绝，避免把任意地址写进商品。
 */
const LOCAL_UPLOAD = /^\/media\/[a-f0-9-]+\.png$/;
const QINIU_UPLOAD =
  /^\/media\/qiniu\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

/**
 * 返回合法的上传结果地址，非法返回空串；不做 trim、不做大小写归一。
 * 先要求原值与 trim 后完全相等：JS 的 `$` 允许末尾换行，单靠正则会把 `路径.png\n` 判为合法。
 */
export function uploadedImageUrl(value) {
  if (typeof value !== 'string' || value !== value.trim()) return '';
  return LOCAL_UPLOAD.test(value) || QINIU_UPLOAD.test(value) ? value : '';
}
