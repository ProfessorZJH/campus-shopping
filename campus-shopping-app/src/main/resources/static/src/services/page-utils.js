import { store, money, skuOf } from './store.js';
const statusLabel = (names) => (value) => names[value] || (value ? '未知状态' : '—');
export const orderStatusLabel = statusLabel({
  PENDING_PAYMENT: '待付款',
  PAID: '已支付',
  COMPLETED: '已完成',
  CANCELED: '已取消',
  REFUNDED: '已退款',
});
export const afterSaleStatusLabel = statusLabel({
  REQUESTED: '待商户审核',
  APPROVED: '已批准退款',
  REJECTED: '已驳回',
  DISPUTED: '待平台裁决',
  REFUNDED: '已退款',
});
export const applicationStatusLabel = statusLabel({
  SUBMITTED: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
});
export const merchantStatusLabel = statusLabel({
  ACTIVE: '营业中',
  DISABLED: '已停用',
  INACTIVE: '已停用',
});
export const productStatusLabel = statusLabel({
  DRAFT: '草稿',
  PUBLISHED: '已上架',
  UNPUBLISHED: '已下架',
});
export const pickupStatusLabel = statusLabel({
  WAIT_PREP: '待备货',
  CREATED: '待备货',
  PREPARING: '备货中',
  READY: '待自提',
  VERIFIED: '已核销',
  CANCELED: '已取消',
  COMPLETED: '已核销',
});
export const membershipStatusLabel = statusLabel({ ACTIVE: '有效成员', REVOKED: '已撤销' });
export const invitationStatusLabel = statusLabel({
  PENDING: '待接受',
  ACCEPTED: '已接受',
  CANCELED: '已取消',
  EXPIRED: '已过期',
});
export const knowledgeIndexStatusLabel = statusLabel({
  PENDING: '待索引',
  INDEXING: '索引中',
  READY: '索引就绪',
  FAILED: '索引失败',
});
export const knowledgeStatusLabel = statusLabel({
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  WITHDRAWN: '已撤回',
});
export const knowledgeVisibilityLabel = statusLabel({
  MERCHANT_INTERNAL: '商户内部',
  PLATFORM_INTERNAL: '平台内部',
  PUBLIC: '公开',
});
export const inventoryOperationLabel = statusLabel({
  REPLENISH: '补货',
  RESERVE: '库存预占',
  RELEASE: '释放预占',
  CONSUME: '核销出库',
});
export const proposalStatusLabel = statusLabel({
  PENDING: '待确认',
  CONFIRMED: '已确认',
  EXPIRED: '已过期',
});
export const accountStatusLabel = statusLabel({ ACTIVE: '账号正常', DISABLED: '账号已停用' });
export function priceSku(product) {
  return (
    [...(product?.skus || [])]
      .filter((sku) => sku.status === 'ACTIVE')
      .sort((a, b) => Number(a.priceCent) - Number(b.priceCent))[0] || null
  );
}
export function inventoryQuantityLabel(move) {
  const quantity = move.quantity;
  switch (move.type) {
    case 'REPLENISH':
      return `实物增加 ${quantity}`;
    case 'RESERVE':
      return `预占增加 ${quantity}`;
    case 'RELEASE':
      return `预占减少 ${quantity}`;
    case 'CONSUME':
      return `实物减少 ${quantity}，预占减少 ${quantity}`;
    default:
      return `数量 ${quantity}`;
  }
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
export function safeDecodeId(v) {
  try {
    return decodeURIComponent(v || '');
  } catch {
    return '';
  }
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
