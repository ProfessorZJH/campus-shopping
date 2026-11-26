import { requestScope } from '../services/request-scope.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import StatusPanel from '../components/StatusPanel.vue';
import { api, idempotency } from '../services/api.js';
import { store, go, money, preview, notify } from '../services/store.js';
import { DEMO_CART } from '../services/pages-demo.js';
import { pathId, positiveInt } from '../services/page-utils.js';
const { ref, computed, onMounted } = Vue;
const PICKUP_SLOTS = [
  { value: 'IMMEDIATE', label: '立即备餐（约8分钟）' },
  { value: '10:00-10:20 大课间', label: '10:00-10:20 大课间' },
  { value: '12:00-12:30 午休自提', label: '12:00-12:30 午休自提' },
  { value: '18:00-18:30 晚课前', label: '18:00-18:30 晚课前' },
  { value: '21:30-22:15 夜宵时段', label: '21:30-22:15 夜宵时段' },
];
const REMARK_CHIPS = ['少冰', '去冰', '三分糖', '需要吸管/餐具', '放自提架'];
export default {
  name: 'Cart',
  components: { ConsumerShell, ProductImage, StatusPanel },
  setup() {
    const scope = requestScope();
    const items = ref([]),
      merchantId = ref(''),
      checkedSkus = ref([]),
      pickupSlot = ref('IMMEDIATE'),
      buyerRemark = ref(''),
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
        total: rows
          .filter((i) => id !== merchantId.value || checkedSkus.value.includes(i.skuId))
          .reduce((s, i) => s + Number(i.priceCent) * Number(i.quantity), 0),
      })),
    );
    const selected = computed(() =>
      items.value.filter(
        (i) => i.merchantId === merchantId.value && checkedSkus.value.includes(i.skuId),
      ),
    );
    const selectedQty = computed(() =>
      selected.value.reduce((n, i) => n + Number(i.quantity || 0), 0),
    );
    const total = computed(() =>
      selected.value.reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity), 0),
    );
    const merchantName = (id) =>
      items.value.find((i) => i.merchantId === id)?.merchantName ||
      store.merchants.find((m) => m.merchantId === id)?.name ||
      '校内商户';
    function selectStore(id) {
      merchantId.value = id;
      const storeSkus = items.value.filter((i) => i.merchantId === id).map((i) => i.skuId);
      if (!storeSkus.some((skuId) => checkedSkus.value.includes(skuId))) {
        checkedSkus.value = [...new Set([...checkedSkus.value, ...storeSkus])];
      }
    }
    function toggleSku(item) {
      if (item.merchantId !== merchantId.value) {
        merchantId.value = item.merchantId;
      }
      if (checkedSkus.value.includes(item.skuId)) {
        checkedSkus.value = checkedSkus.value.filter((id) => id !== item.skuId);
      } else {
        checkedSkus.value = [...checkedSkus.value, item.skuId];
      }
    }
    function appendRemark(chip) {
      const current = buyerRemark.value.trim();
      if (current.includes(chip)) return;
      const next = current ? current + '，' + chip : chip;
      if (next.length <= 200) buyerRemark.value = next;
    }
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
      store.cartCount = items.value.reduce((n, i) => n + Number(i.quantity || 0), 0);
      if (!items.value.some((i) => i.merchantId === merchantId.value))
        merchantId.value = items.value[0]?.merchantId || '';
      const validIds = new Set(items.value.map((i) => i.skuId));
      const kept = checkedSkus.value.filter((id) => validIds.has(id));
      const activeStoreSkus = items.value
        .filter((i) => i.merchantId === merchantId.value)
        .map((i) => i.skuId);
      checkedSkus.value = kept.some((id) => activeStoreSkus.includes(id))
        ? [...new Set([...kept, ...activeStoreSkus.filter((id) => !kept.includes(id))])]
        : [...activeStoreSkus];
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
        merchant = merchantId.value,
        chosenSet = new Set(checkedSkus.value);
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
        const rows = (cart || []).filter(
          (i) => i.merchantId === merchant && (chosenSet.size === 0 || chosenSet.has(i.skuId)),
        );
        confirmMerchant.value = shop || {};
        confirmItems.value = rows;
        confirmTotal.value = rows.reduce(
          (sum, i) => sum + Number(i.priceCent) * Number(i.quantity),
          0,
        );
        if (!rows.length) confirmError.value = '购物车中已没有该商户的已选商品，请返回调整';
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
        buyerRemark: buyerRemark.value.trim(),
        pickupSlot: pickupSlot.value || 'IMMEDIATE',
        items: confirmItems.value.map((i) => ({
          skuId: i.skuId,
          quantity: Number(i.quantity),
          expectedPriceCent: Number(i.priceCent),
          expectedVersion: Number(i.quoteVersion),
        })),
      };
      const next = JSON.stringify(body);
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
        buyerRemark.value = '';
        pickupSlot.value = 'IMMEDIATE';
        confirmRetryable.value = false;
        confirmOpen.value = false;
        notify('订单已创建');
        go('/orders/' + pathId(created.orderId));
      } catch (e) {
        if (current()) {
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
      checkedSkus,
      pickupSlot,
      buyerRemark,
      PICKUP_SLOTS,
      REMARK_CHIPS,
      busy,
      error,
      groups,
      selected,
      selectedQty,
      total,
      preview,
      go,
      money,
      merchantName,
      selectStore,
      toggleSku,
      appendRemark,
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
  template: `<ConsumerShell active="cart">
    <div class="mobile-page-top"><button @click="go('/')" aria-label="返回"><Icon name="arrowLeft"/></button><b>购物车 ({{items.length}})</b><button :disabled="busy||loading" @click="load" aria-label="刷新"><Icon name="refresh"/></button></div>
    <div class="mall-cart-head">
      <div>
        <h1>我的购物车 <span>全部商品 {{items.length}}</span></h1>
        <p>校内门店直供 · 免打包费 · 单次结算同一门店凭动态码极速取货</p>
      </div>
      <button type="button" class="outline-button small" :disabled="busy||loading" @click="load"><Icon name="refresh" :size="14"/>刷新库存价格</button>
    </div>
    <StatusPanel v-if="loading" state="loading" message="正在加载购物车…"/>
    <StatusPanel v-if="error" state="error" :message="error" action-label="重新加载" :busy="loading" @retry="load"/>
    <div v-if="!loading&&!items.length&&!error" class="mobile-empty cart-empty-box">
      <Icon name="cart" :size="40"/>
      <strong>购物车还是空的，去挑点零食冰饮吧</strong>
      <button class="teal-button" @click="go('/')">去首页逛逛</button>
    </div>
    <div v-if="items.length" class="cart-layout">
      <div class="cart-stores-col">
        <template v-for="g in groups" :key="g.id">
          <section class="cart-store" :class="{selected:merchantId===g.id}">
            <div class="cart-store-head-wrap">
              <button class="cart-store-head" :disabled="busy||loading" :aria-pressed="merchantId===g.id" @click="selectStore(g.id)">
                <span class="radio-circle" :class="{active:merchantId===g.id}"><Icon name="check" :size="12"/></span>
                <span class="store-badge-mini">校内店</span>
                <strong>{{merchantName(g.id)}}</strong>
                <span class="store-pack-free">免打包费 · 最快8分钟可取</span>
                <span class="cart-store-total">{{money(g.total)}}</span>
              </button>
            </div>
            <div class="cart-line" v-for="i in g.rows" :key="i.skuId">
              <button type="button" class="sku-check-btn" :class="{checked:merchantId===g.id&&checkedSkus.includes(i.skuId)}" :aria-label="'勾选'+i.title" :aria-pressed="merchantId===g.id&&checkedSkus.includes(i.skuId)" :disabled="busy||loading" @click="toggleSku(i)"><Icon name="check" :size="12"/></button>
              <ProductImage :src="i.imageUrl" :alt="i.title"/>
              <div class="cart-line-info">
                <div class="cart-line-top">
                  <strong>{{i.title}}</strong>
                  <button class="cart-remove" :disabled="busy||preview" :aria-label="'移除'+i.title" @click="remove(i)">删除</button>
                </div>
                <div class="cart-spec-pill-row">
                  <span class="cart-spec-pill">{{i.specKey}}</span>
                  <span v-if="!i.sellable||i.available<i.quantity" class="red-text">库存不足或已下架</span>
                  <span v-else class="cart-stock-ok">现货充足</span>
                </div>
                <div class="cart-line-bottom">
                  <b class="cart-unit-price">{{money(i.priceCent)}}</b>
                  <div class="mini-qty">
                    <button :disabled="busy||preview" :aria-label="'减少'+i.title" @click="quantity(i,-1)"><Icon name="minus" :size="15"/></button>
                    <span>{{i.quantity}}</span>
                    <button :disabled="busy||preview||!i.sellable||i.quantity>=99||i.quantity>=i.available" :aria-label="'增加'+i.title" @click="quantity(i,1)"><Icon name="plus" :size="15"/></button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </template>
        <div v-if="groups.length>1" class="mobile-hint">温馨提示：不同门店备餐窗口独立，每次结算一家门店，点击店名即可切换结算店铺</div>
      </div>
      <aside class="cart-summary-col">
        <div class="mobile-summary tmall-cart-summary">
          <h3>结算明细</h3>
          <div class="summary-store-tag"><Icon name="store" :size="14"/> <span>{{merchantName(merchantId)}}</span></div>
          <div>已选商品 <strong>{{selected.length}} 种（共 {{selectedQty}} 件）</strong></div>
          <div>商品总额 <strong>{{money(total)}}</strong></div>
          <div>打包与服务费 <strong class="free-green">¥0（校内免打包费）</strong></div>
          <div>履约方式 <strong>到店凭 6 位码自提</strong></div>
          <div class="mobile-summary-total">应付合计 <b>{{money(total)}}</b></div>
        </div>
        <div class="mobile-checkout-bar tmall-checkout-bar">
          <div class="checkout-bar-price">
            <small>已选 {{selectedQty}} 件 · 免打包费 · 合计：</small>
            <b>{{money(total)}}</b>
          </div>
          <button class="teal-button checkout-submit-btn" :disabled="preview||busy||loading||!selected.length" @click="checkout">{{busy?'提交中':'提交订单'}}</button>
        </div>
      </aside>
    </div>

    <div v-if="confirmOpen" v-modal="closeConfirm" class="ui-overlay" @click.self="closeConfirm">
      <section class="product-sheet checkout-confirm" role="dialog" aria-modal="true" aria-label="确认订单">
        <button class="sheet-close" @click="closeConfirm" aria-label="关闭"><Icon name="x" :size="19"/></button>
        <h3>确认自提订单</h3>
        <p class="checkout-note">核验门店实时库存与价格后锁单（当前为校园模拟收银沙箱，不产生真实扣款）。</p>
        <StatusPanel v-if="confirmLoading" state="loading" message="正在核对最新价格与库存…"/>
        <template v-else-if="confirmError&&!confirmItems.length">
          <StatusPanel state="error" :message="confirmError" action-label="重新加载" :busy="confirmLoading" @retry="loadConfirmation"/>
          <button class="outline-button checkout-back" @click="closeConfirm">返回调整</button>
        </template>
        <template v-else>
          <section class="checkout-shop">
            <div class="checkout-shop-badge">自提点</div>
            <div>
              <strong>{{confirmMerchant.name||'校内商户'}}</strong>
              <span>{{confirmMerchant.storeName||'门店'}} · {{confirmMerchant.location||'校内自提点'}}</span>
            </div>
          </section>
          <div class="checkout-lines">
            <div v-for="i in confirmItems" :key="i.skuId" class="checkout-line">
              <div><strong>{{i.title}}</strong><small>{{i.specKey}} × {{i.quantity}} · {{money(i.priceCent)}}/件</small></div>
              <b>{{money(Number(i.priceCent)*Number(i.quantity))}}</b>
            </div>
          </div>
          <section class="checkout-rituals">
            <div class="checkout-ritual-group">
              <label class="checkout-ritual-label">预约取餐时段</label>
              <div class="slot-pills">
                <button type="button" v-for="slot in PICKUP_SLOTS" :key="slot.value" class="slot-pill" :class="{active:pickupSlot===slot.value}" :aria-pressed="pickupSlot===slot.value" @click="pickupSlot=slot.value">{{slot.label}}</button>
              </div>
            </div>
            <div class="checkout-ritual-group">
              <label class="checkout-ritual-label" for="checkout-remark">口味与自提备注</label>
              <div class="quick-chip-row"><button type="button" v-for="chip in REMARK_CHIPS" :key="chip" class="quick-chip" @click="appendRemark(chip)">+ {{chip}}</button></div>
              <input id="checkout-remark" v-model="buyerRemark" maxlength="200" class="admin-input checkout-remark-input" placeholder="选填：如少冰、三分糖、多拿双筷子…"/>
            </div>
          </section>
          <div class="checkout-total"><span>应付合计（免打包费）</span><b>{{money(confirmTotal)}}</b></div>
          <div v-if="confirmRetryable" class="mobile-hint" role="status">提交结果未知，可直接重试；同一内容不会重复下单。</div>
          <div v-if="confirmError" class="inline-error" role="alert">{{confirmError}} <button @click="loadConfirmation">刷新确认信息</button></div>
          <div class="checkout-actions">
            <button class="outline-button" @click="closeConfirm" :disabled="busy">返回调整</button>
            <button class="teal-button" :disabled="busy||confirmLoading||!!confirmError" @click="confirmCheckout">{{busy?'提交中…':'确认下单（模拟支付）'}}</button>
          </div>
        </template>
      </section>
    </div>
  </ConsumerShell>`,
};
