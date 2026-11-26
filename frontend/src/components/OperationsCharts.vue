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

const HBAR_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];
const SLICE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const trendModel = computed(() => {
  const raw = props.stats?.trend || [];
  if (!raw.length)
    return { bars: [], maxVal: 0, midVal: 0, peakVal: 0, linePath: '', areaPath: '' };
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
  const peakVal = Math.max(0, ...days.map((d) => byDay.get(d) || 0));
  const maxVal = Math.max(2, peakVal);
  const midVal = Math.round(maxVal / 2);
  const count = Math.max(1, days.length);
  const plotW = 308;
  const startX = 36;
  const baseY = 124;
  const plotH = 86;
  const step = plotW / count;
  const barW = Math.min(24, Math.max(11, step * 0.52));
  const bars = days.map((day, idx) => {
    const val = byDay.get(day) || 0;
    const h = val > 0 ? Math.max(8, Math.round((val / maxVal) * plotH)) : 4;
    const x = startX + idx * step + (step - barW) / 2;
    const y = baseY - h;
    const cx = Math.round((x + barW / 2) * 10) / 10;
    const pointY = val > 0 ? y : baseY;
    return {
      day,
      shortDay: day.slice(5),
      val,
      x: Math.round(x * 10) / 10,
      y,
      w: Math.round(barW * 10) / 10,
      h,
      cx,
      pointY,
    };
  });

  let linePath = '';
  let areaPath = '';
  if (bars.length === 1) {
    const p0 = bars[0];
    const x0 = Math.max(startX, p0.cx - 14).toFixed(1);
    const x1 = Math.min(startX + plotW, p0.cx + 14).toFixed(1);
    linePath = `M ${x0} ${p0.pointY} L ${x1} ${p0.pointY}`;
    areaPath = `${linePath} L ${x1} ${baseY} L ${x0} ${baseY} Z`;
  } else if (bars.length > 1) {
    const segs = [`M ${bars[0].cx.toFixed(1)} ${bars[0].pointY.toFixed(1)}`];
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1];
      const curr = bars[i];
      const dx = (curr.cx - prev.cx) * 0.42;
      const c1x = (prev.cx + dx).toFixed(1);
      const c2x = (curr.cx - dx).toFixed(1);
      segs.push(
        `C ${c1x} ${prev.pointY.toFixed(1)}, ${c2x} ${curr.pointY.toFixed(1)}, ${curr.cx.toFixed(1)} ${curr.pointY.toFixed(1)}`,
      );
    }
    linePath = segs.join(' ');
    const last = bars[bars.length - 1];
    const first = bars[0];
    areaPath = `${linePath} L ${last.cx.toFixed(1)} ${baseY} L ${first.cx.toFixed(1)} ${baseY} Z`;
  }

  return { bars, maxVal, midVal, peakVal, linePath, areaPath };
});

const topProducts = computed(() => {
  const list = props.stats?.products || [];
  const maxQty = Math.max(1, ...list.map((p) => Number(p.quantity || 0)));
  return list.slice(0, 6).map((p, idx) => {
    const pct = Math.max(10, Math.round((Number(p.quantity || 0) / maxQty) * 100));
    return {
      ...p,
      rank: idx + 1,
      pct,
      barWidth: Math.max(24, Math.round((pct / 100) * 280)),
      color: HBAR_COLORS[idx % HBAR_COLORS.length],
    };
  });
});

const donutModel = computed(() => {
  const list = props.stats?.statuses || [];
  const totalOrders = list.reduce((sum, item) => sum + Number(item.orderCount || 0), 0);
  const safeTotal = Math.max(1, totalOrders);
  const circumference = 2 * Math.PI * 40;
  let offsetAcc = 0;
  const slices = list.map((item, idx) => {
    const count = Number(item.orderCount || 0);
    const ratio = count / safeTotal;
    const len = Math.max(count > 0 ? 4 : 0, ratio * circumference);
    const pct = totalOrders > 0 ? Math.round(ratio * 100) : 0;
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
        <span v-if="trendModel.bars.length">单日峰值 {{ trendModel.peakVal }} 单</span>
      </div>
      <div v-if="trendModel.bars.length" class="chart-svg-wrap">
        <svg class="chart-svg" viewBox="0 0 360 154" role="img" aria-label="每日订单量趋势图">
          <defs>
            <linearGradient id="ops-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.22" />
              <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="ops-bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--chart-1)" />
              <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0.65" />
            </linearGradient>
          </defs>
          <text class="chart-axis-text" x="28" y="40" text-anchor="end">
            {{ trendModel.maxVal }}
          </text>
          <text class="chart-axis-text" x="28" y="83" text-anchor="end">
            {{ trendModel.midVal }}
          </text>
          <text class="chart-axis-text" x="28" y="126" text-anchor="end">0</text>
          <line x1="34" y1="38" x2="348" y2="38" stroke="#E5E6EB" stroke-dasharray="3 3" />
          <line x1="34" y1="81" x2="348" y2="81" stroke="#E5E6EB" stroke-dasharray="3 3" />
          <line x1="34" y1="124" x2="348" y2="124" stroke="#C9CDD4" />
          <rect
            v-for="bar in trendModel.bars"
            :key="'col-' + bar.day"
            class="chart-bar-rect"
            :x="bar.x"
            :y="bar.y"
            :width="bar.w"
            :height="bar.h"
            rx="4"
            fill="url(#ops-bar-grad)"
            opacity="0.16"
          />
          <path v-if="trendModel.areaPath" :d="trendModel.areaPath" fill="url(#ops-area-grad)" />
          <path
            v-if="trendModel.linePath"
            :d="trendModel.linePath"
            fill="none"
            stroke="var(--chart-1)"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <g v-for="bar in trendModel.bars" :key="bar.day">
            <circle
              :cx="bar.cx"
              :cy="bar.pointY"
              r="3.8"
              fill="#FFFFFF"
              stroke="var(--chart-1)"
              stroke-width="2.2"
            />
            <text
              v-if="bar.val > 0"
              class="chart-val-text"
              :x="bar.cx"
              :y="bar.pointY - 8"
              text-anchor="middle"
            >
              {{ bar.val }}
            </text>
            <text class="chart-axis-text" :x="bar.cx" y="143" text-anchor="middle">
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
        <span v-if="topProducts.length">TOP {{ topProducts.length }}</span>
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
          <svg class="hbar-svg" viewBox="0 0 280 8" aria-hidden="true">
            <rect x="0" y="0" width="280" height="8" rx="4" fill="#F2F3F5" />
            <rect x="0" y="0" :width="item.barWidth" height="8" rx="4" :fill="item.color" />
          </svg>
        </div>
      </div>
      <div v-else class="admin-empty">暂无成交商品</div>
    </section>

    <section class="ops-card">
      <div class="ops-card-header">
        <h2>订单状态分布</h2>
        <span v-if="donutModel.slices.length">实时履约占比</span>
      </div>
      <div v-if="donutModel.slices.length" class="donut-chart-layout">
        <div class="donut-svg-box">
          <svg viewBox="0 0 124 124" class="donut-svg" role="img" aria-label="订单状态环形图">
            <circle cx="62" cy="62" r="40" fill="none" stroke="#F2F3F5" stroke-width="15" />
            <circle
              cx="62"
              cy="62"
              r="28"
              fill="none"
              stroke="#E5E6EB"
              stroke-width="1"
              stroke-dasharray="2.5 3"
            />
            <circle
              v-for="s in donutModel.slices"
              :key="s.status"
              cx="62"
              cy="62"
              r="40"
              fill="none"
              :stroke="s.color"
              stroke-width="15"
              :stroke-dasharray="s.dashArray"
              :stroke-dashoffset="s.dashOffset"
              transform="rotate(-90 62 62)"
            />
          </svg>
          <div class="donut-center-label">
            <strong>{{ donutModel.totalOrders }}</strong>
            <small>总单量</small>
          </div>
        </div>
        <div class="donut-legend">
          <div v-for="s in donutModel.slices" :key="'lg-' + s.status" class="donut-legend-row">
            <svg class="legend-dot" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
              <circle cx="5" cy="5" r="4.5" :fill="s.color" />
            </svg>
            <span class="legend-name">{{ orderStatusLabel(s.status) }}</span>
            <small class="legend-pct">{{ s.pct }}%</small>
            <b>{{ s.orderCount }}单</b>
          </div>
        </div>
      </div>
      <div v-else class="admin-empty">暂无状态统计</div>
    </section>
  </div>
</template>
