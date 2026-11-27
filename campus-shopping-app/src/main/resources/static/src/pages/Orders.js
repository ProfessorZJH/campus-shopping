import UiPagination from '../components/UiPagination.vue';
import { requestScope } from '../services/request-scope.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import StatusPanel from '../components/StatusPanel.vue';
import QrCodeSvg from '../components/QrCodeSvg.vue';
import { api, query } from '../services/api.js';
import { store, go, money, preview, notify } from '../services/store.js';
import { DEMO_ORDERS } from '../services/pages-demo.js';
import {
  afterSaleStatusLabel,
  orderStatusLabel,
  orderEventLabel,
  paymentChannelLabel,
  pickupSlotLabel,
  formatPin,
  dateTime,
  pathId,
  safeDecodeId,
} from '../services/page-utils.js';
const { ref, computed, onMounted, onUnmounted, watch } = Vue;

const PAYMENT_CHANNELS = [
  { code: 'WECHAT_PAY', name: '微信支付', badge: '常用' },
  { code: 'ALIPAY', name: '支付宝', badge: '' },
  { code: 'CAMPUS_CARD', name: '校园一卡通', badge: '' },
];
const REFUND_QUICK_REASONS = ['临时有课无法取货', '拍错规格重拍', '商品与需求不符'];
const REVIEW_TAGS = ['出餐快', '分量足', '包装好', '性价比高', '还会回购'];

function formatCountdown(isoTime, nowMs) {
  if (!isoTime) return '';
  const target = Date.parse(isoTime);
  if (!Number.isFinite(target)) return '';
  const remainSec = Math.max(0, Math.floor((target - nowMs) / 1000));
  if (remainSec <= 0) return '00:00';
  const mins = Math.floor(remainSec / 60);
  const secs = remainSec % 60;
  return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

export default {
  name: 'Orders',
  components: { ConsumerShell, ProductImage, StatusPanel, UiPagination, QrCodeSvg },
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
      reason = ref(''),
      selectedChannel = ref('WECHAT_PAY'),
      nowMs = ref(Date.now()),
      reviewOpen = ref(false),
      reviewRating = ref(5),
      reviewTags = ref([]),
      reviewContent = ref('');
    let tickTimer = null;

    const id = computed(() => {
      const base = store.route.split('?')[0];
      return base.startsWith('/orders/') ? safeDecodeId(base.slice('/orders/'.length)) : null;
    });
    const filtered = computed(() =>
      orders.value.filter((o) => tab.value === 'ALL' || o.status === tab.value),
    );
    const refundPending = computed(
      () =>
        !!detail.value?.afterSale &&
        ['REQUESTED', 'DISPUTED', 'APPROVED'].includes(detail.value.afterSale.status),
    );
    const deadlineCountdown = computed(() =>
      detail.value?.status === 'PENDING_PAYMENT'
        ? formatCountdown(detail.value.deadline, nowMs.value)
        : '',
    );
    const tokenCountdown = computed(() =>
      token.value?.expiresAt ? formatCountdown(token.value.expiresAt, nowMs.value) : '',
    );
    const merchantName = (id, record) =>
      record?.merchantName || store.merchants.find((m) => m.merchantId === id)?.name || '校内门店';

    async function load() {
      const request = scope.begin();
      const target = id.value;
      loading.value = true;
      error.value = '';
      token.value = null;
      refundOpen.value = false;
      reviewOpen.value = false;
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

    onMounted(() => {
      load();
      tickTimer = setInterval(() => {
        nowMs.value = Date.now();
      }, 1000);
    });
    onUnmounted(() => {
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
    });
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

    async function payOrder() {
      await action('/pay' + query({ channel: selectedChannel.value }));
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

    function toggleReviewTag(tag) {
      if (reviewTags.value.includes(tag))
        reviewTags.value = reviewTags.value.filter((t) => t !== tag);
      else reviewTags.value = [...reviewTags.value, tag];
    }

    async function submitReview() {
      if (!reviewContent.value.trim()) {
        notify('请填写评价内容');
        return;
      }
      const current = scope.capture(),
        orderId = detail.value?.orderId;
      const result = await action('/reviews', 'POST', {
        rating: reviewRating.value,
        tags: reviewTags.value.join(','),
        content: reviewContent.value.trim(),
      });
      if (!result.ok || !current() || detail.value?.orderId !== orderId) return;
      reviewOpen.value = false;
      reviewContent.value = '';
      reviewTags.value = [];
      reviewRating.value = 5;
    }

    function statusClass(s) {
      return ['PAID', 'COMPLETED'].includes(s)
        ? 'ok'
        : ['CANCELED', 'REFUNDED'].includes(s)
          ? 'muted'
          : 'warn';
    }

    function cardActionText(o) {
      if (o.status === 'PENDING_PAYMENT') return '去付款';
      if (o.status === 'PAID' && o.pickup?.status === 'READY') return '看取件码';
      if (o.status === 'PAID') return '看进度';
      if (o.status === 'COMPLETED' && !o.reviewed) return '写评价';
      return '查看详情';
    }

    const allowToken = computed(
      () =>
        detail.value?.status === 'PAID' &&
        detail.value?.pickup?.status === 'READY' &&
        !['REQUESTED', 'DISPUTED', 'APPROVED'].includes(detail.value?.afterSale?.status),
    );

    async function copyToken() {
      const value = token.value?.pinCode || token.value?.token;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        notify('取件码已复制');
      } catch {
        notify('请手动复制取件码');
      }
    }

    async function copyOrderId(orderId) {
      if (!orderId) return;
      try {
        await navigator.clipboard.writeText(orderId);
        notify('订单号已复制');
      } catch {
        notify('请手动复制订单号');
      }
    }

    const progressStep = computed(() => {
      const o = detail.value;
      if (!o || o.status === 'CANCELED' || o.status === 'REFUNDED') return -1;
      if (o.status === 'PENDING_PAYMENT') return 0;
      if (o.status === 'COMPLETED') return 3;
      return o.pickup?.status === 'READY' ? 2 : 1;
    });

    const shortId = (raw) => (raw && raw.length > 12 ? raw.slice(0, 8).toUpperCase() : raw || '');

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
      PAYMENT_CHANNELS,
      REFUND_QUICK_REASONS,
      REVIEW_TAGS,
      selectedChannel,
      deadlineCountdown,
      tokenCountdown,
      reviewOpen,
      reviewRating,
      reviewTags,
      reviewContent,
      id,
      preview,
      go,
      money,
      afterSaleStatusLabel,
      orderStatusLabel,
      paymentChannelLabel,
      pickupSlotLabel,
      formatPin,
      dateTime,
      merchantName,
      action,
      payOrder,
      submitRefund,
      toggleReviewTag,
      submitReview,
      copyToken,
      copyOrderId,
      progressStep,
      shortId,
      statusClass,
      cardActionText,
      allowToken,
      refundPending,
      eventLabel: orderEventLabel,
      load,
    };
  },
  template: `<ConsumerShell active="orders">
    <div class="mobile-page-top">
      <button aria-label="返回" @click="go(id ? '/orders' : '/')"><Icon name="arrowLeft" /></button>
      <b>{{ id ? '订单详情' : '我的订单' }}</b>
      <button :disabled="busy || loading" aria-label="刷新" @click="load"><Icon name="refresh" /></button>
    </div>

    <div class="mall-orders-head desktop-only-head">
      <div class="mall-orders-title-left">
        <button v-if="id" type="button" class="back-pill-btn" @click="go('/orders')">
          <Icon name="arrowLeft" :size="15" /> 返回列表
        </button>
        <h1>{{ id ? '订单详情' : '我的订单' }}</h1>
      </div>
      <button type="button" class="outline-button small" :disabled="busy || loading" @click="load">
        <Icon name="refresh" :size="14" />刷新
      </button>
    </div>

    <StatusPanel v-if="loading" state="loading" message="正在加载订单…" />
    <StatusPanel v-else-if="error" state="error" :message="error" action-label="重新加载" :busy="loading" @retry="load" />

    <template v-else-if="!id">
      <div class="order-tabs tmall-order-tabs">
        <button
          v-for="t in [
            ['ALL', '全部'],
            ['PENDING_PAYMENT', '待付款'],
            ['PAID', '待取货'],
            ['COMPLETED', '已完成'],
            ['REFUNDED', '退款/售后'],
          ]"
          :key="t[0]"
          :class="{ active: tab === t[0] }"
          @click="page = 1; tab = t[0]"
        >
          {{ t[1] }}
        </button>
      </div>
      <StatusPanel v-if="!filtered.length" state="empty" :message="tab === 'ALL' ? '暂无订单' : '暂无符合状态的订单'" />
      <div v-else class="orders-grid">
        <button v-for="o in filtered" :key="o.orderId" class="consumer-order-card" @click="go('/orders/' + pathId(o.orderId))">
          <div class="order-card-head">
            <span class="order-store-title">
              <Icon name="store" :size="15" />{{ merchantName(o.merchantId, o) }}
              <Icon name="chevronRight" :size="13" />
            </span>
            <b :class="statusClass(o.status)">
              {{
                o.status === 'PAID' && o.pickup?.status === 'READY'
                  ? '待自提'
                  : o.status === 'PAID' && o.pickup?.status === 'PREPARING'
                    ? '备餐中'
                    : orderStatusLabel(o.status)
              }}
            </b>
          </div>
          <div v-if="o.pickup?.pickupCode || (o.pickupSlot && o.pickupSlot !== 'IMMEDIATE') || o.buyerRemark" class="order-ritual-badges">
            <span v-if="o.pickup?.pickupCode" class="pickup-queue-badge">取餐号 {{ o.pickup.pickupCode }}</span>
            <span v-if="o.pickupSlot && o.pickupSlot !== 'IMMEDIATE'" class="slot-chip">{{ o.pickupSlot }}</span>
            <span v-if="o.buyerRemark" class="remark-chip">{{ o.buyerRemark }}</span>
          </div>
          <div class="order-goods">
            <div class="order-item-placeholder">
              <ProductImage :src="o.items?.[0]?.imageUrl" :alt="o.items?.[0]?.title || '商品'" />
            </div>
            <div>
              <strong>
                {{ o.items?.[0]?.title || '校园订单' }}<template v-if="(o.items?.length || 0) > 1"> 等{{ o.items.length }}件</template>
              </strong>
              <small>共 {{ o.items?.length || 0 }} 种 · {{ dateTime(o.createdAt) }}</small>
            </div>
            <div class="order-price-col">
              <b>{{ money(o.totalCent) }}</b>
            </div>
          </div>
          <div class="order-card-foot">
            <span class="order-short-no">#{{ shortId(o.orderId) }}</span>
            <span class="order-cta-pill" :class="{ urgent: o.status === 'PENDING_PAYMENT' || (o.status === 'PAID' && o.pickup?.status === 'READY') }">
              {{ cardActionText(o) }}
            </span>
          </div>
        </button>
      </div>
      <UiPagination v-if="!preview && pageInfo.total > 0" :page="page" :has-next="pageInfo.hasNext" :busy="loading" @previous="page--" @next="page++">
        共 {{ pageInfo.total }} 单
      </UiPagination>
    </template>

    <template v-else-if="detail">
      <section class="pickup-hero" :class="{ complete: detail.status === 'COMPLETED', ready: detail.status === 'PAID' && detail.pickup?.status === 'READY' }">
        <div class="pickup-status-icon">
          <Icon :name="detail.status === 'COMPLETED' ? 'check' : detail.pickup?.status === 'READY' ? 'scan' : 'clock'" :size="24" />
        </div>
        <div class="pickup-hero-copy">
          <h1>
            {{
              detail.status === 'PAID' && refundPending
                ? '退款处理中'
                : detail.status === 'PAID' && detail.pickup?.status === 'READY'
                  ? '待自提'
                  : orderStatusLabel(detail.status)
            }}
          </h1>
          <p>
            {{
              detail.status === 'COMPLETED'
                ? '已取货完成，感谢惠顾'
                : detail.status === 'PAID' && refundPending
                  ? '正在处理退款申请，请留意下方进度'
                  : detail.status === 'PAID' && detail.pickup?.status === 'READY'
                    ? '商品已备好，请前往门店取货'
                    : detail.status === 'PAID'
                      ? '门店正在备货，备好后即可查看取件码'
                      : detail.status === 'PENDING_PAYMENT'
                        ? '请在倒计时内完成支付'
                        : '查看订单记录'
            }}
          </p>
        </div>
        <div v-if="detail.pickup?.pickupCode" class="hero-queue-ticket">
          <small>取餐号</small>
          <strong>{{ detail.pickup.pickupCode }}</strong>
        </div>
      </section>

      <div v-if="progressStep >= 0" class="order-stepper" aria-label="订单进度">
        <div
          v-for="(label, idx) in ['已下单', '备货中', '待取货', '已完成']"
          :key="label"
          class="order-step"
          :class="{ done: idx < progressStep, current: idx === progressStep }"
        >
          <span class="order-step-dot">{{ idx < progressStep ? '✓' : idx + 1 }}</span>
          <span>{{ label }}</span>
        </div>
      </div>

      <div class="order-detail-grid">
        <div class="order-detail-main">
          <section v-if="detail.status === 'PENDING_PAYMENT' && !preview" class="cashier-card" aria-label="选择付款方式">
            <div class="cashier-head">
              <h2>选择付款方式</h2>
              <div v-if="deadlineCountdown" class="cashier-timer">
                <Icon name="clock" :size="14" /><span>剩余 {{ deadlineCountdown }}</span>
              </div>
            </div>
            <div class="cashier-channels">
              <button
                v-for="ch in PAYMENT_CHANNELS"
                :key="ch.code"
                type="button"
                class="cashier-channel"
                :class="{ active: selectedChannel === ch.code }"
                :aria-pressed="selectedChannel === ch.code"
                @click="selectedChannel = ch.code"
              >
                <span class="channel-title-group">
                  <span class="channel-radio-dot" aria-hidden="true"><Icon name="check" :size="11" /></span>
                  <strong>{{ ch.name }}</strong>
                </span>
                <span v-if="ch.badge" class="channel-badge">{{ ch.badge }}</span>
              </button>
            </div>
            <div class="cashier-actions">
              <button type="button" class="teal-button cashier-pay-btn" aria-label="模拟支付" :disabled="busy || loading || !!error" @click="payOrder">
                立即付款 {{ money(detail.totalCent) }}
              </button>
              <button type="button" class="outline-button" :disabled="busy || loading || !!error" @click="action('/cancel')">取消订单</button>
            </div>
          </section>

          <section v-if="detail.status === 'PAID' && !refundPending" class="ops-card token-card luckin-ticket-wrap">
            <div class="ticket-section-head">
              <h2>取货凭证</h2>
              <span v-if="tokenCountdown" class="boarding-timer"><Icon name="clock" :size="13" /> 有效期 {{ tokenCountdown }}</span>
            </div>
            <div v-if="token" class="pickup-code boarding-pass luckin-stub pickup-ticket">
              <div class="luckin-stub-top">
                <div>
                  <span class="stub-eyebrow">取餐号 · PICKUP NO.</span>
                  <strong class="boarding-queue-code">{{ token.pickupCode || detail.pickup?.pickupCode || 'A-108' }}</strong>
                </div>
                <div v-if="token.pinCode" class="boarding-pin-block">
                  <span class="boarding-pin-label">6 位取件码</span>
                  <strong class="boarding-pin-value">{{ formatPin(token.pinCode) }}</strong>
                </div>
              </div>
              <div class="luckin-perforation" aria-hidden="true"></div>
              <div class="boarding-pass-body">
                <div class="boarding-qr-box"><QrCodeSvg :value="token.qrPayload || token.token" label="到店自提二维码" /></div>
                <div class="boarding-pin-col">
                  <p class="boarding-pass-tip">到店向店员出示二维码或报 6 位取件码即可取货</p>
                  <button type="button" class="outline-button small copy-token-btn" @click="copyToken">复制取件码</button>
                </div>
              </div>
              <code class="sr-only sr-token-code">{{ token.token }}</code>
            </div>
            <div v-else class="pickup-code placeholder-code">
              <Icon name="scan" :size="28" />
              <span>{{ detail.pickup?.status === 'READY' ? '商品已备好，点击下方按钮展示取件码' : '门店备货中，备好后可查看取件码' }}</span>
            </div>
            <button class="teal-button" :disabled="preview || busy || loading || !!error || !allowToken" @click="action('/pickup-token')">
              {{ token ? '刷新取件码' : '领取自提凭证' }}
            </button>
          </section>

          <section v-if="detail.status === 'PAID' && refundPending" class="ops-card token-card">
            <h2>退款处理中</h2>
            <p class="muted-short">当前订单正在处理退款，取货码已暂停使用。</p>
          </section>

          <section class="detail-card store-snap-card">
            <div class="order-card-head">
              <span class="order-store-title"><Icon name="store" :size="17" />{{ merchantName(detail.merchantId, detail) }}</span>
              <button type="button" class="text-go-shop" @click="go('/shops/' + pathId(detail.merchantId))">
                进店 <Icon name="chevronRight" :size="14" />
              </button>
            </div>
            <div class="pickup-location">
              <Icon name="pin" :size="16" />
              <span v-if="detail.pickupStoreName || detail.pickupLocation">
                {{ detail.pickupStoreName || '自提门店' }} · {{ detail.pickupLocation || '地点未记录' }}
              </span>
              <span v-else>历史自提地点未记录</span>
            </div>
            <small v-if="!detail.pickupStoreName && !detail.pickupLocation" class="muted-short">
              当前门店：{{ store.merchants.find((m) => m.merchantId === detail.merchantId)?.location || '未提供' }}（仅供参考，非下单时快照）
            </small>
            <div v-if="(detail.pickupSlot && detail.pickupSlot !== 'IMMEDIATE') || detail.buyerRemark" class="order-ritual-badges detail-rituals">
              <span v-if="detail.pickupSlot && detail.pickupSlot !== 'IMMEDIATE'" class="slot-chip">{{ detail.pickupSlot }}</span>
              <span v-if="detail.buyerRemark" class="remark-chip">备注：{{ detail.buyerRemark }}</span>
            </div>
          </section>

          <section class="detail-card">
            <h2 class="card-title-inline">商品明细 <span>共 {{ detail.items?.length || 0 }} 种</span></h2>
            <div v-for="i in detail.items" :key="i.skuId" class="order-detail-line">
              <div class="order-item-placeholder"><ProductImage :src="i.imageUrl" :alt="i.title" /></div>
              <div>
                <strong>{{ i.title }}</strong>
                <small>{{ i.specKey }} × {{ i.quantity }}</small>
              </div>
              <b>{{ money(Number(i.unitPriceCent) * Number(i.quantity)) }}</b>
            </div>
            <div class="price-row"><span>合计</span><b class="red-text">{{ money(detail.totalCent) }}</b></div>
          </section>

          <section v-if="!preview && (detail.status === 'PAID' || detail.status === 'COMPLETED')" class="order-actions">
            <button v-if="detail.status === 'PAID' && !detail.afterSale" class="outline-button" :disabled="busy || loading || !!error" @click="refundOpen = !refundOpen">
              申请退款
            </button>
            <button v-if="detail.status === 'PAID' && detail.afterSale?.status === 'REJECTED'" class="outline-button" :disabled="busy || loading || !!error" @click="action('/appeal')">
              申请平台介入
            </button>
            <button v-if="detail.status === 'COMPLETED' && !detail.reviewed" class="teal-button" :disabled="busy || loading || !!error" @click="reviewOpen = !reviewOpen">
              <Icon name="star" :size="15" />写评价
            </button>
            <span v-if="detail.status === 'COMPLETED' && detail.reviewed" class="reviewed-done-pill">
              <Icon name="check" :size="14" /> 已评价
            </span>
          </section>

          <form v-if="refundOpen && !preview" class="detail-card" @submit.prevent="submitRefund">
            <label class="field-label" for="orders-field-1">退款原因</label>
            <div class="quick-chip-row">
              <button v-for="chip in REFUND_QUICK_REASONS" :key="chip" type="button" class="quick-chip" @click="reason = chip">{{ chip }}</button>
            </div>
            <textarea id="orders-field-1" v-model="reason" class="admin-input" maxlength="500" rows="3" required placeholder="请选择或填写退款原因"></textarea>
            <button type="submit" class="teal-button" :disabled="busy || loading || !!error">提交退款申请</button>
          </form>

          <form v-if="reviewOpen && detail.status === 'COMPLETED' && !detail.reviewed && !preview" class="detail-card review-card" @submit.prevent="submitReview">
            <h3 class="card-title-inline">写评价</h3>
            <div class="review-stars" role="radiogroup" aria-label="商品评分">
              <button
                v-for="n in 5"
                :key="n"
                type="button"
                class="star-btn"
                :class="{ active: n <= reviewRating }"
                :aria-label="n + '星'"
                :aria-pressed="n <= reviewRating"
                @click="reviewRating = n"
              >
                ★
              </button>
              <span>{{ reviewRating }}.0 分</span>
            </div>
            <div class="quick-chip-row">
              <button
                v-for="tag in REVIEW_TAGS"
                :key="tag"
                type="button"
                class="quick-chip"
                :class="{ active: reviewTags.includes(tag) }"
                @click="toggleReviewTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
            <label class="field-label" for="orders-review-content">评价内容</label>
            <textarea id="orders-review-content" v-model="reviewContent" class="admin-input" maxlength="500" rows="3" required placeholder="说说你的体验吧"></textarea>
            <button type="submit" class="teal-button" :disabled="busy || loading || !!error">发布评价</button>
          </form>
        </div>

        <div class="order-detail-side">
          <section class="detail-card order-metadata">
            <h2 class="card-title-inline">订单信息</h2>
            <div>
              <span>订单号</span>
              <strong class="mono-id-row">
                <em class="mono-id-trunc" :title="detail.orderId">{{ detail.orderId }}</em>
                <button type="button" class="copy-inline-btn" @click="copyOrderId(detail.orderId)">复制</button>
              </strong>
            </div>
            <div v-if="detail.pickup?.pickupCode"><span>取餐号</span><strong>{{ detail.pickup.pickupCode }}</strong></div>
            <div v-if="detail.pickupSlot"><span>取货时间</span><strong>{{ pickupSlotLabel(detail.pickupSlot) }}</strong></div>
            <div v-if="detail.buyerRemark"><span>备注</span><strong>{{ detail.buyerRemark }}</strong></div>
            <div v-if="detail.paymentChannel"><span>支付方式</span><strong>{{ paymentChannelLabel(detail.paymentChannel) }}</strong></div>
            <div><span>下单时间</span><strong>{{ dateTime(detail.createdAt) }}</strong></div>
            <div v-if="detail.status === 'PENDING_PAYMENT'"><span>付款截止</span><strong>{{ dateTime(detail.deadline) }}</strong></div>
            <div v-if="detail.afterSale"><span>售后进度</span><strong>{{ afterSaleStatusLabel(detail.afterSale.status) }}</strong></div>
          </section>

          <section class="detail-card order-timeline">
            <h2 class="card-title-inline">订单进度</h2>
            <ol v-if="detail.events?.length">
              <li v-for="(e, i) in detail.events" :key="e.eventId || i">
                <span class="timeline-dot"></span>
                <div>
                  <strong>{{ eventLabel(e.type) }}</strong>
                  <small>{{ dateTime(e.occurredAt) }}<template v-if="e.reason"> · {{ e.reason }}</template></small>
                </div>
              </li>
            </ol>
            <p v-else class="muted-short">历史进度未记录</p>
          </section>
        </div>
      </div>
    </template>
    <StatusPanel v-else state="empty" message="未找到订单" />
  </ConsumerShell>`,
};
