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

const SLICE_COLORS = ['#00b578', '#1677ff', '#ff8f1f', '#ff4400', '#94a3b8'];

const trendModel = computed(() => {
  const raw = props.stats?.trend || [];
  if (!raw.length) return { bars: [], linePath: '', areaPath: '', maxVal: 0, midVal: 0 };
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
  const plotH = 90;
  const step = plotW / count;
  const barW = Math.min(20, Math.max(10, step * 0.46));
  const bars = days.map((day, idx) => {
    const val = byDay.get(day) || 0;
    const h = val > 0 ? Math.max(8, Math.round((val / maxVal) * plotH)) : 3;
    const x = startX + idx * step + (step - barW) / 2;
    const y = baseY - h;
    const cx = Math.round((x + barW / 2) * 10) / 10;
    const ly = Math.round((baseY - (val / maxVal) * plotH) * 10) / 10;
    return {
      day,
      shortDay: day.slice(5),
      val,
      x: Math.round(x * 10) / 10,
      y,
      w: Math.round(barW * 10) / 10,
      h,
      cx,
      ly,
    };
  });
  const linePath = bars.map((b, idx) => `${idx === 0 ? 'M' : 'L'} ${b.cx} ${b.ly}`).join(' ');
  const areaPath = bars.length
    ? `${linePath} L ${bars[bars.length - 1].cx} ${baseY} L ${bars[0].cx} ${baseY} Z`
    : '';
  return { bars, linePath, areaPath, maxVal, midVal };
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
        <div>
          <h2>近 {{ trendModel.bars.length || 7 }} 日订单趋势</h2>
          <small class="chart-sub-hint">柱状成交单量 · 折线日度走势</small>
        </div>
        <span class="chart-unit-pill">单位：单</span>
      </div>
      <div v-if="trendModel.bars.length" class="chart-svg-wrap">
        <svg class="chart-svg" viewBox="0 0 360 154" role="img" aria-label="每日订单量趋势图">
          <defs>
            <linearGradient id="campusBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00c282" stop-opacity="0.88" />
              <stop offset="100%" stop-color="#00a870" stop-opacity="0.35" />
            </linearGradient>
            <linearGradient id="campusAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1677ff" stop-opacity="0.22" />
              <stop offset="100%" stop-color="#1677ff" stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <text class="chart-axis-text" x="28" y="34" text-anchor="end">
            {{ trendModel.maxVal }}
          </text>
          <text class="chart-axis-text" x="28" y="78" text-anchor="end">
            {{ trendModel.midVal }}
          </text>
          <text class="chart-axis-text" x="28" y="124" text-anchor="end">0</text>
          <line x1="34" y1="32" x2="348" y2="32" stroke="#ebedf0" stroke-dasharray="3 3" />
          <line x1="34" y1="77" x2="348" y2="77" stroke="#ebedf0" stroke-dasharray="3 3" />
          <line x1="34" y1="122" x2="348" y2="122" stroke="#dcdfe6" />
          <path v-if="trendModel.areaPath" :d="trendModel.areaPath" fill="url(#campusAreaGrad)" />
          <g v-for="bar in trendModel.bars" :key="bar.day">
            <rect
              class="chart-bar-rect"
              :x="bar.x"
              :y="bar.y"
              :width="bar.w"
              :height="bar.h"
              rx="4"
            />
            <text class="chart-axis-text" :x="bar.cx" y="142" text-anchor="middle">
              {{ bar.shortDay }}
            </text>
          </g>
          <path
            v-if="trendModel.linePath"
            :d="trendModel.linePath"
            fill="none"
            stroke="#1677ff"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <g v-for="bar in trendModel.bars" :key="'pt-' + bar.day">
            <circle
              :cx="bar.cx"
              :cy="bar.ly"
              r="3.4"
              fill="#ffffff"
              stroke="#1677ff"
              stroke-width="2"
            />
            <text
              v-if="bar.val > 0"
              class="chart-val-text"
              :x="bar.cx"
              :y="bar.ly - 7"
              text-anchor="middle"
            >
              {{ bar.val }}
            </text>
          </g>
        </svg>
      </div>
      <div v-else class="admin-empty">期间暂无订单</div>
    </section>

    <section class="ops-card">
      <div class="ops-card-header">
        <div>
          <h2>热销商品 TOP 榜</h2>
          <small class="chart-sub-hint">按已成交核销件数排行</small>
        </div>
        <span class="chart-unit-pill">热卖单品</span>
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
          <svg class="hbar-svg" viewBox="0 0 100 7" preserveAspectRatio="none" aria-hidden="true">
            <rect x="0" y="0" width="100" height="7" rx="3.5" fill="#f0f2f5" />
            <rect
              x="0"
              y="0"
              :width="item.pct"
              height="7"
              rx="3.5"
              :fill="item.rank === 1 ? '#ff4400' : item.rank === 2 ? '#ff8f1f' : '#00b578'"
            />
          </svg>
        </div>
      </div>
      <div v-else class="admin-empty">期间暂无成交商品</div>
    </section>

    <section class="ops-card">
      <div class="ops-card-header">
        <div>
          <h2>订单履约状态占比</h2>
          <small class="chart-sub-hint">单量结构与实收金额分布</small>
        </div>
        <span class="chart-unit-pill">环形分布</span>
      </div>
      <div v-if="donutModel.slices.length" class="donut-chart-layout">
        <div class="donut-svg-box">
          <svg viewBox="0 0 120 120" class="donut-svg" role="img" aria-label="订单状态环形图">
            <circle cx="60" cy="60" r="38" fill="none" stroke="#f0f2f5" stroke-width="14" />
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
            <text x="60" y="56" text-anchor="middle" class="donut-center-num">
              {{ donutModel.totalOrders }}
            </text>
            <text x="60" y="72" text-anchor="middle" class="donut-center-label">总单数</text>
          </svg>
        </div>
        <div class="donut-legend-col">
          <div v-for="item in donutModel.slices" :key="item.status" class="donut-legend-row">
            <span class="legend-dot" :class="'dot-' + item.status.toLowerCase()"></span>
            <div class="legend-meta">
              <strong>{{ orderStatusLabel(item.status) }}</strong>
              <small>{{ item.orderCount }}单 · {{ item.pct }}%</small>
            </div>
            <b>{{ money(item.amountCent) }}</b>
          </div>
        </div>
      </div>
      <div v-else class="admin-empty">期间暂无订单</div>
    </section>
  </div>
</template>
