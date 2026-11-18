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
}
defineProps<{
  items: Recommendation[];
  selectedIds: string[];
  total: number;
  feedback: string;
  preview: boolean;
  thinking: boolean;
  confirming: boolean;
  proposalStatus?: string;
}>();
defineEmits<{
  toggle: [skuId: string];
  detail: [item: Recommendation];
  reject: [];
  confirm: [];
  cart: [];
}>();
</script>

<template>
  <section class="recommendation-panel">
    <div class="recommendation-header">
      <div>
        <h2>
          为你挑了 <em>{{ items.length }}</em> 件好物
        </h2>
        <p>勾选想要的商品，确认后加入购物车</p>
      </div>
    </div>
    <div class="rec-cards">
      <article v-for="item in items" :key="item.skuId" class="rec-item">
        <button
          class="rec-check"
          :class="{ checked: selectedIds.includes(item.skuId) }"
          :aria-label="'选择' + item.title"
          :aria-pressed="selectedIds.includes(item.skuId)"
          @click="$emit('toggle', item.skuId)"
        >
          <Icon name="check" :size="13" />
        </button>
        <div class="rec-photo" @click="$emit('toggle', item.skuId)">
          <ProductImage :src="item.imageUrl || item.product?.imageUrl" :alt="item.title" />
        </div>
        <div class="rec-card-content">
          <div class="rec-item-tag">
            {{ item.merchantName || (item.merchantId ? shopName(item.merchantId) : '校内自提') }}
          </div>
          <strong>{{ item.title }}</strong>
          <small
            >{{ item.specKey
            }}<template v-if="(item.quantity || 1) > 1"> × {{ item.quantity }}</template></small
          >
          <button
            class="rec-detail-link"
            type="button"
            :disabled="!item.detailAvailable || !item.productId"
            @click="$emit('detail', item)"
          >
            {{ item.detailAvailable ? '查看详情' : '详情暂不可用' }}
          </button>
          <div class="rec-price">
            <span>{{ money(item.priceCent) }}</span>
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
          @click="$emit('reject')"
        >
          放弃
        </button>
        <button
          v-if="proposalStatus === 'CONFIRMED'"
          type="button"
          class="outline-button small"
          @click="$emit('cart')"
        >
          去购物车
        </button>
        <button
          class="confirm-button"
          :disabled="
            preview || thinking || !selectedIds.length || (!preview && proposalStatus !== 'PENDING')
          "
          @click="$emit('confirm')"
        >
          <Icon name="check" :size="17" />{{
            proposalStatus === 'CONFIRMED' ? '已确认' : confirming ? '确认中…' : '确认加购'
          }}
        </button>
      </div>
    </div>
  </section>
</template>
