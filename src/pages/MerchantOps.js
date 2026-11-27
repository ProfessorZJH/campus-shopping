import MerchantOrderTable from '../components/MerchantOrderTable.vue';
import MerchantInventoryTable from '../components/MerchantInventoryTable.vue';
import OperationsCharts from '../components/OperationsCharts.vue';
import StatusPanel from '../components/StatusPanel.vue';
import UiPagination from '../components/UiPagination.vue';
import { requestScope } from '../services/request-scope.js';
import BackofficeShell from '../components/BackofficeShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, query, idempotency } from '../services/api.js';
import { designTheme } from '../services/design-theme.js';
import {
  store,
  go,
  money,
  preview,
  notify,
  loadMerchant,
  hasPermission,
  isOwner,
} from '../services/store.js';
import {
  DEMO_STATS,
  DEMO_MERCHANT_ORDERS,
  DEMO_MEMBERS,
  DEMO_STOCK_MOVES,
  DEMO_AFTERSALES,
} from '../services/pages-demo.js';
import {
  inventoryQuantityLabel,
  afterSaleStatusLabel,
  inventoryOperationLabel,
  membershipStatusLabel,
  orderStatusLabel,
  orderEventLabel,
  pickupStatusLabel,
  paymentChannelLabel,
  pickupSlotLabel,
  dateTime,
  pathId,
  coverSku,
  positiveInt,
} from '../services/page-utils.js';
const { ref, computed, nextTick, onMounted, onUnmounted, watch } = Vue;
const names = {
  '/merchant': '经营概览',
  '/merchant/inventory': '库存管理',
  '/merchant/orders': '订单管理',
  '/merchant/pickup': '自提核销',
  '/merchant/aftersales': '售后处理',
  '/merchant/team': '店员管理',
  '/merchant/settings': '门店设置',
};
export default {
  name: 'MerchantOps',
  components: {
    BackofficeShell,
    ProductImage,
    UiPagination,
    MerchantOrderTable,
    MerchantInventoryTable,
    OperationsCharts,
    StatusPanel,
  },
  setup() {
    const scope = requestScope();
    const adminTheme = computed(() => designTheme.admin || 'antd');
    const route = computed(() => store.route.split('?')[0] || '/merchant');
    const title = computed(() => names[route.value] || '经营概览');
    const filter = ref('');
    const pickupState = ref(route.value === '/merchant/pickup' ? 'READY' : '');
    const q = ref('');
    const statsPeriod = ref(7);
    const stats = ref(null),
      orders = ref([]),
      afterSales = ref([]),
      members = ref([]),
      moves = ref([]),
      stockRows = ref([]),
      error = ref(''),
      loading = ref(false),
      busy = ref(false),
      picked = ref(null),
      token = ref(''),
      quickToken = ref(''),
      decision = ref(''),
      reason = ref(''),
      historyEvents = ref([]),
      historyLoading = ref(false),
      historyError = ref('');
    const availableBelow = ref(null);
    const movementQ = ref('');
    const movementPage = ref(1);
    const movementPageInfo = ref({ total: 0, hasNext: false });
    let historyVersion = 0;
    const page = ref(1),
      pageInfo = ref({ total: 0, hasNext: false }),
      amount = ref(1),
      sku = ref(''),
      inviteUser = ref(''),
      profile = ref({
        name: '',
        storeName: '',
        location: '',
        description: '',
        businessHours: '',
        imageUrl: '',
      });
    const replenishKey = ref(''),
      replenishFingerprint = ref('');
    const merchant = computed(
      () => store.merchants.find((m) => m.merchantId === store.merchantId) || {},
    );
    const skuRows = computed(() =>
      !preview && route.value === '/merchant/inventory'
        ? stockRows.value.map((s) => ({
            product: { title: s.productTitle || s.skuId, imageUrl: s.imageUrl || '' },
            sku: { skuId: s.skuId, specKey: s.specKey || '规格' },
            stock: s,
          }))
        : store.products.flatMap((p) =>
            (p.skus || []).map((s) => ({
              product: p,
              sku: s,
              stock: store.stocks.find((x) => x.skuId === s.skuId),
            })),
          ),
    );
    const visibleOrders = computed(() =>
      !preview
        ? orders.value
        : orders.value.filter(
            (o) =>
              (!filter.value || o.status === filter.value) &&
              (!pickupState.value || o.pickup?.status === pickupState.value) &&
              (!q.value ||
                o.orderId?.toLowerCase().includes(q.value.toLowerCase()) ||
                o.items?.some((i) => i.title?.includes(q.value))),
          ),
    );
    const selectedOrder = computed(
      () => orders.value.find((o) => o.orderId === picked.value) || visibleOrders.value[0] || null,
    );
    const canOwner = computed(() => isOwner());
    const can = computed(() => (code) => hasPermission(code));
    const roles = ref([]);
    const routePermission = {
      '/merchant': 'order.read',
      '/merchant/inventory': 'stock.read',
      '/merchant/orders': 'order.read',
      '/merchant/pickup': 'pickup.verify',
      '/merchant/aftersales': 'aftersale.read',
      '/merchant/team': 'team.manage',
      '/merchant/settings': 'store.manage',
    };
    const restricted = computed(
      () => !preview && !hasPermission(routePermission[route.value] || 'order.read'),
    );
    const canAct = computed(
      () =>
        !preview &&
        !busy.value &&
        !loading.value &&
        !error.value &&
        !!store.merchantId &&
        !restricted.value,
    );
    let loadVersion = 0;
    async function load() {
      const request = scope.begin();
      const read = (path) => api(path, { signal: request.signal });
      const stamp = ++loadVersion;
      const section = route.value;
      error.value = '';
      if (!store.merchantId) await loadMerchant();
      if (stamp !== loadVersion) return;
      const mid = store.merchantId;
      if (!mid) {
        loading.value = false;
        error.value = store.error || '尚未加入商户';
        return;
      }
      if (restricted.value) {
        loading.value = false;
        return;
      }
      if (preview) {
        loading.value = false;
        pageInfo.value = { total: DEMO_MERCHANT_ORDERS.length, hasNext: false };
        stats.value = { ...DEMO_STATS };
        orders.value = DEMO_MERCHANT_ORDERS.map((o) => ({ ...o }));
        members.value = DEMO_MEMBERS;
        afterSales.value = DEMO_AFTERSALES;
        moves.value = DEMO_STOCK_MOVES;
        profile.value = {
          name: merchant.value.name || '东湖便利',
          storeName: merchant.value.storeName || '学一食堂店',
          location: merchant.value.location || '东湖校区',
        };
        return;
      }
      const base = '/merchants/' + pathId(mid);
      const actor = store.user?.userId;
      const current = () =>
        stamp === loadVersion &&
        route.value === section &&
        store.merchantId === mid &&
        store.user?.userId === actor;
      loading.value = true;
      try {
        if (section === '/merchant') {
          const [s, o] = await Promise.all([
            hasPermission('dashboard.read')
              ? read(base + '/statistics/operations' + query({ periodDays: statsPeriod.value }))
              : Promise.resolve(null),
            read(base + '/orders/page' + query({ page: 1, size: 5 })),
          ]);
          if (!current()) return;
          stats.value = s;
          orders.value = o.items || [];
          pageInfo.value = o;
        }
        if (section === '/merchant/orders' || section === '/merchant/pickup') {
          const result = await read(
            base +
              '/orders/page' +
              query({
                page: page.value,
                size: 10,
                state: filter.value,
                pickupState: pickupState.value,
                q: q.value,
              }),
          );
          if (!current()) return;
          if (result.items?.length === 0 && page.value > 1 && result.total > 0) {
            page.value = Math.max(1, Math.ceil(result.total / 10));
            return;
          }
          orders.value = result.items || [];
          pageInfo.value = result;
        }
        if (section === '/merchant/aftersales') {
          const result = await read(
            base + '/aftersales/page' + query({ page: page.value, size: 10 }),
          );
          if (!current()) return;
          afterSales.value = result.items || [];
          pageInfo.value = result;
        }
        if (section === '/merchant/inventory') {
          const [stockResult, movements] = await Promise.all([
            read(
              base +
                '/stocks/page' +
                query({
                  page: page.value,
                  size: 10,
                  q: q.value,
                  availableBelow: availableBelow.value,
                }),
            ),
            read(
              base +
                '/stock-movements/page' +
                query({ page: movementPage.value, size: 8, q: movementQ.value }),
            ),
          ]);
          if (!current()) return;
          stockRows.value = stockResult.items || [];
          if (sku.value && !stockRows.value.some((s) => s.skuId === sku.value)) {
            sku.value = '';
          }
          moves.value = movements.items || [];
          movementPageInfo.value = movements;
          pageInfo.value = stockResult;
        }
        if (section === '/merchant/team') {
          const [m, r] = await Promise.all([read(base + '/members'), read(base + '/rbac/roles')]);
          if (!current()) return;
          members.value = m || [];
          roles.value = r || [];
        }
        if (section === '/merchant/settings' && current())
          profile.value = {
            name: merchant.value.name || '',
            storeName: merchant.value.storeName || '',
            location: merchant.value.location || '',
            description: merchant.value.description || '',
            businessHours: merchant.value.businessHours || '',
            imageUrl: merchant.value.imageUrl || '',
          };
      } catch (e) {
        if (current()) error.value = e.message;
      } finally {
        if (current()) loading.value = false;
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
      [page, q, filter, pickupState, availableBelow, movementQ, statsPeriod],
      (next, previous) => {
        if (resettingPage) return;
        clearTimeout(searchDelay);
        ++loadVersion;
        loading.value = true;
        const changed = next.slice(1).some((v, i) => v !== previous[i + 1]);
        if (changed) {
          resettingPage = true;
          page.value = 1;
          if (next[4] !== previous[4] || next[5] !== previous[5]) movementPage.value = 1;
          resettingPage = false;
        }
        searchDelay = setTimeout(load, next[1] !== previous[1] ? 280 : 0);
      },
      { flush: 'sync' },
    );
    watch(movementPage, () => {
      if (route.value === '/merchant/inventory') load();
    });
    async function perform(url, body, method = 'POST', key) {
      if (!canAct.value) return;
      const current = scope.capture();
      busy.value = true;
      try {
        await api(url, { method, body, key });
        if (!current()) return false;
        notify('操作成功');
        token.value = '';
        await load();
        return current();
      } catch (e) {
        if (current()) notify(e.message);
        return false;
      } finally {
        if (current()) busy.value = false;
      }
    }
    function midPath() {
      return '/merchants/' + pathId(store.merchantId);
    }
    function orderReminder(o) {
      const now = Date.now();
      const deadline = o?.deadline ? Date.parse(o.deadline) : NaN;
      if (o?.status === 'PENDING_PAYMENT' && Number.isFinite(deadline)) {
        if (deadline <= now) return '付款已超时';
        if (deadline - now <= 15 * 60 * 1000) return '付款即将超时';
      }
      const pickupExpires = o?.pickup?.expiresAt ? Date.parse(o.pickup.expiresAt) : NaN;
      if (o?.pickup?.status === 'READY' && Number.isFinite(pickupExpires) && pickupExpires <= now)
        return '自提凭证已过期';
      return '';
    }
    async function prepare(o, ready) {
      await perform(midPath() + '/orders/' + pathId(o.orderId) + (ready ? '/ready' : '/prepare'));
    }
    async function verify(o) {
      if (!token.value.trim()) {
        notify('请输入买家出示的自提码');
        return;
      }
      await perform(midPath() + '/orders/' + pathId(o.orderId) + '/verify', {
        token: token.value.trim(),
      });
    }
    async function quickVerify() {
      const code = quickToken.value.trim();
      if (!code) {
        notify('请输入 6 位取件码或扫码凭证');
        return;
      }
      if (!canAct.value) return;
      const current = scope.capture();
      busy.value = true;
      try {
        const res = await api(midPath() + '/pickups/quick-verify', {
          method: 'POST',
          body: { token: code },
        });
        if (!current()) return;
        quickToken.value = '';
        const qCode = res?.pickup?.pickupCode ? `（取餐号 ${res.pickup.pickupCode}）` : '';
        notify('极速核销成功' + qCode);
        await load();
      } catch (e) {
        if (current()) notify(e.message);
      } finally {
        if (current()) busy.value = false;
      }
    }
    function pickSkuForReplenish(id) {
      sku.value = id;
      nextTick(() => document.getElementById('merchantops-field-2')?.focus());
    }
    async function replenish() {
      if (!hasPermission('stock.replenish')) return;
      if (!positiveInt(amount.value, 1000000)) {
        notify('补货数量须为1~1000000');
        return;
      }
      if (!sku.value) return;
      const f = store.merchantId + ':' + sku.value + ':' + Number(amount.value);
      if (replenishFingerprint.value !== f) {
        replenishFingerprint.value = f;
        replenishKey.value = idempotency();
      }
      if (
        await perform(
          midPath() + '/stocks/' + pathId(sku.value) + '/replenish',
          { quantity: Number(amount.value) },
          'POST',
          replenishKey.value,
        )
      ) {
        replenishKey.value = '';
        replenishFingerprint.value = '';
      }
    }
    async function invite() {
      if (!canOwner.value || !inviteUser.value.trim()) return;
      if (await perform(midPath() + '/invitations', { username: inviteUser.value.trim() }))
        inviteUser.value = '';
    }
    async function revoke(m) {
      if (!canOwner.value || m.role === 'OWNER' || m.status !== 'ACTIVE') return;
      if (!window.confirm('确定撤销该成员的商户权限？')) return;
      await perform(midPath() + '/members/' + pathId(m.userId), undefined, 'DELETE');
    }
    async function assignMember(m, event) {
      const code = event.target.value;
      event.target.value = m.role;
      if (!canOwner.value || !code || code === m.role || m.role === 'OWNER') return;
      await perform(
        midPath() + '/rbac/members/' + pathId(m.userId) + '/role',
        { roleCode: code },
        'PUT',
      );
    }
    async function saveProfile() {
      if (!canOwner.value || !canAct.value) return;
      const current = scope.capture();
      const v = profile.value;
      if (!v.name.trim() || !v.storeName.trim() || !v.location.trim()) {
        notify('请完善门店资料');
        return;
      }
      busy.value = true;
      try {
        const saved = await api(midPath() + '/profile', { method: 'PUT', body: { ...v } });
        if (!current()) return;
        const index = store.merchants.findIndex((m) => m.merchantId === saved.merchantId);
        if (index >= 0) store.merchants[index] = saved;
        if (store.workspace) store.workspace.merchants = store.merchants;
        profile.value = {
          name: saved.name,
          storeName: saved.storeName,
          location: saved.location,
          description: saved.description || '',
          businessHours: saved.businessHours || '',
          imageUrl: saved.imageUrl || '',
        };
        notify('门店资料已保存');
      } catch (e) {
        if (current()) notify(e.message);
      } finally {
        if (current()) busy.value = false;
      }
    }

    /** 门店图片走 STORE 用途上传；保存资料时服务端再次核验商户归属。 */
    async function uploadStoreImage(event) {
      if (!canOwner.value || !canAct.value || busy.value) return;
      const input = event.target;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (!['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 2_000_000) {
        notify('请选择 2MB 以内的 JPG 或 PNG 图片');
        return;
      }
      const current = scope.capture();
      busy.value = true;
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
          reader.onerror = () => reject(new Error('图片读取失败'));
          reader.readAsDataURL(file);
        });
        if (!current()) return;
        const uploaded = await api(midPath() + '/store/images', {
          method: 'POST',
          body: { filename: file.name, contentType: file.type, base64 },
        });
        if (!current()) return;
        const url = typeof uploaded?.url === 'string' ? uploaded.url.trim() : '';
        if (!url || (!url.startsWith('/') && !/^https?:\/\//i.test(url)))
          throw new Error('门店图片上传返回地址无效');
        profile.value.imageUrl = url;
        notify('门店图片已上传，保存设置后生效');
      } catch (e) {
        if (current()) notify(e.message);
      } finally {
        if (current()) busy.value = false;
      }
    }
    /** 售后历史按 aftersale.read 授权读取，并用请求代次丢弃切换案件后的迟到响应。 */
    async function openAfterSaleDecision(orderId) {
      const version = ++historyVersion;
      decision.value = orderId;
      reason.value = '';
      historyEvents.value = [];
      historyError.value = '';
      if (preview) return;
      historyLoading.value = true;
      try {
        const events = await api(midPath() + '/orders/' + pathId(orderId) + '/after-sale-history');
        if (version !== historyVersion || decision.value !== orderId) return;
        historyEvents.value = (events || []).filter(
          (e) =>
            e.type.startsWith('REFUND_') ||
            e.type.startsWith('MERCHANT_') ||
            e.type.startsWith('PLATFORM_'),
        );
      } catch (e) {
        if (version === historyVersion) historyError.value = e.message;
      } finally {
        if (version === historyVersion) historyLoading.value = false;
      }
    }
    async function decisionAction(s, approved) {
      if (!hasPermission('aftersale.review') || !s) return;
      if (afterSales.value.find((row) => row.id === s.id)?.status !== 'REQUESTED') {
        notify('该售后已不处于待审核状态，请刷新列表');
        return;
      }
      const comment = reason.value.trim();
      if (!comment) {
        notify('请填写退款审核说明');
        return;
      }
      if (
        await perform(midPath() + '/orders/' + pathId(s.orderId) + '/refund-decision', {
          approved,
          reason: comment,
        })
      )
        reason.value = '';
    }
    const topOrders = computed(() => orders.value.slice(0, 5));
    const merchantName = computed(() => merchant.value.name || '校内商户');
    const pendingPrepCount = computed(
      () => orders.value.filter((o) => o.status === 'PAID' && o.pickup?.status !== 'READY').length,
    );
    const pendingPickupCount = computed(
      () => orders.value.filter((o) => o.status === 'PAID' && o.pickup?.status === 'READY').length,
    );
    const pendingPaymentCount = computed(
      () => orders.value.filter((o) => o.status === 'PENDING_PAYMENT').length,
    );
    const pendingAfterSaleCount = computed(
      () =>
        afterSales.value.filter((s) => s.status === 'REQUESTED').length ||
        Number(stats.value?.refundedOrders || 0),
    );
    const avgOrderCent = computed(() => {
      const denom = Number(stats.value?.paidOrders || stats.value?.totalOrders || 0);
      return denom > 0 ? Math.round(Number(stats.value?.completedAmountCent || 0) / denom) : 0;
    });
    const peakDayOrders = computed(() =>
      Math.max(0, ...(stats.value?.trend || []).map((t) => Number(t.orderCount || 0))),
    );
    const readyRatePct = computed(() => {
      const totalActive = pendingPrepCount.value + pendingPickupCount.value;
      return totalActive > 0 ? Math.round((pendingPickupCount.value / totalActive) * 100) : 100;
    });
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
      go,
      preview,
      designTheme,
      adminTheme,
      route,
      title,
      filter,
      pickupState,
      q,
      page,
      pageInfo,
      statsPeriod,
      stats,
      orders,
      afterSales,
      members,
      moves,
      stockRows,
      availableBelow,
      movementQ,
      movementPage,
      movementPageInfo,
      error,
      busy,
      loading,
      picked,
      selectedOrder,
      visibleOrders,
      token,
      quickToken,
      decision,
      reason,
      historyEvents,
      historyLoading,
      historyError,
      orderEventLabel,
      openAfterSaleDecision,
      amount,
      sku,
      skuRows,
      inviteUser,
      profile,
      merchantName,
      merchant,
      topOrders,
      pendingPrepCount,
      pendingPickupCount,
      pendingPaymentCount,
      pendingAfterSaleCount,
      avgOrderCent,
      peakDayOrders,
      readyRatePct,
      sparkPaths,
      canOwner,
      can,
      roles,
      assignMember,
      restricted,
      canAct,
      money,
      inventoryQuantityLabel,
      afterSaleStatusLabel,
      inventoryOperationLabel,
      membershipStatusLabel,
      orderStatusLabel,
      pickupStatusLabel,
      paymentChannelLabel,
      pickupSlotLabel,
      orderReminder,
      dateTime,
      coverSku,
      load,
      prepare,
      verify,
      quickVerify,
      pickSkuForReplenish,
      replenish,
      invite,
      revoke,
      saveProfile,
      uploadStoreImage,
      decisionAction,
    };
  },
  template: `<BackofficeShell role="merchant" :title="title"><template #actions><button class="outline-button small" @click="load"><Icon name="refresh" :size="16"/>刷新</button></template><StatusPanel v-if="loading" state="loading" message="正在加载…"/><StatusPanel v-if="error" state="error" :message="error" action-label="重新加载" :busy="loading" @retry="load"/>
 <div v-if="restricted" class="ops-card access-denied"><Icon name="shield" :size="32"/><h2>无权限访问</h2></div>
 <template v-else-if="route==='/merchant'">
  <!-- Workbench 1: ByteDance Arco Design Pro Workplace 1:1 Structural Replica -->
  <div v-if="adminTheme==='arco'" class="arco-workplace-grid">
    <div class="arco-workplace-main">
      <section class="ops-card arco-welcome-card">
        <div class="arco-welcome-head">
          <div class="arco-welcome-greeting">
            <span class="arco-welcome-avatar" aria-hidden="true"><Icon name="store" :size="22"/></span>
            <div>
              <h2>欢迎回来，实时同步校园经营数据</h2>
              <p>{{merchantName}} · {{merchant.storeName||'校内自提营业点'}} · {{merchant.location||'校园生活区'}}</p>
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
              <span>成交金额</span>
              <strong>{{stats?money(stats.completedAmountCent):'—'}}</strong>
            </div>
          </div>
          <div class="arco-hero-metric">
            <span class="arco-metric-medallion is-cyan" aria-hidden="true"><Icon name="order" :size="20"/></span>
            <div class="arco-metric-copy">
              <span>总订单数</span>
              <strong>{{stats?.totalOrders??orders.length}} <small>单</small></strong>
            </div>
          </div>
          <div class="arco-hero-metric">
            <span class="arco-metric-medallion is-amber" aria-hidden="true"><Icon name="scan" :size="20"/></span>
            <div class="arco-metric-copy">
              <span>待核销自提</span>
              <strong>{{pendingPickupCount}} <small>单</small></strong>
            </div>
          </div>
          <div class="arco-hero-metric">
            <span class="arco-metric-medallion is-purple" aria-hidden="true"><Icon name="trendingUp" :size="20"/></span>
            <div class="arco-metric-copy">
              <span>客单均价</span>
              <strong>{{stats?money(avgOrderCent):'—'}}</strong>
            </div>
          </div>
        </div>
      </section>

      <OperationsCharts v-if="stats" mode="arco" :stats="stats" :money="money" :order-status-label="orderStatusLabel"/>

      <section class="ops-card">
        <div class="ops-card-header">
          <h2>最新履约订单</h2>
          <button type="button" @click="go('/merchant/orders')">查看全部 <Icon name="chevronRight" :size="15"/></button>
        </div>
        <div class="ops-list-line" v-for="o in topOrders" :key="o.orderId">
          <span class="mini-icon"><Icon name="order" :size="18"/></span>
          <div>
            <strong><span v-if="o.pickup?.pickupCode" class="pickup-queue-badge compact">{{o.pickup.pickupCode}}</span> {{o.items?.[0]?.title||'校园订单'}}</strong>
            <small>#{{o.orderId.length>12?o.orderId.slice(0,8).toUpperCase():o.orderId}} · {{dateTime(o.createdAt)}}</small>
          </div>
          <b>{{money(o.totalCent)}}</b>
          <span class="status-tag" :class="o.status==='COMPLETED'?'tone-ok':o.status==='PAID'?'tone-info':o.status==='REFUNDED'?'tone-danger':'tone-warn'">{{orderStatusLabel(o.status)}}</span>
        </div>
        <div v-if="!topOrders.length" class="admin-empty">暂无订单</div>
      </section>
    </div>

    <aside class="arco-workplace-rail">
      <section class="ops-card arco-rail-card">
        <div class="ops-card-header">
          <h2>快捷操作</h2>
          <span>高频入口</span>
        </div>
        <div class="arco-shortcut-grid">
          <button type="button" class="arco-shortcut-tile" :disabled="!preview&&!can('product.read')" @click="go('/merchant/products')">
            <span class="arco-shortcut-ico"><Icon name="package" :size="18"/></span>
            <span>发布商品</span>
          </button>
          <button type="button" class="arco-shortcut-tile" :disabled="!preview&&!can('pickup.verify')" @click="go('/merchant/pickup')">
            <span class="arco-shortcut-ico"><Icon name="scan" :size="18"/></span>
            <span>自提核销</span>
          </button>
          <button type="button" class="arco-shortcut-tile" :disabled="!preview&&!can('stock.read')" @click="go('/merchant/inventory')">
            <span class="arco-shortcut-ico"><Icon name="box" :size="18"/></span>
            <span>库存补货</span>
          </button>
          <button type="button" class="arco-shortcut-tile" :disabled="!preview&&!can('order.read')" @click="go('/merchant/orders')">
            <span class="arco-shortcut-ico"><Icon name="order" :size="18"/></span>
            <span>订单履约</span>
          </button>
          <button type="button" class="arco-shortcut-tile" :disabled="!preview&&!can('aftersale.read')" @click="go('/merchant/aftersales')">
            <span class="arco-shortcut-ico"><Icon name="clipboard" :size="18"/></span>
            <span>售后审核</span>
          </button>
          <button type="button" class="arco-shortcut-tile" :disabled="!preview&&!can('knowledge.read')" @click="go('/merchant/knowledge')">
            <span class="arco-shortcut-ico"><Icon name="book" :size="18"/></span>
            <span>知识库</span>
          </button>
        </div>
      </section>

      <section class="ops-card arco-rail-card">
        <div class="ops-card-header">
          <h2>今日待办</h2>
          <span>实时工单</span>
        </div>
        <div class="arco-todo-list">
          <button type="button" class="arco-todo-row" @click="go('/merchant/pickup')">
            <span class="arco-todo-dot is-brand" aria-hidden="true"></span>
            <span class="arco-todo-title">待自提核销</span>
            <em class="arco-todo-pill is-brand">{{pendingPickupCount}} 单</em>
          </button>
          <button type="button" class="arco-todo-row" @click="go('/merchant/orders')">
            <span class="arco-todo-dot is-warn" aria-hidden="true"></span>
            <span class="arco-todo-title">待备货出餐</span>
            <em class="arco-todo-pill is-warn">{{pendingPrepCount}} 单</em>
          </button>
          <button type="button" class="arco-todo-row" @click="go('/merchant/aftersales')">
            <span class="arco-todo-dot is-danger" aria-hidden="true"></span>
            <span class="arco-todo-title">售后与退款单</span>
            <em class="arco-todo-pill is-danger">{{pendingAfterSaleCount}} 单</em>
          </button>
          <button type="button" class="arco-todo-row" @click="go('/merchant/products')">
            <span class="arco-todo-dot is-ok" aria-hidden="true"></span>
            <span class="arco-todo-title">热销在售单品</span>
            <em class="arco-todo-pill is-ok">{{stats?.products?.length||0}} 款</em>
          </button>
        </div>
      </section>

      <section class="ops-card arco-rail-card">
        <div class="ops-card-header">
          <h2>经营公告</h2>
          <span>规范</span>
        </div>
        <ul class="arco-notice-list">
          <li><span class="arco-notice-tag is-blue">核销</span><span>凭买家 6 位动态自提码当面交接</span></li>
          <li><span class="arco-notice-tag is-green">库存</span><span>实时校验现货，售罄规格自动禁售</span></li>
          <li><span class="arco-notice-tag is-amber">导购</span><span>更新门店知识库后同步 AI 问答引用</span></li>
        </ul>
      </section>
    </aside>
  </div>

  <!-- Workbench 2: Alibaba Ant Design Pro / Qianniu Analysis 1:1 Structural Replica -->
  <div v-else-if="adminTheme==='antd'" class="antd-analysis-stack">
    <div class="antd-chartcard-grid">
      <article class="antd-chart-card">
        <div class="antd-cc-top">
          <span>总成交额</span>
          <em class="antd-cc-badge">近 {{statsPeriod}} 天</em>
        </div>
        <strong class="antd-cc-value">{{stats?money(stats.completedAmountCent):'—'}}</strong>
        <div class="antd-cc-visual">
          <span class="antd-cc-trend">已支付 <b>{{stats?.paidOrders||0}}</b> 笔 · 退款 <b>{{stats?.refundedOrders||0}}</b> 笔</span>
        </div>
        <div class="antd-cc-footer">
          <span>客单均价</span>
          <b>{{stats?money(avgOrderCent):'—'}}</b>
        </div>
      </article>

      <article class="antd-chart-card">
        <div class="antd-cc-top">
          <span>总订单笔数</span>
          <em class="antd-cc-badge is-green">实时</em>
        </div>
        <strong class="antd-cc-value">{{stats?.totalOrders??orders.length}}</strong>
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
          <span>千牛待履约工单</span>
          <em class="antd-cc-badge is-amber">自提现场</em>
        </div>
        <strong class="antd-cc-value">{{pendingPrepCount + pendingPickupCount}}</strong>
        <div class="antd-cc-visual">
          <svg class="progress-bar-svg" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
            <rect x="0" y="0" width="100" height="6" rx="3" class="progress-track-bg"/>
            <rect x="0" y="0" :width="readyRatePct" height="6" rx="3" class="progress-track-fill"/>
          </svg>
        </div>
        <div class="antd-cc-footer">
          <span>待核销 {{pendingPickupCount}} 单</span>
          <button type="button" class="antd-cc-link" @click="go('/merchant/pickup')">去核销 →</button>
        </div>
      </article>

      <article class="antd-chart-card">
        <div class="antd-cc-top">
          <span>售后退款率</span>
          <div class="stats-period-pills compact">
            <button type="button" :class="{active:statsPeriod===7}" @click="statsPeriod=7">7天</button>
            <button type="button" :class="{active:statsPeriod===30}" @click="statsPeriod=30">30天</button>
          </div>
        </div>
        <strong class="antd-cc-value">{{stats?.refundRate==null?'—':(stats.refundRate*100).toFixed(1)+'%'}}</strong>
        <div class="antd-cc-visual">
          <span class="antd-cc-trend">待审售后 <b>{{pendingAfterSaleCount}}</b> 单 · 热销在售 <b>{{stats?.products?.length||0}}</b> 款</span>
        </div>
        <div class="antd-cc-footer">
          <span>千牛售后保障正常</span>
          <button type="button" class="antd-cc-link" @click="go('/merchant/aftersales')">处理售后 →</button>
        </div>
      </article>
    </div>

    <OperationsCharts v-if="stats" mode="antd" :stats="stats" :money="money" :order-status-label="orderStatusLabel">
      <template #besideDonut>
        <section class="ops-card antd-qianniu-card">
          <div class="ops-card-header">
            <h2>千牛待办与最新订单</h2>
            <button type="button" @click="go('/merchant/orders')">全部订单 <Icon name="chevronRight" :size="15"/></button>
          </div>
          <div class="antd-todo-strip">
            <button type="button" @click="go('/merchant/orders')"><span>待备货</span><strong>{{pendingPrepCount}}</strong></button>
            <button type="button" @click="go('/merchant/pickup')"><span>待核销</span><strong>{{pendingPickupCount}}</strong></button>
            <button type="button" @click="go('/merchant/products')"><span>商品管理</span><strong>{{stats?.products?.length||0}}</strong></button>
            <button type="button" @click="go('/merchant/inventory')"><span>库存补货</span><strong>进入</strong></button>
          </div>
          <div class="ops-list-line" v-for="o in topOrders.slice(0,4)" :key="o.orderId">
            <span class="mini-icon"><Icon name="order" :size="17"/></span>
            <div>
              <strong><span v-if="o.pickup?.pickupCode" class="pickup-queue-badge compact">{{o.pickup.pickupCode}}</span> {{o.items?.[0]?.title||'校园订单'}}</strong>
              <small>#{{o.orderId.length>12?o.orderId.slice(0,8).toUpperCase():o.orderId}} · {{dateTime(o.createdAt)}}</small>
            </div>
            <b>{{money(o.totalCent)}}</b>
            <span class="status-tag" :class="o.status==='COMPLETED'?'tone-ok':o.status==='PAID'?'tone-info':o.status==='REFUNDED'?'tone-danger':'tone-warn'">{{orderStatusLabel(o.status)}}</span>
          </div>
          <div v-if="!topOrders.length" class="admin-empty">暂无订单</div>
        </section>
      </template>
    </OperationsCharts>

    <section v-else class="ops-card antd-qianniu-card">
      <div class="ops-card-header">
        <h2>千牛待办与最新订单</h2>
        <button type="button" @click="go('/merchant/orders')">全部订单 <Icon name="chevronRight" :size="15"/></button>
      </div>
      <div class="ops-list-line" v-for="o in topOrders" :key="o.orderId">
        <span class="mini-icon"><Icon name="order" :size="17"/></span>
        <div>
          <strong>{{o.items?.[0]?.title||'校园订单'}}</strong>
          <small>#{{o.orderId.length>12?o.orderId.slice(0,8).toUpperCase():o.orderId}} · {{dateTime(o.createdAt)}}</small>
        </div>
        <b>{{money(o.totalCent)}}</b>
        <span class="status-tag">{{orderStatusLabel(o.status)}}</span>
      </div>
      <div v-if="!topOrders.length" class="admin-empty">暂无订单</div>
    </section>
  </div>

  <!-- Workbench 3: Meituan Merchant PC Express Order Workbench 1:1 Structural Replica -->
  <div v-else class="meituan-workbench-stack">
    <section class="meituan-command-banner">
      <div class="meituan-cmd-left">
        <div class="meituan-cmd-head">
          <span class="meituan-cmd-badge">美团商家极速版</span>
          <h2>门店极速接单与核销看板</h2>
          <small>{{merchantName}} · {{merchant.storeName||'校内自提档口'}}</small>
        </div>
        <div class="meituan-cmd-counters">
          <button type="button" class="meituan-counter-pill is-gold" @click="go('/merchant/pickup')">
            <span>待核销</span>
            <strong>{{pendingPickupCount}}</strong>
            <small>单</small>
          </button>
          <button type="button" class="meituan-counter-pill" @click="go('/merchant/orders')">
            <span>待备货</span>
            <strong>{{pendingPrepCount}}</strong>
            <small>单</small>
          </button>
          <button type="button" class="meituan-counter-pill" @click="go('/merchant/orders')">
            <span>待付款</span>
            <strong>{{pendingPaymentCount}}</strong>
            <small>单</small>
          </button>
          <button type="button" class="meituan-counter-pill" @click="go('/merchant/aftersales')">
            <span>售后待处理</span>
            <strong>{{pendingAfterSaleCount}}</strong>
            <small>单</small>
          </button>
        </div>
      </div>
      <div class="meituan-cmd-right">
        <div class="meituan-period-switch">
          <button type="button" :class="{active:statsPeriod===7}" @click="statsPeriod=7">近 7 天</button>
          <button type="button" :class="{active:statsPeriod===30}" @click="statsPeriod=30">近 30 天</button>
        </div>
        <button type="button" class="meituan-gold-cta" @click="go('/merchant/pickup')">
          <Icon name="scan" :size="17"/>
          <span>前往自提核销</span>
        </button>
      </div>
    </section>

    <div class="ops-kpis meituan-kpi-strip" v-if="stats">
      <div><span>周期营业额</span><strong>{{money(stats.completedAmountCent)}}</strong></div>
      <div><span>有效订单数</span><strong>{{stats.totalOrders||0}}</strong></div>
      <div><span>已支付单量</span><strong>{{stats.paidOrders||0}}</strong></div>
      <div><span>已退款单量</span><strong>{{stats.refundedOrders||0}}</strong></div>
      <div><span>售后退款率</span><strong>{{stats.refundRate==null?'—':(stats.refundRate*100).toFixed(1)+'%'}}</strong></div>
    </div>

    <OperationsCharts v-if="stats" mode="meituan" :stats="stats" :money="money" :order-status-label="orderStatusLabel"/>

    <div class="ops-grid">
      <section class="ops-card">
        <div class="ops-card-header">
          <h2>实时接单队列</h2>
          <button type="button" @click="go('/merchant/orders')">查看全部 <Icon name="chevronRight" :size="15"/></button>
        </div>
        <div class="ops-list-line" v-for="o in topOrders" :key="o.orderId">
          <span class="mini-icon"><Icon name="order" :size="18"/></span>
          <div>
            <strong><span v-if="o.pickup?.pickupCode" class="pickup-queue-badge compact">{{o.pickup.pickupCode}}</span> {{o.items?.[0]?.title||'校园订单'}}</strong>
            <small>#{{o.orderId.length>12?o.orderId.slice(0,8).toUpperCase():o.orderId}} · {{dateTime(o.createdAt)}}</small>
          </div>
          <b>{{money(o.totalCent)}}</b>
          <span class="status-tag" :class="o.status==='COMPLETED'?'tone-ok':o.status==='PAID'?'tone-info':o.status==='REFUNDED'?'tone-danger':'tone-warn'">{{orderStatusLabel(o.status)}}</span>
        </div>
        <div v-if="!topOrders.length" class="admin-empty">暂无订单</div>
      </section>
      <section class="ops-card">
        <div class="ops-card-header"><h2>门店常用工具</h2></div>
        <div class="ops-quick">
          <button v-if="can('product.read')" type="button" @click="go('/merchant/products')"><Icon name="package"/>商品管理</button>
          <button v-if="can('stock.read')" type="button" @click="go('/merchant/inventory')"><Icon name="box"/>库存补货</button>
          <button v-if="can('pickup.verify')" type="button" @click="go('/merchant/pickup')"><Icon name="scan"/>自提核销</button>
          <button v-if="can('knowledge.read')" type="button" @click="go('/merchant/knowledge')"><Icon name="book"/>门店知识库</button>
        </div>
      </section>
    </div>
  </div>
 </template>
 <template v-else-if="route==='/merchant/inventory'"><div class="ops-grid inventory-grid"><section class="ops-card"><div class="ops-card-header"><h2>库存清单</h2><span>{{preview?skuRows.length:pageInfo.total}} 个规格</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="q" placeholder="搜索商品 / 规格"/></label><div class="filter-pills secondary-pills"><button :class="{active:availableBelow===null}" @click="availableBelow=null">全部库存</button><button :class="{active:availableBelow!==null}" @click="availableBelow=10">低可售 ≤ {{availableBelow===null?10:availableBelow}}</button><input v-if="availableBelow!==null" class="admin-input compact-select" type="number" min="0" max="1000000" v-model.number="availableBelow" aria-label="低可售阈值"/></div><MerchantInventoryTable :rows="skuRows" :selected-sku="sku" :query="q" :preview="preview" :can-replenish="can('stock.replenish')" @select="pickSkuForReplenish"/></section><section class="ops-card ops-sideform"><template v-if="can('stock.replenish')"><h2>库存补货</h2><form @submit.prevent="replenish"><label class="field-label" for="merchantops-field-1">选择规格</label><select id="merchantops-field-1" class="admin-input" v-model="sku" required><option disabled value="">选择规格</option><option v-for="row in skuRows" :key="row.sku.skuId" :value="row.sku.skuId">{{row.product.title}} · {{row.sku.specKey}}</option></select><label class="field-label" for="merchantops-field-2">补货数量</label><input id="merchantops-field-2" type="number" class="admin-input" v-model.number="amount" min="1" max="1000000" required/><button class="teal-button" type="submit" :disabled="!canAct">确认补货</button></form></template><div class="ops-card-header compact"><h3>库存流水</h3><span>{{movementPageInfo.total||0}} 条</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="movementQ" placeholder="搜索单据号 / 规格"/></label><div class="ops-list-line" v-for="m in moves" :key="m.id"><span class="mini-icon"><Icon name="box" :size="16"/></span><div><strong>{{inventoryOperationLabel(m.type)}}</strong><small>{{dateTime(m.createdAt)}} · 单据 {{m.bizKey}}</small></div><b>{{inventoryQuantityLabel(m)}}</b></div><div v-if="!moves.length" class="admin-empty">暂无匹配流水</div><UiPagination v-if="movementPageInfo.total>0" :page="movementPage" :has-next="movementPageInfo.hasNext" :busy="loading" @previous="movementPage--" @next="movementPage++"/></section></div></template>
 <template v-else-if="route==='/merchant/orders'||route==='/merchant/pickup'"><div class="ops-card"><div class="ops-card-header"><div><h2>{{route==='/merchant/pickup'?'待核销订单':'订单列表'}}</h2></div><div class="filter-pills"><button :class="{active:pickupState===''}" @click="pickupState=''">全部</button><button :class="{active:pickupState==='WAIT_PREP'}" @click="pickupState='WAIT_PREP'">待备货</button><button :class="{active:pickupState==='PREPARING'}" @click="pickupState='PREPARING'">备货中</button><button :class="{active:pickupState==='READY'}" @click="pickupState='READY'">待核销</button><button :class="{active:pickupState==='COMPLETED'}" @click="pickupState='COMPLETED'">已核销</button></div></div><form v-if="route==='/merchant/pickup'&&can('pickup.verify')" class="quick-verify-bar" @submit.prevent="quickVerify"><div class="quick-verify-label"><span class="quick-verify-icon" aria-hidden="true"><Icon name="scan" :size="20"/></span><div><span class="quick-verify-eyebrow">极速出餐核销</span><strong>自提凭证核销台</strong><small>输入买家 6 位数字取件码即可出餐核销</small></div></div><div class="quick-verify-inputs"><input class="admin-input quick-pin-input" type="text" v-model="quickToken" autocomplete="off" aria-label="快速核销取件码或二维码" placeholder="输入 6 位数字取件码"/><button type="submit" class="teal-button" :disabled="!canAct||!quickToken.trim()">核销取件</button></div></form><div v-if="route==='/merchant/orders'" class="filter-pills secondary-pills"><button :class="{active:filter===''}" @click="filter=''">所有订单状态</button><button :class="{active:filter==='PAID'}" @click="filter='PAID'">已支付</button><button :class="{active:filter==='COMPLETED'}" @click="filter='COMPLETED'">已完成</button></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="q" placeholder="搜索订单号 / 商品"/></label><div class="ops-grid orders-split"><MerchantOrderTable :orders="visibleOrders" :selected-order="selectedOrder" :order-reminder="orderReminder" :can-prepare="can('order.prepare')&&canAct" :busy="busy" @select="picked=$event" @quick-prepare="prepare($event.order,$event.ready)"/><aside class="order-inspector" v-if="selectedOrder"><h2>订单详情</h2><div v-if="selectedOrder.pickup?.pickupCode" class="inspector-queue-banner"><div class="queue-ticket-meta"><span>取餐号</span><small>{{pickupStatusLabel(selectedOrder.pickup?.status)}}</small></div><strong>{{selectedOrder.pickup.pickupCode}}</strong></div><div class="inspector-row"><span>订单编号</span><strong>{{selectedOrder.orderId}}</strong></div><div class="inspector-row"><span>订单状态</span><strong>{{orderStatusLabel(selectedOrder.status)}}</strong></div><div class="inspector-row"><span>取货进度</span><strong>{{pickupStatusLabel(selectedOrder.pickup?.status)}}</strong></div><div v-if="selectedOrder.pickupSlot" class="inspector-row"><span>取餐时段</span><strong>{{pickupSlotLabel(selectedOrder.pickupSlot)}}</strong></div><div v-if="selectedOrder.buyerRemark" class="inspector-remark-box"><span>买家备注</span><strong>{{selectedOrder.buyerRemark}}</strong></div><div v-if="selectedOrder.paymentChannel" class="inspector-row"><span>支付方式</span><strong>{{paymentChannelLabel(selectedOrder.paymentChannel)}}</strong></div><div v-if="orderReminder(selectedOrder)" class="inline-error">{{orderReminder(selectedOrder)}}</div><div class="inspector-row"><span>金额</span><b class="red-text">{{money(selectedOrder.totalCent)}}</b></div><div class="order-detail-line" v-for="i in selectedOrder.items" :key="i.skuId"><span class="mini-icon"><Icon name="package"/></span><div><strong>{{i.title}}</strong><small>{{i.specKey}} × {{i.quantity}}</small></div></div><div class="form-buttons"><button v-if="can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='WAIT_PREP'" class="outline-button" :disabled="!canAct" @click="prepare(selectedOrder,false)">开始备货</button><button v-if="can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='PREPARING'" class="teal-button" :disabled="!canAct" @click="prepare(selectedOrder,true)">备货完成</button></div><form v-if="route!=='/merchant/pickup'&&can('pickup.verify')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='READY'" class="verify-form" @submit.prevent="verify(selectedOrder)"><label class="field-label" for="merchantops-field-3">取件码核销</label><input id="merchantops-field-3" type="text" class="admin-input quick-pin-input" v-model="token" required autocomplete="off" placeholder="输入买家 6 位自提码"/><button type="submit" class="teal-button" :disabled="!canAct">核销自提</button></form></aside></div></div></template>
 <template v-else-if="route==='/merchant/aftersales'"><section class="ops-card"><div class="ops-card-header"><h2>售后申请</h2><span>{{preview?afterSales.length:pageInfo.total}} 条</span></div><div class="ops-list-line" v-for="s in afterSales" :key="s.id"><span class="mini-icon"><Icon name="shield"/></span><div><strong>{{s.orderId}}</strong><small>{{s.reason}}</small></div><span class="status-tag">{{afterSaleStatusLabel(s.status)}}</span><button v-if="can('aftersale.read')" class="outline-button small" @click="openAfterSaleDecision(s.orderId)">{{s.status==='REQUESTED'?'审核':'查看历程'}}</button></div><div v-if="!afterSales.length" class="admin-empty">暂无售后</div><section class="review-inline" v-if="decision&&can('aftersale.read')&&afterSales.find(s=>s.orderId===decision)"><h3>售后处理 · {{decision}}</h3><div class="review-history"><strong>处理历程</strong><ol v-if="historyEvents.length"><li v-for="(e,i) in historyEvents" :key="e.eventId||i"><b>{{orderEventLabel(e.type)}}</b><small>{{dateTime(e.occurredAt)}}<template v-if="e.reason"> · {{e.reason}}</template></small></li></ol><p v-else-if="historyLoading" class="muted-short">正在加载处理历程…</p><p v-else class="muted-short">{{historyError||'历史记录不完整，仅显示当前状态'}}</p></div><form v-if="afterSales.find(s=>s.orderId===decision)?.status==='REQUESTED'" @submit.prevent="decisionAction(afterSales.find(s=>s.orderId===decision),true)"><div class="quick-chip-row"><button type="button" class="quick-chip" @click="reason='同意退款，款项原路退回'">原路退回</button><button type="button" class="quick-chip" @click="reason='商品已备好，请到店取货'">已备好请取货</button></div><textarea class="admin-input" rows="3" v-model="reason" maxlength="500" required placeholder="填写或点选审核说明"></textarea><div class="form-buttons"><button type="button" class="outline-button" :disabled="!canAct||!reason.trim()" @click="decisionAction(afterSales.find(s=>s.orderId===decision),false)">驳回</button><button type="submit" class="teal-button" :disabled="!canAct||!reason.trim()">同意退款</button></div></form></section></section></template>
 <template v-else-if="route==='/merchant/team'"><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>成员</h2><span>{{members.length}} 人</span></div><div class="ops-list-line" v-for="m in members" :key="m.userId"><span class="mini-icon"><Icon name="user"/></span><div><strong>{{m.displayName?m.displayName+' ('+m.userId+')':m.userId}}</strong><small>{{roles.find(r=>r.code===m.role)?.name||m.role}} · {{membershipStatusLabel(m.status)}}</small></div><select v-if="m.role!=='OWNER'&&m.status==='ACTIVE'" class="admin-input compact-select" :value="m.role" :disabled="!canAct||!canOwner" @change="assignMember(m,$event)"><option v-for="r in roles.filter(r=>r.code!=='OWNER')" :value="r.code" :key="r.code">{{r.name}}</option></select><button v-if="m.role!=='OWNER'&&m.status==='ACTIVE'" class="outline-button small" :disabled="!canAct||!canOwner" @click="revoke(m)">撤销</button></div></section><section class="ops-card ops-sideform"><h2>邀请店员</h2><form @submit.prevent="invite"><label class="field-label" for="merchantops-field-4">已注册用户名</label><input id="merchantops-field-4" class="admin-input" v-model="inviteUser" required maxlength="32" placeholder="用户名"/><button type="submit" class="teal-button" :disabled="!canAct||!canOwner">发送邀请</button></form><button class="outline-button small" @click="go('/merchant/roles')">管理角色和权限</button></section></div></template>
 <template v-else-if="route==='/merchant/settings'"><section class="ops-card ops-settings"><h2>门店资料</h2><form @submit.prevent="saveProfile"><label>经营名称<input class="admin-input" v-model="profile.name" required maxlength="100"/></label><label>门店名称<input class="admin-input" v-model="profile.storeName" required maxlength="100"/></label><label>自提位置<input class="admin-input" v-model="profile.location" required maxlength="200"/></label><label>门店介绍<textarea class="admin-input" v-model="profile.description" maxlength="2000" rows="4" placeholder="未填写"></textarea></label><label>营业时间<input class="admin-input" v-model="profile.businessHours" maxlength="200" placeholder="如：周一至周五 08:00-20:00（北京时间）"/></label><div class="store-image-field"><span>门店图片</span><ProductImage :src="profile.imageUrl" alt="门店图片"/><input type="file" accept="image/png,image/jpeg" @change="uploadStoreImage" :disabled="!canAct||!canOwner||busy"/><small>支持 JPG、PNG，不超过 2MB</small><button v-if="profile.imageUrl" type="button" class="outline-button" :disabled="!canAct||!canOwner||busy" @click="profile.imageUrl=''">移除图片</button></div><button class="teal-button" :disabled="!canAct||!canOwner||busy" type="submit">保存设置</button></form></section></template>
 <UiPagination v-if="!preview&&['/merchant/orders','/merchant/pickup','/merchant/aftersales','/merchant/inventory'].includes(route)&&pageInfo.total>0" :page="page" :has-next="pageInfo.hasNext" :busy="loading" @previous="page--" @next="page++">共 {{pageInfo.total}} 条</UiPagination></BackofficeShell>`,
};
