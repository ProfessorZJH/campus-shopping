<script setup lang="ts">
import ProductImage from './ProductImage.js';
import { money } from '../services/store.js';

interface Recommendation {
  skuId: string;
  productId?: string;
  title: string;
  specKey: string;
  priceCent: number;
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
}>();
</script>

<template>
  <section class="recommendation-panel">
    <div class="recommendation-header">
      <div>
        <h2>
          为你选了 <em>{{ items.length }}</em> 件好物
        </h2>
      </div>
    </div>
    <div class="rec-cards">
      <article v-for="(item, index) in items" :key="item.skuId" class="rec-item">
        <button
          class="rec-check"
          :class="{ checked: selectedIds.includes(item.skuId) }"
          :aria-label="'选择' + item.title"
          :aria-pressed="selectedIds.includes(item.skuId)"
          @click="$emit('toggle', item.skuId)"
        >
          <Icon name="check" :size="13" />
        </button>
        <div class="rec-photo">
          <ProductImage :src="item.imageUrl || item.product?.imageUrl" :alt="item.title" />
        </div>
        <div class="rec-card-content">
          <div class="rec-item-tag">
            {{ index === 0 ? 'HOT PICK' : index === 1 ? 'DAILY' : 'GOOD VALUE' }}
          </div>
          <strong>{{ item.title }}</strong>
          <small>{{ item.specKey }}</small>
          <button
            class="rec-detail-link"
            type="button"
            :disabled="!item.detailAvailable || !item.productId"
            @click="$emit('detail', item)"
          >
            {{ item.detailAvailable ? '查看详情' : '详情暂不可用' }}
          </button>
          <div class="rec-price">
            <span>{{ money(item.priceCent) }}</span
            ><span class="pick-mini"><Icon name="plus" :size="15" /></span>
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
          class="ghost-decline"
          @click="$emit('reject')"
        >
          放弃
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
