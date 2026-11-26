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
const CATEGORY_SUBTITLES = {
  drink: '冰乌龙 / 鲜奶 / 拿铁',
  beverage: '无糖茶 / 矿泉水',
  food: '豚骨泡面 / 坚果 / 能量棒',
  fruit: '双拼果切 / 甜橙 / 酸奶',
  stationery: '速干笔 / 活页本 / 荧光笔',
  daily: '竹浆抽纸 / 消毒湿巾',
  dormitory: '洗护常备 / 宿舍日百',
  digital: '护眼台灯 / 降噪耳机',
};
const CATEGORY_BADGES = {
  drink: '冰镇秒取',
  food: '夜宵热卖',
  fruit: '当日现切',
  stationery: '考前必囤',
  daily: '整提特惠',
  digital: '自习神器',
};

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
    let bannerTimer = null;

    const banners = computed(() => [
      {
        tag: '北苑24h便利仓 · 深夜能量站',
        title: '深夜赶论文 · 5分钟热汤豚骨面配冰茶',
        sub: '豚骨叉烧杯面 + 0糖原叶乌龙茶 · 下单锁库存，下楼凭码免排队即取',
        cta: '去抢夜宵好物',
        keyword: '泡面',
        theme: 'warm',
        img: preview ? './images/noodles.webp' : './images/prod-instant-noodles.jpg',
      },
      {
        tag: '图书馆南门连廊 · 早八提神专场',
        title: '早八大课间 · 生椰冰拿铁与巴氏鲜奶',
        sub: '支持预约 10:00 大课间自提时段，静音出餐不排队，进馆顺手带走',
        cta: '逛茶饮冰咖',
        categoryCode: 'drink',
        theme: 'fresh',
        img: preview ? './images/milk.webp' : './images/prod-iced-latte.jpg',
      },
      {
        tag: '南区鲜果屋 · 坏果包退',
        title: '清晨冷链直达 · 现切草莓芒果双拼果杯',
        sub: '每日现切鲜果不过夜，高蛋白希腊酸奶碗满口维C超清爽',
        cta: '挑现切鲜果',
        categoryCode: 'fruit',
        theme: 'berry',
        img: preview ? './images/category-fruit.webp' : './images/prod-fruit-cup.jpg',
      },
    ]);

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
          if (merged.length >= 6) return merged;
        }
      }
      return merged;
    });
    const categories = computed(() => store.categories.filter((c) => c.active));
    const shops = computed(() => store.merchants.filter((m) => m.status === 'ACTIVE').slice(0, 6));
    const flashPair = computed(() => {
      const out = [];
      const seenImg = new Set();
      for (const p of shown.value) {
        const key = p.imageUrl || p.productId;
        if (seenImg.has(key)) continue;
        seenImg.add(key);
        out.push(p);
        if (out.length >= 2) break;
      }
      return out.length ? out : shown.value.slice(0, 2);
    });
    const lowPricePair = computed(() => {
      const seenImg = new Set(flashPair.value.map((f) => f.imageUrl).filter(Boolean));
      const underTen = [];
      for (const p of shown.value) {
        if (Number(cardSku(p)?.priceCent) > 1000) continue;
        if (flashPair.value.some((f) => f.productId === p.productId)) continue;
        const key = p.imageUrl || p.productId;
        if (seenImg.has(key)) continue;
        seenImg.add(key);
        underTen.push(p);
        if (underTen.length >= 2) break;
      }
      return underTen.length
        ? underTen
        : shown.value.filter((p) => Number(cardSku(p)?.priceCent) <= 1000).slice(0, 2);
    });
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

    function applyQuickFilter(mode) {
      if (mode === 'hot') {
        sort.value = 'sales';
        page.value = 1;
        loadSearch();
      } else if (mode === 'lowPrice') {
        priceMin.value = '';
        priceMax.value = '10';
        applyPrice();
      } else if (mode === 'ai') {
        go('/ai');
      }
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
      const next = [clean, ...searchHistory.value.filter((x) => x !== clean)].slice(0, 6);
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
        }, 5200);
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
      splitPrice,
      skuOf,
      priceSku,
      available,
      shopName,
      preview,
      discovery,
      banners,
      bannerIdx,
      triggerBanner,
      applyQuickFilter,
      keywords,
      discoveryShelf,
      flashPair,
      lowPricePair,
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
      CATEGORY_SUBTITLES,
      CATEGORY_BADGES,
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
    <section class="mall-search-stage" aria-label="商城搜索主栏">
      <div class="mall-search-row">
        <div class="mall-search-Promise">
          <span class="promise-badge">闪电自提</span>
          <strong>全校现货比价 · 免打包费</strong>
        </div>
        <div class="mall-search-center">
          <div class="mall-search-bar-wrap">
            <div class="big-search">
              <span class="search-scope-pill">校内现货</span>
              <Icon name="search" :size="18"/>
              <input v-model="search" placeholder="搜无糖乌龙茶、豚骨泡面、纯牛奶、现切果杯、速干中性笔…" aria-label="搜索校园商品" @keydown.enter="submitSearch"/>
              <button @click="submitSearch">搜索</button>
            </div>
            <button type="button" class="mall-ai-ask-btn" @click="go('/ai')">
              <Icon name="sparkles" :size="15"/>
              <span>AI 帮我挑</span>
            </button>
          </div>
          <div class="popular-tags">
            <span class="hot-search-label">热搜：</span>
            <button v-for="(k, ki) in keywords" :key="k" @click="applyKeyword(k)" :class="{active:search===k, isHot:ki<2}">
              <em v-if="ki<2" class="hot-mini-tag">热</em>{{k}}
            </button>
            <template v-if="searchHistory.length">
              <span class="search-history-sep">|</span>
              <span class="search-history-label">历史：</span>
              <button type="button" v-for="h in searchHistory.slice(0,3)" :key="'h-'+h" class="search-history-chip" @click="applyKeyword(h)">{{h}}</button>
              <button type="button" class="search-history-clear" @click="clearSearchHistory">清空</button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <section class="mall-first-screen" aria-label="商城首屏核心区">
      <aside class="mall-cat-tree" aria-label="全部分类导航">
        <div class="cat-tree-head"><Icon name="grid" :size="15"/><span>校内商品分类</span></div>
        <button
          v-for="c in categories"
          :key="'tree-'+c.code"
          type="button"
          class="cat-tree-row"
          :class="{active:category===c.code}"
          @click="setCategory(c.code)"
        >
          <div class="cat-tree-text">
            <strong>{{c.name}}</strong>
            <small>{{CATEGORY_SUBTITLES[c.code] || '校内门店现货直供'}}</small>
          </div>
          <Icon name="chevronRight" :size="13"/>
        </button>
      </aside>

      <div class="mall-banner-stage">
        <div class="mall-carousel" :class="'theme-' + banners[bannerIdx].theme">
          <div class="mall-carousel-copy">
            <span class="carousel-scene-tag">{{banners[bannerIdx].tag}}</span>
            <h2>{{banners[bannerIdx].title}}</h2>
            <p>{{banners[bannerIdx].sub}}</p>
            <div class="carousel-actions">
              <button type="button" class="carousel-cta-btn" @click="triggerBanner(banners[bannerIdx])">
                {{banners[bannerIdx].cta}} <Icon name="chevronRight" :size="14"/>
              </button>
              <div class="carousel-dots" role="tablist" aria-label="焦点海报切换">
                <button
                  v-for="(b, bi) in banners"
                  :key="b.title"
                  type="button"
                  class="carousel-dot"
                  :class="{active:bi===bannerIdx}"
                  :aria-label="'海报'+(bi+1)"
                  @click="bannerIdx=bi"
                ></button>
              </div>
            </div>
          </div>
          <div class="mall-carousel-art" @click="triggerBanner(banners[bannerIdx])">
            <ProductImage :src="banners[bannerIdx].img" :alt="banners[bannerIdx].title"/>
          </div>
        </div>

        <div class="mall-sub-channels">
          <div class="sub-channel-card flash" @click="applyQuickFilter('hot')">
            <div class="sub-channel-head">
              <strong>⚡ 课间闪电自提</strong>
              <span class="sub-badge red">8分钟出餐</span>
            </div>
            <p>教学楼 / 图书馆顺路秒取免排队</p>
            <div v-if="flashPair.length" class="sub-mini-thumbs">
              <div v-for="item in flashPair" :key="'f-'+item.productId" class="sub-mini-item" @click.stop="showDetail(item)">
                <ProductImage :src="item.imageUrl" :alt="item.title"/>
                <b>{{money(cardSku(item)?.priceCent)}}</b>
              </div>
            </div>
          </div>
          <div class="sub-channel-card subsidy" @click="applyQuickFilter('lowPrice')">
            <div class="sub-channel-head">
              <strong>🧧 十元平价好物</strong>
              <span class="sub-badge green">学生专享价</span>
            </div>
            <p>10元封顶零食水饮文具高性价比必囤</p>
            <div v-if="lowPricePair.length" class="sub-mini-thumbs">
              <div v-for="item in lowPricePair" :key="'s-'+item.productId" class="sub-mini-item" @click.stop="showDetail(item)">
                <ProductImage :src="item.imageUrl" :alt="item.title"/>
                <b>{{money(cardSku(item)?.priceCent)}}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside class="mall-user-cabin" aria-label="个人履约与AI导购舱">
        <div class="cabin-user-card">
          <div class="cabin-user-top">
            <span class="cabin-avatar">{{(store.user?.displayName || store.user?.username || '青').slice(0,1)}}</span>
            <div>
              <strong>Hi，{{store.user?.displayName || store.user?.username || '同学你好'}}</strong>
              <small>{{store.user ? '校内实名认证 · 享0元起提' : '登录同步购物车与取餐码'}}</small>
            </div>
          </div>
          <div class="cabin-stat-grid">
            <button type="button" @click="go('/cart')"><b>{{store.cartCount||0}}</b><span>待结商品</span></button>
            <button type="button" @click="go('/orders')"><b>自提</b><span>查取餐码</span></button>
            <button type="button" @click="go('/account')"><b>{{discovery?.favoriteProductIds?.length||0}}</b><span>收藏夹</span></button>
            <button type="button" @click="go('/account')"><b>{{discovery?.recentProducts?.length||0}}</b><span>足迹</span></button>
          </div>
        </div>

        <button class="hero-shopping" @click="go('/ai')" aria-label="进入 AI 导购">
          <div class="cabin-ai-top">
            <img src="./images/robot.webp" alt="AI 导购助手" class="cabin-ai-avatar"/>
            <div>
              <div class="hero-title"><span>AI</span> 导购</div>
              <small>青柠问问 · 跨店实时比价凑单</small>
            </div>
            <span class="cabin-ai-go">去提问 <Icon name="chevronRight" :size="13"/></span>
          </div>
          <p class="cabin-ai-desc">“30元内配齐熬夜泡面+无糖茶？” 说出预算口味，核验真实库存后一键加购</p>
        </button>

        <div class="cabin-guarantees">
          <span><Icon name="check" :size="12"/> 校内实名店</span>
          <span><Icon name="shield" :size="12"/> 锁库存保价</span>
          <span><Icon name="clock" :size="12"/> 未取随时退</span>
        </div>
      </aside>
    </section>

    <section class="category-section kingkong-grid" aria-label="商品分类">
      <button v-for="c in categories" :key="c.code" class="category-item" @click="setCategory(c.code)" :class="{categoryActive:category===c.code}">
        <span v-if="CATEGORY_BADGES[c.code]" class="kingkong-micro-tag">{{CATEGORY_BADGES[c.code]}}</span>
        <span class="category-picture"><img :src="staticCategoryArt[c.code]||'./images/category-snacks.webp'" :alt="c.name"/></span>
        <strong>{{c.name}}</strong>
      </button>
      <button type="button" class="kingkong-extra-item" @click="applyQuickFilter('hot')">
        <span class="kingkong-micro-tag hot">HOT</span>
        <span class="kingkong-icon-circle coral"><Icon name="flame" :size="22"/></span>
        <strong>热销爆款</strong>
      </button>
      <button type="button" class="kingkong-extra-item" @click="applyQuickFilter('lowPrice')">
        <span class="kingkong-micro-tag">好价</span>
        <span class="kingkong-icon-circle amber"><Icon name="star" :size="22"/></span>
        <strong>十元好物</strong>
      </button>
      <button type="button" class="kingkong-extra-item" @click="applyQuickFilter('ai')">
        <span class="kingkong-micro-tag green">AI</span>
        <span class="kingkong-icon-circle mint"><Icon name="sparkles" :size="22"/></span>
        <strong>AI帮我挑</strong>
      </button>
      <button type="button" class="kingkong-extra-item" @click="go('/orders')">
        <span class="kingkong-icon-circle sky"><Icon name="scan" :size="22"/></span>
        <strong>亮码取餐</strong>
      </button>
    </section>

    <section v-if="discoveryShelf.length && !hasActiveSearch" class="discovery-shelf" aria-label="校内实时热销榜">
      <div class="section-head flash-head">
        <div class="section-title">
          <span class="flash-pill-tag"><Icon name="flame" :size="14"/> 限时热卖榜</span>
          <h2>同学都在买 · 校内复购飙升榜</h2>
        </div>
        <span class="tiny-note">校内门店现货直供 · 下单立锁库存</span>
      </div>
      <div class="discovery-shelf-track">
        <button type="button" class="discovery-shelf-card" v-for="(p, idx) in discoveryShelf" :key="p.productId" @click="showDetail(p)">
          <span class="shelf-rank-badge" :class="'rank-'+(idx+1)">TOP {{idx+1}}</span>
          <div class="discovery-shelf-photo"><ProductImage :src="p.imageUrl" :alt="p.title"/></div>
          <div class="discovery-shelf-info">
            <strong>{{p.title}}</strong>
            <small>{{p.merchantStoreName||p.merchantName||'校内自提店'}}</small>
            <div class="shelf-price-line">
              <span class="rtl-price"><em class="yen">¥</em><b class="int">{{splitPrice(cardSku(p)?.priceCent).int}}</b><i v-if="splitPrice(cardSku(p)?.priceCent).dec" class="dec">{{splitPrice(cardSku(p)?.priceCent).dec}}</i></span>
              <span class="shelf-buy-pill">抢</span>
            </div>
          </div>
        </button>
      </div>
    </section>

    <section class="merchant-section">
      <div class="section-head">
        <div class="section-title"><span class="head-accent mint"><Icon name="store" :size="17"/></span><h2>校内品质好店街</h2></div>
        <span class="tiny-note">覆盖食堂、图书馆、南北宿舍区 · 免打包费</span>
      </div>
      <div class="merchant-cards">
        <div class="merchant-card" v-for="(m,idx) in shops" :key="m.merchantId" :class="{active:merchant===m.merchantId}" @click="merchant=merchant===m.merchantId?'':m.merchantId;page=1;loadSearch()">
          <div class="merchant-card-top">
            <span class="merchant-logo" :class="'store-'+idx"><img v-if="m.imageUrl||m.image" :src="m.imageUrl||m.image" :alt="m.name"/><Icon v-else name="store" :size="20"/></span>
            <div class="merchant-card-meta">
              <div class="merchant-title-row">
                <strong>{{m.name}}</strong>
                <span class="store-rating-pill">★ 4.9</span>
              </div>
              <small>{{m.storeName||m.location||'校内自提点'}}</small>
            </div>
          </div>
          <div class="merchant-card-tags">
            <span class="merchant-chip"><span class="merchant-chip-dot"></span> {{m.businessHours?m.businessHours.slice(0,16):'营业中 · 约8分钟出餐'}}</span>
            <span class="store-free-tag">免打包费</span>
            <button type="button" class="store-enter-mini" @click.stop="go('/shops/'+pathId(m.merchantId))">进店 <Icon name="chevronRight" :size="12"/></button>
          </div>
        </div>
      </div>
      <div v-if="merchant" class="merchant-filter-bar"><span>当前只看门店：<b>{{shopName(merchant)}}</b></span><div class="merchant-filter-actions"><button type="button" class="shop-visit-link" @click="go('/shops/'+pathId(merchant))">进入店铺主页 <Icon name="chevronRight" :size="13"/></button><button type="button" @click="merchant='';page=1;loadSearch()">查看全校商品 <Icon name="x" :size="13" /></button></div></div>
    </section>

    <section class="reco-section">
      <div class="feed-sticky-bar">
        <div class="section-head reco-heading">
          <div class="section-title">
            <span class="feed-title-main">猜你喜欢</span>
            <span class="feed-title-sub">精选校内现货</span>
          </div>
          <div class="sort-tabs">
            <button :class="{active:sort==='popular'}" @click="sort='popular';page=1;loadSearch()">最新</button>
            <button :class="{active:sort==='sales'}" @click="sort='sales';page=1;loadSearch()">热销优先</button>
            <button :class="{active:sort==='stock'}" @click="sort='stock';page=1;loadSearch()">库存</button>
            <button :class="{active:sort==='price'}" @click="sort='price';page=1;loadSearch()">价格</button>
            <button :class="{active:sort==='priceDesc'}" @click="sort='priceDesc';page=1;loadSearch()">价格从高到低</button>
          </div>
        </div>
        <div class="price-filter" aria-label="价格筛选">
          <span class="price-filter-label">价格区间(元)</span>
          <input v-model="priceMin" inputmode="decimal" placeholder="¥最低" aria-label="最低价（元）" @keydown.enter="applyPrice"/>
          <span>—</span>
          <input v-model="priceMax" inputmode="decimal" placeholder="¥最高" aria-label="最高价（元）" @keydown.enter="applyPrice"/>
          <button class="outline-button" @click="applyPrice">应用</button>
          <button v-if="priceActive" @click="clearPrice">清除价格</button>
          <button class="price-filter-reset" @click="resetFilters">重置筛选</button>
        </div>
      </div>
      <div v-if="priceError" class="inline-error price-filter-error" role="alert"><Icon name="alert" :size="16"/>{{priceError}}</div>
      <StatusPanel v-if="store.loading" state="loading" message="正在加载校内现货…"/>
      <div v-if="store.error" class="inline-error"><Icon name="alert" :size="18"/>{{store.error}} <button v-if="!preview" type="button" class="outline-button small" @click="retryLoad()">重试</button></div>
      <StatusPanel v-if="!store.loading&&!shown.length&&!store.error" state="empty" message="暂无符合条件的商品" action-label="查看全部" @retry="resetFilters"/>
      <div class="home-product-grid">
        <article class="home-product" v-for="p in shown" :key="p.productId" @click="showDetail(p)">
          <div class="home-product-photo">
            <ProductImage :src="p.imageUrl" :alt="p.title"/>
            <span v-if="p.tag" class="corner-tag">{{p.tag}}</span>
            <span v-else-if="p.skus?.length > 1" class="corner-tag multi">{{p.skus.length}}款可选</span>
            <span class="floating-pickup">⚡ 到店自提</span>
          </div>
          <div class="home-product-info">
            <button class="home-product-open" @click.stop="showDetail(p)">{{p.title}}</button>
            <div class="rtl-card-tags">
              <span class="rtl-tag promo">免打包费</span>
              <span class="rtl-tag spec">{{cardSku(p)?.specKey||'标准装'}}</span>
              <span v-if="available(p)>0 && available(p)<=20" class="rtl-tag scarce">仅剩{{available(p)}}件</span>
            </div>
            <div class="product-store-meta">
              <Icon name="store" :size="12"/>
              <span>{{p.merchantStoreName||p.merchantName||shopName(p.merchantId)}}</span>
              <em class="stock-dot-note">{{available(p)>0 ? '现货'+available(p) : '已售罄'}}</em>
            </div>
            <div class="product-price-row">
              <span class="price-main rtl-price">
                <em class="yen">¥</em><b class="int">{{splitPrice(cardSku(p)?.priceCent).int}}</b><i v-if="splitPrice(cardSku(p)?.priceCent).dec" class="dec">{{splitPrice(cardSku(p)?.priceCent).dec}}</i><small v-if="p.skus?.length>1" class="qi">起</small>
              </span>
              <button class="rtl-plus-btn" @click.stop="showDetail(p)" :aria-label="'查看'+p.title">
                <Icon name="plus" :size="16" />
              </button>
            </div>
          </div>
        </article>
      </div>
      <UiPagination v-if="!preview && pageInfo.total>0" :page="page" :has-next="pageInfo.hasNext" :busy="store.loading" @previous="page--;loadSearch()" @next="page++;loadSearch()">共 {{pageInfo.total}} 件</UiPagination>
    </section>

    <div v-if="selected" v-modal="() => selected=null" class="ui-overlay" @click.self="selected=null">
      <div class="product-sheet" role="dialog" aria-modal="true" :aria-label="selected.title">
        <button class="sheet-close" @click="selected=null" aria-label="关闭"><Icon name="x" :size="19"/></button>
        <div class="sheet-product-line">
          <ProductImage :src="selected.imageUrl" :alt="selected.title"/>
          <div>
            <div class="sheet-badges-row">
              <span class="mini-category">{{productCategory(selected)}}</span>
              <span class="rtl-tag promo">免打包费 · 闪电自提</span>
            </div>
            <h3>{{selected.title}}</h3>
            <div class="sheet-price rtl-price"><em class="yen">¥</em><b class="int">{{splitPrice(chosen.priceCent).int}}</b><i v-if="splitPrice(chosen.priceCent).dec" class="dec">{{splitPrice(chosen.priceCent).dec}}</i></div>
            <span class="sheet-muted"><Icon name="store" :size="12"/> {{currentShop(selected).name||selected.merchantName||'校内商户'}}</span>
          </div>
        </div>
        <button class="more-product-detail" @click="go('/product/'+pathId(selected.productId));selected=null">查看商品详情 · 图文与评价 <Icon name="chevronRight" :size="15"/></button>
        <label class="sheet-field-label">选择规格</label>
        <div class="sku-picker">
          <button v-for="sku in selected.skus" :key="sku.skuId" :class="{active:chosenSku===sku.skuId}" :aria-pressed="chosenSku===sku.skuId" :disabled="saving||sku.status!=='ACTIVE'||Number(sku.available)<=0" @click="chosenSku=sku.skuId;count=1">
            <span>{{sku.specKey}}</span>
            <small class="sku-inline-price">{{money(sku.priceCent)}}</small>
          </button>
        </div>
        <div class="quantity-picker">
          <span>购买数量 <small class="sheet-stock-hint">实时可售 {{chosen.available||0}} 件</small></span>
          <div>
            <button @click="count=Math.max(1,count-1)" aria-label="减少数量" :disabled="saving"><Icon name="minus" :size="17" /></button>
            <b>{{count}}</b>
            <button @click="count=Math.min(99,Number(chosen.available||0),count+1)" aria-label="增加数量" :disabled="saving||count>=Number(chosen.available||0)"><Icon name="plus" :size="17"/></button>
          </div>
        </div>
        <button class="primary-wide" :disabled="!canAdd || saving || preview" @click="addCart">{{saving?'加入中…':'加入购物车'}}</button>
      </div>
    </div>
  </ConsumerShell>`,
};
