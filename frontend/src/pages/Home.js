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
const { ref, computed, onMounted, onUnmounted } = Vue;
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
const STORE_PHOTOS = [
  './images/store-campus-hub.jpg',
  './images/store-library-cafe.jpg',
  './images/store-dorm-mart.jpg',
  './images/store-fruit-bar.jpg',
];

function splitPrice(cent) {
  const formatted = money(cent).replace(/^¥/, '');
  const dot = formatted.indexOf('.');
  if (dot < 0) return { int: formatted, dec: '' };
  return { int: formatted.slice(0, dot), dec: formatted.slice(dot) };
}

function readSearchHistory() {
  try {
    const raw = window.localStorage?.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string' && x.trim()).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(list) {
  try {
    window.localStorage?.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {}
}

export default {
  name: 'Home',
  components: { ConsumerShell, ProductImage, UiPagination, StatusPanel },
  setup() {
    const scope = requestScope();
    const initialScope = requestScope();
    const discovery = ref(null);
    const bannerIdx = ref(0);
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
    const quickAddingId = ref('');
    const quickAddedMap = ref({});
    let bannerTimer = null;

    const banners = computed(() => [
      {
        tag: '深夜热食',
        title: '赶论文饿了？热汤杯面配无糖冰茶',
        sub: '手机下单，下楼到店直接取走，不用排队等结账',
        cta: '看看夜宵',
        keyword: '泡面',
        img: preview ? './images/noodles.webp' : './images/prod-instant-noodles.jpg',
      },
      {
        tag: '课间饮品',
        title: '早八大课间 · 生椰冰拿铁与鲜牛奶',
        sub: '支持预约 10:00 课间取餐，路过连廊顺手带进教室',
        cta: '挑杯饮品',
        categoryCode: 'drink',
        img: preview ? './images/milk.webp' : './images/prod-iced-latte.jpg',
      },
      {
        tag: '每日鲜切',
        title: '现切双拼鲜果杯 · 清爽低负担',
        sub: '当天现切草莓芒果与酸奶碗，午休饭后解腻刚刚好',
        cta: '逛逛鲜果',
        categoryCode: 'fruit',
        img: preview ? './images/category-fruit.webp' : './images/prod-fruit-cup.jpg',
      },
    ]);

    const keywords = computed(() =>
      discovery.value?.hotKeywords?.length ? discovery.value.hotKeywords : DEFAULT_KEYWORDS,
    );
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

    function triggerBanner(b) {
      if (b.categoryCode) {
        category.value = b.categoryCode;
        search.value = '';
      } else if (b.keyword) {
        search.value = b.keyword;
        category.value = '';
      }
      page.value = 1;
      loadSearch({ syncUrl: true });
    }

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
      const next = [clean, ...searchHistory.value.filter((x) => x !== clean)].slice(0, 5);
      searchHistory.value = next;
      writeSearchHistory(next);
    }
    function clearSearchHistory() {
      searchHistory.value = [];
      writeSearchHistory([]);
    }
    onMounted(() => {
      if (!preview && !window.__contractApi) {
        bannerTimer = setInterval(() => {
          bannerIdx.value = (bannerIdx.value + 1) % 3;
        }, 5600);
      }
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
    onUnmounted(() => {
      if (bannerTimer) {
        clearInterval(bannerTimer);
        bannerTimer = null;
      }
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
    function hasMultipleActiveSkus(p) {
      return (p?.skus || []).filter((s) => s.status === 'ACTIVE').length > 1;
    }
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
    /** 单规格商品点击 + 号直接一键加购，多规格商品展开选规格抽屉。 */
    async function quickAdd(p) {
      if (preview || hasMultipleActiveSkus(p)) {
        showDetail(p);
        return;
      }
      if (!store.user) {
        notify('请先登录后再加购');
        return;
      }
      if (quickAddingId.value) return;
      const targetSku = cardSku(p);
      if (!targetSku?.skuId || Number(targetSku.available || 0) < 1) {
        showDetail(p);
        return;
      }
      const valid = scope.capture();
      quickAddingId.value = p.productId;
      try {
        const current = await api('/products/' + pathId(p.productId));
        const real = current.skus?.find((s) => s.skuId === targetSku.skuId);
        if (!real || real.status !== 'ACTIVE' || Number(real.available) < 1)
          throw new Error('该商品暂时缺货');
        if (!valid()) return;
        await api('/cart', { method: 'POST', body: { skuId: real.skuId, quantity: 1 } });
        if (!valid()) return;
        store.cartCount = Number(store.cartCount || 0) + 1;
        quickAddedMap.value = {
          ...quickAddedMap.value,
          [p.productId]: Number(quickAddedMap.value[p.productId] || 0) + 1,
        };
        notify('已加入购物车');
      } catch (err) {
        if (valid()) notify(err.status === 401 ? '请先登录后再加购' : err.message);
      } finally {
        if (valid()) quickAddingId.value = '';
      }
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
      splitPrice,
      skuOf,
      priceSku,
      available,
      shopName,
      preview,
      banners,
      bannerIdx,
      triggerBanner,
      keywords,
      searchHistory,
      clearSearchHistory,
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
      quickAddingId,
      quickAddedMap,
      canAdd,
      cardSku,
      hasMultipleActiveSkus,
      currentShop,
      staticCategoryArt,
      STORE_PHOTOS,
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
      quickAdd,
      addCart,
    };
  },
  template: `
  <ConsumerShell active="home">
    <section class="home-search-strip" aria-label="商品搜索">
      <div class="home-search-bar-row">
        <div class="big-search">
          <Icon name="search" :size="18" class="big-search-icon"/>
          <input v-model="search" placeholder="搜索饮品、零食、水果、文具…" aria-label="搜索校园商品" @keydown.enter="submitSearch"/>
          <button type="button" @click="submitSearch">搜索</button>
        </div>
      </div>
      <div class="popular-tags">
        <button v-for="(k, ki) in keywords" :key="k" type="button" @click="applyKeyword(k)" :class="{active:search===k, 'is-hot-lead': ki===0}">
          <Icon v-if="ki===0" name="flame" :size="12" class="hot-lead-icon"/><span>{{k}}</span>
        </button>
        <template v-if="searchHistory.length">
          <span class="search-history-sep">·</span>
          <span class="search-history-label">历史</span>
          <button type="button" v-for="h in searchHistory.slice(0,3)" :key="'h-'+h" class="search-history-chip" @click="applyKeyword(h)">{{h}}</button>
          <button type="button" class="search-history-clear" @click="clearSearchHistory">清空</button>
        </template>
      </div>
    </section>

    <section class="home-hero-row" aria-label="精选场景与导购">
      <div class="home-scene-banner">
        <div class="scene-banner-copy">
          <span class="carousel-scene-tag"><span class="scene-live-dot" aria-hidden="true"></span>{{banners[bannerIdx].tag}}</span>
          <h2>{{banners[bannerIdx].title}}</h2>
          <p>{{banners[bannerIdx].sub}}</p>
          <div class="carousel-actions">
            <button type="button" class="carousel-cta-btn" @click="triggerBanner(banners[bannerIdx])">
              {{banners[bannerIdx].cta}} <Icon name="chevronRight" :size="13"/>
            </button>
            <div class="carousel-dots" role="tablist" aria-label="场景切换">
              <button
                v-for="(b, bi) in banners"
                :key="b.title"
                type="button"
                class="carousel-dot"
                :class="{active:bi===bannerIdx}"
                :aria-label="'场景'+(bi+1)"
                @click="bannerIdx=bi"
              ></button>
            </div>
          </div>
        </div>
        <div class="scene-banner-art" @click="triggerBanner(banners[bannerIdx])">
          <ProductImage :src="banners[bannerIdx].img" :alt="banners[bannerIdx].title"/>
        </div>
      </div>

      <button type="button" class="hero-shopping cabin-ai-card" @click="go('/ai')" aria-label="进入 AI 导购">
        <div class="cabin-ai-top">
          <span class="cabin-ai-avatar cabin-ai-emblem" aria-hidden="true">
            <Icon name="sparkles" :size="20"/>
          </span>
          <div>
            <div class="hero-title"><span>AI</span> 导购</div>
            <div class="cabin-ai-sub">按预算和口味帮你挑</div>
          </div>
          <span class="cabin-ai-go">去试试 <Icon name="chevronRight" :size="12"/></span>
        </div>
        <p class="cabin-ai-desc">不知道买什么？说声“30元夜宵”或“无糖冰饮”，直接配好加购方案</p>
        <div class="cabin-ai-tags" aria-hidden="true">
          <span class="cabin-ai-tag">20元无糖冰饮</span>
          <span class="cabin-ai-tag">30元深夜夜宵</span>
        </div>
      </button>
    </section>

    <section class="home-browse-panel" aria-label="分类与门店筛选">
      <div class="category-section" aria-label="商品分类">
        <button v-for="c in categories" :key="c.code" type="button" class="category-item" @click="setCategory(c.code)" :class="{categoryActive:category===c.code}">
          <span class="category-picture"><img :src="staticCategoryArt[c.code]||'./images/category-snacks.webp'" :alt="c.name"/></span>
          <span>{{c.name}}</span>
        </button>
      </div>
      <div v-if="shops.length" class="store-pills-row" aria-label="校内门店">
        <span class="store-pills-label"><Icon name="store" :size="13"/><span>门店</span></span>
        <button type="button" class="store-pill-chip" :class="{active:!merchant}" @click="merchant='';page=1;loadSearch()">全部门店</button>
        <button type="button" v-for="(m, idx) in shops" :key="m.merchantId" class="store-pill-chip merchant-card" :class="{active:merchant===m.merchantId}" @click="merchant=merchant===m.merchantId?'':m.merchantId;page=1;loadSearch()">
          <ProductImage class="store-pill-avatar" :src="m.imageUrl || m.image || STORE_PHOTOS[idx % STORE_PHOTOS.length]" alt=""/>
          <span>{{m.name}}</span>
        </button>
        <button v-if="merchant" type="button" class="store-enter-inline" @click="go('/shops/'+pathId(merchant))">进店主页 <Icon name="chevronRight" :size="12"/></button>
      </div>
    </section>

    <section class="reco-section">
      <div class="feed-sticky-bar">
        <div class="sort-tabs">
          <button type="button" :class="{active:sort==='popular'}" @click="sort='popular';page=1;loadSearch()">最新</button>
          <button type="button" :class="{active:sort==='sales'}" @click="sort='sales';page=1;loadSearch()">热销</button>
          <button type="button" :class="{active:sort==='price'}" @click="sort='price';page=1;loadSearch()">价格</button>
          <button type="button" :class="{active:sort==='priceDesc'}" @click="sort='priceDesc';page=1;loadSearch()">价格降序</button>
          <button type="button" :class="{active:sort==='stock'}" @click="sort='stock';page=1;loadSearch()">库存</button>
        </div>
        <div class="price-filter" aria-label="价格筛选">
          <span class="price-filter-label">价格</span>
          <input v-model="priceMin" inputmode="decimal" placeholder="¥最低" aria-label="最低价（元）" @keydown.enter="applyPrice"/>
          <span>—</span>
          <input v-model="priceMax" inputmode="decimal" placeholder="¥最高" aria-label="最高价（元）" @keydown.enter="applyPrice"/>
          <button type="button" class="outline-button" @click="applyPrice">应用</button>
          <button v-if="priceActive" type="button" class="outline-button" @click="clearPrice">清除价格</button>
          <button type="button" class="price-filter-reset" @click="resetFilters">重置筛选</button>
        </div>
      </div>

      <div v-if="priceError" class="inline-error price-filter-error" role="alert"><Icon name="alert" :size="16"/>{{priceError}}</div>
      <StatusPanel v-if="store.loading" state="loading" message="正在加载商品…"/>
      <div v-if="store.error" class="inline-error"><Icon name="alert" :size="18"/>{{store.error}} <button v-if="!preview" type="button" class="outline-button small" @click="retryLoad()">重试</button></div>
      <StatusPanel v-if="!store.loading&&!shown.length&&!store.error" state="empty" message="暂无符合条件的商品" action-label="查看全部" @retry="resetFilters"/>

      <div class="home-product-grid">
        <article class="home-product" v-for="p in shown" :key="p.productId" @click="showDetail(p)">
          <div class="home-product-photo">
            <ProductImage :src="p.imageUrl" :alt="p.title"/>
            <span v-if="p.tag || available(p)<=10" class="product-photo-badge" :class="{'is-soldout': available(p)<=0, 'is-scarce': !p.tag && available(p)>0 && available(p)<=10}">{{available(p)<=0 ? '暂时售罄' : p.tag ? p.tag : '仅剩 '+available(p)+' 件'}}</span>
          </div>
          <div class="home-product-info">
            <button type="button" class="home-product-open" @click.stop="showDetail(p)">{{p.title}}</button>
            <div class="product-store-meta">
              <span>{{p.merchantStoreName||p.merchantName||shopName(p.merchantId)}}</span>
              <span class="product-meta-dot">·</span>
              <span>{{cardSku(p)?.specKey||'标准装'}}</span>
            </div>
            <div class="product-price-row">
              <span class="price-main rtl-price">
                <em class="yen">¥</em><b class="int">{{splitPrice(cardSku(p)?.priceCent).int}}</b><i v-if="splitPrice(cardSku(p)?.priceCent).dec" class="dec">{{splitPrice(cardSku(p)?.priceCent).dec}}</i><small v-if="p.skus?.length>1" class="qi"> 起</small>
              </span>
              <button
                type="button"
                class="rtl-plus-btn"
                :class="{'is-spec': hasMultipleActiveSkus(p)}"
                :disabled="quickAddingId===p.productId"
                :aria-label="hasMultipleActiveSkus(p) ? '选规格 '+p.title : '加购 '+p.title"
                @click.stop="quickAdd(p)"
              >
                <template v-if="hasMultipleActiveSkus(p)">选规格</template>
                <template v-else>
                  <Icon name="plus" :size="15" />
                  <em v-if="quickAddedMap[p.productId]" class="rtl-plus-badge">{{quickAddedMap[p.productId]}}</em>
                </template>
              </button>
            </div>
          </div>
        </article>
      </div>
      <UiPagination v-if="!preview && pageInfo.total>0" :page="page" :has-next="pageInfo.hasNext" :busy="store.loading" @previous="page--;loadSearch()" @next="page++;loadSearch()">共 {{pageInfo.total}} 件</UiPagination>
    </section>

    <div v-if="store.cartCount>0 && !selected && !preview" class="floating-cart-pill">
      <span>已选 {{store.cartCount}} 件商品</span>
      <button type="button" aria-label="去结算" @click="go('/cart')">去结算 <Icon name="chevronRight" :size="14"/></button>
    </div>

    <div v-if="selected" v-modal="() => selected=null" class="ui-overlay" @click.self="selected=null">
      <div class="product-sheet" role="dialog" aria-modal="true" :aria-label="selected.title">
        <button class="sheet-close" @click="selected=null" aria-label="关闭"><Icon name="x" :size="18"/></button>
        <div class="sheet-product-line">
          <ProductImage :src="selected.imageUrl" :alt="selected.title"/>
          <div>
            <h3>{{selected.title}}</h3>
            <div class="sheet-price rtl-price"><em class="yen">¥</em><b class="int">{{splitPrice(chosen.priceCent).int}}</b><i v-if="splitPrice(chosen.priceCent).dec" class="dec">{{splitPrice(chosen.priceCent).dec}}</i></div>
            <span class="sheet-muted"><Icon name="store" :size="12"/> {{currentShop(selected).name||selected.merchantName||'校内门店'}}</span>
          </div>
        </div>
        <button class="more-product-detail" @click="go('/product/'+pathId(selected.productId));selected=null">查看商品详情 <Icon name="chevronRight" :size="15"/></button>
        <label class="sheet-field-label">规格</label>
        <div class="sku-picker">
          <button v-for="sku in selected.skus" :key="sku.skuId" :class="{active:chosenSku===sku.skuId}" :aria-pressed="chosenSku===sku.skuId" :disabled="saving||sku.status!=='ACTIVE'||Number(sku.available)<=0" @click="chosenSku=sku.skuId;count=1">{{sku.specKey}}</button>
        </div>
        <div class="quantity-picker">
          <span>数量 <small class="sheet-stock-hint">库存 {{chosen.available||0}} 件</small></span>
          <div>
            <button @click="count=Math.max(1,count-1)" aria-label="减少数量" :disabled="saving"><Icon name="minus" :size="16" /></button>
            <b>{{count}}</b>
            <button @click="count=Math.min(99,Number(chosen.available||0),count+1)" aria-label="增加数量" :disabled="saving||count>=Number(chosen.available||0)"><Icon name="plus" :size="16"/></button>
          </div>
        </div>
        <button class="primary-wide" :disabled="!canAdd || saving || preview" @click="addCart">{{saving?'加入中…':'加入购物车'}}</button>
      </div>
    </div>
  </ConsumerShell>`,
};
