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

const SLICE_COLORS = ['#00a870', '#3b82f6', '#f59e0b', '#64748b', '#e11d48'];

const trendModel = computed(() => {
  const raw = props.stats?.trend || [];
  if (!raw.length) return { bars: [], maxVal: 0, midVal: 0 };
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
  const maxVal = Math.max(2, ...days.map((d) => byDay.get(d) || 0));
  const midVal = Math.round(maxVal / 2);
  const count = Math.max(1, days.length);
  const plotW = 308;
  const startX = 36;
  const baseY = 122;
  const plotH = 88;
  const step = plotW / count;
  const barW = Math.min(22, Math.max(10, step * 0.48));
  const bars = days.map((day, idx) => {
    const val = byDay.get(day) || 0;
    const h = val > 0 ? Math.max(8, Math.round((val / maxVal) * plotH)) : 3;
    const x = startX + idx * step + (step - barW) / 2;
    const y = baseY - h;
    const cx = Math.round((x + barW / 2) * 10) / 10;
    return {
      day,
      shortDay: day.slice(5),
      val,
      x: Math.round(x * 10) / 10,
      y,
      w: Math.round(barW * 10) / 10,
      h,
      cx,
    };
  });
  return { bars, maxVal, midVal };
});

const topProducts = computed(() => {
  const list = props.stats?.products || [];
  const maxQty = Math.max(1, ...list.map((p) => Number(p.quantity || 0)));
  return list.slice(0, 6).map((p, idx) => ({
    ...p,
    rank: idx + 1,
    pct: Math.max(10, Math.round((Number(p.quantity || 0) / maxQty) * 100)),
  }));
});

const donutModel = computed(() => {
  const list = props.stats?.statuses || [];
  const totalOrders = list.reduce((sum, item) => sum + Number(item.orderCount || 0), 0);
  const safeTotal = Math.max(1, totalOrders);
  const circumference = 2 * Math.PI * 38;
  let offsetAcc = 0;
  const slices = list.map((item, idx) => {
    const count = Number(item.orderCount || 0);
    const ratio = count / safeTotal;
    const len = Math.max(count > 0 ? 4 : 0, ratio * circumference);
    const pct = Math.round(ratio * 100);
    const entry = {
      ...item,
      pct,
      color: SLICE_COLORS[idx % SLICE_COLORS.length],
      dashArray: `${len.toFixed(1)} ${circumference.toFixed(1)}`,
      dashOffset: (-offsetAcc).toFixed(1),
    };
    offsetAcc += len;
    return entry;
  });
  return { totalOrders, slices };
});
</script>

<template>
  <div class="ops-grid stats-three-col echarts-pro-grid">
    <section class="ops-card">
      <div class="ops-card-header">
        <h2>近 {{ trendModel.bars.length || 7 }} 日订单趋势</h2>
      </div>
      <div v-if="trendModel.bars.length" class="chart-svg-wrap">
        <svg class="chart-svg" viewBox="0 0 360 150" role="img" aria-label="每日订单量趋势图">
          <text class="chart-axis-text" x="28" y="34" text-anchor="end">
            {{ trendModel.maxVal }}
          </text>
          <text class="chart-axis-text" x="28" y="78" text-anchor="end">
            {{ trendModel.midVal }}
          </text>
          <text class="chart-axis-text" x="28" y="124" text-anchor="end">0</text>
          <line x1="34" y1="32" x2="348" y2="32" stroke="#f1f5f9" stroke-dasharray="3 3" />
          <line x1="34" y1="77" x2="348" y2="77" stroke="#f1f5f9" stroke-dasharray="3 3" />
          <line x1="34" y1="122" x2="348" y2="122" stroke="#e2e8f0" />
          <g v-for="bar in trendModel.bars" :key="bar.day">
            <rect
              class="chart-bar-rect"
              :x="bar.x"
              :y="bar.y"
              :width="bar.w"
              :height="bar.h"
              rx="5"
            />
            <text
              v-if="bar.val > 0"
              class="chart-val-text"
              :x="bar.cx"
              :y="bar.y - 6"
              text-anchor="middle"
            >
              {{ bar.val }}
            </text>
            <text class="chart-axis-text" :x="bar.cx" y="140" text-anchor="middle">
              {{ bar.shortDay }}
            </text>
          </g>
        </svg>
      </div>
      <div v-else class="admin-empty">暂无订单数据</div>
    </section>

    <section class="ops-card">
      <div class="ops-card-header">
        <h2>热销商品排行</h2>
      </div>
      <div v-if="topProducts.length" class="hbar-list">
        <div v-for="item in topProducts" :key="item.productId" class="hbar-item">
          <div class="hbar-head">
            <div class="hbar-rank-title">
              <span class="rank-medal" :class="'medal-' + item.rank">{{ item.rank }}</span>
              <strong>{{ item.title || item.productId }}</strong>
            </div>
            <b>{{ item.quantity }} 件</b>
          </div>
          <svg class="hbar-svg" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
            <rect x="0" y="0" width="100" height="6" rx="3" fill="#f1f5f9" />
            <rect
              x="0"
              y="0"
              :width="item.pct"
              height="6"
              rx="3"
              :fill="item.rank === 1 ? '#00a870' : item.rank === 2 ? '#10b981' : '#34d399'"
            />
          </svg>
        </div>
      </div>
      <div v-else class="admin-empty">暂无成交商品</div>
    </section>

    <section class="ops-card">
      <div class="ops-card-header">
        <h2>订单状态分布</h2>
      </div>
      <div v-if="donutModel.slices.length" class="donut-chart-layout">
        <div class="donut-svg-box">
          <svg viewBox="0 0 120 120" class="donut-svg" role="img" aria-label="订单状态环形图">
            <circle cx="60" cy="60" r="38" fill="none" stroke="#f1f5f9" stroke-width="14" />
            <circle
              v-for="s in donutModel.slices"
              :key="s.status"
              cx="60"
              cy="60"
              r="38"
              fill="none"
              :stroke="s.color"
              stroke-width="14"
              :stroke-dasharray="s.dashArray"
              :stroke-dashoffset="s.dashOffset"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div class="donut-center-label">
            <strong>{{ donutModel.totalOrders }}</strong>
            <small>总单量</small>
          </div>
        </div>
        <div class="donut-legend">
          <div v-for="s in donutModel.slices" :key="'lg-' + s.status" class="donut-legend-row">
            <span class="legend-dot" :style="{ background: s.color }"></span>
            <span class="legend-name">{{ orderStatusLabel(s.status) }}</span>
            <b>{{ s.orderCount }}单</b>
          </div>
        </div>
      </div>
      <div v-else class="admin-empty">暂无状态统计</div>
    </section>
  </div>
</template>
