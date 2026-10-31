import { store, money, skuOf } from './store.js';
export const stateName = {
  PENDING_PAYMENT: '待付款',
  PAID: '已支付',
  COMPLETED: '已完成',
  CANCELED: '已取消',
  REFUNDED: '已退款',
  PENDING: '待审核',
  SUBMITTED: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  DISPUTED: '平台介入',
  REQUESTED: '待处理',
  PREPARING: '备货中',
  READY: '待自提',
  CREATED: '待备货',
  WAIT_PREP: '待备货',
  ACTIVE: '营业中',
  INACTIVE: '已停用',
  PUBLISHED: '已发布',
  UNPUBLISHED: '已下架',
  DRAFT: '草稿',
  INDEXING: '索引中',
  FAILED: '失败',
  MERCHANT_INTERNAL: '商户内部',
  PLATFORM_INTERNAL: '平台内部',
  PUBLIC: '公开',
};
export function label(s) {
  return stateName[s] || s || '—';
}
export function dateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d)
    ? String(v)
    : d.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}
export function pathId(v) {
  return encodeURIComponent(String(v || ''));
}
export function coverSku(skuId) {
  const p = store.products.find((p) => p.skus?.some((s) => s.skuId === skuId));
  return p?.imageUrl || '';
}
export function amount(row) {
  return money(Number(row?.quantity || 1) * Number(row?.priceCent || row?.unitPriceCent || 0));
}
export function positiveInt(v, max = 99) {
  return Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max;
}
