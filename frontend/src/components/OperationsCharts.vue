<script setup lang="ts">
import { computed } from 'vue';

interface TrendItem {
  day: string;
  orderCount: number;
}
interface TopProductItem {
  productId: string;
  title?: string;
  quantity: number;
}
interface StatusItem {
  status: string;
  orderCount: number;
  amountCent: number;
}
interface StatsData {
  trend?: TrendItem[];
  products?: TopProductItem[];
  statuses?: StatusItem[];
}

const props = defineProps<{
  stats: StatsData;
  money: (cent: number) => string;
  orderStatusLabel: (status: string) => string;
}>();

const SLICE_COLORS = ['#0f766e', '#10b981', '#f59e0b', '#ef4444', '#94a3b8'];

const trendBars = computed(() => {
  const raw = props.stats?.trend || [];
  if (!raw.length) return [];
  const byDay = new Map<string, number>();
  for (const item of raw) {
    byDay.set(String(item.day || '').slice(0, 10), Number(item.orderCount || 0));
  }
  const sortedDays = [...byDay.keys()].filter(Boolean).sort();
  let days = sortedDays.slice(-10);
  if (days.length > 0 && days.length < 7) {
    const endDate = new Date(days[days.length - 1] + 'T00:00:00Z');
    if (!Number.isNaN(endDate.getTime())) {
      const padded: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(endDate.getTime() - i * 86400000);
        padded.push(d.toISOString().slice(0, 10));
      }
      days = padded;
    }
  }
  const maxVal = Math.max(1, ...days.map((d) => byDay.get(d) || 0));
  const count = Math.max(1, days.length);
  const plotW = 320;
  const startX = 24;
  const step = plotW / count;
  const barW = Math.min(24, Math.max(10, step * 0.54));
  return days.map((day, idx) => {
    const val = byDay.get(day) || 0;
    const h = val > 0 ? Math.max(8, Math.round((val / maxVal) * 92)) : 3;
    const x = startX + idx * step + (step - barW) / 2;
    const y = 116 - h;
    return {
      day,
      shortDay: day.slice(5),
      val,
      x: Math.round(x * 10) / 10,
      y,
      w: Math.round(barW * 10) / 10,
      h,
      cx: Math.round((x + barW / 2) * 10) / 10,
    };
  });
});

const topProducts = computed(() => {
  const list = props.stats?.products || [];
  const maxQty = Math.max(1, ...list.map((p) => Number(p.quantity || 0)));
  return list.map((p) => ({
    ...p,
    pct: Math.max(8, Math.round((Number(p.quantity || 0) / maxQty) * 100)),
  }));
});

const statusSlices = computed(() => {
  const list = props.stats?.statuses || [];
  const totalCount = Math.max(
    1,
    list.reduce((sum, item) => sum + Number(item.orderCount || 0), 0),
  );
  let cursor = 0;
  return list.map((item, idx) => {
    const pct = Math.max(4, Math.round((Number(item.orderCount || 0) / totalCount) * 100));
    const width = Math.min(100 - cursor, pct);
    const slice = {
      ...item,
      pct,
      offset: cursor,
      width: Math.max(2, width),
      color: SLICE_COLORS[idx % SLICE_COLORS.length],
    };
    cursor = Math.min(100, cursor + width);
    return slice;
  });
});
</script>

<template>
  <div class="ops-grid stats-three-col">
    <section class="ops-card">
      <div class="ops-card-header">
        <h2>每日订单量</h2>
        <span>近 {{ trendBars.length }} 日笔数</span>
      </div>
      <div v-if="trendBars.length" class="chart-svg-wrap">
        <svg class="chart-svg" viewBox="0 0 360 150" role="img" aria-label="每日订单量趋势图">
          <defs>
            <linearGradient id="campusBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#10b981" />
              <stop offset="100%" stop-color="#0f766e" />
            </linearGradient>
          </defs>
          <line x1="20" y1="20" x2="346" y2="20" stroke="#efede6" stroke-dasharray="3 3" />
          <line x1="20" y1="68" x2="346" y2="68" stroke="#efede6" stroke-dasharray="3 3" />
          <line x1="20" y1="116" x2="346" y2="116" stroke="#e6e4dc" />
          <g v-for="bar in trendBars" :key="bar.day">
            <rect class="chart-bar-rect" :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h" />
            <text
              v-if="bar.val > 0"
              class="chart-val-text"
              :x="bar.cx"
              :y="bar.y - 5"
              text-anchor="middle"
            >
              {{ bar.val }}
            </text>
            <text class="chart-axis-text" :x="bar.cx" y="136" text-anchor="middle">
              {{ bar.shortDay }}
            </text>
          </g>
        </svg>
      </div>
      <div v-else class="admin-empty">期间暂无订单</div>
    </section>

    <section class="ops-card">
      <div class="ops-card-header">
        <h2>热销商品</h2>
        <span>已成交件数</span>
      </div>
      <div v-if="topProducts.length" class="hbar-list">
        <div v-for="item in topProducts" :key="item.productId" class="hbar-item">
          <div class="hbar-head">
            <strong>{{ item.title || item.productId }}</strong>
            <b>{{ item.quantity }} 件</b>
          </div>
          <svg class="hbar-svg" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect x="0" y="0" width="100" height="8" rx="4" fill="#efede6" />
            <rect x="0" y="0" :width="item.pct" height="8" rx="4" fill="#0f766e" />
          </svg>
        </div>
      </div>
      <div v-else class="admin-empty">期间暂无成交商品</div>
    </section>

    <section class="ops-card">
      <div class="ops-card-header">
        <h2>订单状态分布</h2>
        <span>金额占比</span>
      </div>
      <template v-if="statusSlices.length">
        <svg class="seg-svg" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0" y="0" width="100" height="10" rx="5" fill="#efede6" />
          <rect
            v-for="s in statusSlices"
            :key="s.status"
            :x="s.offset"
            y="0"
            :width="s.width"
            height="10"
            :fill="s.color"
          />
        </svg>
        <div v-for="item in statusSlices" :key="item.status" class="ops-list-line">
          <div>
            <strong>{{ orderStatusLabel(item.status) }}</strong>
            <small>{{ item.orderCount }} 单 · {{ item.pct }}%</small>
          </div>
          <b>{{ money(item.amountCent) }}</b>
        </div>
      </template>
      <div v-else class="admin-empty">期间暂无订单</div>
    </section>
  </div>
</template>
