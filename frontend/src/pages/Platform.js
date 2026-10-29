import BackofficeShell from '../components/BackofficeShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, query, idempotency } from '../services/api.js';
import { store, go, preview, notify, money, loadSession } from '../services/store.js';
import {
  DEMO_STATS,
  DEMO_APPLICATIONS,
  DEMO_MERCHANT_ORDERS,
  DEMO_AFTERSALES,
} from '../services/pages-demo.js';
import { DEMO_MERCHANTS, DEMO_PRODUCTS, DEMO_CATEGORIES } from '../services/demo.js';
import { label, dateTime, pathId } from '../services/page-utils.js';
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
  components: { BackofficeShell, ProductImage },
  setup() {
    const route = computed(() => store.route),
      title = computed(() => titles[route.value] || '平台总览');
    const stats = ref(null),
      applications = ref([]),
      merchants = ref([]),
      products = ref([]),
      orders = ref([]),
      aftersales = ref([]),
      categories = ref([]);
    const selectedId = ref(''),
      search = ref(''),
      state = ref(''),
      page = ref(1),
      pageInfo = ref({ total: 0, hasNext: false }),
      reason = ref(''),
      category = ref({ code: '', name: '', active: true }),
      busy = ref(false),
      error = ref(''),
      allowed = ref(preview);
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
    function clearPrivateViews() {
      stats.value = null;
      applications.value = [];
      merchants.value = [];
      products.value = [];
      orders.value = [];
      aftersales.value = [];
      selectedId.value = '';
      pageInfo.value = { total: 0, hasNext: false };
    }
    async function load() {
      const stamp = ++loadVersion;
      const current = route.value;
      error.value = '';
      if (preview) {
        allowed.value = true;
        stats.value = { ...DEMO_STATS };
        applications.value = DEMO_APPLICATIONS;
        merchants.value = DEMO_MERCHANTS;
        products.value = DEMO_PRODUCTS;
        orders.value = DEMO_MERCHANT_ORDERS;
        aftersales.value = DEMO_AFTERSALES;
        categories.value = DEMO_CATEGORIES;
        return;
      }
      try {
        await loadSession();
        if (stamp !== loadVersion) return;
        const actor = store.user?.userId;
        const valid = () =>
          stamp === loadVersion && route.value === current && store.user?.userId === actor;
        const work = await api('/workspace');
        if (!valid()) return;
        store.workspace = work;
        allowed.value = !!work?.platformAdmin;
        if (!allowed.value) return;
        if (current === '/admin') {
          const [s, m, o] = await Promise.all([
            api('/admin/statistics'),
            api('/admin/merchants/page' + query({ page: 1, size: 6 })),
            api('/admin/orders/page' + query({ page: 1, size: 6 })),
          ]);
          if (!valid()) return;
          stats.value = s;
          merchants.value = m.items || [];
          orders.value = o.items || [];
        }
        if (current === '/admin/applications') {
          const result = await api(
            '/admin/merchant-applications/page' +
              query({ page: page.value, size: 12, state: state.value, q: search.value }),
          );
          if (!valid()) return;
          applications.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/merchants') {
          const result = await api(
            '/admin/merchants/page' + query({ page: page.value, size: 12, q: search.value }),
          );
          if (!valid()) return;
          merchants.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/products') {
          const result = await api(
            '/admin/products/page' + query({ page: page.value, size: 12, q: search.value }),
          );
          if (!valid()) return;
          products.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/orders') {
          const result = await api(
            '/admin/orders/page' +
              query({ page: page.value, size: 12, state: state.value, q: search.value }),
          );
          if (!valid()) return;
          orders.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/disputes') {
          const result = await api(
            '/admin/aftersales/page' + query({ page: page.value, size: 12, state: state.value }),
          );
          if (!valid()) return;
          aftersales.value = result.items || [];
          pageInfo.value = result;
        }
        if (current === '/admin/categories') {
          const result = await api('/categories');
          if (!valid()) return;
          categories.value = result || [];
        }
      } catch (e) {
        if (stamp === loadVersion && route.value === current) error.value = e.message;
      }
    }
    onMounted(load);
    onUnmounted(() => {
      ++loadVersion;
      clearTimeout(searchDelay);
    });
    watch(
      () => store.user?.userId,
      () => {
        ++loadVersion;
        allowed.value = preview;
        clearPrivateViews();
        if (!preview && route.value.startsWith('/admin')) load();
      },
    );
    watch(route, () => {
      page.value = 1;
      search.value = '';
      state.value = '';
      selectedId.value = '';
      load();
    });
    watch(page, load);
    watch(state, () => {
      page.value = 1;
      if (route.value !== '/admin') load();
    });
    let searchDelay;
    watch(search, () => {
      page.value = 1;
      if (
        !preview &&
        ['/admin/products', '/admin/merchants', '/admin/applications', '/admin/orders'].includes(
          route.value,
        )
      ) {
        clearTimeout(searchDelay);
        searchDelay = setTimeout(load, 280);
      }
    });
    async function perform(path, body) {
      if (preview || busy.value || !allowed.value) return;
      busy.value = true;
      try {
        await api(path, { method: 'POST', body });
        notify('操作成功');
        reason.value = '';
        await load();
      } catch (e) {
        notify(e.message);
      } finally {
        busy.value = false;
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
      perform('/admin/merchants/' + pathId(m.merchantId) + '/state', {
        active: m.status !== 'ACTIVE',
        reason: reason.value || '平台管理操作',
      });
    }
    function forceProduct(p) {
      perform('/admin/products/' + pathId(p.productId) + '/unpublish');
    }
    function decideRefund(a, approved) {
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
    function selectApplication(a) {
      selectedId.value = a.applicationId;
      reason.value = '';
    }
    const merchantName = (id, row) =>
      row?.merchantName || merchants.value.find((m) => m.merchantId === id)?.name || id || '—';
    return {
      store,
      route,
      title,
      stats,
      applications,
      merchants,
      products,
      orders,
      aftersales,
      categories,
      selectedId,
      search,
      state,
      page,
      pageInfo,
      reason,
      category,
      busy,
      error,
      allowed,
      pickedApplication,
      filtered,
      preview,
      go,
      money,
      label,
      dateTime,
      merchantName,
      load,
      review,
      stateMerchant,
      forceProduct,
      decideRefund,
      saveCategory,
      selectApplication,
    };
  },
  template: `<BackofficeShell role="admin" :title="title"><template #actions><button class="outline-button small" @click="load"><Icon name="refresh" :size="16"/>刷新</button></template><div v-if="error" class="inline-error">{{error}}</div><div v-if="!allowed&&!preview" class="ops-card access-denied"><Icon name="shield" :size="38"/><h2>无权限访问</h2></div>
 <template v-else-if="route==='/admin'"><div class="ops-kpis" v-if="stats"><div><span>全部订单</span><strong>{{stats.totalOrders||0}}</strong></div><div><span>待付款</span><strong>{{stats.pendingCount||0}}</strong></div><div><span>已完成</span><strong>{{stats.completedCount||0}}</strong></div><div><span>模拟交易金额</span><strong>{{money(stats.completedAmountCent)}}</strong></div></div><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>近期订单</h2><button @click="go('/admin/orders')">全部 <Icon name="chevronRight" :size="16"/></button></div><div class="ops-list-line" v-for="o in orders.slice(0,6)" :key="o.orderId"><span class="mini-icon"><Icon name="order"/></span><div><strong>{{o.orderId}}</strong><small>{{dateTime(o.createdAt)}}</small></div><b>{{money(o.totalCent)}}</b><span class="status-tag">{{label(o.status)}}</span></div><div v-if="!orders.length" class="admin-empty">暂无订单</div></section><section class="ops-card"><div class="ops-card-header"><h2>运营入口</h2></div><div class="ops-quick"><button @click="go('/admin/applications')"><Icon name="store"/>商户审核</button><button @click="go('/admin/merchants')"><Icon name="users"/>商户监管</button><button @click="go('/admin/disputes')"><Icon name="shield"/>争议处理</button><button @click="go('/admin/knowledge')"><Icon name="book"/>知识库</button></div></section></div></template>
 <template v-else-if="route==='/admin/applications'"><div class="ops-grid admin-review-grid"><section class="ops-card"><div class="ops-card-header"><h2>入驻申请</h2><span>{{preview?applications.length:pageInfo.total}} 条</span></div><div class="ops-toolbar"><label class="ops-search"><Icon name="search" :size="16"/><input v-model="search" placeholder="商户 / 申请人"/></label><select class="admin-input compact-select" v-model="state"><option value="">全部状态</option><option value="SUBMITTED">待审核</option><option value="APPROVED">已通过</option><option value="REJECTED">已拒绝</option></select></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商户</th><th>申请人</th><th>门店</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="a in filtered" :key="a.applicationId" :class="{active:pickedApplication?.applicationId===a.applicationId}" @click="selectApplication(a)"><td><strong>{{a.merchantName}}</strong><small>{{a.category}}</small></td><td>{{a.contactName}}</td><td>{{a.storeName}}</td><td><span class="status-tag" :class="a.status==='APPROVED'?'published':'draft'">{{label(a.status)}}</span></td><td><Icon name="chevronRight" :size="16"/></td></tr></tbody></table></div><div v-if="!filtered.length" class="admin-empty">无符合条件的申请</div></section><aside class="ops-card ops-sideform" v-if="pickedApplication"><h2>{{pickedApplication.merchantName}}</h2><span class="status-tag">{{label(pickedApplication.status)}}</span><div class="inspector-row"><span>申请编号</span><strong>{{pickedApplication.applicationId}}</strong></div><div class="inspector-row"><span>联系人</span><strong>{{pickedApplication.contactName}}</strong></div><div class="inspector-row"><span>联系电话</span><strong>{{pickedApplication.contactPhone}}</strong></div><div class="inspector-row"><span>门店</span><strong>{{pickedApplication.storeName}}</strong></div><div class="inspector-row"><span>位置</span><strong>{{pickedApplication.location}}</strong></div><div v-if="pickedApplication.rejectionReason" class="inline-error">{{pickedApplication.rejectionReason}}</div><template v-if="pickedApplication.status==='SUBMITTED'"><label class="field-label">审核意见</label><textarea class="admin-input" v-model="reason" rows="3" maxlength="500" placeholder="拒绝时必须填写原因"></textarea><div class="form-buttons"><button class="outline-button" :disabled="preview||busy||!reason.trim()" @click="review(false)">驳回</button><button class="teal-button" :disabled="preview||busy" @click="review(true)">通过审核</button></div></template></aside></div></template>
 <template v-else-if="route==='/admin/merchants'"><section class="ops-card"><div class="ops-card-header"><h2>商户列表</h2><span>{{preview?merchants.length:pageInfo.total}} 家</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="搜索经营名称"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商户</th><th>品类</th><th>首个门店</th><th>自提位置</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="m in filtered" :key="m.merchantId"><td><strong>{{m.name}}</strong><small>{{m.merchantId}}</small></td><td>{{m.category}}</td><td>{{m.storeName}}</td><td>{{m.location}}</td><td><span class="status-tag" :class="m.status==='ACTIVE'?'published':'draft'">{{label(m.status)}}</span></td><td><button class="row-link" :disabled="preview||busy" @click="stateMerchant(m)">{{m.status==='ACTIVE'?'停用':'恢复'}}</button></td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/products'"><section class="ops-card"><div class="ops-card-header"><h2>商品监管</h2><span>{{preview?products.length:pageInfo.total}} 件</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="搜索商品 / 商户"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商品</th><th>商户</th><th>分类</th><th>售价</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="p in filtered" :key="p.productId"><td><div class="table-product-cell"><ProductImage :src="p.imageUrl" :alt="p.title"/><div><strong>{{p.title}}</strong><span>{{p.productId}}</span></div></div></td><td>{{merchantName(p.merchantId,p)}}</td><td>{{p.categoryCode}}</td><td>{{money(p.skus?.[0]?.priceCent)}}</td><td><span class="status-tag">{{label(p.status)}}</span></td><td><button class="row-link" :disabled="preview||busy||p.status!=='PUBLISHED'" @click="forceProduct(p)">强制下架</button></td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/orders'"><section class="ops-card"><div class="ops-card-header"><h2>订单监管</h2><span>{{preview?orders.length:pageInfo.total}} 笔</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="订单号"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>订单</th><th>商户</th><th>实付金额</th><th>状态</th><th>创建时间</th></tr></thead><tbody><tr v-for="o in filtered" :key="o.orderId"><td><strong>{{o.orderId}}</strong><small>{{o.items?.[0]?.title||'—'}}</small></td><td>{{merchantName(o.merchantId,o)}}</td><td>{{money(o.totalCent)}}</td><td><span class="status-tag">{{label(o.status)}}</span></td><td>{{dateTime(o.createdAt)}}</td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/disputes'"><section class="ops-card"><div class="ops-card-header"><h2>售后争议</h2><span>{{aftersales.length}} 条</span></div><div class="ops-list-line dispute-line" v-for="a in aftersales" :key="a.id"><span class="mini-icon"><Icon name="shield"/></span><div><strong>{{a.orderId}}</strong><small>{{a.reason}}</small></div><span class="status-tag">{{label(a.status)}}</span><button class="outline-button small" @click="selectedId=a.id;reason=''">查看处理</button></div><div v-if="!aftersales.length" class="admin-empty">暂无争议</div><div class="review-inline" v-if="selectedId&&aftersales.find(a=>a.id===selectedId)"><h3>裁决 · {{aftersales.find(a=>a.id===selectedId).orderId}}</h3><label class="field-label">裁决说明</label><textarea class="admin-input" v-model="reason" rows="3" maxlength="500" placeholder="审核说明（必填）"></textarea><div class="form-buttons"><button class="outline-button" :disabled="preview||busy||!reason.trim()" @click="decideRefund(aftersales.find(a=>a.id===selectedId),false)">驳回</button><button class="teal-button" :disabled="preview||busy||!reason.trim()" @click="decideRefund(aftersales.find(a=>a.id===selectedId),true)">批准退款</button></div></div></section></template>
 <template v-else-if="route==='/admin/categories'"><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>类目</h2><span>{{categories.length}} 个</span></div><div class="ops-list-line" v-for="c in categories" :key="c.code"><span class="mini-icon"><Icon name="grid"/></span><div><strong>{{c.name}}</strong><small>{{c.code}}</small></div><span class="status-tag" :class="c.active?'published':'draft'">{{c.active?'启用':'停用'}}</span><button class="row-link" @click="category={code:c.code,name:c.name,active:!c.active}" :disabled="preview">{{c.active?'停用':'恢复'}}</button></div></section><form class="ops-card ops-sideform" @submit.prevent="saveCategory"><h2>编辑分类</h2><label class="field-label">编码</label><input class="admin-input" v-model.trim="category.code" required maxlength="32"/><label class="field-label">名称</label><input class="admin-input" v-model.trim="category.name" required maxlength="50"/><label class="field-label">状态</label><select class="admin-input" v-model="category.active"><option :value="true">启用</option><option :value="false">停用</option></select><button type="submit" class="teal-button" :disabled="preview||busy">{{preview?'设计预览':'保存分类'}}</button></form></div></template>
 <div v-if="!preview&&route!=='/admin'&&route!=='/admin/categories'&&pageInfo.total>0" class="sdd-pager"><span>共 {{pageInfo.total}} 条</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext" @click="page++">下一页</button></div></BackofficeShell>`,
};
