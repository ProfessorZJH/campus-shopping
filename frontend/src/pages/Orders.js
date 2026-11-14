import UiPagination from '../components/UiPagination.vue';
import { requestScope } from '../services/request-scope.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import StatusPanel from '../components/StatusPanel.vue';
import { api, query } from '../services/api.js';
import { store, go, money, preview, notify } from '../services/store.js';
import { DEMO_ORDERS } from '../services/pages-demo.js';
import {
  afterSaleStatusLabel,
  orderStatusLabel,
  orderEventLabel,
  dateTime,
  pathId,
  safeDecodeId,
} from '../services/page-utils.js';
const { ref, computed, onMounted, watch } = Vue;
export default {
  name: 'Orders',
  components: { ConsumerShell, ProductImage, StatusPanel, UiPagination },
  setup() {
    const scope = requestScope();
    const orders = ref([]),
      detail = ref(null),
      token = ref(null),
      error = ref(''),
      busy = ref(false),
      loading = ref(true),
      tab = ref('ALL'),
      page = ref(1),
      pageInfo = ref({ total: 0, hasNext: false }),
      refundOpen = ref(false),
      reason = ref('');
    const id = computed(() =>
      store.route.startsWith('/orders/')
        ? safeDecodeId(store.route.slice('/orders/'.length))
        : null,
    );
    const filtered = computed(() =>
      orders.value.filter((o) => tab.value === 'ALL' || o.status === tab.value),
    );
    const refundPending = computed(
      () =>
        !!detail.value?.afterSale &&
        ['REQUESTED', 'DISPUTED', 'APPROVED'].includes(detail.value.afterSale.status),
    );
    const merchantName = (id, record) =>
      record?.merchantName || store.merchants.find((m) => m.merchantId === id)?.name || '校内商户';
    async function load() {
      const request = scope.begin();
      const target = id.value;
      loading.value = true;
      error.value = '';
      token.value = null;
      refundOpen.value = false;
      if (preview) {
        orders.value = DEMO_ORDERS.map((x) => ({ ...x }));
        pageInfo.value = { total: orders.value.length, hasNext: false };
        detail.value = id.value ? orders.value.find((o) => o.orderId === id.value) || null : null;
        loading.value = false;
        return true;
      }
      try {
        if (store.route.startsWith('/orders/') && !target) throw Error('无效订单地址');
        if (id.value) {
          const result = await api('/orders/' + pathId(target), { signal: request.signal });
          if (!request.current()) return false;
          detail.value = result;
        } else {
          detail.value = null;
          const result = await api(
            '/orders/page' +
              query({ page: page.value, size: 10, state: tab.value === 'ALL' ? '' : tab.value }),
            { signal: request.signal },
          );
          if (!request.current()) return false;
          orders.value = result.items || [];
          pageInfo.value = result;
        }
        return true;
      } catch (e) {
        if (request.current()) error.value = e.message;
        return false;
      } finally {
        if (request.current()) loading.value = false;
      }
    }
    onMounted(load);
    watch([page, tab], () => {
      if (!id.value) load();
    });
    async function action(endpoint, method = 'POST', body) {
      if (preview || busy.value || loading.value || !!error.value || !detail.value)
        return { ok: false };
      const current = scope.capture(),
        orderId = detail.value.orderId;
      busy.value = true;
      try {
        const result = await api('/orders/' + pathId(orderId) + endpoint, {
          method,
          body,
        });
        if (!current() || detail.value?.orderId !== orderId) return { ok: false };
        if (endpoint === '/pickup-token') {
          token.value = result;
          return { ok: true, refreshed: true };
        }
        notify('操作成功');
        const refreshed = await load();
        if (!current() || detail.value?.orderId !== orderId) return { ok: true, refreshed: false };
        if (!refreshed) notify('操作成功，但页面刷新失败，请稍后手动刷新');
        return { ok: true, refreshed };
      } catch (e) {
        if (current()) notify(e.message);
        return { ok: false };
      } finally {
        if (current()) busy.value = false;
      }
    }
    async function submitRefund() {
      if (!reason.value.trim()) {
        notify('请输入退款原因');
        return;
      }
      const current = scope.capture(),
        orderId = detail.value?.orderId;
      const result = await action('/refunds', 'POST', { reason: reason.value.trim() });
      if (!result.ok || !current() || detail.value?.orderId !== orderId) return;
      refundOpen.value = false;
      reason.value = '';
    }
    function statusClass(s) {
      return ['PAID', 'COMPLETED'].includes(s)
        ? 'ok'
        : ['CANCELED', 'REFUNDED'].includes(s)
          ? 'muted'
          : 'warn';
    }
    const allowToken = computed(
      () =>
        detail.value?.status === 'PAID' &&
        detail.value?.pickup?.status === 'READY' &&
        !['REQUESTED', 'DISPUTED', 'APPROVED'].includes(detail.value?.afterSale?.status),
    );
    return {
      store,
      orders,
      loading,
      pathId,
      detail,
      filtered,
      token,
      error,
      busy,
      tab,
      page,
      pageInfo,
      refundOpen,
      reason,
      id,
      preview,
      go,
      money,
      afterSaleStatusLabel,
      orderStatusLabel,
      dateTime,
      merchantName,
      action,
      submitRefund,
      statusClass,
      allowToken,
      refundPending,
      eventLabel: orderEventLabel,
      load,
    };
  },
  template: `<ConsumerShell active="orders"><div class="mobile-page-top"><button @click="go(id?'/orders':'/')" aria-label="返回"><Icon name="arrowLeft"/></button><b>{{id?'订单详情':'我的订单'}}</b><button :disabled="busy||loading" @click="load" aria-label="刷新"><Icon name="refresh"/></button></div><StatusPanel v-if="loading" state="loading" message="正在加载订单…"/><StatusPanel v-else-if="error" state="error" :message="error" action-label="重新加载" :busy="loading" @retry="load"/>
 <template v-else-if="!id"><div class="order-tabs"><button v-for="t in [['ALL','全部'],['PENDING_PAYMENT','待付款'],['PAID','待自提'],['COMPLETED','已完成']]" :class="{active:tab===t[0]}" :key="t[0]" @click="page=1;tab=t[0]">{{t[1]}}</button></div><StatusPanel v-if="!filtered.length" state="empty" message="暂无订单"/><button class="consumer-order-card" v-for="o in filtered" :key="o.orderId" @click="go('/orders/'+pathId(o.orderId))"><div class="order-card-head"><span><Icon name="store" :size="17"/>{{merchantName(o.merchantId,o)}}</span><b :class="statusClass(o.status)">{{orderStatusLabel(o.status)}}</b></div><div class="order-goods"><div class="order-item-placeholder"><ProductImage :src="o.items?.[0]?.imageUrl" :alt="o.items?.[0]?.title||'商品'"/></div><div><strong>{{o.items?.[0]?.title||'校园订单'}}</strong><small>{{o.items?.length||0}} 种商品 · {{dateTime(o.createdAt)}}</small></div><b>{{money(o.totalCent)}}</b></div><div class="order-card-foot">#{{o.orderId}} <span>查看详情 <Icon name="chevronRight" :size="14"/></span></div></button><UiPagination v-if="!preview&&pageInfo.total>0" :page="page" :has-next="pageInfo.hasNext" :busy="loading" @previous="page--" @next="page++">共 {{pageInfo.total}} 单</UiPagination></template>
 <template v-else-if="detail"><section class="pickup-hero" :class="{complete:detail.status==='COMPLETED'}"><div class="pickup-status-icon"><Icon :name="detail.status==='COMPLETED'?'check':'clock'" :size="28"/></div><div><h1>{{detail.pickup?.status==='READY'?'待自提':orderStatusLabel(detail.status)}}</h1><p>{{detail.status==='COMPLETED'?'感谢购买':detail.status==='PAID'?'校内门店自提':detail.status==='PENDING_PAYMENT'?'请在付款截止前完成模拟支付':'查看订单记录'}}</p></div></section>
 <section class="detail-card"><div class="order-card-head"><span><Icon name="store" :size="18"/>{{merchantName(detail.merchantId,detail)}}</span><Icon name="chevronRight" :size="17"/></div><div class="pickup-location"><Icon name="pin" :size="19"/><span v-if="detail.pickupStoreName||detail.pickupLocation">{{detail.pickupStoreName||'自提门店'}} · {{detail.pickupLocation||'地点未记录'}}</span><span v-else>历史自提地点未记录</span></div><small v-if="!detail.pickupStoreName&&!detail.pickupLocation" class="muted-short">当前门店：{{store.merchants.find(m=>m.merchantId===detail.merchantId)?.location||'未提供'}}（仅供参考，非下单时快照）</small></section>
 <section class="detail-card token-card" v-if="detail.status==='PAID'&&!refundPending"><h2>自提凭证</h2><div class="pickup-code" v-if="token"><Icon name="shield" :size="25"/><code>{{token.token}}</code><small>有效期至 {{dateTime(token.expiresAt)}}，再次签发旧凭证失效</small></div><div v-else class="pickup-code placeholder-code"><Icon name="scan" :size="30"/><span>{{detail.pickup?.status==='READY'?'可领取自提令牌':'等待商户备货完成'}}</span></div><button class="teal-button" :disabled="preview||busy||loading||!!error||!allowToken" @click="action('/pickup-token')">{{token?'重新签发自提凭证':'领取自提凭证'}}</button></section>
 <section v-if="detail.status==='PAID'&&refundPending" class="detail-card token-card"><h2>退款处理中</h2><p class="muted-short">自提凭证暂停使用，请以退款进度为准。</p></section>
 <section class="detail-card"><h2 class="card-title-inline">商品清单 <span>{{detail.items?.length||0}} 种</span></h2><div class="order-detail-line" v-for="i in detail.items" :key="i.skuId"><div class="order-item-placeholder"><ProductImage :src="i.imageUrl" :alt="i.title"/></div><div><strong>{{i.title}}</strong><small>{{i.specKey}} × {{i.quantity}}</small></div><b>{{money(Number(i.unitPriceCent)*Number(i.quantity))}}</b></div><div class="price-row"><span>实付 / 应付</span><b>{{money(detail.totalCent)}}</b></div></section>
 <section class="detail-card order-metadata"><div><span>订单编号</span><strong>{{detail.orderId}}</strong></div><div><span>下单时间</span><strong>{{dateTime(detail.createdAt)}}</strong></div><div v-if="detail.status==='PENDING_PAYMENT'"><span>付款截止</span><strong>{{dateTime(detail.deadline)}}</strong></div><div v-if="detail.afterSale"><span>售后状态</span><strong>{{afterSaleStatusLabel(detail.afterSale.status)}}</strong></div></section>
 <section class="detail-card order-timeline"><h2 class="card-title-inline">订单进度</h2><ol v-if="detail.events?.length"><li v-for="(e,i) in detail.events" :key="e.eventId||i"><span class="timeline-dot"></span><div><strong>{{eventLabel(e.type)}}</strong><small>{{dateTime(e.occurredAt)}}<template v-if="e.reason"> · {{e.reason}}</template></small></div></li></ol><p v-else class="muted-short">历史进度未记录</p></section>
 <section v-if="!preview" class="order-actions"><button v-if="detail.status==='PENDING_PAYMENT'" class="teal-button" :disabled="busy||loading||!!error" @click="action('/pay')">模拟支付</button><button v-if="detail.status==='PENDING_PAYMENT'" class="outline-button" :disabled="busy||loading||!!error" @click="action('/cancel')">取消订单</button><button v-if="detail.status==='PAID'&&!detail.afterSale" class="outline-button" :disabled="busy||loading||!!error" @click="refundOpen=!refundOpen">申请退款</button><button v-if="detail.status==='PAID'&&detail.afterSale?.status==='REJECTED'" class="outline-button" :disabled="busy||loading||!!error" @click="action('/appeal')">申请平台介入</button></section><form v-if="refundOpen&&!preview" class="detail-card" @submit.prevent="submitRefund"><label class="field-label" for="orders-field-1">退款原因</label><textarea id="orders-field-1" class="admin-input" v-model="reason" maxlength="500" rows="3" required></textarea><button type="submit" class="teal-button" :disabled="busy||loading||!!error">提交退款申请</button></form></template><StatusPanel v-else state="empty" message="未找到订单"/></ConsumerShell>`,
};
