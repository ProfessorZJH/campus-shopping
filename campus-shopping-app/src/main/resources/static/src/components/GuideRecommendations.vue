<script setup lang="ts">
import ProductImage from './ProductImage.js';
import { money, shopName } from '../services/store.js';

interface Recommendation {
  skuId: string;
  productId?: string;
  merchantId?: string;
  merchantName?: string;
  title: string;
  specKey: string;
  priceCent: number;
  quantity?: number;
  imageUrl?: string;
  product?: { imageUrl?: string };
  detailAvailable?: boolean;
  reason?: string;
}
defineProps<{
  items: Recommendation[];
  selectedIds: string[];
  total: number;
  feedback: string;
  preview: boolean;
  thinking: boolean;
  confirming: boolean;
  rejecting?: boolean;
  proposalStatus?: string;
}>();
defineEmits<{
  toggle: [skuId: string];
  detail: [item: Recommendation];
  reject: [];
  confirm: [];
  cart: [];
}>();

function meaningfulReason(raw?: string): string {
  const text = String(raw || '').trim();
  if (!text || text.includes('数量、库存和预算已校验')) return '';
  return text;
}
</script>

<template>
  <section class="recommendation-panel">
    <div class="recommendation-header">
      <h2>
        推荐搭配 <em>{{ items.length }}</em>
      </h2>
      <span class="rec-header-sub">价格与库存实时复验</span>
    </div>
    <div class="rec-cards">
      <article
        v-for="item in items"
        :key="item.skuId"
        class="rec-item"
        :class="{ 'is-checked': selectedIds.includes(item.skuId) }"
      >
        <button
          type="button"
          class="rec-check"
          :class="{ checked: selectedIds.includes(item.skuId) }"
          :aria-label="'选择' + item.title"
          :aria-pressed="selectedIds.includes(item.skuId)"
          :disabled="
            thinking || confirming || rejecting || (!preview && proposalStatus !== 'PENDING')
          "
          @click="$emit('toggle', item.skuId)"
        >
          <Icon name="check" :size="13" />
        </button>
        <button
          type="button"
          class="rec-photo"
          :aria-label="'切换勾选' + item.title"
          :aria-pressed="selectedIds.includes(item.skuId)"
          :disabled="
            thinking || confirming || rejecting || (!preview && proposalStatus !== 'PENDING')
          "
          @click="$emit('toggle', item.skuId)"
        >
          <ProductImage :src="item.imageUrl || item.product?.imageUrl" :alt="item.title" />
        </button>
        <div class="rec-card-content">
          <div class="rec-item-tag">
            {{ item.merchantName || (item.merchantId ? shopName(item.merchantId) : '校内门店') }}
          </div>
          <strong>{{ item.title }}</strong>
          <small
            >{{ item.specKey
            }}<template v-if="(item.quantity || 1) > 1"> × {{ item.quantity }}</template></small
          >
          <div v-if="meaningfulReason(item.reason)" class="rec-item-reason">
            {{ meaningfulReason(item.reason) }}
          </div>
          <div class="rec-price-row">
            <div class="rec-price">
              <span>{{ money(item.priceCent) }}</span>
            </div>
            <button
              class="rec-detail-link"
              type="button"
              :disabled="!item.detailAvailable || !item.productId"
              @click="$emit('detail', item)"
            >
              {{ item.detailAvailable ? '查看详情' : '暂无详情' }}
            </button>
          </div>
        </div>
      </article>
    </div>
    <div v-if="feedback" class="proposal-feedback" role="alert">{{ feedback }}</div>
    <div class="proposal-footer">
      <div class="proposal-total">
        <span>已选 {{ selectedIds.length }} 件</span><strong>{{ money(total) }}</strong>
      </div>
      <div class="proposal-actions">
        <button
          v-if="!preview && proposalStatus === 'PENDING'"
          type="button"
          class="ghost-decline"
          :disabled="thinking || confirming || rejecting"
          @click="$emit('reject')"
        >
          {{ rejecting ? '处理中…' : '放弃' }}
        </button>
        <button
          v-if="proposalStatus === 'CONFIRMED'"
          type="button"
          class="confirm-button"
          @click="$emit('cart')"
        >
          去购物车结算 →
        </button>
        <button
          v-else
          type="button"
          class="confirm-button"
          :disabled="
            preview ||
            thinking ||
            confirming ||
            rejecting ||
            !selectedIds.length ||
            (!preview && proposalStatus !== 'PENDING')
          "
          @click="$emit('confirm')"
        >
          <Icon name="check" :size="15" />{{ confirming ? '加入中…' : '确认加购' }}
        </button>
      </div>
    </div>
  </section>
</template>
