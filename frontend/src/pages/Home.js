import { requestScope } from '../services/request-scope.js';
import { pathId } from '../services/page-utils.js';
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
  beginPublicSearch,
  publicSearchCurrent,
} from '../services/store.js';
const { ref, computed } = Vue;
const staticCategoryArt = {
  food: './images/category-snacks.webp',
  drink: './images/category-drinks.webp',
  fruit: './images/category-fruit.webp',
  stationery: './images/category-stationery.webp',
  daily: './images/category-daily.webp',
};
export default {
  name: 'Home',
  components: { ConsumerShell, ProductImage },
  setup() {
    const scope = requestScope();
    const keywords = ['泡面', '牛奶', '水果', '文具', '纸巾', '零食'];
    const search = ref('');
    const category = ref('');
    const merchant = ref('');
    const sort = ref('popular');
    const page = ref(1);
    const selected = ref(null);
    const chosenSku = ref('');
    const count = ref(1);
    const saving = ref(false);
    const categories = computed(() => store.categories.filter((c) => c.active).slice(0, 5));
    const shops = computed(() => store.merchants.filter((m) => m.status === 'ACTIVE').slice(0, 3));
    const shown = computed(() => {
      let arr = store.products.filter((p) => p.status === 'PUBLISHED');
      if (preview) {
        const q = search.value.trim().toLowerCase();
        if (q) arr = arr.filter((p) => (p.title + ' ' + p.description).toLowerCase().includes(q));
      }
      if (category.value) arr = arr.filter((p) => p.categoryCode === category.value);
      if (merchant.value) arr = arr.filter((p) => p.merchantId === merchant.value);
      if (preview && sort.value === 'price')
        arr = [...arr].sort((a, b) => Number(skuOf(a).priceCent) - Number(skuOf(b).priceCent));
      if (preview && sort.value === 'stock')
        arr = [...arr].sort((a, b) => available(b) - available(a));
      return arr;
    });
    const priceSku = (p) =>
      [...(p?.skus || [])]
        .filter((s) => s.status === 'ACTIVE')
        .sort((a, b) => Number(a.priceCent) - Number(b.priceCent))[0] || skuOf(p);
    const pageInfo = computed(() => store.publicPage);
    const chosen = computed(
      () => selected.value?.skus?.find((s) => s.skuId === chosenSku.value) || skuOf(selected.value),
    );
    const productCategory = (p) =>
      store.categories.find((c) => c.code === p.categoryCode)?.name || '好物';
    const currentShop = (p) => store.merchants.find((m) => m.merchantId === p.merchantId) || {};
    async function loadSearch() {
      if (preview) return;
      const current = scope.capture();
      const stamp = beginPublicSearch();
      const params = {
        q: search.value,
        category: category.value,
        merchantId: merchant.value,
        page: page.value,
        size: 20,
        sort:
          sort.value === 'price' ? 'PRICE_ASC' : sort.value === 'stock' ? 'STOCK_DESC' : 'NEWEST',
      };
      store.loading = true;
      store.error = '';
      try {
        const result = await api('/products/page' + query(params));
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
      loadSearch();
    }
    function applyKeyword(word) {
      search.value = word;
      page.value = 1;
      loadSearch();
    }
    function showDetail(p) {
      selected.value = p;
      chosenSku.value = skuOf(p).skuId || '';
      count.value = 1;
    }
    async function addCart() {
      if (!selected.value || saving.value || previewGuard()) return;
      if (!chosen.value?.skuId) {
        notify('请选择有效规格');
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
        const cart = await api('/cart');
        if (!valid()) return;
        const old = (cart || []).find((i) => i.skuId === real.skuId);
        const n = Number(old?.quantity || 0) + requested;
        if (n > 99) throw new Error('单个规格最多购买99件');
        await api('/cart', { method: 'PUT', body: { skuId: real.skuId, quantity: n } });
        if (!valid()) return;
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
      search,
      category,
      merchant,
      sort,
      page,
      pageInfo,
      categories,
      shops,
      shown,
      selected,
      chosen,
      chosenSku,
      count,
      saving,
      productCategory,
      currentShop,
      staticCategoryArt,
      loadSearch,
      setCategory,
      applyKeyword,
      showDetail,
      addCart,
    };
  },
  template: `
  <ConsumerShell active="home">
    <section class="search-section">
      <div class="big-search"><Icon name="search" :size="22"/><input v-model="search" placeholder="搜索商品、商户名称、规格" aria-label="搜索校园商品" @keydown.enter="page=1;loadSearch()"/><button @click="page=1;loadSearch()">搜索</button></div>
      <div class="popular-tags"><button v-for="k in keywords" :key="k" @click="applyKeyword(k)" :class="{active:search===k}">{{k}}</button></div>
    </section>
    <button class="hero-shopping" @click="go('/ai')" aria-label="进入 AI 导购">
      <div class="hero-lines"><div class="hero-title"><span>AI</span> 导购</div><h1>你的校园购物小助手</h1><span class="hero-cta">开始探索 <Icon name="arrowUpRight" :size="17" /></span></div>
      <div class="hero-robot-wrap"><img src="./images/robot.webp" alt="AI 导购机器人"/></div><span class="hero-star hstar-one">✦</span><span class="hero-star hstar-two">✧</span>
    </button>
    <section class="category-section" aria-label="商品分类">
      <button v-for="c in categories" :key="c.code" class="category-item" @click="setCategory(c.code)" :class="{categoryActive:category===c.code}"><span class="category-picture"><img :src="staticCategoryArt[c.code]||'./images/category-snacks.webp'" :alt="c.name"/></span><strong>{{c.name}}</strong></button>
    </section>
    <section class="merchant-section">
      <div class="section-head"><div class="section-title"><span class="head-accent mint"><Icon name="store" :size="21"/></span><h2>附近商家</h2></div><span class="tiny-note">校内自提</span></div>
      <div class="merchant-cards"><button class="merchant-card" v-for="(m,idx) in shops" :key="m.merchantId" @click="merchant=m.merchantId;page=1;loadSearch()" :class="{active:merchant===m.merchantId}">
        <span class="merchant-logo" :class="'store-'+idx"><img v-if="m.image" :src="m.image" :alt="m.name"/><Icon v-else name="store" :size="21"/></span>
        <strong>{{m.name}}</strong><small>{{m.storeName||m.location||'校内门店'}}</small><span class="merchant-chip"><span class="merchant-chip-dot"></span> 可自提</span>
      </button></div>
      <div v-if="merchant" class="merchant-filter-bar">当前：{{shopName(merchant)}}<button @click="merchant='';page=1;loadSearch()">清除筛选 <Icon name="x" :size="13" /></button></div>
    </section>
    <section class="reco-section">
      <div class="section-head reco-heading"><div class="section-title"><span class="flame-icon">✦</span><h2>为你推荐</h2></div><div class="sort-tabs"><button :class="{active:sort==='popular'}" @click="sort='popular';page=1;loadSearch()">最新</button><button :class="{active:sort==='stock'}" @click="sort='stock';page=1;loadSearch()">全局库存</button><button :class="{active:sort==='price'}" @click="sort='price';page=1;loadSearch()">全局价格</button></div></div>
      <div v-if="store.loading" class="inline-loading"><div class="mini-spinner"></div>正在加载</div>
      <div v-if="store.error" class="inline-error"><Icon name="alert" :size="18"/>{{store.error}} <a v-if="!preview" href="/?demo=1#/">查看设计预览</a></div>
      <div v-if="!store.loading&&!shown.length&&!store.error" class="no-results"><Icon name="search" :size="22"/>暂无相关商品<button @click="search='';category='';merchant='';page=1;loadSearch()">查看全部</button></div>
      <div class="home-product-grid">
        <article class="home-product" v-for="p in shown" :key="p.productId" @click="showDetail(p)">
          <div class="home-product-photo"><ProductImage :src="p.imageUrl" :alt="p.title"/><span v-if="p.tag" class="corner-tag">{{p.tag}}</span><span class="floating-pickup">可自提</span></div>
          <div class="home-product-info"><button class="home-product-open" @click.stop="showDetail(p)">{{p.title}}</button><div class="product-minor"><span>{{skuOf(p).specKey}}</span><span>库存 {{available(p)>0?'充足':'售罄'}}</span></div><div class="product-price-row"><span class="price-main">{{money(priceSku(p).priceCent)}}</span><button @click.stop="showDetail(p)" :aria-label="'查看'+p.title"><Icon name="plus" :size="20" /></button></div></div>
        </article>
      </div>
      <div class="sdd-pager" v-if="!preview && pageInfo.total>0"><span>共 {{pageInfo.total}} 件</span><button :disabled="page<=1||store.loading" @click="page--;loadSearch()">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext||store.loading" @click="page++;loadSearch()">下一页</button></div>
    </section>
    
    <div v-if="selected" v-modal="() => selected=null" class="ui-overlay" @click.self="selected=null"><div class="product-sheet" role="dialog" aria-modal="true" :aria-label="selected.title">
      <button class="sheet-close" @click="selected=null" aria-label="关闭"><Icon name="x" :size="19"/></button>
      <div class="sheet-product-line"><ProductImage :src="selected.imageUrl" :alt="selected.title"/><div><span class="mini-category">{{productCategory(selected)}}</span><h3>{{selected.title}}</h3><div class="sheet-price">{{money(chosen.priceCent)}}</div><span class="sheet-muted">{{currentShop(selected).name||'校内商户'}}</span></div></div>
      <button class="more-product-detail" @click="go('/product/'+pathId(selected.productId));selected=null">查看商品详情 <Icon name="chevronRight" :size="15"/></button><label class="sheet-field-label">选择规格</label><div class="sku-picker"><button v-for="sku in selected.skus" :key="sku.skuId" :class="{active:chosenSku===sku.skuId}" :aria-pressed="chosenSku===sku.skuId" :disabled="saving||sku.status!=='ACTIVE'||sku.available===0" @click="chosenSku=sku.skuId">{{sku.specKey}}</button></div>
      <div class="quantity-picker"><span>购买数量</span><div><button @click="count=Math.max(1,count-1)" aria-label="减少数量" :disabled="saving"><Icon name="minus" :size="17" /></button><b>{{count}}</b><button @click="count=Math.min(99,Number(chosen.available||0),count+1)" aria-label="增加数量" :disabled="saving||count>=Number(chosen.available||0)"><Icon name="plus" :size="17"/></button></div></div>
      <button class="primary-wide" :disabled="!chosen.skuId || !chosen.available || saving || preview" @click="addCart">{{saving?'加入中…':'加入购物车'}}</button>
    </div></div>
  </ConsumerShell>`,
};
