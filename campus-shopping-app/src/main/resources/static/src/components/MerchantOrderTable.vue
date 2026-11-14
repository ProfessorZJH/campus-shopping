<script setup lang="ts">
import { dateTime, orderStatusLabel, pickupStatusLabel } from '../services/page-utils.js';
import { money } from '../services/store.js';

interface OrderRow {
  orderId: string;
  createdAt?: string;
  totalCent: number;
  status: string;
  items?: { title: string }[];
  pickup?: { status: string };
}

defineProps<{
  orders: OrderRow[];
  selectedOrder: OrderRow | null;
  orderReminder: (order: OrderRow) => string;
}>();
defineEmits<{ select: [orderId: string] }>();
</script>

<template>
  <div class="ops-table-wrap">
    <table class="ops-table">
      <thead>
        <tr>
          <th>订单</th>
          <th>商品</th>
          <th>金额</th>
          <th>状态</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="order in orders"
          :key="order.orderId"
          :class="{ active: selectedOrder?.orderId === order.orderId }"
          @click="$emit('select', order.orderId)"
        >
          <td>
            <button
              class="row-link"
              :aria-pressed="selectedOrder?.orderId === order.orderId"
              @click.stop="$emit('select', order.orderId)"
            >
              #{{ order.orderId }}
            </button>
            <small>{{ dateTime(order.createdAt) }}</small>
          </td>
          <td>{{ order.items?.[0]?.title || '—' }}</td>
          <td>{{ money(order.totalCent) }}</td>
          <td>
            <span class="status-tag" :class="order.status === 'COMPLETED' ? 'published' : 'draft'">
              {{ orderStatusLabel(order.status) }}
            </span>
            <small v-if="order.pickup">{{ pickupStatusLabel(order.pickup.status) }}</small>
            <small v-if="orderReminder(order)" class="red-text">{{ orderReminder(order) }}</small>
          </td>
          <td><Icon name="chevronRight" :size="16" /></td>
        </tr>
      </tbody>
    </table>
    <div v-if="!orders.length" class="admin-empty">暂无符合条件的订单</div>
  </div>
</template>
