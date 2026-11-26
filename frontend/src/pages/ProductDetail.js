import { requestScope } from '../services/request-scope.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import StatusPanel from '../components/StatusPanel.vue';
import { api } from '../services/api.js';
import { store, go, money, preview, notify, skuOf, available } from '../services/store.js';
import { pathId, safeDecodeId, dateTime, priceSku } from '../services/page-utils.js';
const { ref, computed, onMounted } = Vue;
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

export default {
  name: 'ProductDetail',
  components: { ConsumerShell, ProductImage, StatusPanel },
  setup() {
    const scope = requestScope();
    const product = ref(null),
      shop = ref(null),
      chosen = ref(''),
      count = ref(1),
      busy = ref(false),
      loading = ref(true),
      error = ref(''),
      errorCode = ref(''),
      imageIndex = ref(0),
      touchStartX = ref(null),
      lightboxOpen = ref(false),
      favorited = ref(false),
      favBusy = ref(false),
      reviewSummary = ref(null),
      recommendations = ref({ boughtTogether: [], sameStoreHot: [] });
    const defaultSku = (p) =>
      p?.skus?.find((s) => s.status === 'ACTIVE' && Number(s.available || 0) > 0) || skuOf(p);
    const id = computed(() => safeDecodeId(store.route.split('/')[2] || ''));
    const sku = computed(
      () => product.value?.skus?.find((s) => s.skuId === chosen.value) || defaultSku(product.value),
    );
    const merchant = computed(
      () =>
        store.merchants.find((m) => m.merchantId === product.value?.merchantId) || shop.value || {},
    );
    const merchantPhoto = computed(() => {
      const explicit = merchant.value?.imageUrl || merchant.value?.image;
      if (explicit) return explicit;
      const raw = String(product.value?.merchantId || '');
      let hash = 0;
      for (let i = 0; i < raw.length; i += 1) {
        hash = (hash + raw.charCodeAt(i)) % STORE_PHOTOS.length;
      }
      return STORE_PHOTOS[hash];
    });
    const categoryName = computed(
      () =>
        store.categories.find((c) => c.code === product.value?.categoryCode)?.name || '商品分类',
    );
    const detailImages = computed(() =>
      product.value?.images?.length
        ? product.value.images
        : [{ url: product.value?.imageUrl || '' }],
    );
    const relatedProducts = computed(() => {
      const seen = new Set([product.value?.productId]);
      const combined = [];
      for (const list of [
        recommendations.value?.boughtTogether || [],
        recommendations.value?.sameStoreHot || [],
      ]) {
        for (const item of list) {
          if (!item?.productId || seen.has(item.productId)) continue;
          seen.add(item.productId);
          combined.push(item);
          if (combined.length >= 4) return combined;
        }
      }
      return combined;
    });
    /** 下架/不存在/网络失败是不同事实，不能都显示成同一条加载错误。 */
    const errorText = computed(() => {
      if (errorCode.value === 'C0001') return '该商品已下架或暂不可售';
      if (errorCode.value === 'G0001') return '商品不存在或已删除';
      if (!errorCode.value || ['NETWORK', 'TIMEOUT', 'RESPONSE'].includes(errorCode.value))
        return '商品加载失败，请检查网络后重试';
      return error.value || '商品加载失败，请重试';
    });
    async function load() {
      const request = scope.begin();
      const target = id.value;
      product.value = null;
      shop.value = null;
      reviewSummary.value = null;
      recommendations.value = { boughtTogether: [], sameStoreHot: [] };
      favorited.value = false;
      lightboxOpen.value = false;
      error.value = '';
      errorCode.value = '';
      loading.value = true;
      try {
        if (preview) {
          product.value = store.products.find((p) => p.productId === target) || null;
          if (product.value) {
            recommendations.value = {
              boughtTogether: store.products.filter((p) => p.productId !== target).slice(0, 4),
              sameStoreHot: [],
            };
          }
        } else {
          if (!target) throw Error('无效商品地址');
          const p = await api('/products/' + pathId(target), { signal: request.signal });
          if (request.current()) {
            product.value = p;
            if (p?.merchantId && !store.merchants.some((m) => m.merchantId === p.merchantId)) {
              api('/merchants/public/' + pathId(p.merchantId), { signal: request.signal })
                .then((m) => {
                  if (request.current() && m) shop.value = m;
                })
                .catch(() => {});
            }
            Promise.all([
              api('/products/' + pathId(target) + '/reviews', { signal: request.signal }).catch(
                () => null,
              ),
              api('/products/' + pathId(target) + '/recommendations', {
                signal: request.signal,
              }).catch(() => null),
              store.user
                ? api('/discovery/home', { signal: request.signal }).catch(() => null)
                : Promise.resolve(null),
            ]).then(([rev, rec, disc]) => {
              if (!request.current()) return;
              if (rev) reviewSummary.value = rev;
              if (rec) recommendations.value = rec;
              if (disc?.favoriteProductIds) {
                favorited.value = disc.favoriteProductIds.includes(target);
              }
            });
          }
        }
      } catch (e) {
        if (request.current()) {
          error.value = e.message;
          errorCode.value = e.code || '';
        }
      } finally {
        if (request.current()) loading.value = false;
      }
      if (!request.current()) return;
      chosen.value = defaultSku(product.value).skuId || '';
      imageIndex.value = 0;
      count.value = 1;
    }
    onMounted(load);
    async function add(goCart = false) {
      if (preview || busy.value || !sku.value?.skuId) return;
      const current = scope.capture(),
        productId = product.value.productId,
        skuId = sku.value.skuId,
        requested = Number(count.value);
      busy.value = true;
      try {
        const actual = await api('/products/' + pathId(productId));
        const real = actual.skus.find((s) => s.skuId === skuId);
        if (
          actual.status !== 'PUBLISHED' ||
          !real ||
          real.status !== 'ACTIVE' ||
          Number(real.available) < requested
        )
          throw Error('商品库存或状态已变化');
        if (!current()) return;
        await api('/cart', { method: 'POST', body: { skuId: real.skuId, quantity: requested } });
        if (current()) {
          store.cartCount = Number(store.cartCount || 0) + requested;
          notify(goCart ? '已加入购物车，正在前往结算' : '已加入购物车');
          if (goCart) go('/cart');
        }
      } catch (e) {
        if (current()) notify(e.message);
      } finally {
        if (current()) busy.value = false;
      }
    }
    async function toggleFavorite() {
      if (preview || favBusy.value || !product.value?.productId) return;
      if (!store.user) {
        notify('请先登录后再收藏商品');
        return;
      }
      const current = scope.capture();
      const was = favorited.value;
      favBusy.value = true;
      try {
        const res = await api('/products/' + pathId(product.value.productId) + '/favorite', {
          method: was ? 'DELETE' : 'POST',
        });
        if (!current()) return;
        favorited.value = res?.favorited ?? !was;
        notify(favorited.value ? '已收藏' : '已取消收藏');
      } catch (e) {
        if (current()) notify(e.message);
      } finally {
        if (current()) favBusy.value = false;
      }
    }
    function splitTags(raw) {
      return String(raw || '')
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    function prevImage() {
      imageIndex.value =
        (imageIndex.value + detailImages.value.length - 1) % detailImages.value.length;
    }
    function nextImage() {
      imageIndex.value = (imageIndex.value + 1) % detailImages.value.length;
    }
    function touchStart(event) {
      touchStartX.value = event.touches?.[0]?.clientX ?? null;
    }
    function touchEnd(event) {
      if (touchStartX.value == null || detailImages.value.length < 2) return;
      const end = event.changedTouches?.[0]?.clientX;
      const delta = typeof end === 'number' ? end - touchStartX.value : 0;
      touchStartX.value = null;
      if (Math.abs(delta) < 36) return;
      if (delta < 0) nextImage();
      else prevImage();
    }

    return {
      product,
      sku,
      chosen,
      count,
      busy,
      loading,
      error,
      errorText,
      preview,
      store,
      go,
      money,
      splitPrice,
      available,
      priceSku,
      dateTime,
      merchant,
      merchantPhoto,
      categoryName,
      add,
      load,
      pathId,
      imageIndex,
      lightboxOpen,
      favorited,
      favBusy,
      toggleFavorite,
      reviewSummary,
      relatedProducts,
      splitTags,
      prevImage,
      nextImage,
      touchStart,
      touchEnd,
      detailImages,
    };
  },
  template: `<ConsumerShell active="home">
    <div class="mobile-page-top"><button @click="go('/')" aria-label="返回首页"><Icon name="arrowLeft"/></button><b>商品详情</b><span></span></div>
    <StatusPanel v-if="loading" state="loading" message="正在加载商品…"/>
    <StatusPanel v-else-if="error" state="error" :message="errorText" action-label="重新加载" :busy="loading" @retry="load"/>
    <template v-else-if="product">
      <nav class="mall-breadcrumb" aria-label="面包屑导航">
        <button type="button" @click="go('/')">首页</button>
        <span>/</span>
        <span>{{categoryName}}</span>
        <span>/</span>
        <button type="button" @click="go('/shops/'+pathId(product.merchantId))">{{product.merchantName||merchant.name||'校内门店'}}</button>
        <span>/</span>
        <strong>{{product.title}}</strong>
      </nav>

      <div class="detail-cabin-card">
        <div class="detail-layout">
          <div class="detail-gallery-col">
            <div class="detail-art" @touchstart.passive="touchStart" @touchend.passive="touchEnd">
              <button type="button" class="detail-art-trigger" aria-label="查看大图" @click="lightboxOpen=true">
                <ProductImage :src="detailImages[imageIndex].url" :alt="product.title" loading="eager"/>
              </button>
              <button v-if="detailImages.length>1" type="button" class="detail-image-prev" aria-label="上一张" @click="prevImage">‹</button>
              <button v-if="detailImages.length>1" type="button" class="detail-image-next" aria-label="下一张" @click="nextImage">›</button>
            </div>
            <div v-if="detailImages.length>1" class="detail-image-thumbs">
              <button v-for="(img,i) in detailImages" :key="img.imageId||img.url" type="button" :class="{active:i===imageIndex}" @click="imageIndex=i">
                <ProductImage :src="img.url" :alt="product.title"/>
              </button>
            </div>
          </div>

          <div class="detail-buy-col detail-buy-box">
            <div class="detail-info">
              <h1>{{product.title}}</h1>
              <p v-if="product.description" class="muted-short detail-desc-text">{{product.description}}</p>
            </div>

            <div class="tmall-price-banner">
              <div class="tmall-price-main-row">
                <div class="detail-price rtl-price">
                  <em class="yen">¥</em><b class="int">{{splitPrice(sku.priceCent).int}}</b><i v-if="splitPrice(sku.priceCent).dec" class="dec">{{splitPrice(sku.priceCent).dec}}</i>
                </div>
                <button type="button" class="fav-toggle-btn" :class="{active:favorited}" :disabled="preview||favBusy" :aria-pressed="favorited" @click="toggleFavorite">
                  <Icon name="heart" :size="15"/><span>{{favorited?'已收藏':'收藏'}}</span>
                </button>
              </div>
              <div class="detail-assurance-strip" aria-label="履约保障">
                <span><Icon name="clock" :size="13"/>极速备餐</span>
                <span><Icon name="store" :size="13"/>校内自提免运费</span>
                <span><Icon name="shield" :size="13"/>未取随时退</span>
              </div>
            </div>

            <div class="tmall-meta-rows">
              <div class="tmall-meta-row">
                <span class="meta-label">取货门店</span>
                <div class="meta-val">
                  <strong>{{product.merchantStoreName||merchant.storeName||product.merchantName||merchant.name||'校内门店'}}</strong>
                  <span>· {{product.merchantLocation||merchant.location||'校园自提点'}}</span>
                  <em class="meta-eta">约8分钟备好</em>
                </div>
              </div>
              <div class="tmall-meta-row">
                <span class="meta-label">营业时间</span>
                <div class="meta-val">
                  <span>{{merchant.businessHours||'正常营业 · 未取货支持随时退款'}}</span>
                </div>
              </div>
            </div>

            <div class="tmall-sku-panel">
              <div class="tmall-sku-row">
                <span class="meta-label">规格</span>
                <div class="sku-picker tmall-sku-picker">
                  <button v-for="s in product.skus" :key="s.skuId" type="button" :class="{active:sku.skuId===s.skuId}" :aria-pressed="sku.skuId===s.skuId" :disabled="busy||s.status!=='ACTIVE'||Number(s.available)<=0" @click="chosen=s.skuId;count=1">
                    <span>{{s.specKey}}</span>
                    <small v-if="s.status!=='ACTIVE'" class="sku-state">已下架</small>
                    <small v-else-if="Number(s.available)<=0" class="sku-state">无货</small>
                  </button>
                </div>
              </div>

              <div class="tmall-sku-row qty-row">
                <span class="meta-label">数量</span>
                <div class="quantity-picker tmall-qty-picker">
                  <div>
                    <button type="button" aria-label="减少" :disabled="busy" @click="count=Math.max(1,count-1)"><Icon name="minus" :size="16"/></button>
                    <b>{{count}}</b>
                    <button type="button" aria-label="增加" :disabled="busy||count>=Math.min(99,Number(sku.available||0))" @click="count++"><Icon name="plus" :size="16"/></button>
                  </div>
                  <span class="stock-live-text">库存 {{sku.available||0}} 件</span>
                </div>
              </div>
            </div>

            <div class="detail-fixed tmall-action-bar">
              <button type="button" class="teal-button" :disabled="preview||busy||sku.status!=='ACTIVE'||Number(sku.available||0)<=0||product.status!=='PUBLISHED'" @click="add(false)">{{busy?'加入中…':'加入购物车'}}</button>
              <button type="button" class="buy-now-button" :disabled="preview||busy||sku.status!=='ACTIVE'||Number(sku.available||0)<=0||product.status!=='PUBLISHED'" @click="add(true)">立即购买</button>
            </div>

            <button type="button" class="detail-merchant" @click="go('/shops/'+pathId(product.merchantId))">
              <span class="merchant-logo"><ProductImage :src="merchantPhoto" :alt="merchant.name||'门店'"/></span>
              <div class="store-dsr-main">
                <strong>{{product.merchantName||merchant.name||'校内门店'}}</strong>
                <span>{{product.merchantStoreName||merchant.storeName||product.merchantLocation||merchant.location||'支持到店自提'}}</span>
              </div>
              <span class="shop-enter-label">进店逛逛 <Icon name="chevronRight" :size="13"/></span>
            </button>
          </div>
        </div>
      </div>

      <div class="detail-sections">
        <section class="detail-card detail-reviews-card">
          <div class="detail-section-head">
            <h2>评价 ({{reviewSummary?.totalCount||0}})</h2>
            <div v-if="reviewSummary?.totalCount" class="review-summary-pill"><b>{{reviewSummary.averageRating.toFixed(1)}} ★</b></div>
          </div>
          <div v-if="reviewSummary?.items?.length" class="review-list">
            <article v-for="r in reviewSummary.items" :key="r.id" class="review-item">
              <div class="review-item-head">
                <span class="review-buyer"><span class="buyer-mini-avatar">{{(r.buyerDisplayName||'同').slice(0,1)}}</span> {{r.buyerDisplayName||'同学'}}</span>
                <span class="review-stars-static">{{'★'.repeat(Math.max(1,Math.min(5,r.rating||5)))}}</span>
                <small>{{dateTime(r.createdAt)}}</small>
              </div>
              <div v-if="r.tags" class="review-tag-row"><span v-for="t in splitTags(r.tags)" :key="t" class="review-tag-chip">{{t}}</span></div>
              <p class="review-body">{{r.content}}</p>
            </article>
          </div>
          <p v-else class="muted-short">暂无评价，取货完成后可在订单页写评价</p>
        </section>

        <section v-if="relatedProducts.length" class="detail-card detail-reco-card">
          <div class="detail-section-head"><h2>店内热销</h2></div>
          <div class="detail-reco-grid">
            <button type="button" v-for="rp in relatedProducts" :key="rp.productId" class="detail-reco-item" @click="go('/product/'+pathId(rp.productId))">
              <div class="detail-reco-photo"><ProductImage :src="rp.imageUrl" :alt="rp.title"/></div>
              <strong>{{rp.title}}</strong>
              <b class="rtl-price"><em class="yen">¥</em><b class="int">{{splitPrice((priceSku(rp)||skuOf(rp))?.priceCent).int}}</b><i v-if="splitPrice((priceSku(rp)||skuOf(rp))?.priceCent).dec" class="dec">{{splitPrice((priceSku(rp)||skuOf(rp))?.priceCent).dec}}</i></b>
            </button>
          </div>
        </section>
      </div>

      <div v-if="lightboxOpen" v-modal="() => lightboxOpen=false" class="ui-overlay lightbox-overlay" @click.self="lightboxOpen=false">
        <div class="lightbox-dialog" role="dialog" aria-modal="true" :aria-label="product.title+'大图预览'">
          <button type="button" class="sheet-close lightbox-close" aria-label="关闭大图" @click="lightboxOpen=false"><Icon name="x" :size="20"/></button>
          <ProductImage :src="detailImages[imageIndex].url" :alt="product.title"/>
          <div v-if="detailImages.length>1" class="lightbox-controls">
            <button type="button" class="outline-button small" @click="prevImage">上一张</button>
            <span>{{imageIndex+1}} / {{detailImages.length}}</span>
            <button type="button" class="outline-button small" @click="nextImage">下一张</button>
          </div>
        </div>
      </div>
    </template>
  </ConsumerShell>`,
};
