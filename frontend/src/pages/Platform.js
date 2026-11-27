import PlatformApplicationReview from '../components/PlatformApplicationReview.vue';
import OperationsCharts from '../components/OperationsCharts.vue';
import UiPagination from '../components/UiPagination.vue';
import { requestScope } from '../services/request-scope.js';
import BackofficeShell from '../components/BackofficeShell.js';
import ProductImage from '../components/ProductImage.js';
import StatusPanel from '../components/StatusPanel.vue';
import { api, query } from '../services/api.js';
import { designTheme } from '../services/design-theme.js';
import { store, go, preview, notify, money } from '../services/store.js';
import {
  DEMO_STATS,
  DEMO_APPLICATIONS,
  DEMO_MERCHANT_ORDERS,
  DEMO_AFTERSALES,
} from '../services/pages-demo.js';
import { DEMO_MERCHANTS, DEMO_PRODUCTS, DEMO_CATEGORIES } from '../services/demo.js';
import {
  priceSku,
  afterSaleStatusLabel,
  applicationStatusLabel,
  merchantStatusLabel,
  orderStatusLabel,
  orderEventLabel,
  productStatusLabel,
  dateTime,
  pathId,
} from '../services/page-utils.js';
const { ref, computed, onMounted, onUnmounted, watch } = Vue;
const titles = {
  '/admin': '平台总览',
  '/admin/applications': '商户审核',
  '/admin/merchants': '商户监管',
  '/admin/products': '商品监管',
  '/admin/orders': '订单监管',
  '/admin/disputes': '争议处理',
  '/admin/categories': '分类管理',
};
export default {
  name: 'Platform',
  components: {
    BackofficeShell,
    ProductImage,
    StatusPanel,
    UiPagination,
    PlatformApplicationReview,
    OperationsCharts,
  },
  setup() {
    const scope = requestScope();
    const adminTheme = computed(() => designTheme.admin || 'antd');
    const route = computed(() => store.route.split('?')[0] || '/admin'),
      title = computed(() => titles[route.value] || '平台总览');
    const stats = ref(null),
      telemetry = ref(null),
      applications = ref([]),
      merchants = ref([]),
      products = ref([]),
      orders = ref([]),
      aftersales = ref([]),
      categories = ref([]),
      merchantTotal = ref(0),
      productTotal = ref(0);
    const selectedId = ref(''),
      search = ref(''),
      statsPeriod = ref(7),
      state = ref(route.value === '/admin/disputes' ? 'DISPUTED' : ''),
      page = ref(1),
      pageInfo = ref({ total: 0, hasNext: false }),
      reason = ref(''),
      historyEvents = ref([]),
      historyLoading = ref(false),
      historyError = ref(''),
      category = ref({ code: '', name: '', active: true }),
      loading = ref(false),
      busy = ref(false),
      error = ref(''),
      allowed = ref(preview);
    let disputeVersion = 0;
    const pickedApplication = computed(
      () =>
        applications.value.find((a) => a.applicationId === selectedId.value) ||
        applications.value[0] ||
        null,
    );
    const filtered = computed(() => {
      const source =
        route.value === '/admin/applications'
          ? applications.value
          : route.value === '/admin/merchants'
            ? merchants.value
            : route.value === '/admin/products'
              ? products.value
              : route.value === '/admin/orders'
                ? orders.value
                : route.value === '/admin/disputes'
                  ? aftersales.value
                  : categories.value;
      if (
        !preview &&
        ['/admin/applications', '/admin/merchants', '/admin/products', '/admin/orders'].includes(
          route.value,
        )
      )
        return source;
      const q = search.value.trim().toLowerCase();
      return source.filter(
        (row) =>
          (!q ||
            (route.value === '/admin/products' && !preview) ||
            Object.values(row).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))) &&
          (!state.value ||
            preview ||
            ['/admin/merchants', '/admin/products'].includes(route.value) ||
            row.status === state.value),
      );
    });
    let loadVersion = 0;
    async function load() {
      const request = scope.begin();
      const read = (path) => api(path, { signal: request.signal });
      const stamp = ++loadVersion;
      const current = route.value;
      error.value = '';
      if (preview) {
        loading.value = false;
        allowed.value = true;
        stats.value = { ...DEMO_STATS };
        telemetry.value = {
          redisEnabled: true,
          securityConnected: true,
          cacheConnected: true,
          namespace: 'cs:preview',
          crawlerBlockedCount: 12,
          rateLimitedCount: 3,
          orderBrushBlockedCount: 1,
          pinLockoutCount: 0,
          displayCacheFailures: 0,
          topHotKeywords: ['乌龙茶', '泡面', '纯牛奶', '果切'],
          topSellingProductIds: ['preview-p1', 'preview-p2'],
          activeRealtimeSubscribers: 2,
          delayedExpiryQueueSize: 1,
        };
        applications.value = DEMO_APPLICATIONS;
        merchants.value = DEMO_MERCHANTS;
        products.value = DEMO_PRODUCTS;
        orders.value = DEMO_MERCHANT_ORDERS;
        aftersales.value = DEMO_AFTERSALES;
        categories.value = DEMO_CATEGORIES;
        merchantTotal.value = DEMO_MERCHANTS.length;
        productTotal.value = DEMO_PRODUCTS.filter((p) => p.status === 'PUBLISHED').length;
        return;
      }
      loading.value = true;
      try {
        if (stamp !== loadVersion) return;
        const actor = store.user?.userId;
        const valid = () =>
          stamp === loadVersion && route.value === current && store.user?.userId === actor;
        const work = store.workspace || (await read('/workspace'));
        if (!valid()) return;
        store.workspace = work;
        allowed.value = !!work?.platformAdmin;
        if (!allowed.value) return;
        if (current === '/admin') {
          const [s, m, o, t, p] = await Promise.all([
            read('/admin/statistics/operations' + query({ periodDays: statsPeriod.value })),
            read('/admin/merchants/page' + query({ page: 1, size: 6 })),
            read('/admin/orders/page' + query({ page: 1, size: 6 })),
            read('/admin/redis-telemetry').catch(() => null),
            read('/admin/products/page' + query({ page: 1, size: 50 })).catch(() => null),
          ]);
          if (!valid()) return;
          stats.value = s;
          merchants.value = m.items || [];
          merchantTotal.value = Number(m?.total || merchants.value.length);
          orders.value = o.items || [];
          telemetry.value = t;
          if (p?.items?.length) products.value = p.items;
          if (p?.total != null) productTotal.value = Number(p.total);
        }
        if (current === '/admin/applications') {
          const result = await read(
            '/admin/merchant-applications/page' +
              query({ page: page.value, size: 12, state: state.value, q: search.value }),
          );
          if (!valid()) return;
          applications.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/merchants') {
          const result = await read(
            '/admin/merchants/page' + query({ page: page.value, size: 12, q: search.value }),
          );
          if (!valid()) return;
          merchants.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/products') {
          const result = await read(
            '/admin/products/page' + query({ page: page.value, size: 12, q: search.value }),
          );
          if (!valid()) return;
          products.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/orders') {
          const result = await read(
            '/admin/orders/page' +
              query({ page: page.value, size: 12, state: state.value, q: search.value }),
          );
          if (!valid()) return;
          orders.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/disputes') {
          const [result, mRes] = await Promise.all([
            read(
              '/admin/aftersales/page' + query({ page: page.value, size: 12, state: state.value }),
            ),
            merchants.value.length
              ? Promise.resolve({ items: merchants.value })
              : read('/admin/merchants/page' + query({ page: 1, size: 100 })).catch(() => ({
                  items: [],
                })),
          ]);
          if (!valid()) return;
          aftersales.value = result.items || [];
          if (!merchants.value.length && mRes?.items?.length) merchants.value = mRes.items;
          pageInfo.value = result;
        }
        if (current === '/admin/categories') {
          const result = await read('/categories');
          if (!valid()) return;
          categories.value = result || [];
        }
      } catch (e) {
        if (stamp === loadVersion && route.value === current) error.value = e.message;
      } finally {
        if (stamp === loadVersion) loading.value = false;
      }
    }
    onMounted(load);
    onUnmounted(() => {
      ++loadVersion;
      clearTimeout(searchDelay);
    });
    let searchDelay;
    let resettingPage = false;
    watch(
      [page, search, state, statsPeriod],
      (next, previous) => {
        if (resettingPage) return;
        clearTimeout(searchDelay);
        ++loadVersion;
        loading.value = true;
        const changed = next.slice(1).some((v, i) => v !== previous[i + 1]);
        if (changed) {
          resettingPage = true;
          page.value = 1;
          resettingPage = false;
        }
        searchDelay = setTimeout(load, next[1] !== previous[1] ? 280 : 0);
      },
      { flush: 'sync' },
    );
    async function perform(path, body) {
      if (preview || busy.value || loading.value || !!error.value || !allowed.value) return;
      const current = scope.capture();
      busy.value = true;
      try {
        await api(path, { method: 'POST', body });
        if (!current()) return;
        notify('操作成功');
        reason.value = '';
        await load();
      } catch (e) {
        if (current()) notify(e.message);
      } finally {
        if (current()) busy.value = false;
      }
    }
    function review(approved) {
      const a = pickedApplication.value;
      if (!a) return;
      if (!approved && !reason.value.trim()) {
        notify('请输入拒绝理由');
        return;
      }
      perform('/admin/merchant-applications/' + pathId(a.applicationId) + '/review', {
        approved,
        reason: reason.value,
      });
    }
    function stateMerchant(m) {
      if (preview || busy.value || loading.value || !allowed.value) return;
      const active = m.status !== 'ACTIVE';
      let comment = reason.value.trim();
      if (!active) {
        comment = window.prompt('请输入停用商户“' + m.name + '”的原因', comment);
        if (comment === null) return;
        comment = comment.trim();
        if (!comment || comment.length > 500) {
          notify('停用原因须为1~500字');
          return;
        }
      }
      if (!window.confirm('确定' + (active ? '启用' : '停用') + '商户“' + m.name + '”？')) return;
      perform('/admin/merchants/' + pathId(m.merchantId) + '/state', {
        active: m.status !== 'ACTIVE',
        reason: comment || '平台管理操作',
      });
    }
    function forceProduct(p) {
      if (preview || busy.value || loading.value || !allowed.value) return;
      if (!window.confirm('确定强制下架商品“' + p.title + '”？')) return;
      perform('/admin/products/' + pathId(p.productId) + '/unpublish');
    }
    async function openDispute(afterSale) {
      const version = ++disputeVersion;
      selectedId.value = afterSale.id;
      reason.value = '';
      historyEvents.value = [];
      historyError.value = '';
      if (preview) return;
      historyLoading.value = true;
      try {
        const detail = await api('/orders/' + pathId(afterSale.orderId));
        if (version !== disputeVersion || selectedId.value !== afterSale.id) return;
        historyEvents.value = (detail.events || []).filter(
          (e) =>
            e.type.startsWith('REFUND_') ||
            e.type.startsWith('MERCHANT_') ||
            e.type.startsWith('PLATFORM_'),
        );
      } catch (e) {
        if (version === disputeVersion) historyError.value = e.message;
      } finally {
        if (version === disputeVersion) historyLoading.value = false;
      }
    }
    function decideRefund(a, approved) {
      if (aftersales.value.find((row) => row.id === a?.id)?.status !== 'DISPUTED') {
        notify('该售后已不处于争议状态，请刷新列表');
        return;
      }
      const comment = reason.value.trim();
      if (!a || !comment) {
        notify('请填写退款审核说明');
        return;
      }
      perform('/admin/orders/' + pathId(a.orderId) + '/refund-decision', {
        approved,
        reason: comment,
      });
    }
    function saveCategory() {
      if (!category.value.code.trim() || !category.value.name.trim()) {
        notify('请填写分类信息');
        return;
      }
      perform('/admin/categories', { ...category.value });
    }
    function toggleCategory(c) {
      const next = { code: c.code, name: c.name, active: !c.active };
      category.value = next;
      perform('/admin/categories', next);
    }
    function selectApplication(a) {
      selectedId.value = a.applicationId;
      reason.value = '';
    }
    const categoryName = (code) =>
      categories.value.find((c) => c.code === code)?.name ||
      store.categories.find((c) => c.code === code)?.name ||
      code ||
      '—';
    const merchantName = (id, row) =>
      row?.merchantName ||
      merchants.value.find((m) => m.merchantId === id)?.storeName ||
      merchants.value.find((m) => m.merchantId === id)?.name ||
      (id && id.length > 12 ? '商户 #' + id.slice(0, 8).toUpperCase() : id) ||
      '—';
    const resolveProductTitle = (pid) => {
      if (!pid) return '热销单品';
      const fromStats = (stats.value?.products || []).find((p) => p.productId === pid)?.title;
      if (fromStats) return fromStats;
      const fromProducts = products.value.find((p) => p.productId === pid)?.title;
      if (fromProducts) return fromProducts;
      const fromStore = store.products.find((p) => p.productId === pid)?.title;
      if (fromStore) return fromStore;
      return '校内热销单品 #' + pid.slice(0, 6).toUpperCase();
    };
    const pendingAppCount = computed(
      () => applications.value.filter((a) => a.status === 'SUBMITTED').length,
    );
    const disputedCount = computed(
      () =>
        aftersales.value.filter((a) => a.status === 'DISPUTED').length ||
        Number(stats.value?.refundedOrders || 0),
    );
    const displayMerchantCount = computed(() =>
      preview ? merchants.value.length : merchantTotal.value || merchants.value.length,
    );
    const displayProductCount = computed(() =>
      preview
        ? products.value.filter((p) => p.status === 'PUBLISHED').length
        : productTotal.value || products.value.length,
    );
    const peakDayOrders = computed(() =>
      Math.max(0, ...(stats.value?.trend || []).map((t) => Number(t.orderCount || 0))),
    );
    const securityInterceptTotal = computed(
      () =>
        Number(telemetry.value?.crawlerBlockedCount || 0) +
        Number(telemetry.value?.rateLimitedCount || 0) +
        Number(telemetry.value?.orderBrushBlockedCount || 0) +
        Number(telemetry.value?.pinLockoutCount || 0),
    );
    const sparkPaths = computed(() => {
      const list = (stats.value?.trend || []).slice(-7);
      if (!list.length) {
        return {
          line: 'M 4 22 L 56 18 L 112 20 L 176 12',
          area: 'M 4 22 L 56 18 L 112 20 L 176 12 L 176 28 L 4 28 Z',
        };
      }
      const max = Math.max(2, ...list.map((d) => Number(d.orderCount || 0)));
      const step = list.length > 1 ? 172 / (list.length - 1) : 172;
      const pts = list.map((d, idx) => {
        const x = (4 + idx * step).toFixed(1);
        const y = (24 - (Number(d.orderCount || 0) / max) * 18).toFixed(1);
        return { x, y };
      });
      if (pts.length === 1) {
        return {
          line: `M 4 ${pts[0].y} L 176 ${pts[0].y}`,
          area: `M 4 ${pts[0].y} L 176 ${pts[0].y} L 176 28 L 4 28 Z`,
        };
      }
      const line = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const area = `${line} L ${pts[pts.length - 1].x} 28 L ${pts[0].x} 28 Z`;
      return { line, area };
    });
    return {
      store,
      designTheme,
      adminTheme,
      route,
      title,
      stats,
      telemetry,
      applications,
      merchants,
      products,
      orders,
      aftersales,
      categories,
      merchantTotal,
      productTotal,
      pendingAppCount,
      disputedCount,
      displayMerchantCount,
      displayProductCount,
      peakDayOrders,
      securityInterceptTotal,
      sparkPaths,
      selectedId,
      search,
      statsPeriod,
      state,
      page,
      pageInfo,
      reason,
      historyEvents,
      historyLoading,
      historyError,
      orderEventLabel,
      openDispute,
      category,
      busy,
      loading,
      error,
      allowed,
      pickedApplication,
      filtered,
      preview,
      go,
      money,
      priceSku,
      afterSaleStatusLabel,
      applicationStatusLabel,
      merchantStatusLabel,
      orderStatusLabel,
      productStatusLabel,
      dateTime,
      categoryName,
      merchantName,
      resolveProductTitle,
      load,
      review,
      stateMerchant,
      forceProduct,
      decideRefund,
      saveCategory,
      toggleCategory,
      selectApplication,
    };
  },
  template: `<BackofficeShell role="admin" :title="title"><template #actions><button class="outline-button small" @click="load"><Icon name="refresh" :size="16"/>刷新</button></template><StatusPanel v-if="loading" state="loading" message="正在加载…"/><StatusPanel v-else-if="error" state="error" :message="error" action-label="重新加载" :busy="loading" @retry="load"/><div v-else-if="!allowed&&!preview" class="ops-card access-denied"><Icon name="shield" :size="38"/><h2>无权限访问</h2></div>
  <template v-else-if="route==='/admin'">
    <!-- Workbench 1: ByteDance Arco Design Pro Workplace 1:1 Structural Replica -->
    <div v-if="adminTheme==='arco'" class="arco-workplace-grid">
      <div class="arco-workplace-main">
        <section class="ops-card arco-welcome-card">
          <div class="arco-welcome-head">
            <div class="arco-welcome-greeting">
              <span class="arco-welcome-avatar is-admin" aria-hidden="true"><Icon name="shield" :size="22"/></span>
              <div>
                <h2>欢迎回来，实时同步校园经营数据</h2>
                <p>青柠校园平台治理中心<template v-if="stats?.periodStart&&stats?.periodEnd"> · {{String(stats.periodStart).slice(0,10)}} 至 {{String(stats.periodEnd).slice(0,10)}}</template></p>
              </div>
            </div>
            <div class="stats-period-pills">
              <button type="button" :class="{active:statsPeriod===7}" @click="statsPeriod=7">近 7 天</button>
              <button type="button" :class="{active:statsPeriod===30}" @click="statsPeriod=30">近 30 天</button>
            </div>
          </div>
          <div class="arco-hero-metrics">
            <div class="arco-hero-metric">
              <span class="arco-metric-medallion is-blue" aria-hidden="true"><Icon name="creditCard" :size="20"/></span>
              <div class="arco-metric-copy">
                <span>平台成交额</span>
                <strong>{{stats?money(stats.completedAmountCent):'—'}}</strong>
              </div>
            </div>
            <div class="arco-hero-metric">
              <span class="arco-metric-medallion is-cyan" aria-hidden="true"><Icon name="order" :size="20"/></span>
              <div class="arco-metric-copy">
                <span>总订单数</span>
                <strong>{{stats?.totalOrders||0}} <small>单</small></strong>
              </div>
            </div>
            <div class="arco-hero-metric">
              <span class="arco-metric-medallion is-amber" aria-hidden="true"><Icon name="store" :size="20"/></span>
              <div class="arco-metric-copy">
                <span>入驻商户</span>
                <strong>{{displayMerchantCount}} <small>家</small></strong>
              </div>
            </div>
            <div class="arco-hero-metric">
              <span class="arco-metric-medallion is-purple" aria-hidden="true"><Icon name="package" :size="20"/></span>
              <div class="arco-metric-copy">
                <span>在售商品</span>
                <strong>{{displayProductCount}} <small>件</small></strong>
              </div>
            </div>
          </div>
        </section>

        <section v-if="telemetry" class="ops-card redis-telemetry-card">
          <div class="ops-card-header">
            <div class="telemetry-title-group"><h2>系统运行与访问安全</h2><code v-if="telemetry.namespace" class="redis-ns-badge">{{telemetry.namespace}}</code></div>
            <div class="telemetry-nodes">
              <span class="status-tag" :class="telemetry.securityConnected?'tone-ok':'tone-warn'"><i></i>交易与会话服务：{{telemetry.securityConnected?'正常':'降级'}}</span>
              <span class="status-tag" :class="telemetry.cacheConnected?'tone-ok':'tone-warn'"><i></i>商品缓存加速：{{telemetry.cacheConnected?'正常':'降级'}}</span>
            </div>
          </div>
          <div class="redis-plane-grid">
            <div class="redis-plane-card is-security">
              <div class="redis-plane-head"><div class="redis-plane-title"><span class="plane-beacon" :class="telemetry.securityConnected?'online':'degraded'" aria-hidden="true"></span><strong>交易与安全协调节点</strong><code class="plane-code-tag">SECURITY · SESSION</code></div><span class="status-tag" :class="telemetry.securityConnected?'tone-ok':'tone-warn'">{{telemetry.securityConnected?'运行正常':'已降级'}}</span></div>
              <p>负责登录会话、请求限流、防刷占单与取件码安全核验</p>
            </div>
            <div class="redis-plane-card is-cache">
              <div class="redis-plane-head"><div class="redis-plane-title"><span class="plane-beacon" :class="telemetry.cacheConnected?'online':'degraded'" aria-hidden="true"></span><strong>公开目录与热榜缓存节点</strong><code class="plane-code-tag">CATALOG · REALTIME</code></div><span class="status-tag" :class="telemetry.cacheConnected?'tone-ok':'tone-warn'">{{telemetry.cacheConnected?'运行正常':'回源运行'}}</span></div>
              <p>负责在售商品展示加速、实时热搜统计与热销商品排行</p>
            </div>
          </div>
          <div class="telemetry-metrics">
            <div class="metric-security"><small class="metric-domain">安全防护</small><span>异常访问拦截</span><strong>{{telemetry.crawlerBlockedCount||0}}</strong></div>
            <div class="metric-security"><small class="metric-domain">流量治理</small><span>高频请求限流</span><strong>{{telemetry.rateLimitedCount||0}}</strong></div>
            <div class="metric-security"><small class="metric-domain">交易风控</small><span>异常占单拦截</span><strong>{{telemetry.orderBrushBlockedCount||0}}</strong></div>
            <div class="metric-security"><small class="metric-domain">核销防爆破</small><span>输错码保护</span><strong>{{telemetry.pinLockoutCount||0}}</strong></div>
            <div class="metric-realtime is-queue"><small class="metric-domain">延时队列</small><span>待超时关单</span><strong :class="{'brand-text':(telemetry.delayedExpiryQueueSize||0)>0}">{{telemetry.delayedExpiryQueueSize||0}}</strong></div>
            <div class="metric-realtime is-live"><small class="metric-domain">SSE 实时通道</small><span>在线接单门店</span><strong>{{telemetry.activeRealtimeSubscribers||0}}</strong></div>
          </div>
          <div v-if="telemetry.topHotKeywords?.length||telemetry.topSellingProductIds?.length" class="telemetry-strips">
            <div v-if="telemetry.topHotKeywords?.length" class="telemetry-strip"><span>热门搜索</span><div class="telemetry-chips"><em v-for="kw in telemetry.topHotKeywords.slice(0,8)" :key="kw">{{kw}}</em></div></div>
            <div v-if="telemetry.topSellingProductIds?.length" class="telemetry-strip"><span>热销商品</span><div class="telemetry-chips"><em v-for="pid in telemetry.topSellingProductIds.slice(0,6)" :key="pid">{{resolveProductTitle(pid)}}</em></div></div>
          </div>
        </section>

        <OperationsCharts v-if="stats" mode="arco" :stats="stats" :money="money" :order-status-label="orderStatusLabel"/>
      </div>

      <aside class="arco-workplace-rail">
        <section class="ops-card arco-rail-card">
          <div class="ops-card-header">
            <h2>快捷操作</h2>
            <span>治理入口</span>
          </div>
          <div class="arco-shortcut-grid">
            <button type="button" class="arco-shortcut-tile" @click="go('/admin/applications')">
              <span class="arco-shortcut-ico"><Icon name="store" :size="18"/></span>
              <span>入驻审核</span>
            </button>
            <button type="button" class="arco-shortcut-tile" @click="go('/admin/products')">
              <span class="arco-shortcut-ico"><Icon name="package" :size="18"/></span>
              <span>商品巡检</span>
            </button>
            <button type="button" class="arco-shortcut-tile" @click="go('/admin/disputes')">
              <span class="arco-shortcut-ico"><Icon name="shield" :size="18"/></span>
              <span>争议裁决</span>
            </button>
            <button type="button" class="arco-shortcut-tile" @click="go('/admin/categories')">
              <span class="arco-shortcut-ico"><Icon name="grid" :size="18"/></span>
              <span>分类管理</span>
            </button>
            <button type="button" class="arco-shortcut-tile" @click="go('/admin/knowledge')">
              <span class="arco-shortcut-ico"><Icon name="book" :size="18"/></span>
              <span>知识库</span>
            </button>
            <button type="button" class="arco-shortcut-tile" @click="go('/admin/orders')">
              <span class="arco-shortcut-ico"><Icon name="clipboard" :size="18"/></span>
              <span>日志审计</span>
            </button>
          </div>
        </section>

        <section class="ops-card arco-rail-card">
          <div class="ops-card-header">
            <h2>今日待办</h2>
            <span>平台监管</span>
          </div>
          <div class="arco-todo-list">
            <button type="button" class="arco-todo-row" @click="go('/admin/applications')">
              <span class="arco-todo-dot is-brand" aria-hidden="true"></span>
              <span class="arco-todo-title">待审入驻申请</span>
              <em class="arco-todo-pill is-brand">{{pendingAppCount}} 家</em>
            </button>
            <button type="button" class="arco-todo-row" @click="go('/admin/disputes')">
              <span class="arco-todo-dot is-danger" aria-hidden="true"></span>
              <span class="arco-todo-title">待裁决售后争议</span>
              <em class="arco-todo-pill is-danger">{{disputedCount}} 单</em>
            </button>
            <button type="button" class="arco-todo-row" @click="go('/admin/merchants')">
              <span class="arco-todo-dot is-ok" aria-hidden="true"></span>
              <span class="arco-todo-title">在营监管商户</span>
              <em class="arco-todo-pill is-ok">{{displayMerchantCount}} 家</em>
            </button>
            <button type="button" class="arco-todo-row" @click="go('/admin/products')">
              <span class="arco-todo-dot is-warn" aria-hidden="true"></span>
              <span class="arco-todo-title">全站在售商品</span>
              <em class="arco-todo-pill is-warn">{{displayProductCount}} 件</em>
            </button>
          </div>
        </section>

        <section class="ops-card arco-rail-card">
          <div class="ops-card-header">
            <h2>最新订单</h2>
            <button type="button" @click="go('/admin/orders')">全部 <Icon name="chevronRight" :size="14"/></button>
          </div>
          <div class="ops-list-line compact-rail-line" v-for="o in orders.slice(0,4)" :key="o.orderId">
            <div>
              <strong>{{o.items?.[0]?.title||o.orderId}}</strong>
              <small>{{money(o.totalCent)}} · {{orderStatusLabel(o.status)}}</small>
            </div>
          </div>
          <div v-if="!orders.length" class="admin-empty">暂无订单</div>
        </section>
      </aside>
    </div>

    <!-- Workbench 2: Alibaba Ant Design Pro Analysis 1:1 Structural Replica -->
    <div v-else-if="adminTheme==='antd'" class="antd-analysis-stack">
      <div class="antd-chartcard-grid">
        <article class="antd-chart-card">
          <div class="antd-cc-top">
            <span>平台总成交额</span>
            <em class="antd-cc-badge">近 {{statsPeriod}} 天</em>
          </div>
          <strong class="antd-cc-value">{{stats?money(stats.completedAmountCent):'—'}}</strong>
          <div class="antd-cc-visual">
            <span class="antd-cc-trend">已支付 <b>{{stats?.paidOrders||0}}</b> 笔 · 退款 <b>{{stats?.refundedOrders||0}}</b> 笔</span>
          </div>
          <div class="antd-cc-footer">
            <span>交易实时复验正常</span>
            <b>{{stats?.totalOrders||0}} 笔总单</b>
          </div>
        </article>

        <article class="antd-chart-card">
          <div class="antd-cc-top">
            <span>全平台订单量</span>
            <em class="antd-cc-badge is-green">实时</em>
          </div>
          <strong class="antd-cc-value">{{stats?.totalOrders||0}}</strong>
          <div class="antd-cc-visual">
            <svg class="antd-spark-svg" viewBox="0 0 180 28" preserveAspectRatio="none" aria-hidden="true">
              <path :d="sparkPaths.area" fill="var(--color-brand)" fill-opacity="0.16"/>
              <path :d="sparkPaths.line" fill="none" stroke="var(--color-brand)" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="antd-cc-footer">
            <span>单日峰值订单</span>
            <b>{{peakDayOrders}} 单</b>
          </div>
        </article>

        <article class="antd-chart-card">
          <div class="antd-cc-top">
            <span>入驻商户规模</span>
            <em class="antd-cc-badge is-amber">校内经营</em>
          </div>
          <strong class="antd-cc-value">{{displayMerchantCount}}</strong>
          <div class="antd-cc-visual">
            <svg class="progress-bar-svg" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y="0" width="100" height="6" rx="3" class="progress-track-bg"/>
              <rect x="0" y="0" width="82" height="6" rx="3" class="progress-track-fill"/>
            </svg>
          </div>
          <div class="antd-cc-footer">
            <span>在售商品 {{displayProductCount}} 件</span>
            <button type="button" class="antd-cc-link" @click="go('/admin/merchants')">监管 →</button>
          </div>
        </article>

        <article class="antd-chart-card">
          <div class="antd-cc-top">
            <span>平台退款率</span>
            <div class="stats-period-pills compact">
              <button type="button" :class="{active:statsPeriod===7}" @click="statsPeriod=7">7天</button>
              <button type="button" :class="{active:statsPeriod===30}" @click="statsPeriod=30">30天</button>
            </div>
          </div>
          <strong class="antd-cc-value">{{stats?.refundRate==null?'—':(stats.refundRate*100).toFixed(1)+'%'}}</strong>
          <div class="antd-cc-visual">
            <span class="antd-cc-trend">安全风控累计拦截 <b>{{securityInterceptTotal}}</b> 次</span>
          </div>
          <div class="antd-cc-footer">
            <span>争议工单 {{disputedCount}} 单</span>
            <button type="button" class="antd-cc-link" @click="go('/admin/disputes')">裁决 →</button>
          </div>
        </article>
      </div>

      <OperationsCharts v-if="stats" mode="antd" :stats="stats" :money="money" :order-status-label="orderStatusLabel">
        <template #besideDonut>
          <section class="ops-card antd-qianniu-card">
            <div class="ops-card-header">
              <h2>平台治理待办与最新订单</h2>
              <button type="button" @click="go('/admin/orders')">全部订单 <Icon name="chevronRight" :size="15"/></button>
            </div>
            <div class="antd-todo-strip">
              <button type="button" @click="go('/admin/applications')"><span>入驻审核</span><strong>{{pendingAppCount}}</strong></button>
              <button type="button" @click="go('/admin/disputes')"><span>争议裁决</span><strong>{{disputedCount}}</strong></button>
              <button type="button" @click="go('/admin/products')"><span>商品巡检</span><strong>{{displayProductCount}}</strong></button>
              <button type="button" @click="go('/admin/categories')"><span>分类管理</span><Icon name="arrowRight" :size="14"/></button>
            </div>
            <div class="ops-list-line" v-for="o in orders.slice(0,4)" :key="o.orderId">
              <span class="mini-icon"><Icon name="order" :size="17"/></span>
              <div>
                <strong>{{o.items?.[0]?.title||o.orderId}}</strong>
                <small>#{{o.orderId.length>12?o.orderId.slice(0,8).toUpperCase():o.orderId}} · {{dateTime(o.createdAt)}}</small>
              </div>
              <b>{{money(o.totalCent)}}</b>
              <span class="status-tag" :class="o.status==='COMPLETED'?'tone-ok':o.status==='PAID'?'tone-info':o.status==='REFUNDED'?'tone-danger':'tone-warn'">{{orderStatusLabel(o.status)}}</span>
            </div>
            <div v-if="!orders.length" class="admin-empty">暂无订单</div>
          </section>
        </template>
      </OperationsCharts>

      <section v-if="telemetry" class="ops-card redis-telemetry-card">
        <div class="ops-card-header">
          <div class="telemetry-title-group"><h2>双平面 Redis 运行与访问安全</h2><code v-if="telemetry.namespace" class="redis-ns-badge">{{telemetry.namespace}}</code></div>
          <div class="telemetry-nodes">
            <span class="status-tag" :class="telemetry.securityConnected?'tone-ok':'tone-warn'"><i></i>交易与会话服务：{{telemetry.securityConnected?'正常':'降级'}}</span>
            <span class="status-tag" :class="telemetry.cacheConnected?'tone-ok':'tone-warn'"><i></i>商品缓存加速：{{telemetry.cacheConnected?'正常':'降级'}}</span>
          </div>
        </div>
        <div class="redis-plane-grid">
          <div class="redis-plane-card is-security">
            <div class="redis-plane-head"><div class="redis-plane-title"><span class="plane-beacon" :class="telemetry.securityConnected?'online':'degraded'" aria-hidden="true"></span><strong>交易与安全协调节点</strong><code class="plane-code-tag">SECURITY · SESSION</code></div><span class="status-tag" :class="telemetry.securityConnected?'tone-ok':'tone-warn'">{{telemetry.securityConnected?'运行正常':'已降级'}}</span></div>
            <p>负责登录会话、请求限流、防刷占单与取件码安全核验</p>
          </div>
          <div class="redis-plane-card is-cache">
            <div class="redis-plane-head"><div class="redis-plane-title"><span class="plane-beacon" :class="telemetry.cacheConnected?'online':'degraded'" aria-hidden="true"></span><strong>公开目录与热榜缓存节点</strong><code class="plane-code-tag">CATALOG · REALTIME</code></div><span class="status-tag" :class="telemetry.cacheConnected?'tone-ok':'tone-warn'">{{telemetry.cacheConnected?'运行正常':'回源运行'}}</span></div>
            <p>负责在售商品展示加速、实时热搜统计与热销商品排行</p>
          </div>
        </div>
        <div class="telemetry-metrics">
          <div class="metric-security"><small class="metric-domain">安全防护</small><span>异常访问拦截</span><strong>{{telemetry.crawlerBlockedCount||0}}</strong></div>
          <div class="metric-security"><small class="metric-domain">流量治理</small><span>高频请求限流</span><strong>{{telemetry.rateLimitedCount||0}}</strong></div>
          <div class="metric-security"><small class="metric-domain">交易风控</small><span>异常占单拦截</span><strong>{{telemetry.orderBrushBlockedCount||0}}</strong></div>
          <div class="metric-security"><small class="metric-domain">核销防爆破</small><span>输错码保护</span><strong>{{telemetry.pinLockoutCount||0}}</strong></div>
          <div class="metric-realtime is-queue"><small class="metric-domain">延时队列</small><span>待超时关单</span><strong :class="{'brand-text':(telemetry.delayedExpiryQueueSize||0)>0}">{{telemetry.delayedExpiryQueueSize||0}}</strong></div>
          <div class="metric-realtime is-live"><small class="metric-domain">SSE 实时通道</small><span>在线接单门店</span><strong>{{telemetry.activeRealtimeSubscribers||0}}</strong></div>
        </div>
        <div v-if="telemetry.topHotKeywords?.length||telemetry.topSellingProductIds?.length" class="telemetry-strips">
          <div v-if="telemetry.topHotKeywords?.length" class="telemetry-strip"><span>热门搜索</span><div class="telemetry-chips"><em v-for="kw in telemetry.topHotKeywords.slice(0,8)" :key="kw">{{kw}}</em></div></div>
          <div v-if="telemetry.topSellingProductIds?.length" class="telemetry-strip"><span>热销商品</span><div class="telemetry-chips"><em v-for="pid in telemetry.topSellingProductIds.slice(0,6)" :key="pid">{{resolveProductTitle(pid)}}</em></div></div>
        </div>
      </section>
    </div>

    <!-- Workbench 3: Meituan PC Operational Command Workbench 1:1 Structural Replica -->
    <div v-else class="meituan-workbench-stack">
      <section class="meituan-command-banner">
        <div class="meituan-cmd-left">
          <div class="meituan-cmd-head">
            <span class="meituan-cmd-badge">美团商家调度中心</span>
            <h2>门店极速接单与核销看板 · 全站治理</h2>
            <small v-if="stats?.periodStart&&stats?.periodEnd">{{String(stats.periodStart).slice(0,10)}} 至 {{String(stats.periodEnd).slice(0,10)}}</small>
          </div>
          <div class="meituan-cmd-counters">
            <button type="button" class="meituan-counter-pill is-gold" @click="go('/admin/applications')">
              <span>待审入驻</span>
              <strong>{{pendingAppCount}}</strong>
              <small>家</small>
            </button>
            <button type="button" class="meituan-counter-pill" @click="go('/admin/disputes')">
              <span>待裁争议</span>
              <strong>{{disputedCount}}</strong>
              <small>单</small>
            </button>
            <button type="button" class="meituan-counter-pill" @click="go('/admin/merchants')">
              <span>在线门店</span>
              <strong>{{telemetry?.activeRealtimeSubscribers||displayMerchantCount}}</strong>
              <small>家</small>
            </button>
            <button type="button" class="meituan-counter-pill" @click="go('/admin/orders')">
              <span>风控拦截</span>
              <strong>{{securityInterceptTotal}}</strong>
              <small>次</small>
            </button>
          </div>
        </div>
        <div class="meituan-cmd-right">
          <div class="meituan-period-switch">
            <button type="button" :class="{active:statsPeriod===7}" @click="statsPeriod=7">近 7 天</button>
            <button type="button" :class="{active:statsPeriod===30}" @click="statsPeriod=30">近 30 天</button>
          </div>
          <button type="button" class="meituan-gold-cta" @click="go(disputedCount > 0 ? '/admin/disputes' : '/admin/applications')">
            <Icon name="shield" :size="17"/>
            <span>处理待办工单</span>
          </button>
        </div>
      </section>

      <div class="ops-kpis meituan-kpi-strip" v-if="stats">
        <div><span>成交总额</span><strong>{{money(stats.completedAmountCent)}}</strong></div>
        <div><span>订单总数</span><strong>{{stats.totalOrders||0}}</strong></div>
        <div><span>已支付笔数</span><strong>{{stats.paidOrders||0}}</strong></div>
        <div><span>退款笔数</span><strong>{{stats.refundedOrders||0}}</strong></div>
        <div><span>退款率</span><strong>{{stats.refundRate==null?'—':(stats.refundRate*100).toFixed(1)+'%'}}</strong></div>
      </div>

      <OperationsCharts v-if="stats" mode="meituan" :stats="stats" :money="money" :order-status-label="orderStatusLabel"/>

      <section v-if="telemetry" class="ops-card redis-telemetry-card">
        <div class="ops-card-header">
          <div class="telemetry-title-group"><h2>系统运行与访问安全</h2><code v-if="telemetry.namespace" class="redis-ns-badge">{{telemetry.namespace}}</code></div>
          <div class="telemetry-nodes">
            <span class="status-tag" :class="telemetry.securityConnected?'tone-ok':'tone-warn'"><i></i>交易与会话服务：{{telemetry.securityConnected?'正常':'降级'}}</span>
            <span class="status-tag" :class="telemetry.cacheConnected?'tone-ok':'tone-warn'"><i></i>商品缓存加速：{{telemetry.cacheConnected?'正常':'降级'}}</span>
          </div>
        </div>
        <div class="redis-plane-grid">
          <div class="redis-plane-card is-security">
            <div class="redis-plane-head"><div class="redis-plane-title"><span class="plane-beacon" :class="telemetry.securityConnected?'online':'degraded'" aria-hidden="true"></span><strong>交易与安全协调节点</strong><code class="plane-code-tag">SECURITY · SESSION</code></div><span class="status-tag" :class="telemetry.securityConnected?'tone-ok':'tone-warn'">{{telemetry.securityConnected?'运行正常':'已降级'}}</span></div>
            <p>负责登录会话、请求限流、防刷占单与取件码安全核验</p>
          </div>
          <div class="redis-plane-card is-cache">
            <div class="redis-plane-head"><div class="redis-plane-title"><span class="plane-beacon" :class="telemetry.cacheConnected?'online':'degraded'" aria-hidden="true"></span><strong>公开目录与热榜缓存节点</strong><code class="plane-code-tag">CATALOG · REALTIME</code></div><span class="status-tag" :class="telemetry.cacheConnected?'tone-ok':'tone-warn'">{{telemetry.cacheConnected?'运行正常':'回源运行'}}</span></div>
            <p>负责在售商品展示加速、实时热搜统计与热销商品排行</p>
          </div>
        </div>
        <div class="telemetry-metrics">
          <div class="metric-security"><small class="metric-domain">安全防护</small><span>异常访问拦截</span><strong>{{telemetry.crawlerBlockedCount||0}}</strong></div>
          <div class="metric-security"><small class="metric-domain">流量治理</small><span>高频请求限流</span><strong>{{telemetry.rateLimitedCount||0}}</strong></div>
          <div class="metric-security"><small class="metric-domain">交易风控</small><span>异常占单拦截</span><strong>{{telemetry.orderBrushBlockedCount||0}}</strong></div>
          <div class="metric-security"><small class="metric-domain">核销防爆破</small><span>输错码保护</span><strong>{{telemetry.pinLockoutCount||0}}</strong></div>
          <div class="metric-realtime is-queue"><small class="metric-domain">延时队列</small><span>待超时关单</span><strong :class="{'brand-text':(telemetry.delayedExpiryQueueSize||0)>0}">{{telemetry.delayedExpiryQueueSize||0}}</strong></div>
          <div class="metric-realtime is-live"><small class="metric-domain">SSE 实时通道</small><span>在线接单门店</span><strong>{{telemetry.activeRealtimeSubscribers||0}}</strong></div>
        </div>
        <div v-if="telemetry.topHotKeywords?.length||telemetry.topSellingProductIds?.length" class="telemetry-strips">
          <div v-if="telemetry.topHotKeywords?.length" class="telemetry-strip"><span>热门搜索</span><div class="telemetry-chips"><em v-for="kw in telemetry.topHotKeywords.slice(0,8)" :key="kw">{{kw}}</em></div></div>
          <div v-if="telemetry.topSellingProductIds?.length" class="telemetry-strip"><span>热销商品</span><div class="telemetry-chips"><em v-for="pid in telemetry.topSellingProductIds.slice(0,6)" :key="pid">{{resolveProductTitle(pid)}}</em></div></div>
        </div>
      </section>

      <div class="ops-grid">
        <section class="ops-card">
          <div class="ops-card-header"><h2>最新订单</h2><button type="button" @click="go('/admin/orders')">全部 <Icon name="chevronRight" :size="16"/></button></div>
          <div class="ops-list-line" v-for="o in orders.slice(0,6)" :key="o.orderId">
            <span class="mini-icon"><Icon name="order"/></span>
            <div><strong>{{o.items?.[0]?.title||o.orderId}}</strong><small>#{{o.orderId.length>12?o.orderId.slice(0,8).toUpperCase():o.orderId}} · {{dateTime(o.createdAt)}}</small></div>
            <b>{{money(o.totalCent)}}</b>
            <span class="status-tag" :class="o.status==='COMPLETED'?'tone-ok':o.status==='PAID'?'tone-info':o.status==='REFUNDED'?'tone-danger':'tone-warn'">{{orderStatusLabel(o.status)}}</span>
          </div>
          <div v-if="!orders.length" class="admin-empty">暂无订单</div>
        </section>
        <section class="ops-card">
          <div class="ops-card-header"><h2>快捷管理</h2></div>
          <div class="ops-quick">
            <button type="button" @click="go('/admin/applications')"><Icon name="store"/>商户审核</button>
            <button type="button" @click="go('/admin/merchants')"><Icon name="users"/>商户监管</button>
            <button type="button" @click="go('/admin/disputes')"><Icon name="shield"/>争议处理</button>
            <button type="button" @click="go('/admin/knowledge')"><Icon name="book"/>知识库</button>
          </div>
        </section>
      </div>
    </div>
  </template>
 <template v-else-if="route==='/admin/applications'"><div class="ops-grid admin-review-grid"><section class="ops-card"><div class="ops-card-header"><h2>入驻申请</h2><span>{{preview?applications.length:pageInfo.total}} 条</span></div><div class="ops-toolbar"><label class="ops-search"><Icon name="search" :size="16"/><input v-model="search" placeholder="搜索商户或申请人"/></label><select class="admin-input compact-select" v-model="state"><option value="">全部状态</option><option value="SUBMITTED">待审核</option><option value="APPROVED">已通过</option><option value="REJECTED">已拒绝</option></select></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商户</th><th>申请人</th><th>门店</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="a in filtered" :key="a.applicationId" :class="{active:pickedApplication?.applicationId===a.applicationId}" @click="selectApplication(a)"><td><button class="row-link" @click.stop="selectApplication(a)" :aria-pressed="pickedApplication?.applicationId===a.applicationId">{{a.merchantName}}</button><small>{{a.category}}</small></td><td>{{a.contactName}}</td><td>{{a.storeName}}</td><td><span class="status-tag" :class="a.status==='APPROVED'?'published':a.status==='REJECTED'?'tone-danger':'draft'">{{applicationStatusLabel(a.status)}}</span></td><td><Icon name="chevronRight" :size="16"/></td></tr></tbody></table></div><div v-if="!filtered.length" class="admin-empty">暂无符合条件的申请</div></section><PlatformApplicationReview v-if="pickedApplication" :application="pickedApplication" v-model:reason="reason" :disabled="loading||!!error||preview||busy" @review="review"/></div></template>
 <template v-else-if="route==='/admin/merchants'"><section class="ops-card"><div class="ops-card-header"><h2>商户列表</h2><span>{{preview?merchants.length:pageInfo.total}} 家</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="搜索经营名称"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商户</th><th>品类</th><th>门店名称</th><th>自提位置</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="m in filtered" :key="m.merchantId"><td><strong>{{m.name}}</strong></td><td>{{m.category}}</td><td>{{m.storeName}}</td><td>{{m.location}}</td><td><span class="status-tag" :class="m.status==='ACTIVE'?'published':'tone-danger'">{{merchantStatusLabel(m.status)}}</span></td><td><button class="row-link" :disabled="loading||!!error||preview||busy" @click="stateMerchant(m)">{{m.status==='ACTIVE'?'停用':'恢复'}}</button></td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/products'"><section class="ops-card"><div class="ops-card-header"><h2>商品监管</h2><span>{{preview?products.length:pageInfo.total}} 件</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="搜索商品 / 商户"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商品</th><th>商户</th><th>分类</th><th>售价</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="p in filtered" :key="p.productId"><td><div class="table-product-cell"><ProductImage :src="p.imageUrl" :alt="p.title"/><div><strong>{{p.title}}</strong><span v-if="p.skus?.length">{{p.skus.length}} 个规格</span></div></div></td><td>{{merchantName(p.merchantId,p)}}</td><td>{{categoryName(p.categoryCode)}}</td><td>{{priceSku(p) ? money(priceSku(p).priceCent)+' 起' : '暂无有效规格'}}</td><td><span class="status-tag" :class="p.status==='PUBLISHED'?'published':'draft'">{{productStatusLabel(p.status)}}</span></td><td><button class="row-link" :disabled="loading||!!error||preview||busy||p.status!=='PUBLISHED'" @click="forceProduct(p)">强制下架</button></td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/orders'"><section class="ops-card"><div class="ops-card-header"><h2>订单监管</h2><span>{{preview?orders.length:pageInfo.total}} 笔</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="订单号"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>订单</th><th>商户</th><th>实付金额</th><th>状态</th><th>创建时间</th></tr></thead><tbody><tr v-for="o in filtered" :key="o.orderId"><td><strong class="mono-id-trunc" :title="o.orderId">{{o.orderId}}</strong><small>{{o.items?.[0]?.title||'—'}}</small></td><td>{{merchantName(o.merchantId,o)}}</td><td>{{money(o.totalCent)}}</td><td><span class="status-tag" :class="o.status==='COMPLETED'?'tone-ok':o.status==='PAID'?'tone-info':o.status==='REFUNDED'?'tone-danger':'tone-warn'">{{orderStatusLabel(o.status)}}</span></td><td>{{dateTime(o.createdAt)}}</td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/disputes'"><div class="ops-kpis dispute-kpis"><div><span>售后工单</span><strong>{{aftersales.length}}</strong></div><div><span>待平台介入</span><strong class="red-text">{{aftersales.filter(a=>a.status==='DISPUTED').length}}</strong></div></div><section class="ops-card"><div class="ops-card-header"><div><h2>争议工单</h2></div><div class="ops-header-controls"><select class="admin-input compact-select" v-model="state" @change="page=1;load()"><option value="">全部状态</option><option value="REQUESTED">待商户审核</option><option value="DISPUTED">待平台裁决</option><option value="REFUNDED">已退款</option><option value="REJECTED">已驳回</option></select><span>{{aftersales.length}} 条</span></div></div><div class="ops-list-line dispute-line" v-for="a in aftersales" :key="a.id"><span class="mini-icon"><Icon name="shield"/></span><div><strong>{{a.orderId.length>12?'订单 #'+a.orderId.slice(0,8).toUpperCase():a.orderId}} · {{merchantName(a.merchantId)}}</strong><small>{{a.reason}} · {{dateTime(a.createdAt)}}</small></div><span class="status-tag" :class="a.status==='DISPUTED'?'tone-warn':a.status==='REFUNDED'||a.status==='APPROVED'?'tone-ok':a.status==='REJECTED'?'tone-danger':'tone-info'">{{afterSaleStatusLabel(a.status)}}</span><button class="outline-button small" @click="openDispute(a)">{{a.status==='DISPUTED'?'查看处理':'查看历程'}}</button></div><div v-if="!aftersales.length" class="admin-empty">当前没有待处理工单</div><div class="review-inline" v-if="selectedId&&aftersales.find(a=>a.id===selectedId)"><h3>{{aftersales.find(a=>a.id===selectedId).status==='DISPUTED'?'争议裁决':'处理历程'}} · {{aftersales.find(a=>a.id===selectedId).orderId}}</h3><div class="review-history"><strong>处理历程</strong><ol v-if="historyEvents.length"><li v-for="(e,i) in historyEvents" :key="e.eventId||i"><b>{{orderEventLabel(e.type)}}</b><small>{{dateTime(e.occurredAt)}}<template v-if="e.reason"> · {{e.reason}}</template></small></li></ol><p v-else-if="historyLoading" class="muted-short">正在加载处理历程…</p><p v-else class="muted-short">{{historyError||'历史记录不完整，仅显示当前状态'}}</p></div><template v-if="aftersales.find(a=>a.id===selectedId).status==='DISPUTED'"><label class="field-label" for="platform-field-2">裁决说明</label><div class="quick-chip-row"><button type="button" class="quick-chip" @click="reason='核实属实，批准全额退款'">全额退回</button><button type="button" class="quick-chip" @click="reason='商品已按约备好，驳回退款申请'">维持商户决定</button></div><textarea id="platform-field-2" class="admin-input" v-model="reason" rows="3" maxlength="500" placeholder="填写或点选裁决意见"></textarea><div class="form-buttons"><button class="outline-button" :disabled="loading||!!error||preview||busy||!reason.trim()" @click="decideRefund(aftersales.find(a=>a.id===selectedId),false)">驳回</button><button class="teal-button" :disabled="loading||!!error||preview||busy||!reason.trim()" @click="decideRefund(aftersales.find(a=>a.id===selectedId),true)">批准退款</button></div></template></div></section></template>
 <template v-else-if="route==='/admin/categories'"><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>类目</h2><span>{{categories.length}} 个</span></div><div class="ops-list-line" v-for="c in categories" :key="c.code"><span class="mini-icon"><Icon name="grid"/></span><div><strong>{{c.name}}</strong><small>{{c.code}}</small></div><span class="status-tag" :class="c.active?'published':'draft'">{{c.active?'启用':'停用'}}</span><button class="row-link" @click="toggleCategory(c)" :disabled="loading||!!error||preview||busy">{{c.active?'停用':'恢复'}}</button></div></section><form class="ops-card ops-sideform" @submit.prevent="saveCategory"><h2>编辑分类</h2><label class="field-label" for="platform-field-3">编码</label><input id="platform-field-3" class="admin-input" v-model.trim="category.code" required maxlength="32"/><label class="field-label" for="platform-field-4">名称</label><input id="platform-field-4" class="admin-input" v-model.trim="category.name" required maxlength="50"/><label class="field-label" for="platform-field-5">状态</label><select id="platform-field-5" class="admin-input" v-model="category.active"><option :value="true">启用</option><option :value="false">停用</option></select><button type="submit" class="teal-button" :disabled="loading||!!error||preview||busy">{{preview?'设计预览':'保存分类'}}</button></form></div></template>
 <UiPagination v-if="!preview&&route!=='/admin'&&route!=='/admin/categories'&&pageInfo.total>0" :page="page" :has-next="pageInfo.hasNext" :busy="loading" @previous="page--" @next="page++">共 {{pageInfo.total}} 条</UiPagination></BackofficeShell>`,
};
