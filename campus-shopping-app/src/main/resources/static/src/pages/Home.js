import UiPagination from '../components/UiPagination.vue';
import StatusPanel from '../components/StatusPanel.vue';
import { requestScope } from '../services/request-scope.js';
import { pathId, priceSku, positiveInt } from '../services/page-utils.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, query } from '../services/api.js';
import { designTheme } from '../services/design-theme.js';
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
const { ref, computed, inject, onMounted, onUnmounted } = Vue;

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
const CATEGORY_SUB_KEYWORDS = {
  drink: '冰拿铁 · 乌龙茶',
  beverage: '冰拿铁 · 乌龙茶',
  fruit: '草莓杯 · 脐橙',
  food: '豚骨面 · 坚果',
  stationery: '中性笔 · 活页本',
  daily: '抽纸 · 护眼灯',
  dormitory: '抽纸 · 护眼灯',
  digital: '降噪耳机 · 快充',
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
    const openLogin = inject('openConsumerLogin', () => go('/account'));
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

    const consumerMode = computed(() => designTheme.consumer || 'taobao');

    const banners = computed(() => [
      {
        tag: '校园鲜饮节',
        title: '冰萃拿铁与鲜切果杯',
        sub: '下课顺路 5 分钟即取 · 校内门店现做现货',
        cta: '立即选购',
        categoryCode: 'drink',
        img: './images/hero-campus-fresh.jpg',
      },
      {
        tag: '自习装备季',
        title: '护眼台灯与降噪耳机',
        sub: '图书馆与宿舍专享 · 校内自提免运费',
        cta: '去看看',
        categoryCode: 'stationery',
        img: './images/hero-campus-study.jpg',
      },
    ]);

    const searchPlaceholder = computed(() => {
      if (consumerMode.value === 'jd') return '搜京东校园自营：乌龙茶、护眼灯、中性笔…';
      if (consumerMode.value === 'youpin') return '搜有品严选好物…';
      if (consumerMode.value === 'xiaohongshu') return '搜索校内口碑好物、夜宵、冰饮…';
      return '搜索饮品、零食、水果、文具…';
    });

    const keywords = computed(() =>
      discovery.value?.hotKeywords?.length ? discovery.value.hotKeywords : DEFAULT_KEYWORDS,
    );
    const categories = computed(() => store.categories.filter((c) => c.active));
    const shops = computed(() => store.merchants.filter((m) => m.status === 'ACTIVE').slice(0, 4));
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

    const seckillProducts = computed(() => shown.value.slice(0, 4));
    const userGreeting = computed(
      () => store.user?.displayName || store.user?.username || '同学你好',
    );
    const userInitial = computed(() =>
      (store.user?.displayName || store.user?.username || 'Hi').slice(0, 1).toUpperCase(),
    );

    function categorySubKeywords(c) {
      return CATEGORY_SUB_KEYWORDS[c?.code] || '现货 · 极速自提';
    }

    function storePhoto(m, idx = 0) {
      return m?.imageUrl || m?.image || STORE_PHOTOS[idx % STORE_PHOTOS.length];
    }

    function storePhotoByMerchantId(merchantId) {
      const idx = store.merchants.findIndex((m) => m.merchantId === merchantId);
      const m = idx >= 0 ? store.merchants[idx] : null;
      return storePhoto(m, idx >= 0 ? idx : 0);
    }

    function prevBanner() {
      bannerIdx.value = (bannerIdx.value + banners.value.length - 1) % banners.value.length;
    }

    function nextBanner() {
      bannerIdx.value = (bannerIdx.value + 1) % banners.value.length;
    }

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
        const hashQ = (location.hash || '').indexOf('?');
        const prev = hashQ >= 0 ? new URLSearchParams(location.hash.slice(hashQ + 1)) : null;
        const params = new URLSearchParams();
        for (const k of ['ct', 'hl', 'at']) {
          if (prev?.get(k)) params.set(k, prev.get(k));
        }
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
          bannerIdx.value = (bannerIdx.value + 1) % banners.value.length;
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
      if (designTheme.searchDraft) {
        search.value = designTheme.searchDraft;
        designTheme.searchDraft = '';
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

    function toggleMerchant(id) {
      merchant.value = merchant.value === id ? '' : id;
      page.value = 1;
      loadSearch();
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
      openLogin,
      money,
      splitPrice,
      skuOf,
      priceSku,
      available,
      shopName,
      preview,
      consumerMode,
      searchPlaceholder,
      banners,
      bannerIdx,
      prevBanner,
      nextBanner,
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
      seckillProducts,
      userGreeting,
      userInitial,
      categorySubKeywords,
      storePhoto,
      storePhotoByMerchantId,
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
      loadPublic,
      loadSearch,
      submitSearch,
      retryLoad,
      setCategory,
      toggleMerchant,
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
    <!-- 顶栏原生内嵌搜索槽位（4 套大厂头部零重复搜索框） -->
    <template #header-search>
      <div class="header-search-bundle">
        <div class="big-search">
          <Icon name="search" :size="17" class="big-search-icon" />
          <input
            v-model="search"
            :placeholder="searchPlaceholder"
            aria-label="搜索校园商品"
            @keydown.enter="submitSearch"
          />
          <button type="button" @click="submitSearch">搜索</button>
        </div>
        <div class="popular-tags">
          <button
            v-for="(k, ki) in keywords"
            :key="k"
            type="button"
            :class="{ active: search === k, 'is-hot-lead': ki === 0 }"
            @click="applyKeyword(k)"
          >
            <Icon v-if="ki === 0" name="flame" :size="11" class="hot-lead-icon" /><span>{{ k }}</span>
          </button>
          <template v-if="searchHistory.length">
            <span class="search-history-sep">·</span>
            <span class="search-history-label">历史</span>
            <button
              v-for="h in searchHistory.slice(0, 3)"
              :key="'h-' + h"
              type="button"
              class="search-history-chip"
              @click="applyKeyword(h)"
            >
              {{ h }}
            </button>
            <button type="button" class="search-history-clear" @click="clearSearchHistory">清空</button>
          </template>
        </div>
      </div>
    </template>

    <!-- ==================== REPLICA 1：淘宝 2025 PC 版 (一体白卡三栏首屏：左多词分类 + 中双层大图&好店街 + 右会员与淘宝问问) ==================== -->
    <section v-if="consumerMode === 'taobao'" class="tb-hero-card" aria-label="淘宝风格精选首屏">
      <aside class="tb-cat-panel" aria-label="商品分类">
        <div class="tb-cat-head">
          <Icon name="grid" :size="14" />
          <strong>分类</strong>
          <span>校内现货</span>
        </div>
        <div class="tb-cat-list">
          <button
            v-for="c in categories"
            :key="'tb-' + c.code"
            type="button"
            class="tb-cat-row category-item"
            :class="{ categoryActive: category === c.code }"
            @click="setCategory(c.code)"
          >
            <span class="tb-cat-icon">
              <img :src="c.image || staticCategoryArt[c.code] || './images/category-snacks.webp'" :alt="c.name" />
            </span>
            <span class="tb-cat-words">
              <strong>{{ c.name }}</strong>
              <i aria-hidden="true">/</i>
              <small>{{ categorySubKeywords(c) }}</small>
            </span>
          </button>
        </div>
      </aside>

      <div class="tb-hero-center">
        <div class="home-scene-banner tb-carousel">
          <img
            class="hero-banner-photo"
            :src="banners[bannerIdx].img"
            :alt="banners[bannerIdx].title"
            @click="triggerBanner(banners[bannerIdx])"
          />
          <button type="button" class="banner-nav-arrow is-prev" aria-label="上一张横幅" @click="prevBanner">‹</button>
          <button type="button" class="banner-nav-arrow is-next" aria-label="下一张横幅" @click="nextBanner">›</button>
          <div class="scene-banner-copy">
            <span class="carousel-scene-tag"><span class="scene-live-dot" aria-hidden="true"></span>{{ banners[bannerIdx].tag }}</span>
            <h2>{{ banners[bannerIdx].title }}</h2>
            <p>{{ banners[bannerIdx].sub }}</p>
            <div class="carousel-actions">
              <button type="button" class="carousel-cta-btn" @click="triggerBanner(banners[bannerIdx])">
                {{ banners[bannerIdx].cta }} <Icon name="chevronRight" :size="13" />
              </button>
              <div class="carousel-dots" role="tablist" aria-label="场景切换">
                <button
                  v-for="(b, bi) in banners"
                  :key="b.title"
                  type="button"
                  class="carousel-dot"
                  :class="{ active: bi === bannerIdx }"
                  :aria-label="'场景' + (bi + 1)"
                  @click="bannerIdx = bi"
                ></button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="shops.length" class="tb-store-strip" aria-label="校内严选好店">
          <div class="tb-store-strip-head">
            <span class="tb-store-badge"><Icon name="store" :size="12" />校内严选好店</span>
            <div class="tb-store-strip-actions">
              <button
                v-if="merchant"
                type="button"
                class="tb-store-reset"
                @click="merchant = ''; page = 1; loadSearch()"
              >
                全部门店
              </button>
              <button
                v-if="merchant"
                type="button"
                class="store-enter-inline"
                @click="go('/shops/' + pathId(merchant))"
              >
                进店主页 <Icon name="chevronRight" :size="11" />
              </button>
            </div>
          </div>
          <div class="tb-store-cards">
            <button
              v-for="(m, idx) in shops"
              :key="m.merchantId"
              type="button"
              class="tb-store-card merchant-card"
              :class="{ active: merchant === m.merchantId }"
              @click="toggleMerchant(m.merchantId)"
            >
              <ProductImage class="tb-store-photo" :src="storePhoto(m, idx)" :alt="m.name" />
              <div class="tb-store-meta">
                <strong>{{ m.name }}</strong>
                <small>{{ m.storeName || m.location || '到店自提' }}</small>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div class="tb-member-panel">
        <div class="tb-member-head">
          <span class="tb-member-avatar">{{ userInitial }}</span>
          <div class="tb-member-hello">
            <strong>Hi! {{ userGreeting }}</strong>
            <small>校内自提 · 免配送打包费</small>
          </div>
        </div>

        <button
          v-if="!store.user && !preview"
          type="button"
          class="tb-member-login-cta"
          @click="openLogin"
        >
          立即登录享自提权益
        </button>
        <div v-else class="tb-member-stats">
          <a href="#/orders" @click.prevent="go('/orders')"><b>待付款</b><span>查订单</span></a>
          <a href="#/orders" @click.prevent="go('/orders')"><b>待自提</b><span>取件码</span></a>
          <a href="#/cart" @click.prevent="go('/cart')"><b>{{ store.cartCount || 0 }}</b><span>购物袋</span></a>
          <a href="#/account" @click.prevent="go('/account')"><b>收藏夹</b><span>常买</span></a>
        </div>

        <div
          class="tb-wenwen-card hero-shopping"
          role="region"
          aria-label="淘宝问问 AI 智能导购"
        >
          <button type="button" class="tb-wenwen-open" @click="go('/ai')">
            <span class="tb-wenwen-icon"><Icon name="sparkles" :size="16" /></span>
            <span class="tb-wenwen-title-col">
              <span class="hero-title"><span>AI</span> 导购</span>
              <small>按预算口味配齐自提好物</small>
            </span>
            <Icon name="chevronRight" :size="13" class="tb-wenwen-arrow" />
          </button>
          <div class="tb-wenwen-chips">
            <button type="button" @click="go('/ai')">20元无糖冰饮</button>
            <button type="button" @click="go('/ai')">30元深夜夜宵</button>
          </div>
        </div>

        <div class="tb-guarantee-bar" aria-label="校园自提保障">
          <span><Icon name="clock" :size="12" />现货即取</span>
          <span><Icon name="store" :size="12" />免运费</span>
          <span><Icon name="shield" :size="12" />未取退</span>
        </div>
      </div>
    </section>

    <!-- ==================== REPLICA 2：京东 PC 版 (三块独立分栏首屏 + 经典红底校内秒杀横条 + 自营好店条) ==================== -->
    <template v-else-if="consumerMode === 'jd'">
      <section class="jd-hero-stage" aria-label="京东风格精选首屏">
        <aside class="jd-cat-sidebar" aria-label="商品分类">
          <button
            v-for="c in categories"
            :key="'jd-' + c.code"
            type="button"
            class="jd-cat-row category-item"
            :class="{ categoryActive: category === c.code }"
            @click="setCategory(c.code)"
          >
            <strong>{{ c.name }}</strong>
            <span class="jd-cat-slash" aria-hidden="true">/</span>
            <small>{{ categorySubKeywords(c) }}</small>
          </button>
        </aside>

        <div class="home-scene-banner jd-carousel">
          <img
            class="hero-banner-photo"
            :src="banners[bannerIdx].img"
            :alt="banners[bannerIdx].title"
            @click="triggerBanner(banners[bannerIdx])"
          />
          <button type="button" class="jd-half-arrow is-prev" aria-label="上一张横幅" @click="prevBanner">‹</button>
          <button type="button" class="jd-half-arrow is-next" aria-label="下一张横幅" @click="nextBanner">›</button>
          <div class="scene-banner-copy">
            <span class="carousel-scene-tag">{{ banners[bannerIdx].tag }}</span>
            <h2>{{ banners[bannerIdx].title }}</h2>
            <p>{{ banners[bannerIdx].sub }}</p>
            <div class="carousel-actions">
              <button type="button" class="carousel-cta-btn" @click="triggerBanner(banners[bannerIdx])">
                {{ banners[bannerIdx].cta }} <Icon name="chevronRight" :size="13" />
              </button>
              <div class="carousel-dots" role="tablist" aria-label="场景切换">
                <button
                  v-for="(b, bi) in banners"
                  :key="b.title"
                  type="button"
                  class="carousel-dot"
                  :class="{ active: bi === bannerIdx }"
                  :aria-label="'场景' + (bi + 1)"
                  @click="bannerIdx = bi"
                ></button>
              </div>
            </div>
          </div>
        </div>

        <div class="jd-right-panel">
          <div class="jd-user-box">
            <div class="jd-user-top">
              <span class="jd-user-avatar">{{ userInitial }}</span>
              <div>
                <strong>Hi~ {{ userGreeting }}</strong>
                <small>欢迎来到青柠校园自营</small>
              </div>
            </div>
            <div class="jd-user-btns">
              <button v-if="!store.user && !preview" type="button" class="jd-pill-red" @click="openLogin">新人登录</button>
              <a v-else href="#/orders" class="jd-pill-red" @click.prevent="go('/orders')">查自提单</a>
              <a href="#/apply" class="jd-pill-gold" @click.prevent="go('/apply')">商户入驻</a>
            </div>
          </div>

          <div class="jd-news-block">
            <div class="jd-news-head">
              <strong>校园快报</strong>
              <a href="#/orders" @click.prevent="go('/orders')">更多 ›</a>
            </div>
            <ul class="jd-news-list">
              <li><em>热议</em><span>冰萃拿铁与果切杯下课顺路 5 分钟即取</span></li>
              <li><em>保障</em><span>校内自营现货锁库 · 未核销支持随时退</span></li>
            </ul>
          </div>

          <div class="jd-service-grid">
            <button type="button" class="jd-service-tile hero-shopping" @click="go('/ai')">
              <Icon name="sparkles" :size="18" />
              <span class="hero-title">AI 导购</span>
            </button>
            <a href="#/orders" class="jd-service-tile" @click.prevent="go('/orders')">
              <Icon name="qrCode" :size="18" />
              <span>凭码自提</span>
            </a>
            <a href="#/apply" class="jd-service-tile" @click.prevent="go('/apply')">
              <Icon name="store" :size="18" />
              <span>门店直供</span>
            </a>
            <a href="#/orders" class="jd-service-tile" @click.prevent="go('/orders')">
              <Icon name="shield" :size="18" />
              <span>极速售后</span>
            </a>
          </div>
        </div>
      </section>

      <section v-if="seckillProducts.length" class="jd-seckill-row" aria-label="校内秒杀">
        <div class="jd-seckill-crimson" @click="sort = 'price'; page = 1; loadSearch()">
          <strong>校内秒杀</strong>
          <small>CAMPUS FLASH</small>
          <span class="jd-seckill-bolt"><Icon name="zap" :size="24" /></span>
          <p>校内特惠 · 现货直提</p>
          <div class="jd-clock-boxes" aria-label="极速自提时效">
            <span>15</span><i>:</i><span>00</span><i>:</i><span>即取</span>
          </div>
        </div>
        <div class="jd-seckill-track">
          <div
            v-for="fp in seckillProducts"
            :key="'sk-' + fp.productId"
            class="jd-seckill-tile"
            @click="showDetail(fp)"
          >
            <div class="jd-seckill-photo">
              <ProductImage :src="fp.imageUrl" :alt="fp.title" />
            </div>
            <span class="jd-seckill-title">{{ fp.title }}</span>
            <b class="jd-seckill-price">{{ money(cardSku(fp)?.priceCent) }}</b>
          </div>
        </div>
      </section>

      <section v-if="shops.length" class="jd-store-bar" aria-label="校内自营门店">
        <span class="jd-store-label"><Icon name="store" :size="14" />校内自营好店</span>
        <button
          type="button"
          class="store-pill-chip"
          :class="{ active: !merchant }"
          @click="merchant = ''; page = 1; loadSearch()"
        >
          全部门店
        </button>
        <button
          v-for="(m, idx) in shops"
          :key="m.merchantId"
          type="button"
          class="store-pill-chip merchant-card"
          :class="{ active: merchant === m.merchantId }"
          @click="toggleMerchant(m.merchantId)"
        >
          <ProductImage class="store-pill-avatar" :src="storePhoto(m, idx)" alt="" />
          <span>{{ m.name }}</span>
        </button>
        <button
          v-if="merchant"
          type="button"
          class="store-enter-inline"
          @click="go('/shops/' + pathId(merchant))"
        >
          进店主页 <Icon name="chevronRight" :size="12" />
        </button>
      </section>
    </template>

    <!-- ==================== REPLICA 3：小米有品 PC 版 (满幅 360px 商业摄影横幅 + 左侧 #845F3F 深棕半透明悬浮分类 + 5格严选金刚区) ==================== -->
    <template v-else-if="consumerMode === 'youpin'">
      <section class="yp-hero-stage" aria-label="有品严选首屏">
        <div class="yp-banner-canvas">
          <img
            class="hero-banner-photo"
            :src="banners[bannerIdx].img"
            :alt="banners[bannerIdx].title"
            @click="triggerBanner(banners[bannerIdx])"
          />
          <aside class="yp-cat-overlay" aria-label="有品分类导航">
            <button
              v-for="c in categories"
              :key="'yp-' + c.code"
              type="button"
              class="yp-cat-row category-item"
              :class="{ categoryActive: category === c.code }"
              @click="setCategory(c.code)"
            >
              <strong>{{ c.name }}</strong>
              <span class="yp-cat-sub">{{ categorySubKeywords(c) }}</span>
              <Icon name="chevronRight" :size="13" class="yp-cat-arrow" />
            </button>
          </aside>

          <div class="yp-banner-copy">
            <span class="yp-banner-tag">{{ banners[bannerIdx].tag }}</span>
            <h2>{{ banners[bannerIdx].title }}</h2>
            <p>{{ banners[bannerIdx].sub }}</p>
            <div class="carousel-actions">
              <button type="button" class="yp-banner-cta" @click="triggerBanner(banners[bannerIdx])">
                {{ banners[bannerIdx].cta }}
              </button>
              <div class="carousel-dots" role="tablist" aria-label="场景切换">
                <button
                  v-for="(b, bi) in banners"
                  :key="b.title"
                  type="button"
                  class="carousel-dot"
                  :class="{ active: bi === bannerIdx }"
                  :aria-label="'场景' + (bi + 1)"
                  @click="bannerIdx = bi"
                ></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="yp-kingkong-strip" aria-label="有品快捷频道与严选门店">
        <button type="button" class="yp-kingkong-item is-ai hero-shopping" @click="go('/ai')">
          <span class="yp-kingkong-circle yp-ai-medallion"><Icon name="sparkles" :size="22" /></span>
          <strong class="hero-title">AI 导购</strong>
          <small>智能严选配单</small>
        </button>

        <button
          v-for="(m, idx) in shops"
          :key="m.merchantId"
          type="button"
          class="yp-kingkong-item merchant-card"
          :class="{ active: merchant === m.merchantId }"
          @click="toggleMerchant(m.merchantId)"
        >
          <span class="yp-kingkong-circle">
            <ProductImage :src="storePhoto(m, idx)" :alt="m.name" />
          </span>
          <strong>{{ m.name }}</strong>
          <small>{{ m.storeName || m.location || '校内自提' }}</small>
        </button>

        <button
          v-if="merchant"
          type="button"
          class="yp-kingkong-enter"
          @click="go('/shops/' + pathId(merchant))"
        >
          <span>进入门店主页</span>
          <Icon name="chevronRight" :size="14" />
        </button>
      </section>
    </template>

    <!-- ==================== REPLICA 4：小红书 Web 版 (零传统大横幅！单行频道胶囊条 + 门店胶囊) ==================== -->
    <section v-else class="xhs-channel-deck" aria-label="发现频道与筛选">
      <div class="xhs-channel-row">
        <button
          type="button"
          class="xhs-channel-pill"
          :class="{ active: !category && !merchant }"
          @click="category = ''; merchant = ''; page = 1; loadSearch({ syncUrl: true })"
        >
          推荐
        </button>
        <button
          v-for="c in categories"
          :key="'xhs-' + c.code"
          type="button"
          class="xhs-channel-pill category-item"
          :class="{ categoryActive: category === c.code }"
          @click="setCategory(c.code)"
        >
          {{ c.name }}
        </button>
        <button type="button" class="xhs-ai-pill hero-shopping" @click="go('/ai')">
          <Icon name="sparkles" :size="14" />
          <span class="hero-title">AI 导购</span>
        </button>
      </div>

      <div v-if="shops.length" class="xhs-store-row" aria-label="校内门店">
        <button
          type="button"
          class="xhs-store-chip"
          :class="{ active: !merchant }"
          @click="merchant = ''; page = 1; loadSearch()"
        >
          全部门店
        </button>
        <button
          v-for="(m, idx) in shops"
          :key="m.merchantId"
          type="button"
          class="xhs-store-chip merchant-card"
          :class="{ active: merchant === m.merchantId }"
          @click="toggleMerchant(m.merchantId)"
        >
          <ProductImage class="store-pill-avatar" :src="storePhoto(m, idx)" alt="" />
          <span>{{ m.name }}</span>
        </button>
        <button
          v-if="merchant"
          type="button"
          class="store-enter-inline"
          @click="go('/shops/' + pathId(merchant))"
        >
          进店主页 <Icon name="chevronRight" :size="12" />
        </button>
      </div>
    </section>

    <!-- ==================== 商品流楼层标题 + 排序/价格筛选栏 + 4 套差异化商品卡网格 ==================== -->
    <section class="reco-section">
      <div v-if="consumerMode === 'jd'" class="jd-floor-heading">
        <span class="jd-floor-deco" aria-hidden="true"></span>
        <h2>为你推荐</h2>
        <span class="jd-floor-deco" aria-hidden="true"></span>
      </div>
      <div v-else-if="consumerMode === 'youpin'" class="yp-floor-heading">
        <h2>有品推荐</h2>
        <span>严选校园品质好物 · 到店凭码即取</span>
      </div>

      <div class="feed-sticky-bar">
        <div class="feed-bar-left">
          <div v-if="consumerMode === 'taobao'" class="tb-feed-title">
            <h2>猜你喜欢</h2>
            <span class="tb-feed-pill">个性推荐</span>
          </div>
          <div class="sort-tabs">
            <button type="button" :class="{ active: sort === 'popular' }" @click="sort = 'popular'; page = 1; loadSearch()">最新</button>
            <button type="button" :class="{ active: sort === 'sales' }" @click="sort = 'sales'; page = 1; loadSearch()">热销</button>
            <button type="button" :class="{ active: sort === 'price' }" @click="sort = 'price'; page = 1; loadSearch()">价格</button>
            <button type="button" :class="{ active: sort === 'priceDesc' }" @click="sort = 'priceDesc'; page = 1; loadSearch()">价格降序</button>
            <button type="button" :class="{ active: sort === 'stock' }" @click="sort = 'stock'; page = 1; loadSearch()">库存</button>
          </div>
        </div>
        <div class="price-filter" aria-label="价格筛选">
          <span class="price-filter-label">价格</span>
          <input v-model="priceMin" inputmode="decimal" placeholder="¥最低" aria-label="最低价（元）" @keydown.enter="applyPrice" />
          <span>—</span>
          <input v-model="priceMax" inputmode="decimal" placeholder="¥最高" aria-label="最高价（元）" @keydown.enter="applyPrice" />
          <button type="button" class="outline-button" @click="applyPrice">应用</button>
          <button v-if="priceActive" type="button" class="outline-button" @click="clearPrice">清除价格</button>
          <button type="button" class="price-filter-reset" @click="resetFilters">重置筛选</button>
        </div>
      </div>

      <div v-if="priceError" class="inline-error price-filter-error" role="alert">
        <Icon name="alert" :size="16" />{{ priceError }}
      </div>
      <StatusPanel v-if="store.loading" state="loading" message="正在加载商品…" />
      <div v-if="store.error" class="inline-error">
        <Icon name="alert" :size="18" />{{ store.error }}
        <button v-if="!preview" type="button" class="outline-button small" @click="retryLoad()">重试</button>
      </div>
      <StatusPanel
        v-if="!store.loading && !shown.length && !store.error"
        state="empty"
        message="暂无符合条件的商品"
        action-label="查看全部"
        @retry="resetFilters"
      />

      <div :class="['home-product-grid', 'grid-' + consumerMode]">
        <article
          v-for="p in shown"
          :key="p.productId"
          :class="['home-product', 'card-' + consumerMode]"
          @click="showDetail(p)"
        >
          <div class="home-product-photo">
            <ProductImage :src="p.imageUrl" :alt="p.title" />
            <span
              v-if="consumerMode !== 'youpin' && (p.tag || available(p) <= 10)"
              class="product-photo-badge"
              :class="{
                'is-soldout': available(p) <= 0,
                'is-scarce': !p.tag && available(p) > 0 && available(p) <= 10,
              }"
            >
              {{ available(p) <= 0 ? '暂时售罄' : p.tag ? p.tag : '仅剩 ' + available(p) + ' 件' }}
            </span>
            <span
              v-else-if="consumerMode === 'youpin' && available(p) <= 0"
              class="product-photo-badge is-soldout"
            >
              暂时售罄
            </span>
          </div>

          <div class="home-product-info">
            <div class="home-product-title-line">
              <span v-if="consumerMode === 'taobao'" class="rtl-inline-tag is-taobao" aria-hidden="true">自提</span>
              <span v-else-if="consumerMode === 'jd'" class="rtl-inline-tag is-jd" aria-hidden="true">自营</span>
              <button type="button" class="home-product-open" @click.stop="showDetail(p)">{{ p.title }}</button>
            </div>

            <!-- 小米有品：居中极简灰字卖点 + 规格 -->
            <div v-if="consumerMode === 'youpin'" class="yp-card-subtitle">
              <span>{{ p.description || (p.merchantStoreName || p.merchantName || shopName(p.merchantId)) }}</span>
              <span class="product-meta-dot">·</span>
              <span>{{ cardSku(p)?.specKey || '标准装' }}</span>
            </div>
            <!-- 小红书：规格轻标签 -->
            <div v-else-if="consumerMode === 'xiaohongshu'" class="xhs-card-spec-row">
              <span>{{ cardSku(p)?.specKey || '标准装' }}</span>
              <span v-if="available(p) > 0 && available(p) <= 10" class="xhs-scarce-text">剩 {{ available(p) }}</span>
            </div>
            <!-- 淘宝 / 京东：门店 + 规格行 -->
            <div v-else class="product-store-meta">
              <span>{{ p.merchantStoreName || p.merchantName || shopName(p.merchantId) }}</span>
              <span class="product-meta-dot">·</span>
              <span>{{ cardSku(p)?.specKey || '标准装' }}</span>
            </div>

            <!-- 小红书笔记底栏：左圆形店标+店名，右小红书红价格+加购 -->
            <div v-if="consumerMode === 'xiaohongshu'" class="xhs-note-footer">
              <div class="xhs-note-author">
                <ProductImage class="xhs-author-avatar" :src="storePhotoByMerchantId(p.merchantId)" alt="" />
                <span>{{ p.merchantStoreName || p.merchantName || shopName(p.merchantId) }}</span>
              </div>
              <div class="xhs-note-price-act">
                <span class="price-main rtl-price">
                  <em class="yen">¥</em><b class="int">{{ splitPrice(cardSku(p)?.priceCent).int }}</b><i v-if="splitPrice(cardSku(p)?.priceCent).dec" class="dec">{{ splitPrice(cardSku(p)?.priceCent).dec }}</i><small v-if="p.skus?.length > 1" class="qi"> 起</small>
                </span>
                <button
                  type="button"
                  class="rtl-plus-btn"
                  :class="{ 'is-spec': hasMultipleActiveSkus(p) }"
                  :disabled="quickAddingId === p.productId"
                  :aria-label="hasMultipleActiveSkus(p) ? '选规格 ' + p.title : '加购 ' + p.title"
                  @click.stop="quickAdd(p)"
                >
                  <template v-if="hasMultipleActiveSkus(p)">选规格</template>
                  <template v-else>
                    <Icon name="plus" :size="14" />
                    <em v-if="quickAddedMap[p.productId]" class="rtl-plus-badge">{{ quickAddedMap[p.productId] }}</em>
                  </template>
                </button>
              </div>
            </div>

            <!-- 淘宝 / 京东 / 小米有品价格底栏 -->
            <div v-else class="product-price-row">
              <span class="price-main rtl-price">
                <em class="yen">¥</em><b class="int">{{ splitPrice(cardSku(p)?.priceCent).int }}</b><i v-if="splitPrice(cardSku(p)?.priceCent).dec" class="dec">{{ splitPrice(cardSku(p)?.priceCent).dec }}</i><small v-if="p.skus?.length > 1" class="qi"> 起</small>
              </span>
              <button
                type="button"
                class="rtl-plus-btn"
                :class="{ 'is-spec': hasMultipleActiveSkus(p) }"
                :disabled="quickAddingId === p.productId"
                :aria-label="hasMultipleActiveSkus(p) ? '选规格 ' + p.title : '加购 ' + p.title"
                @click.stop="quickAdd(p)"
              >
                <template v-if="hasMultipleActiveSkus(p)">选规格</template>
                <template v-else>
                  <Icon name="plus" :size="15" />
                  <em v-if="quickAddedMap[p.productId]" class="rtl-plus-badge">{{ quickAddedMap[p.productId] }}</em>
                </template>
              </button>
            </div>
          </div>
        </article>
      </div>

      <UiPagination
        v-if="!preview && pageInfo.total > 0"
        :page="page"
        :has-next="pageInfo.hasNext"
        :busy="store.loading"
        @previous="page--; loadSearch()"
        @next="page++; loadSearch()"
      >
        共 {{ pageInfo.total }} 件
      </UiPagination>
    </section>

    <div v-if="store.cartCount > 0 && !selected && !preview" class="floating-cart-pill">
      <span>已选 {{ store.cartCount }} 件商品</span>
      <button type="button" aria-label="去结算" @click="go('/cart')">
        去结算 <Icon name="chevronRight" :size="14" />
      </button>
    </div>

    <div v-if="selected" v-modal="() => (selected = null)" class="ui-overlay" @click.self="selected = null">
      <div class="product-sheet" role="dialog" aria-modal="true" :aria-label="selected.title">
        <button class="sheet-close" aria-label="关闭" @click="selected = null"><Icon name="x" :size="18" /></button>
        <div class="sheet-product-line">
          <ProductImage :src="selected.imageUrl" :alt="selected.title" />
          <div>
            <h3>{{ selected.title }}</h3>
            <div class="sheet-price rtl-price">
              <em class="yen">¥</em><b class="int">{{ splitPrice(chosen.priceCent).int }}</b><i v-if="splitPrice(chosen.priceCent).dec" class="dec">{{ splitPrice(chosen.priceCent).dec }}</i>
            </div>
            <span class="sheet-muted">
              <Icon name="store" :size="12" />
              {{ currentShop(selected).name || selected.merchantName || '校内门店' }}
            </span>
          </div>
        </div>
        <button class="more-product-detail" @click="go('/product/' + pathId(selected.productId)); selected = null">
          查看商品详情 <Icon name="chevronRight" :size="15" />
        </button>
        <label class="sheet-field-label">规格</label>
        <div class="sku-picker">
          <button
            v-for="sku in selected.skus"
            :key="sku.skuId"
            :class="{ active: chosenSku === sku.skuId }"
            :aria-pressed="chosenSku === sku.skuId"
            :disabled="saving || sku.status !== 'ACTIVE' || Number(sku.available) <= 0"
            @click="chosenSku = sku.skuId; count = 1"
          >
            {{ sku.specKey }}
          </button>
        </div>
        <div class="quantity-picker">
          <span>数量 <small class="sheet-stock-hint">库存 {{ chosen.available || 0 }} 件</small></span>
          <div>
            <button aria-label="减少数量" :disabled="saving" @click="count = Math.max(1, count - 1)">
              <Icon name="minus" :size="16" />
            </button>
            <b>{{ count }}</b>
            <button
              aria-label="增加数量"
              :disabled="saving || count >= Number(chosen.available || 0)"
              @click="count = Math.min(99, Number(chosen.available || 0), count + 1)"
            >
              <Icon name="plus" :size="16" />
            </button>
          </div>
        </div>
        <button class="primary-wide" :disabled="!canAdd || saving || preview" @click="addCart">
          {{ saving ? '加入中…' : '加入购物车' }}
        </button>
      </div>
    </div>
  </ConsumerShell>`,
};
