import UiPagination from '../components/UiPagination.vue';
import StatusPanel from '../components/StatusPanel.vue';
import { requestScope } from '../services/request-scope.js';
import { pathId, priceSku, positiveInt } from '../services/page-utils.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, query } from '../services/api.js';
import {
  store,
  go,
  money,
  skuOf,
  available,
  shopName,
  preview,
  previewGuard,
  notify,
  loadPublic,
  beginPublicSearch,
  publicSearchCurrent,
} from '../services/store.js';
const { ref, computed, onMounted } = Vue;
const DEFAULT_KEYWORDS = ['乌龙茶', '泡面', '纯牛奶', '果切', '中性笔', '抽纸'];
const HISTORY_STORAGE_KEY = 'campus_search_history_v1';
const staticCategoryArt = {
  food: './images/category-snacks.webp',
  drink: './images/category-drinks.webp',
  beverage: './images/category-drinks.webp',
  fruit: './images/category-fruit.webp',
  stationery: './images/category-stationery.webp',
  daily: './images/category-daily.webp',
  dormitory: './images/category-daily.webp',
  digital: './images/category-digital.webp',
};

function readSearchHistory() {
  try {
    const raw = window.localStorage?.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string' && x.trim()).slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(list) {
  try {
    window.localStorage?.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {}
}

export default {
  name: 'Home',
  components: { ConsumerShell, ProductImage, UiPagination, StatusPanel },
  setup() {
    const scope = requestScope();
    const initialScope = requestScope();
    const discovery = ref(null);
    const searchHistory = ref(readSearchHistory());
    const search = ref('');
    const category = ref('');
    const merchant = ref('');
    const sort = ref('popular');
    const page = ref(1);
    const priceMin = ref('');
    const priceMax = ref('');
    const appliedMin = ref(null);
    const appliedMax = ref(null);
    const priceError = ref('');
    const selected = ref(null);
    const chosenSku = ref('');
    const count = ref(1);
    const saving = ref(false);
    const keywords = computed(() =>
      discovery.value?.hotKeywords?.length ? discovery.value.hotKeywords : DEFAULT_KEYWORDS,
    );
    const discoveryShelf = computed(() => {
      if (preview) return [];
      const seen = new Set();
      const merged = [];
      for (const list of [
        discovery.value?.hotProducts || [],
        discovery.value?.recommendedProducts || [],
      ]) {
        for (const item of list) {
          if (!item?.productId || seen.has(item.productId) || item.status !== 'PUBLISHED') continue;
          seen.add(item.productId);
          merged.push(item);
          if (merged.length >= 8) return merged;
        }
      }
      return merged;
    });
    const categories = computed(() => store.categories.filter((c) => c.active));
    const shops = computed(() => store.merchants.filter((m) => m.status === 'ACTIVE').slice(0, 6));
    const shown = computed(() => {
      let arr = store.products.filter((p) => p.status === 'PUBLISHED');
      if (preview) {
        const q = search.value.trim().toLowerCase();
        if (q) arr = arr.filter((p) => (p.title + ' ' + p.description).toLowerCase().includes(q));
      }
      if (category.value) arr = arr.filter((p) => p.categoryCode === category.value);
      if (merchant.value) arr = arr.filter((p) => p.merchantId === merchant.value);
      if (preview && (appliedMin.value != null || appliedMax.value != null))
        arr = arr.filter((p) =>
          (p.skus || []).some(
            (s) =>
              s.status === 'ACTIVE' &&
              (appliedMin.value == null || Number(s.priceCent) >= appliedMin.value) &&
              (appliedMax.value == null || Number(s.priceCent) <= appliedMax.value),
          ),
        );
      if (preview && sort.value === 'price')
        arr = [...arr].sort(
          (a, b) => Number(priceSku(a).priceCent) - Number(priceSku(b).priceCent),
        );
      if (preview && sort.value === 'priceDesc')
        arr = [...arr].sort(
          (a, b) => Number(priceSku(b).priceCent) - Number(priceSku(a).priceCent),
        );
      if (preview && sort.value === 'stock')
        arr = [...arr].sort((a, b) => available(b) - available(a));
      return arr;
    });
    function syncUrlQuery() {
      if (preview || window.__CAMPUS_TEST_ROUTE__ || !location.protocol.startsWith('http')) return;
      try {
        const params = new URLSearchParams();
        if (search.value.trim()) params.set('q', search.value.trim());
        if (category.value) params.set('category', category.value);
        const qs = params.toString();
        const nextHash = qs ? '#/?' + qs : '#/';
        if (location.hash !== nextHash) {
          window.history.replaceState(null, '', location.pathname + location.search + nextHash);
        }
      } catch {}
    }
    function recordHistory(term) {
      const clean = String(term || '').trim();
      if (!clean) return;
      const next = [clean, ...searchHistory.value.filter((x) => x !== clean)].slice(0, 6);
      searchHistory.value = next;
      writeSearchHistory(next);
    }
    function clearSearchHistory() {
      searchHistory.value = [];
      writeSearchHistory([]);
    }
    onMounted(() => {
      const initReq = initialScope.begin();
      const rawHash = window.__CAMPUS_TEST_ROUTE__ ? '' : location.hash || '';
      const qIdx = rawHash.indexOf('?');
      if (!preview && qIdx >= 0) {
        const params = new URLSearchParams(rawHash.slice(qIdx + 1));
        const initQ = params.get('q') || '';
        const initCat = params.get('category') || '';
        if (initQ) search.value = initQ;
        if (initCat) category.value = initCat;
      }
      if (!preview) {
        api('/discovery/home', { signal: initReq.signal })
          .then((res) => {
            if (initReq.current() && res) discovery.value = res;
          })
          .catch(() => {});
      }
      loadPublic({ signal: initReq.signal }).then(() => {
        if (initReq.current() && !preview && (search.value.trim() || category.value)) {
          loadSearch();
        }
      });
    });
    const pageInfo = computed(() => store.publicPage);
    const priceActive = computed(() => appliedMin.value != null || appliedMax.value != null);
    const hasActiveSearch = computed(() =>
      Boolean(
        search.value.trim() ||
        category.value ||
        merchant.value ||
        appliedMin.value != null ||
        appliedMax.value != null ||
        sort.value !== 'popular' ||
        page.value > 1,
      ),
    );
    const chosen = computed(
      () => selected.value?.skus?.find((s) => s.skuId === chosenSku.value) || skuOf(selected.value),
    );
    const productCategory = (p) =>
      store.categories.find((c) => c.code === p.categoryCode)?.name || '好物';
    const currentShop = (p) => store.merchants.find((m) => m.merchantId === p.merchantId) || {};
    function resolveSortEnum(value) {
      if (value === 'sales') return 'SALES_DESC';
      if (value === 'price') return 'PRICE_ASC';
      if (value === 'priceDesc') return 'PRICE_DESC';
      if (value === 'stock') return 'STOCK_DESC';
      return 'NEWEST';
    }
    async function retryLoad() {
      if (preview) return;
      if (hasActiveSearch.value) {
        if (!store.categories.length || !store.merchants.length) {
          const request = initialScope.begin();
          await Promise.all([
            api('/categories', { signal: request.signal })
              .then((c) => {
                if (request.current()) store.categories = c || [];
              })
              .catch(() => {}),
            api('/merchants/public', { signal: request.signal })
              .then((m) => {
                if (request.current()) store.merchants = m || [];
              })
              .catch(() => {}),
          ]);
          if (!request.current()) return;
        }
        return loadSearch();
      }
      return loadPublic({ signal: initialScope.begin().signal });
    }
    async function loadSearch({ syncUrl = false } = {}) {
      if (syncUrl) syncUrlQuery();
      if (search.value.trim()) recordHistory(search.value);
      if (preview) return;
      const request = scope.begin();
      const current = request.current;
      const stamp = beginPublicSearch();
      const params = {
        q: search.value,
        category: category.value,
        merchantId: merchant.value,
        minPriceCent: appliedMin.value,
        maxPriceCent: appliedMax.value,
        page: page.value,
        size: 20,
        sort: resolveSortEnum(sort.value),
      };
      store.loading = true;
      store.error = '';
      try {
        const result = await api('/products/page' + query(params), { signal: request.signal });
        if (!(current() && publicSearchCurrent(stamp))) return;
        store.products = result.items || [];
        store.publicPage = {
          page: result.page,
          size: result.size,
          total: result.total,
          hasNext: result.hasNext,
        };
      } catch (err) {
        if (current() && publicSearchCurrent(stamp)) store.error = err.message;
      } finally {
        if (current() && publicSearchCurrent(stamp)) store.loading = false;
      }
    }
    function setCategory(c) {
      category.value = category.value === c ? '' : c;
      page.value = 1;
      loadSearch({ syncUrl: true });
    }
    function applyKeyword(word) {
      search.value = word;
      page.value = 1;
      loadSearch({ syncUrl: true });
    }
    function submitSearch() {
      page.value = 1;
      loadSearch({ syncUrl: true });
    }
    /** 卡片在有价格筛选时展示命中区间的最低有效规格，不能把区间外的最低价当作结果。 */
    function cardSku(p) {
      const active = (p?.skus || []).filter((s) => s.status === 'ACTIVE');
      const matched = active.filter(
        (s) =>
          (appliedMin.value == null || Number(s.priceCent) >= appliedMin.value) &&
          (appliedMax.value == null || Number(s.priceCent) <= appliedMax.value),
      );
      return (
        (matched.length ? matched : active).sort(
          (a, b) => Number(a.priceCent) - Number(b.priceCent),
        )[0] || priceSku(p)
      );
    }
    /** 界面以元输入，协议仍提交整数分；最多两位小数，拒绝负数与非法字符。 */
    function yuanToCent(raw) {
      const text = String(raw ?? '').trim();
      if (!text) return null;
      if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
      const [whole, fraction = ''] = text.split('.');
      if (whole.length > 9) return NaN;
      return Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
    }
    function applyPrice() {
      const min = yuanToCent(priceMin.value);
      const max = yuanToCent(priceMax.value);
      if (Number.isNaN(min) || Number.isNaN(max)) {
        priceError.value = '价格条件无效：请填写非负金额，最多两位小数';
        return;
      }
      if (min != null && max != null && min > max) {
        priceError.value = '价格条件无效：最低价不能高于最高价';
        return;
      }
      priceError.value = '';
      appliedMin.value = min;
      appliedMax.value = max;
      page.value = 1;
      loadSearch();
    }
    function clearPrice() {
      priceMin.value = '';
      priceMax.value = '';
      appliedMin.value = null;
      appliedMax.value = null;
      priceError.value = '';
      page.value = 1;
      loadSearch();
    }
    function resetFilters() {
      search.value = '';
      category.value = '';
      merchant.value = '';
      sort.value = 'popular';
      priceMin.value = '';
      priceMax.value = '';
      appliedMin.value = null;
      appliedMax.value = null;
      priceError.value = '';
      page.value = 1;
      loadSearch({ syncUrl: true });
    }
    function showDetail(p) {
      selected.value = p;
      chosenSku.value =
        p.skus?.find((s) => s.status === 'ACTIVE' && Number(s.available) > 0)?.skuId || '';
      count.value = 1;
    }
    const canAdd = computed(
      () =>
        chosen.value?.status === 'ACTIVE' &&
        positiveInt(count.value, 99) &&
        Number(count.value) <= Number(chosen.value.available),
    );
    async function addCart() {
      if (!selected.value || saving.value || previewGuard()) return;
      if (!chosen.value?.skuId || !canAdd.value) {
        notify('请选择有效规格及库存范围内的数量');
        return;
      }
      const valid = scope.capture(),
        productId = selected.value.productId,
        skuId = chosen.value.skuId,
        requested = Number(count.value);
      saving.value = true;
      try {
        const current = await api('/products/' + pathId(productId));
        const real = current.skus.find((s) => s.skuId === skuId);
        if (!real || real.status !== 'ACTIVE' || Number(real.available) < requested)
          throw new Error('库存不足或商品不可售');
        if (!valid()) return;
        await api('/cart', { method: 'POST', body: { skuId: real.skuId, quantity: requested } });
        if (!valid()) return;
        store.cartCount = Number(store.cartCount || 0) + requested;
        selected.value = null;
        notify('已加入购物车');
      } catch (err) {
        if (valid()) notify(err.status === 401 ? '请先登录后再加购' : err.message);
      } finally {
        if (valid()) saving.value = false;
      }
    }
    return {
      store,
      pathId,
      go,
      money,
      skuOf,
      priceSku,
      available,
      shopName,
      preview,
      keywords,
      discoveryShelf,
      searchHistory,
      clearSearchHistory,
      hasActiveSearch,
      search,
      category,
      merchant,
      sort,
      page,
      priceMin,
      priceMax,
      priceActive,
      priceError,
      pageInfo,
      categories,
      shops,
      shown,
      selected,
      chosen,
      chosenSku,
      count,
      saving,
      canAdd,
      cardSku,
      productCategory,
      currentShop,
      staticCategoryArt,
      loadPublic,
      loadSearch,
      submitSearch,
      retryLoad,
      setCategory,
      applyKeyword,
      applyPrice,
      clearPrice,
      resetFilters,
      showDetail,
      addCart,
    };
  },
  template: `
  <ConsumerShell active="home">
    <div class="home-bento">
      <section class="home-discovery-card">
        <div>
          <span class="home-discovery-eyebrow"><Icon name="sparkles" :size="13"/> 校内现货 · 实时库存核验</span>
          <div class="home-discovery-title">把校园便利店装进浏览器</div>
          <div class="home-discovery-sub">跨店比价、按预算筛选，下单后凭动态码到店即取</div>
        </div>
        <div class="search-section">
          <div class="big-search"><Icon name="search" :size="19"/><input v-model="search" placeholder="搜零食、饮料、文具、台灯或校内门店" aria-label="搜索校园商品" @keydown.enter="submitSearch"/><button @click="submitSearch">搜索</button></div>
          <div class="popular-tags"><button v-for="k in keywords" :key="k" @click="applyKeyword(k)" :class="{active:search===k}">{{k}}</button></div>
          <div v-if="searchHistory.length" class="search-history-row"><span class="search-history-label">最近搜过</span><button type="button" v-for="h in searchHistory" :key="h" class="search-history-chip" @click="applyKeyword(h)">{{h}}</button><button type="button" class="search-history-clear" @click="clearSearchHistory">清空</button></div>
        </div>
        <div class="home-trust-strip">
          <span><Icon name="check" :size="13"/> 真实校内门店</span>
          <span><Icon name="shield" :size="13"/> 价格库存实时复验</span>
          <span><Icon name="clock" :size="13"/> 凭动态码快速自提</span>
        </div>
      </section>
      <button class="hero-shopping" @click="go('/ai')" aria-label="进入 AI 导购">
        <div class="hero-lines"><div class="hero-title"><span>AI</span> 导购</div><h1>按预算、口味与使用场景，跨店核验现货并生成可确认加购方案</h1><span class="hero-cta">立即对话 <Icon name="arrowUpRight" :size="15" /></span></div>
        <div class="hero-robot-wrap"><img src="./images/robot.webp" alt="AI 导购助手"/></div>
      </button>
    </div>
    <section class="category-section" aria-label="商品分类">
      <button v-for="c in categories" :key="c.code" class="category-item" @click="setCategory(c.code)" :class="{categoryActive:category===c.code}"><span class="category-picture"><img :src="staticCategoryArt[c.code]||'./images/category-snacks.webp'" :alt="c.name"/></span><strong>{{c.name}}</strong></button>
    </section>
    <section v-if="discoveryShelf.length && !hasActiveSearch" class="discovery-shelf" aria-label="校园实时热销与猜你喜欢">
      <div class="section-head"><div class="section-title"><span class="head-accent hot"><Icon name="flame" :size="17"/></span><h2>🔥 校园实时热销 · 猜你喜欢</h2></div><span class="tiny-note">Redis 实时热度与校园共购推荐</span></div>
      <div class="discovery-shelf-track">
        <button type="button" class="discovery-shelf-card" v-for="p in discoveryShelf" :key="p.productId" @click="showDetail(p)">
          <div class="discovery-shelf-photo"><ProductImage :src="p.imageUrl" :alt="p.title"/></div>
          <div class="discovery-shelf-info"><strong>{{p.title}}</strong><small>{{p.merchantStoreName||p.merchantName||'校内门店'}}</small><b>{{money(cardSku(p)?.priceCent)}}</b></div>
        </button>
      </div>
    </section>
    <section class="merchant-section">
      <div class="section-head"><div class="section-title"><span class="head-accent mint"><Icon name="store" :size="18"/></span><h2>校内门店</h2></div><span class="tiny-note">点选门店筛选现货，或进店浏览</span></div>
      <div class="merchant-cards"><button class="merchant-card" v-for="(m,idx) in shops" :key="m.merchantId" @click="merchant=merchant===m.merchantId?'':m.merchantId;page=1;loadSearch()" :class="{active:merchant===m.merchantId}">
        <div class="merchant-card-top">
          <span class="merchant-logo" :class="'store-'+idx"><img v-if="m.imageUrl" :src="m.imageUrl" :alt="m.name"/><Icon v-else name="store" :size="20"/></span>
          <div class="merchant-card-meta"><strong>{{m.name}}</strong><small>{{m.storeName||m.location||'校内自提点'}}</small></div>
        </div>
        <span class="merchant-chip"><span class="merchant-chip-dot"></span> {{m.businessHours?m.businessHours.slice(0,18):'到店可自提'}}</span>
      </button></div>
      <div v-if="merchant" class="merchant-filter-bar"><span>已选门店：{{shopName(merchant)}}</span><div class="merchant-filter-actions"><button type="button" class="shop-visit-link" @click="go('/shops/'+pathId(merchant))">进店逛逛 <Icon name="chevronRight" :size="13"/></button><button type="button" @click="merchant='';page=1;loadSearch()">清除筛选 <Icon name="x" :size="13" /></button></div></div>
    </section>
    <section class="reco-section">
      <div class="section-head reco-heading"><div class="section-title"><span class="head-accent mint"><Icon name="sparkles" :size="18"/></span><h2>在售好物</h2></div><div class="sort-tabs"><button :class="{active:sort==='popular'}" @click="sort='popular';page=1;loadSearch()">最新</button><button :class="{active:sort==='sales'}" @click="sort='sales';page=1;loadSearch()">热销优先</button><button :class="{active:sort==='stock'}" @click="sort='stock';page=1;loadSearch()">库存</button><button :class="{active:sort==='price'}" @click="sort='price';page=1;loadSearch()">价格</button><button :class="{active:sort==='priceDesc'}" @click="sort='priceDesc';page=1;loadSearch()">价格从高到低</button></div></div>
      <div class="price-filter" aria-label="价格筛选"><span class="price-filter-label">价格区间</span><input v-model="priceMin" inputmode="decimal" placeholder="最低" aria-label="最低价（元）" @keydown.enter="applyPrice"/><span>—</span><input v-model="priceMax" inputmode="decimal" placeholder="最高" aria-label="最高价（元）" @keydown.enter="applyPrice"/><button class="outline-button" @click="applyPrice">应用</button><button v-if="priceActive" @click="clearPrice">清除价格</button><button class="price-filter-reset" @click="resetFilters">重置筛选</button></div>
      <div v-if="priceError" class="inline-error price-filter-error" role="alert"><Icon name="alert" :size="16"/>{{priceError}}</div>
      <StatusPanel v-if="store.loading" state="loading" message="正在加载"/>
      <div v-if="store.error" class="inline-error"><Icon name="alert" :size="18"/>{{store.error}} <button v-if="!preview" type="button" class="outline-button small" @click="retryLoad()">重试</button></div>
      <StatusPanel v-if="!store.loading&&!shown.length&&!store.error" state="empty" message="暂无符合条件的商品" action-label="查看全部" @retry="resetFilters"/>
      <div class="home-product-grid">
        <article class="home-product" v-for="p in shown" :key="p.productId" @click="showDetail(p)">
          <div class="home-product-photo"><ProductImage :src="p.imageUrl" :alt="p.title"/><span v-if="p.tag" class="corner-tag">{{p.tag}}</span><span class="floating-pickup">可自提</span></div>
          <div class="home-product-info"><button class="home-product-open" @click.stop="showDetail(p)">{{p.title}}</button><div v-if="p.merchantStoreName||p.merchantName" class="product-store-meta"><Icon name="store" :size="12"/><span>{{p.merchantStoreName||p.merchantName}}</span></div><div class="product-minor"><span>{{cardSku(p)?.specKey||'暂无规格'}}</span><span>{{available(p)>0?'有现货':'已售罄'}}</span></div><div class="product-price-row"><span class="price-main">{{money(cardSku(p)?.priceCent)}} 起</span><button @click.stop="showDetail(p)" :aria-label="'查看'+p.title"><Icon name="plus" :size="17" /></button></div></div>
        </article>
      </div>
      <UiPagination v-if="!preview && pageInfo.total>0" :page="page" :has-next="pageInfo.hasNext" :busy="store.loading" @previous="page--;loadSearch()" @next="page++;loadSearch()">共 {{pageInfo.total}} 件</UiPagination>
    </section>
    
    <div v-if="selected" v-modal="() => selected=null" class="ui-overlay" @click.self="selected=null"><div class="product-sheet" role="dialog" aria-modal="true" :aria-label="selected.title">
      <button class="sheet-close" @click="selected=null" aria-label="关闭"><Icon name="x" :size="19"/></button>
      <div class="sheet-product-line"><ProductImage :src="selected.imageUrl" :alt="selected.title"/><div><span class="mini-category">{{productCategory(selected)}}</span><h3>{{selected.title}}</h3><div class="sheet-price">{{money(chosen.priceCent)}}</div><span class="sheet-muted">{{currentShop(selected).name||'校内商户'}}</span></div></div>
      <button class="more-product-detail" @click="go('/product/'+pathId(selected.productId));selected=null">查看商品详情 <Icon name="chevronRight" :size="15"/></button><label class="sheet-field-label">选择规格</label><div class="sku-picker"><button v-for="sku in selected.skus" :key="sku.skuId" :class="{active:chosenSku===sku.skuId}" :aria-pressed="chosenSku===sku.skuId" :disabled="saving||sku.status!=='ACTIVE'||Number(sku.available)<=0" @click="chosenSku=sku.skuId;count=1">{{sku.specKey}}</button></div>
      <div class="quantity-picker"><span>购买数量 <small class="sheet-stock-hint">库存 {{chosen.available||0}} 件</small></span><div><button @click="count=Math.max(1,count-1)" aria-label="减少数量" :disabled="saving"><Icon name="minus" :size="17" /></button><b>{{count}}</b><button @click="count=Math.min(99,Number(chosen.available||0),count+1)" aria-label="增加数量" :disabled="saving||count>=Number(chosen.available||0)"><Icon name="plus" :size="17"/></button></div></div>
      <button class="primary-wide" :disabled="!canAdd || saving || preview" @click="addCart">{{saving?'加入中…':'加入购物车'}}</button>
    </div></div>
  </ConsumerShell>`,
};
