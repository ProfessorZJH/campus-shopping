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
import { label, dateTime, pathId, coverSku, positiveInt } from '../services/page-utils.js';
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
    const q = ref('');
    const stats = ref(null),
      orders = ref([]),
      afterSales = ref([]),
      members = ref([]),
      moves = ref([]),
      stockRows = ref([]),
      error = ref(''),
      busy = ref(false),
      picked = ref(null),
      token = ref(''),
      decision = ref(''),
      reason = ref('');
    const page = ref(1),
      pageInfo = ref({ total: 0, hasNext: false }),
      amount = ref(1),
      sku = ref(''),
      inviteUser = ref(''),
      profile = ref({ name: '', storeName: '', location: '' });
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
      () => !preview && !busy.value && !!store.merchantId && !restricted.value,
    );
    let loadVersion = 0;
    function clearPrivateViews() {
      token.value = '';
      reason.value = '';
      filter.value = '';
      q.value = '';
      sku.value = '';
      amount.value = 1;
      inviteUser.value = '';
      replenishKey.value = '';
      replenishFingerprint.value = '';
      profile.value = { name: '', storeName: '', location: '' };
      roles.value = [];
      stats.value = null;
      orders.value = [];
      afterSales.value = [];
      members.value = [];
      moves.value = [];
      stockRows.value = [];
      picked.value = null;
      decision.value = '';
      pageInfo.value = { total: 0, hasNext: false };
    }
    async function load() {
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
      try {
        if (section === '/merchant') {
          const [s, o] = await Promise.all([
            hasPermission('dashboard.read') ? api(base + '/statistics') : Promise.resolve(null),
            api(base + '/orders/page' + query({ page: 1, size: 5 })),
          ]);
          if (!current()) return;
          stats.value = s;
          orders.value = o.items || [];
          pageInfo.value = o;
        }
        if (section === '/merchant/orders' || section === '/merchant/pickup') {
          const result = await api(
            base +
              '/orders/page' +
              query({ page: page.value, size: 10, state: filter.value, q: q.value }),
          );
          if (!current()) return;
          orders.value = result.items || [];
          pageInfo.value = result;
        }
        if (section === '/merchant/aftersales') {
          const result = await api(
            base + '/aftersales/page' + query({ page: page.value, size: 10 }),
          );
          if (!current()) return;
          afterSales.value = result.items || [];
          pageInfo.value = result;
        }
        if (section === '/merchant/inventory') {
          const [stockResult, movements] = await Promise.all([
            api(base + '/stocks/page' + query({ page: page.value, size: 10, q: q.value })),
            api(base + '/stock-movements/page' + query({ page: 1, size: 8 })),
          ]);
          if (!current()) return;
          stockRows.value = stockResult.items || [];
          moves.value = movements.items || [];
          pageInfo.value = stockResult;
        }
        if (section === '/merchant/team') {
          const [m, r] = await Promise.all([api(base + '/members'), api(base + '/rbac/roles')]);
          if (!current()) return;
          members.value = m || [];
          roles.value = r || [];
        }
        if (section === '/merchant/settings' && current())
          profile.value = {
            name: merchant.value.name || '',
            storeName: merchant.value.storeName || '',
            location: merchant.value.location || '',
          };
      } catch (e) {
        if (current()) error.value = e.message;
      }
    }
    onMounted(load);
    onUnmounted(() => {
      ++loadVersion;
      clearTimeout(searchDelay);
    });
    watch([route, () => store.merchantId, () => store.user?.userId], () => {
      ++loadVersion;
      clearPrivateViews();
      page.value = 1;
      load();
    });
    watch(page, load);
    watch(filter, () => {
      page.value = 1;
      if (route.value === '/merchant/orders' || route.value === '/merchant/pickup') load();
    });
    let searchDelay;
    watch(q, () => {
      if (
        !preview &&
        ['/merchant/orders', '/merchant/pickup', '/merchant/inventory'].includes(route.value)
      ) {
        ++loadVersion;
        page.value = 1;
        clearTimeout(searchDelay);
        searchDelay = setTimeout(load, 280);
      }
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
      if (!canOwner.value || m.role === 'OWNER') return;
      if (!window.confirm('确定撤销该成员的商户权限？')) return;
      await perform(midPath() + '/members/' + pathId(m.userId), undefined, 'DELETE');
    }
    async function assignMember(m, code) {
      if (!canOwner.value || !code || code === m.role || m.role === 'OWNER') return;
      await perform(
        midPath() + '/rbac/members/' + pathId(m.userId) + '/role',
        { roleCode: code },
        'PUT',
      );
    }
    async function saveProfile() {
      if (!canOwner.value) return;
      const v = profile.value;
      if (!v.name.trim() || !v.storeName.trim() || !v.location.trim()) {
        notify('请完善门店资料');
        return;
      }
      if (await perform(midPath() + '/profile', { ...v }, 'PUT')) await loadMerchant();
    }
    async function decisionAction(s, approved) {
      if (!hasPermission('aftersale.review') || !s) return;
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
      q,
      page,
      pageInfo,
      stats,
      orders,
      afterSales,
      members,
      moves,
      stockRows,
      error,
      busy,
      picked,
      selectedOrder,
      visibleOrders,
      token,
      decision,
      reason,
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
      label,
      dateTime,
      coverSku,
      load,
      prepare,
      verify,
      replenish,
      invite,
      revoke,
      saveProfile,
      decisionAction,
    };
  },
  template: `<BackofficeShell role="merchant" :title="title"><template #actions><button class="outline-button small" @click="load"><Icon name="refresh" :size="16"/>刷新</button></template><div v-if="error" class="inline-error">{{error}}</div>
 <div v-if="restricted" class="ops-card access-denied"><Icon name="shield" :size="32"/><h2>无权限访问</h2></div>
 <template v-else-if="route==='/merchant'"><div class="ops-kpis" v-if="stats"><div><span>订单总数</span><strong>{{stats.totalOrders||0}}</strong></div><div><span>待处理</span><strong>{{stats.pendingCount||0}}</strong></div><div><span>已完成</span><strong>{{stats.completedCount||0}}</strong></div><div><span>完成金额</span><strong>{{money(stats.completedAmountCent)}}</strong></div></div><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>最近订单</h2><button @click="go('/merchant/orders')">查看全部 <Icon name="chevronRight" :size="15"/></button></div><div class="ops-list-line" v-for="o in topOrders" :key="o.orderId"><span class="mini-icon"><Icon name="order" :size="19"/></span><div><strong>{{o.items?.[0]?.title||'校园订单'}}</strong><small>{{o.orderId}} · {{dateTime(o.createdAt)}}</small></div><b>{{money(o.totalCent)}}</b><span class="status-tag" :class="o.status==='COMPLETED'?'published':'draft'">{{label(o.status)}}</span></div><div v-if="!topOrders.length" class="admin-empty">暂无订单</div></section><section class="ops-card"><div class="ops-card-header"><h2>快捷操作</h2></div><div class="ops-quick"><button v-if="can('product.read')" @click="go('/merchant/products')"><Icon name="package"/>商品管理</button><button v-if="can('stock.read')" @click="go('/merchant/inventory')"><Icon name="box"/>库存管理</button><button v-if="can('pickup.verify')" @click="go('/merchant/pickup')"><Icon name="scan"/>核销</button><button v-if="can('knowledge.read')" @click="go('/merchant/knowledge')"><Icon name="book"/>知识库</button></div></section></div></template>
 <template v-else-if="route==='/merchant/inventory'"><div class="ops-grid inventory-grid"><section class="ops-card"><div class="ops-card-header"><h2>库存清单</h2><span>{{preview?skuRows.length:pageInfo.total}} SKU</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="q" placeholder="商品 / SKU"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商品 / 规格</th><th>实物</th><th>预占</th><th>可售</th><th>操作</th></tr></thead><tbody><tr v-for="row in (preview?skuRows.filter(r=>!q||r.product.title.includes(q)||r.sku.specKey.includes(q)):skuRows)" :key="row.sku.skuId" :class="{active:sku===row.sku.skuId}"><td><div class="table-product-cell"><ProductImage :src="row.product.imageUrl" :alt="row.product.title"/><div><strong>{{row.product.title}}</strong><span>{{row.sku.specKey}}</span></div></div></td><td>{{row.stock?.onHand??'—'}}</td><td>{{row.stock?.reserved??'—'}}</td><td :class="{'red-text':Number(row.stock?.available||0)<10}">{{row.stock?.available??'—'}}</td><td><button v-if="can('stock.replenish')" class="row-link" @click="sku=row.sku.skuId">补货</button></td></tr></tbody></table></div></section><section class="ops-card ops-sideform"><template v-if="can('stock.replenish')"><h2>库存补货</h2><form @submit.prevent="replenish"><label class="field-label" for="merchantops-field-1">SKU</label><select id="merchantops-field-1" class="admin-input" v-model="sku" required><option disabled value="">选择规格</option><option v-for="row in skuRows" :key="row.sku.skuId" :value="row.sku.skuId">{{row.product.title}} · {{row.sku.specKey}}</option></select><label class="field-label" for="merchantops-field-2">补货数量</label><input id="merchantops-field-2" type="number" class="admin-input" v-model.number="amount" min="1" max="1000000" required/><button class="teal-button" type="submit" :disabled="!canAct">确认补货</button></form></template><div class="ops-card-header compact"><h3>库存流水</h3></div><div class="ops-list-line" v-for="m in moves.slice(0,8)" :key="m.id"><span class="mini-icon"><Icon name="box" :size="16"/></span><div><strong>{{label(m.type)}}</strong><small>{{dateTime(m.createdAt)}}</small></div><b>+{{m.quantity}}</b></div></section></div></template>
 <template v-else-if="route==='/merchant/orders'||route==='/merchant/pickup'"><div class="ops-card"><div class="ops-card-header"><h2>{{route==='/merchant/pickup'?'交付核销':'订单列表'}}</h2><div class="filter-pills"><button :class="{active:filter===''}" @click="filter=''">全部</button><button :class="{active:filter==='PAID'}" @click="filter='PAID'">已支付</button><button :class="{active:filter==='COMPLETED'}" @click="filter='COMPLETED'">已完成</button></div></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="q" placeholder="搜索订单号 / 商品"/></label><div class="ops-grid orders-split"><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>订单</th><th>商品</th><th>金额</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="o in visibleOrders" :key="o.orderId" :class="{active:selectedOrder?.orderId===o.orderId}" @click="picked=o.orderId"><td><button class="row-link" @click.stop="picked=o.orderId" :aria-pressed="selectedOrder?.orderId===o.orderId">#{{o.orderId}}</button><small>{{dateTime(o.createdAt)}}</small></td><td>{{o.items?.[0]?.title||'—'}}</td><td>{{money(o.totalCent)}}</td><td><span class="status-tag" :class="o.status==='COMPLETED'?'published':'draft'">{{label(o.status)}}</span></td><td><Icon name="chevronRight" :size="16"/></td></tr></tbody></table><div v-if="!visibleOrders.length" class="admin-empty">暂无订单</div></div><aside class="order-inspector" v-if="selectedOrder"><h2>订单详情</h2><div class="inspector-row"><span>订单编号</span><strong>{{selectedOrder.orderId}}</strong></div><div class="inspector-row"><span>订单状态</span><strong>{{label(selectedOrder.status)}}</strong></div><div class="inspector-row"><span>自提进度</span><strong>{{label(selectedOrder.pickup?.status)}}</strong></div><div class="inspector-row"><span>金额</span><b class="red-text">{{money(selectedOrder.totalCent)}}</b></div><div class="order-detail-line" v-for="i in selectedOrder.items" :key="i.skuId"><span class="mini-icon"><Icon name="package"/></span><div><strong>{{i.title}}</strong><small>{{i.specKey}} × {{i.quantity}}</small></div></div><div class="form-buttons"><button v-if="can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='WAIT_PREP'" class="outline-button" :disabled="!canAct" @click="prepare(selectedOrder,false)">开始备货</button><button v-if="can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='PREPARING'" class="teal-button" :disabled="!canAct" @click="prepare(selectedOrder,true)">备货完成</button></div><form v-if="can('pickup.verify')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='READY'" class="verify-form" @submit.prevent="verify(selectedOrder)"><label class="field-label" for="merchantops-field-3">买家自提令牌</label><textarea id="merchantops-field-3" class="admin-input" v-model="token" rows="3" required placeholder="输入买家自提令牌"></textarea><button type="submit" class="teal-button" :disabled="!canAct">核销自提</button></form></aside></div></div></template>
 <template v-else-if="route==='/merchant/aftersales'"><section class="ops-card"><div class="ops-card-header"><h2>售后申请</h2><span>{{preview?afterSales.length:pageInfo.total}} 条</span></div><div class="ops-list-line" v-for="s in afterSales" :key="s.id"><span class="mini-icon"><Icon name="shield"/></span><div><strong>{{s.orderId}}</strong><small>{{s.reason}}</small></div><span class="status-tag">{{label(s.status)}}</span><button v-if="can('aftersale.review')" class="outline-button small" @click="decision=s.orderId;reason=''">审核</button></div><div v-if="!afterSales.length" class="admin-empty">暂无售后</div><form class="review-inline" v-if="decision&&can('aftersale.review')" @submit.prevent="decisionAction(afterSales.find(s=>s.orderId===decision),true)"><h3>售后审核 · {{decision}}</h3><textarea class="admin-input" rows="3" v-model="reason" maxlength="500" required placeholder="审核说明（必填）"></textarea><div class="form-buttons"><button type="button" class="outline-button" :disabled="!canAct||!reason.trim()" @click="decisionAction(afterSales.find(s=>s.orderId===decision),false)">驳回</button><button type="submit" class="teal-button" :disabled="!canAct||!reason.trim()">同意退款</button></div></form></section></template>
 <template v-else-if="route==='/merchant/team'"><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>成员</h2><span>{{members.length}} 人</span></div><div class="ops-list-line" v-for="m in members" :key="m.userId"><span class="mini-icon"><Icon name="user"/></span><div><strong>{{m.userId}}</strong><small>{{roles.find(r=>r.code===m.role)?.name||m.role}} · {{label(m.status)}}</small></div><select v-if="m.role!=='OWNER'&&m.status==='ACTIVE'" class="admin-input compact-select" :value="m.role" :disabled="!canAct" @change="assignMember(m,$event.target.value)"><option v-for="r in roles.filter(r=>r.code!=='OWNER')" :value="r.code" :key="r.code">{{r.name}}</option></select><button v-if="m.role!=='OWNER'" class="outline-button small" :disabled="!canAct||!canOwner" @click="revoke(m)">撤销</button></div></section><section class="ops-card ops-sideform"><h2>邀请店员</h2><form @submit.prevent="invite"><label class="field-label" for="merchantops-field-4">已注册用户名</label><input id="merchantops-field-4" class="admin-input" v-model="inviteUser" required maxlength="32" placeholder="用户名"/><button type="submit" class="teal-button" :disabled="!canAct||!canOwner">发送邀请</button></form><button class="outline-button small" @click="go('/merchant/roles')">管理角色和权限</button></section></div></template>
 <template v-else-if="route==='/merchant/settings'"><section class="ops-card ops-settings"><h2>门店资料</h2><form @submit.prevent="saveProfile"><label>经营名称<input class="admin-input" v-model="profile.name" required maxlength="100"/></label><label>门店名称<input class="admin-input" v-model="profile.storeName" required maxlength="100"/></label><label>自提位置<input class="admin-input" v-model="profile.location" required maxlength="200"/></label><button class="teal-button" :disabled="!canAct||!canOwner" type="submit">保存设置</button></form></section></template>
 <div v-if="!preview&&['/merchant/orders','/merchant/pickup','/merchant/aftersales','/merchant/inventory'].includes(route)&&pageInfo.total>0" class="sdd-pager"><span>共 {{pageInfo.total}} 条</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext" @click="page++">下一页</button></div></BackofficeShell>`,
};
