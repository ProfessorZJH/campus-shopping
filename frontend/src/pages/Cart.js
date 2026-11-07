import { requestScope } from '../services/request-scope.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import StatusPanel from '../components/StatusPanel.vue';
import { api, idempotency } from '../services/api.js';
import { store, go, money, preview, notify } from '../services/store.js';
import { DEMO_CART } from '../services/pages-demo.js';
import { pathId, positiveInt } from '../services/page-utils.js';
const { ref, computed, onMounted } = Vue;
export default {
  name: 'Cart',
  components: { ConsumerShell, ProductImage, StatusPanel },
  setup() {
    const scope = requestScope();
    const items = ref([]),
      merchantId = ref(''),
      busy = ref(false),
      loading = ref(true),
      error = ref(''),
      orderKey = ref(''),
      fingerprint = ref(''),
      confirmOpen = ref(false),
      confirmLoading = ref(false),
      confirmError = ref(''),
      confirmRetryable = ref(false),
      confirmItems = ref([]),
      confirmMerchant = ref({}),
      confirmTotal = ref(0);
    let confirmVersion = 0;
    const groups = computed(() =>
      Object.entries(
        Object.groupBy
          ? Object.groupBy(items.value, (i) => i.merchantId)
          : items.value.reduce((a, i) => {
              (a[i.merchantId] ??= []).push(i);
              return a;
            }, {}),
      ).map(([id, rows]) => ({
        id,
        rows,
        total: rows.reduce((s, i) => s + Number(i.priceCent) * Number(i.quantity), 0),
      })),
    );
    const selected = computed(() => items.value.filter((i) => i.merchantId === merchantId.value));
    const total = computed(() =>
      selected.value.reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity), 0),
    );
    const merchantName = (id) =>
      items.value.find((i) => i.merchantId === id)?.merchantName ||
      store.merchants.find((m) => m.merchantId === id)?.name ||
      '校内商户';
    async function load() {
      const request = scope.begin();
      loading.value = true;
      error.value = '';
      if (preview) {
        items.value = DEMO_CART.map((i) => ({ ...i }));
      } else {
        try {
          const result = await api('/cart', { signal: request.signal });
          if (!request.current()) return;
          items.value = result || [];
        } catch (e) {
          if (!request.current()) return;
          error.value = e.message;
          items.value = [];
        }
      }
      if (!request.current()) return;
      loading.value = false;
      if (!items.value.some((i) => i.merchantId === merchantId.value))
        merchantId.value = items.value[0]?.merchantId || '';
    }
    onMounted(load);
    async function quantity(i, d) {
      if (preview || busy.value || loading.value) return;
      const current = scope.capture();
      const n = Number(i.quantity) + d;
      if (n > 99 || n < 0 || (d > 0 && (!i.sellable || n > i.available))) return;
      busy.value = true;
      try {
        if (n) await api('/cart', { method: 'PUT', body: { skuId: i.skuId, quantity: n } });
        else await api('/cart/' + pathId(i.skuId), { method: 'DELETE' });
        if (!current()) return;
        orderKey.value = '';
        fingerprint.value = '';
        await load();
      } catch (e) {
        if (current()) notify(e.message);
      } finally {
        if (current()) busy.value = false;
      }
    }
    function checkout() {
      if (preview || busy.value || loading.value || !selected.value.length) return;
      if (selected.value.length > 20) {
        notify('每笔订单最多支持20个SKU行，请减少商品规格后结算');
        return;
      }
      if (selected.value.some((i) => !i.sellable || i.available < i.quantity)) {
        notify('请先调整失效或库存不足的商品');
        return;
      }
      confirmOpen.value = true;
      loadConfirmation();
    }
    /** 确认页必须重新读取购物车与门店；旧页面数据不能作为已核实结果提交。 */
    async function loadConfirmation() {
      const stamp = ++confirmVersion,
        merchant = merchantId.value;
      confirmLoading.value = true;
      confirmError.value = '';
      confirmRetryable.value = false;
      confirmItems.value = [];
      confirmTotal.value = 0;
      try {
        const [cart, shop] = await Promise.all([
          api('/cart'),
          api('/merchants/public/' + pathId(merchant)),
        ]);
        if (stamp !== confirmVersion) return;
        const rows = (cart || []).filter((i) => i.merchantId === merchant);
        confirmMerchant.value = shop || {};
        confirmItems.value = rows;
        confirmTotal.value = rows.reduce(
          (sum, i) => sum + Number(i.priceCent) * Number(i.quantity),
          0,
        );
        if (!rows.length) confirmError.value = '购物车中已没有该商户的商品，请返回调整';
        else if (rows.some((i) => !i.sellable || i.available < i.quantity))
          confirmError.value = '部分商品库存不足或已失效，请返回调整后重新确认';
      } catch (e) {
        if (stamp === confirmVersion) confirmError.value = e.message;
      } finally {
        if (stamp === confirmVersion) confirmLoading.value = false;
      }
    }
    function closeConfirm() {
      if (busy.value) return;
      ++confirmVersion;
      confirmOpen.value = false;
      confirmLoading.value = false;
      confirmError.value = '';
      confirmRetryable.value = false;
      confirmItems.value = [];
      confirmMerchant.value = {};
      confirmTotal.value = 0;
    }
    async function confirmCheckout() {
      if (preview || busy.value || confirmLoading.value || confirmError.value) return;
      if (!confirmItems.value.length || confirmItems.value.length > 20) return;
      if (
        confirmItems.value.some(
          (i) => !i.sellable || !positiveInt(i.quantity, 99) || i.quantity > i.available,
        )
      ) {
        confirmError.value = '部分商品库存不足或已失效，请刷新确认信息';
        return;
      }
      const body = {
        merchantId: merchantId.value,
        items: confirmItems.value.map((i) => ({
          skuId: i.skuId,
          quantity: Number(i.quantity),
          expectedPriceCent: Number(i.priceCent),
          expectedVersion: Number(i.quoteVersion),
        })),
      };
      const next = JSON.stringify(body);
      // 同一内容的结果未知重试沿用原幂等键；内容变化后必须重新确认并使用新键。
      if (!orderKey.value || fingerprint.value !== next) {
        orderKey.value = idempotency();
        fingerprint.value = next;
      }
      const current = scope.capture();
      busy.value = true;
      confirmRetryable.value = false;
      try {
        const created = await api('/orders', { method: 'POST', body, key: orderKey.value });
        if (!current()) return;
        orderKey.value = '';
        fingerprint.value = '';
        confirmRetryable.value = false;
        confirmOpen.value = false;
        notify('订单已创建');
        go('/orders/' + pathId(created.orderId));
      } catch (e) {
        if (current()) {
          // 网络/响应丢失或 5xx 时服务端可能已提交；保留同一 body 和幂等键供直接重试。
          const indeterminate =
            ['NETWORK', 'TIMEOUT', 'RESPONSE'].includes(e.code) || Number(e.status) >= 500;
          confirmRetryable.value = indeterminate;
          confirmError.value = indeterminate ? '' : e.message;
          if (indeterminate) notify('提交结果未知，可直接重试；同一内容不会重复下单');
        }
      } finally {
        if (current()) busy.value = false;
      }
    }
    return {
      items,
      loading,
      merchantId,
      busy,
      error,
      groups,
      selected,
      total,
      preview,
      go,
      money,
      merchantName,
      quantity,
      remove: (i) => quantity(i, -Number(i.quantity)),
      orderKey,
      confirmOpen,
      confirmLoading,
      confirmRetryable,
      confirmError,
      confirmItems,
      confirmMerchant,
      confirmTotal,
      loadConfirmation,
      closeConfirm,
      confirmCheckout,
      checkout,
      load,
    };
  },
  template: `<ConsumerShell active="cart"><div class="mobile-page-top"><button @click="go('/')" aria-label="返回"><Icon name="arrowLeft"/></button><b>购物车</b><button :disabled="busy||loading" @click="load" aria-label="刷新"><Icon name="refresh"/></button></div><div v-if="loading" role="status" class="inline-loading">正在加载购物车…</div><div v-if="error" class="inline-error">{{error}}</div><div v-if="!loading&&!items.length&&!error" class="mobile-empty"><Icon name="cart" :size="36"/><strong>购物车空空的</strong><button class="teal-button" @click="go('/')">去逛逛</button></div><template v-for="g in groups" :key="g.id"><section class="cart-store" :class="{selected:merchantId===g.id}"><button class="cart-store-head" :disabled="busy||loading" :aria-pressed="merchantId===g.id" @click="merchantId=g.id"><span class="radio-circle" :class="{active:merchantId===g.id}"><Icon name="check" :size="12"/></span><Icon name="store"/><strong>{{merchantName(g.id)}}</strong><span class="cart-store-total">{{money(g.total)}}</span></button><div class="cart-line" v-for="i in g.rows" :key="i.skuId"><ProductImage :src="i.imageUrl" :alt="i.title"/><div class="cart-line-info"><strong>{{i.title}}</strong><button :disabled="busy||preview" :aria-label="'移除'+i.title" @click="remove(i)">移除</button><small>{{i.specKey}} <span v-if="!i.sellable||i.available<i.quantity" class="red-text">库存不足/失效</span></small><div class="cart-line-bottom"><b>{{money(i.priceCent)}}</b><div class="mini-qty"><button :disabled="busy||preview" :aria-label="'减少'+i.title" @click="quantity(i,-1)"><Icon name="minus" :size="15"/></button><span>{{i.quantity}}</span><button :disabled="busy||preview||!i.sellable||i.quantity>=99||i.quantity>=i.available" :aria-label="'增加'+i.title" @click="quantity(i,1)"><Icon name="plus" :size="15"/></button></div></div></div></div></section></template><div v-if="groups.length>1" class="mobile-hint">一次结算一家商户，请选择要下单的店铺。</div><div v-if="items.length" class="mobile-summary"><div>商品金额 <strong>{{money(total)}}</strong></div><div>自提方式 <strong>校内门店自提</strong></div><div class="mobile-summary-total">应付 <b>{{money(total)}}</b></div></div><div v-if="items.length" class="mobile-checkout-bar"><div><small>本单合计</small><b>{{money(total)}}</b></div><button class="teal-button" :disabled="preview||busy||loading||!selected.length" @click="checkout">{{busy?'提交中':'提交订单'}}</button></div>
  <div v-if="confirmOpen" v-modal="closeConfirm" class="ui-overlay" @click.self="closeConfirm"><section class="product-sheet checkout-confirm" role="dialog" aria-modal="true" aria-label="确认订单"><button class="sheet-close" @click="closeConfirm" aria-label="关闭"><Icon name="x" :size="19"/></button><h3>确认订单</h3><p class="checkout-note">模拟支付：提交后生成待付款订单，不会发生真实扣款。</p><StatusPanel v-if="confirmLoading" state="loading" message="正在核对最新购物车与门店信息…"/><template v-else-if="confirmError&&!confirmItems.length"><StatusPanel state="error" :message="confirmError" action-label="重新加载" :busy="confirmLoading" @retry="loadConfirmation"/><button class="outline-button checkout-back" @click="closeConfirm">返回调整</button></template><template v-else><section class="checkout-shop"><strong>{{confirmMerchant.name||'校内商户'}}</strong><span>{{confirmMerchant.storeName||'门店'}} · {{confirmMerchant.location||'地点未填写'}}</span></section><div class="checkout-lines"><div v-for="i in confirmItems" :key="i.skuId" class="checkout-line"><div><strong>{{i.title}}</strong><small>{{i.specKey}} × {{i.quantity}} · {{money(i.priceCent)}}/件</small></div><b>{{money(Number(i.priceCent)*Number(i.quantity))}}</b></div></div><div class="checkout-total"><span>应付合计</span><b>{{money(confirmTotal)}}</b></div><div v-if="confirmRetryable" class="mobile-hint" role="status">提交结果未知，可直接重试；同一内容不会重复下单。</div><div v-if="confirmError" class="inline-error" role="alert">{{confirmError}} <button @click="loadConfirmation">刷新确认信息</button></div><div class="checkout-actions"><button class="outline-button" @click="closeConfirm" :disabled="busy">返回调整</button><button class="teal-button" :disabled="busy||confirmLoading||!!confirmError" @click="confirmCheckout">{{busy?'提交中…':'确认下单（模拟支付）'}}</button></div></template></section></div></ConsumerShell>`,
};
