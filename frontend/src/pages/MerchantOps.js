import { requestScope } from '../services/request-scope.js';
import BackofficeShell from '../components/BackofficeShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, query, idempotency } from '../services/api.js';
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
  dateTime,
  pathId,
  coverSku,
  positiveInt,
} from '../services/page-utils.js';
const { ref, computed, onMounted, onUnmounted, watch } = Vue;
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
  components: { BackofficeShell, ProductImage },
  setup() {
    const scope = requestScope();
    const route = computed(() => store.route);
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
        error.value = store.error || '尚未加入商户';
        return;
      }
      if (restricted.value) return;
      if (preview) {
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
        notify('请输入买家出示的自提令牌');
        return;
      }
      await perform(midPath() + '/orders/' + pathId(o.orderId) + '/verify', {
        token: token.value.trim(),
      });
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
      if (!file.type.startsWith('image/') || file.size > 2_000_000) {
        notify('请选择 2MB 以内的图片');
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
        profile.value.imageUrl = uploaded.url;
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
    return {
      store,
      go,
      preview,
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
      orderReminder,
      dateTime,
      coverSku,
      load,
      prepare,
      verify,
      replenish,
      invite,
      revoke,
      saveProfile,
      uploadStoreImage,
      decisionAction,
    };
  },
  template: `<BackofficeShell role="merchant" :title="title"><template #actions><button class="outline-button small" @click="load"><Icon name="refresh" :size="16"/>刷新</button></template><div v-if="loading" class="inline-loading" role="status">正在加载…</div><div v-if="error" class="inline-error">{{error}} <button @click="load">重试</button></div>
 <div v-if="restricted" class="ops-card access-denied"><Icon name="shield" :size="32"/><h2>无权限访问</h2></div>
 <template v-else-if="route==='/merchant'"><div class="ops-card stats-toolbar"><span>统计期间：近 {{statsPeriod}} 天</span><button :class="{active:statsPeriod===7}" @click="statsPeriod=7">7 天</button><button :class="{active:statsPeriod===30}" @click="statsPeriod=30">30 天</button><small v-if="stats">{{stats.periodStart}} 至 {{stats.periodEnd}} · {{stats.timezone}} · 截至 {{stats.asOf}}</small></div><div class="ops-kpis" v-if="stats"><div><span>订单总数</span><strong>{{stats.totalOrders||0}}</strong></div><div><span>成功支付</span><strong>{{stats.paidOrders||0}}</strong></div><div><span>整单退款</span><strong>{{stats.refundedOrders||0}}</strong></div><div><span>完成金额</span><strong>{{money(stats.completedAmountCent)}}</strong></div><div><span>退款率</span><strong>{{stats.refundRate==null?'—':(stats.refundRate*100).toFixed(1)+'%'}}</strong></div></div><div class="ops-grid" v-if="stats"><section class="ops-card"><div class="ops-card-header"><h2>订单趋势</h2><span>新增订单</span></div><div class="ops-list-line" v-for="item in stats.trend" :key="item.day"><div><strong>{{item.day}}</strong><small>按创建日</small></div><b>{{item.orderCount}}</b></div><div v-if="!stats.trend?.length" class="admin-empty">期间暂无订单</div></section><section class="ops-card"><div class="ops-card-header"><h2>商品表现</h2><span>已完成 SKU</span></div><div class="ops-list-line" v-for="item in stats.products" :key="item.skuId"><div><strong>{{item.title||item.skuId}}</strong><small>{{item.skuId}}</small></div><b>{{item.quantity}}</b></div><div v-if="!stats.products?.length" class="admin-empty">期间暂无已完成商品</div></section><section class="ops-card"><div class="ops-card-header"><h2>状态分布</h2><span>查询时事实</span></div><div class="ops-list-line" v-for="item in stats.statuses" :key="item.status"><div><strong>{{orderStatusLabel(item.status)}}</strong><small>{{item.orderCount}} 单</small></div><b>{{money(item.amountCent)}}</b></div><div v-if="!stats.statuses?.length" class="admin-empty">期间暂无订单</div></section></div><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>最近订单</h2><button @click="go('/merchant/orders')">查看全部 <Icon name="chevronRight" :size="15"/></button></div><div class="ops-list-line" v-for="o in topOrders" :key="o.orderId"><span class="mini-icon"><Icon name="order" :size="19"/></span><div><strong>{{o.items?.[0]?.title||'校园订单'}}</strong><small>{{o.orderId}} · {{dateTime(o.createdAt)}}</small></div><b>{{money(o.totalCent)}}</b><span class="status-tag" :class="o.status==='COMPLETED'?'published':'draft'">{{orderStatusLabel(o.status)}}</span></div><div v-if="!topOrders.length" class="admin-empty">暂无订单</div></section><section class="ops-card"><div class="ops-card-header"><h2>快捷操作</h2></div><div class="ops-quick"><button v-if="can('product.read')" @click="go('/merchant/products')"><Icon name="package"/>商品管理</button><button v-if="can('stock.read')" @click="go('/merchant/inventory')"><Icon name="box"/>库存管理</button><button v-if="can('pickup.verify')" @click="go('/merchant/pickup')"><Icon name="scan"/>核销</button><button v-if="can('knowledge.read')" @click="go('/merchant/knowledge')"><Icon name="book"/>知识库</button></div></section></div></template>
 <template v-else-if="route==='/merchant/inventory'"><div class="ops-grid inventory-grid"><section class="ops-card"><div class="ops-card-header"><h2>库存清单</h2><span>{{preview?skuRows.length:pageInfo.total}} SKU</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="q" placeholder="商品 / SKU"/></label><div class="filter-pills secondary-pills"><button :class="{active:availableBelow===null}" @click="availableBelow=null">全部库存</button><button :class="{active:availableBelow!==null}" @click="availableBelow=10">低可售 ≤ {{availableBelow===null?10:availableBelow}}</button><input v-if="availableBelow!==null" class="admin-input compact-select" type="number" min="0" max="1000000" v-model.number="availableBelow" aria-label="低可售阈值"/></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商品 / 规格</th><th>实物</th><th>预占</th><th>可售</th><th>操作</th></tr></thead><tbody><tr v-for="row in (preview?skuRows.filter(r=>!q||r.product.title.includes(q)||r.sku.specKey.includes(q)):skuRows)" :key="row.sku.skuId" :class="{active:sku===row.sku.skuId}"><td><div class="table-product-cell"><ProductImage :src="row.product.imageUrl" :alt="row.product.title"/><div><strong>{{row.product.title}}</strong><span>{{row.sku.specKey}}</span></div></div></td><td>{{row.stock?.onHand??'—'}}</td><td>{{row.stock?.reserved??'—'}}</td><td :class="{'red-text':Number(row.stock?.available||0)<10}">{{row.stock?.available??'—'}}</td><td><button v-if="can('stock.replenish')" class="row-link" @click="sku=row.sku.skuId">补货</button></td></tr></tbody></table></div></section><section class="ops-card ops-sideform"><template v-if="can('stock.replenish')"><h2>库存补货</h2><form @submit.prevent="replenish"><label class="field-label" for="merchantops-field-1">SKU</label><select id="merchantops-field-1" class="admin-input" v-model="sku" required><option disabled value="">选择规格</option><option v-for="row in skuRows" :key="row.sku.skuId" :value="row.sku.skuId">{{row.product.title}} · {{row.sku.specKey}}</option></select><label class="field-label" for="merchantops-field-2">补货数量</label><input id="merchantops-field-2" type="number" class="admin-input" v-model.number="amount" min="1" max="1000000" required/><button class="teal-button" type="submit" :disabled="!canAct">确认补货</button></form></template><div class="ops-card-header compact"><h3>库存流水</h3><span>{{movementPageInfo.total||0}} 条</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="movementQ" placeholder="单据号 / SKU"/></label><div class="ops-list-line" v-for="m in moves" :key="m.id"><span class="mini-icon"><Icon name="box" :size="16"/></span><div><strong>{{inventoryOperationLabel(m.type)}}</strong><small>{{dateTime(m.createdAt)}} · 单据 {{m.bizKey}}</small></div><b>{{inventoryQuantityLabel(m)}}</b></div><div v-if="!moves.length" class="admin-empty">暂无匹配流水</div><div v-if="movementPageInfo.total>0" class="sdd-pager"><button :disabled="movementPage<=1" @click="movementPage--">上一页</button><span>{{movementPage}}</span><button :disabled="!movementPageInfo.hasNext" @click="movementPage++">下一页</button></div></section></div></template>
 <template v-else-if="route==='/merchant/orders'||route==='/merchant/pickup'"><div class="ops-card"><div class="ops-card-header"><div><h2>{{route==='/merchant/pickup'?'交付核销':'订单列表'}}</h2><small>待办筛选由服务端按履约任务状态计算</small></div><div class="filter-pills"><button :class="{active:pickupState===''}" @click="pickupState=''">全部</button><button :class="{active:pickupState==='WAIT_PREP'}" @click="pickupState='WAIT_PREP'">待备货</button><button :class="{active:pickupState==='PREPARING'}" @click="pickupState='PREPARING'">备货中</button><button :class="{active:pickupState==='READY'}" @click="pickupState='READY'">待核销</button><button :class="{active:pickupState==='COMPLETED'}" @click="pickupState='COMPLETED'">已核销</button></div></div><div class="filter-pills secondary-pills"><button :class="{active:filter===''}" @click="filter=''">所有订单状态</button><button :class="{active:filter==='PAID'}" @click="filter='PAID'">已支付</button><button :class="{active:filter==='COMPLETED'}" @click="filter='COMPLETED'">已完成</button></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="q" placeholder="搜索订单号 / 商品"/></label><div class="ops-grid orders-split"><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>订单</th><th>商品</th><th>金额</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="o in visibleOrders" :key="o.orderId" :class="{active:selectedOrder?.orderId===o.orderId}" @click="picked=o.orderId"><td><button class="row-link" @click.stop="picked=o.orderId" :aria-pressed="selectedOrder?.orderId===o.orderId">#{{o.orderId}}</button><small>{{dateTime(o.createdAt)}}</small></td><td>{{o.items?.[0]?.title||'—'}}</td><td>{{money(o.totalCent)}}</td><td><span class="status-tag" :class="o.status==='COMPLETED'?'published':'draft'">{{orderStatusLabel(o.status)}}</span><small v-if="o.pickup">{{pickupStatusLabel(o.pickup.status)}}</small><small v-if="orderReminder(o)" class="red-text">{{orderReminder(o)}}</small></td><td><Icon name="chevronRight" :size="16"/></td></tr></tbody></table><div v-if="!visibleOrders.length" class="admin-empty">暂无符合条件的订单</div></div><aside class="order-inspector" v-if="selectedOrder"><h2>订单详情</h2><div class="inspector-row"><span>订单编号</span><strong>{{selectedOrder.orderId}}</strong></div><div class="inspector-row"><span>订单状态</span><strong>{{orderStatusLabel(selectedOrder.status)}}</strong></div><div class="inspector-row"><span>自提进度</span><strong>{{pickupStatusLabel(selectedOrder.pickup?.status)}}</strong></div><div v-if="orderReminder(selectedOrder)" class="inline-error">{{orderReminder(selectedOrder)}}</div><div class="inspector-row"><span>金额</span><b class="red-text">{{money(selectedOrder.totalCent)}}</b></div><div class="order-detail-line" v-for="i in selectedOrder.items" :key="i.skuId"><span class="mini-icon"><Icon name="package"/></span><div><strong>{{i.title}}</strong><small>{{i.specKey}} × {{i.quantity}}</small></div></div><div class="form-buttons"><button v-if="can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='WAIT_PREP'" class="outline-button" :disabled="!canAct" @click="prepare(selectedOrder,false)">开始备货</button><button v-if="can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='PREPARING'" class="teal-button" :disabled="!canAct" @click="prepare(selectedOrder,true)">备货完成</button></div><form v-if="can('pickup.verify')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='READY'" class="verify-form" @submit.prevent="verify(selectedOrder)"><label class="field-label" for="merchantops-field-3">买家自提令牌</label><textarea id="merchantops-field-3" class="admin-input" v-model="token" rows="3" required placeholder="输入买家自提令牌"></textarea><button type="submit" class="teal-button" :disabled="!canAct">核销自提</button></form></aside></div></div></template>
 <template v-else-if="route==='/merchant/aftersales'"><section class="ops-card"><div class="ops-card-header"><h2>售后申请</h2><span>{{preview?afterSales.length:pageInfo.total}} 条</span></div><div class="ops-list-line" v-for="s in afterSales" :key="s.id"><span class="mini-icon"><Icon name="shield"/></span><div><strong>{{s.orderId}}</strong><small>{{s.reason}}</small></div><span class="status-tag">{{afterSaleStatusLabel(s.status)}}</span><button v-if="can('aftersale.read')" class="outline-button small" @click="openAfterSaleDecision(s.orderId)">{{s.status==='REQUESTED'?'审核':'查看历程'}}</button></div><div v-if="!afterSales.length" class="admin-empty">暂无售后</div><section class="review-inline" v-if="decision&&can('aftersale.read')&&afterSales.find(s=>s.orderId===decision)"><h3>售后处理 · {{decision}}</h3><div class="review-history"><strong>处理历程</strong><ol v-if="historyEvents.length"><li v-for="(e,i) in historyEvents" :key="e.eventId||i"><b>{{orderEventLabel(e.type)}}</b><small>{{dateTime(e.occurredAt)}}<template v-if="e.reason"> · {{e.reason}}</template></small></li></ol><p v-else-if="historyLoading" class="muted-short">正在加载处理历程…</p><p v-else class="muted-short">{{historyError||'历史记录不完整，仅显示当前状态'}}</p></div><form v-if="afterSales.find(s=>s.orderId===decision)?.status==='REQUESTED'" @submit.prevent="decisionAction(afterSales.find(s=>s.orderId===decision),true)"><textarea class="admin-input" rows="3" v-model="reason" maxlength="500" required placeholder="审核说明（必填）"></textarea><div class="form-buttons"><button type="button" class="outline-button" :disabled="!canAct||!reason.trim()" @click="decisionAction(afterSales.find(s=>s.orderId===decision),false)">驳回</button><button type="submit" class="teal-button" :disabled="!canAct||!reason.trim()">同意退款</button></div></form></section></section></template>
 <template v-else-if="route==='/merchant/team'"><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>成员</h2><span>{{members.length}} 人</span></div><div class="ops-list-line" v-for="m in members" :key="m.userId"><span class="mini-icon"><Icon name="user"/></span><div><strong>{{m.userId}}</strong><small>{{roles.find(r=>r.code===m.role)?.name||m.role}} · {{membershipStatusLabel(m.status)}}</small></div><select v-if="m.role!=='OWNER'&&m.status==='ACTIVE'" class="admin-input compact-select" :value="m.role" :disabled="!canAct||!canOwner" @change="assignMember(m,$event)"><option v-for="r in roles.filter(r=>r.code!=='OWNER')" :value="r.code" :key="r.code">{{r.name}}</option></select><button v-if="m.role!=='OWNER'&&m.status==='ACTIVE'" class="outline-button small" :disabled="!canAct||!canOwner" @click="revoke(m)">撤销</button></div></section><section class="ops-card ops-sideform"><h2>邀请店员</h2><form @submit.prevent="invite"><label class="field-label" for="merchantops-field-4">已注册用户名</label><input id="merchantops-field-4" class="admin-input" v-model="inviteUser" required maxlength="32" placeholder="用户名"/><button type="submit" class="teal-button" :disabled="!canAct||!canOwner">发送邀请</button></form><button class="outline-button small" @click="go('/merchant/roles')">管理角色和权限</button></section></div></template>
 <template v-else-if="route==='/merchant/settings'"><section class="ops-card ops-settings"><h2>门店资料</h2><form @submit.prevent="saveProfile"><label>经营名称<input class="admin-input" v-model="profile.name" required maxlength="100"/></label><label>门店名称<input class="admin-input" v-model="profile.storeName" required maxlength="100"/></label><label>自提位置<input class="admin-input" v-model="profile.location" required maxlength="200"/></label><label>门店介绍<textarea class="admin-input" v-model="profile.description" maxlength="2000" rows="4" placeholder="未填写"></textarea></label><label>营业时间<input class="admin-input" v-model="profile.businessHours" maxlength="200" placeholder="如：周一至周五 08:00-20:00（北京时间）"/></label><div class="store-image-field"><span>门店图片</span><ProductImage :src="profile.imageUrl" alt="门店图片"/><input type="file" accept="image/png,image/jpeg,image/webp" @change="uploadStoreImage" :disabled="!canAct||!canOwner||busy"/><small>只接受本商户上传的门店图片，未上传时显示未填写</small><button v-if="profile.imageUrl" type="button" class="outline-button" @click="profile.imageUrl=''">移除图片</button></div><button class="teal-button" :disabled="!canAct||!canOwner||busy" type="submit">保存设置</button></form></section></template>
 <div v-if="!preview&&['/merchant/orders','/merchant/pickup','/merchant/aftersales','/merchant/inventory'].includes(route)&&pageInfo.total>0" class="sdd-pager"><span>共 {{pageInfo.total}} 条</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext" @click="page++">下一页</button></div></BackofficeShell>`,
};
