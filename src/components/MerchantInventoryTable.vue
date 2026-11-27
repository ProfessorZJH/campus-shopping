<script setup lang="ts">
import ProductImage from './ProductImage.js';

interface StockRow {
  product: { title: string; imageUrl?: string };
  sku: { skuId: string; specKey: string };
  stock?: { onHand?: number; reserved?: number; available?: number } | null;
}

defineProps<{
  rows: StockRow[];
  selectedSku: string;
  query: string;
  preview: boolean;
  canReplenish: boolean;
}>();
defineEmits<{ select: [skuId: string] }>();
</script>

<template>
  <div class="ops-table-wrap">
    <table class="ops-table">
      <thead>
        <tr>
          <th>商品 / 规格</th>
          <th>实物</th>
          <th>预占</th>
          <th>可售</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in preview
            ? rows.filter(
                (r) => !query || r.product.title.includes(query) || r.sku.specKey.includes(query),
              )
            : rows"
          :key="row.sku.skuId"
          :class="{ active: selectedSku === row.sku.skuId }"
        >
          <td>
            <div class="table-product-cell">
              <ProductImage :src="row.product.imageUrl" :alt="row.product.title" />
              <div>
                <strong>{{ row.product.title }}</strong>
                <span>{{ row.sku.specKey }}</span>
              </div>
            </div>
          </td>
          <td>{{ row.stock?.onHand ?? '—' }}</td>
          <td>{{ row.stock?.reserved ?? '—' }}</td>
          <td :class="{ 'red-text': Number(row.stock?.available || 0) < 10 }">
            {{ row.stock?.available ?? '—' }}
          </td>
          <td>
            <button v-if="canReplenish" class="row-link" @click="$emit('select', row.sku.skuId)">
              补货
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
