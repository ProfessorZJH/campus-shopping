import { requestScope } from '../services/request-scope.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import StatusPanel from '../components/StatusPanel.vue';
import { api } from '../services/api.js';
import { store, go, money, preview, notify, skuOf, available } from '../services/store.js';
import { pathId, safeDecodeId, dateTime, priceSku } from '../services/page-utils.js';
const { ref, computed, onMounted } = Vue;
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
        notify(favorited.value ? '已加入收藏' : '已取消收藏');
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
      available,
      priceSku,
      dateTime,
      merchant,
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
  template: `<ConsumerShell active="home"><div class="mobile-page-top"><button @click="go('/')" aria-label="返回首页"><Icon name="arrowLeft"/></button><b>商品详情</b><button @click="go('/cart')" aria-label="购物车"><Icon name="cart"/></button></div><StatusPanel v-if="loading" state="loading" message="正在加载商品…"/><StatusPanel v-else-if="error" state="error" :message="errorText" action-label="重新加载" :busy="loading" @retry="load"/><template v-else-if="product"><div class="detail-layout"><div class="detail-art" @touchstart.passive="touchStart" @touchend.passive="touchEnd"><button type="button" class="detail-art-trigger" aria-label="查看大图" @click="lightboxOpen=true"><ProductImage :src="detailImages[imageIndex].url" :alt="product.title" loading="eager"/></button><button v-if="detailImages.length>1" class="detail-image-prev" aria-label="上一张" @click="prevImage">‹</button><button v-if="detailImages.length>1" class="detail-image-next" aria-label="下一张" @click="nextImage">›</button><div v-if="detailImages.length>1" class="detail-image-thumbs"><button v-for="(img,i) in detailImages" :key="img.imageId||img.url" :class="{active:i===imageIndex}" @click="imageIndex=i"><ProductImage :src="img.url" :alt="product.title"/></button></div><span v-if="product.status==='PUBLISHED'" class="corner-tag">校内自提</span></div><div class="detail-buy-col"><div class="detail-info"><div class="detail-price-line"><div class="detail-price">{{money(sku.priceCent)}} <small>门店自提</small></div><button type="button" class="fav-toggle-btn" :class="{active:favorited}" :disabled="preview||favBusy" :aria-pressed="favorited" @click="toggleFavorite"><Icon name="heart" :size="15"/><span>{{favorited?'已收藏':'收藏'}}</span></button></div><h1>{{product.title}}</h1><p v-if="product.description" class="muted-short">{{product.description}}</p></div><div class="detail-card"><button class="detail-merchant" @click="go('/shops/'+pathId(product.merchantId))"><span class="merchant-logo"><Icon name="store"/></span><div><strong>{{product.merchantName||merchant.name||'校园商户'}}</strong><span>{{product.merchantStoreName||merchant.storeName||product.merchantLocation||merchant.location||'校内自提门店'}}</span></div><span class="shop-enter-label">进店</span><Icon name="chevronRight"/></button></div><div class="detail-card"><div class="detail-subtitle">选择规格</div><div class="sku-picker"><button v-for="s in product.skus" :key="s.skuId" :class="{active:sku.skuId===s.skuId}" :aria-pressed="sku.skuId===s.skuId" :disabled="busy||s.status!=='ACTIVE'||Number(s.available)<=0" @click="chosen=s.skuId;count=1">{{s.specKey}}<small v-if="s.status!=='ACTIVE'" class="sku-state">已下架</small><small v-else-if="Number(s.available)<=0" class="sku-state">无货</small></button></div><div class="quantity-picker"><span>数量 <small>可售 {{sku.available||0}} 件</small></span><div><button aria-label="减少" :disabled="busy" @click="count=Math.max(1,count-1)"><Icon name="minus" :size="16"/></button><b>{{count}}</b><button aria-label="增加" :disabled="busy||count>=Math.min(99,Number(sku.available||0))" @click="count++"><Icon name="plus" :size="16"/></button></div></div></div><div class="detail-guarantees"><span><Icon name="check" :size="14"/> 实时库存复验</span><span><Icon name="shield" :size="14"/> 动态码安全核销</span><span><Icon name="clock" :size="14"/> 未提货支持整单退款</span></div><div class="detail-fixed"><button class="outline-button" @click="go('/cart')"><Icon name="cart" :size="18"/>购物车</button><button class="outline-button" :disabled="preview||busy||sku.status!=='ACTIVE'||Number(sku.available||0)<=0||product.status!=='PUBLISHED'" @click="add(true)">立即购买</button><button class="teal-button" :disabled="preview||busy||sku.status!=='ACTIVE'||Number(sku.available||0)<=0||product.status!=='PUBLISHED'" @click="add(false)">{{busy?'加入中…':'加入购物车'}}</button></div></div></div>
  <div class="detail-sections">
    <section class="detail-card detail-archive-card">
      <div class="detail-section-head"><h2>商品档案与履约保障</h2><span class="tiny-note">门店自提 · 价格库存实时核验</span></div>
      <div class="archive-meta-grid">
        <div><span>自提门店</span><strong>{{product.merchantStoreName||merchant.storeName||product.merchantName||merchant.name||'校内自提门店'}}</strong></div>
        <div><span>取货位置</span><strong>{{product.merchantLocation||merchant.location||'校园生活区自提点'}}</strong></div>
        <div><span>营业状态</span><strong>{{merchant.businessHours||'正常营业 · 支持预约时段自提'}}</strong></div>
        <div><span>履约说明</span><strong>下单锁库存，凭取餐号 + 6 位取件码到店核销</strong></div>
      </div>
      <div class="archive-sku-table-wrap"><table class="archive-sku-table"><thead><tr><th>规格</th><th>单价</th><th>实时可售</th><th>状态</th></tr></thead><tbody><tr v-for="s in product.skus" :key="s.skuId"><td>{{s.specKey}}</td><td><b>{{money(s.priceCent)}}</b></td><td>{{s.available||0}} 件</td><td><span class="status-tag" :class="s.status==='ACTIVE'&&Number(s.available)>0?'published':'draft'">{{s.status!=='ACTIVE'?'已下架':Number(s.available)>0?'可售':'已售罄'}}</span></td></tr></tbody></table></div>
    </section>
    <section class="detail-card detail-reviews-card">
      <div class="detail-section-head"><h2>同学真实评价</h2><div v-if="reviewSummary&&reviewSummary.totalCount>0" class="review-score-summary"><strong>{{Number(reviewSummary.averageRating||0).toFixed(1)}} ★</strong><span>共 {{reviewSummary.totalCount}} 条真实自提评价</span></div></div>
      <div v-if="reviewSummary?.items?.length" class="review-list"><article v-for="r in reviewSummary.items" :key="r.id" class="review-item"><div class="review-item-head"><strong>{{r.buyerDisplayName||'校园同学'}}</strong><span class="review-item-stars">{{'★'.repeat(Math.max(1,Math.min(5,Number(r.rating||5))))}}</span><small>{{dateTime(r.createdAt)}}</small></div><div v-if="splitTags(r.tags).length" class="review-item-tags"><span v-for="t in splitTags(r.tags)" :key="t">{{t}}</span></div><p>{{r.content}}</p></article></div>
      <p v-else class="muted-short">暂无评价，完成自提后可发表首条评价</p>
    </section>
    <section v-if="relatedProducts.length" class="detail-card detail-reco-card">
      <div class="detail-section-head"><h2>买了又买 · 同店热销</h2><span class="tiny-note">基于校内真实自提共购与门店热销</span></div>
      <div class="detail-reco-grid"><button type="button" class="detail-reco-item" v-for="rp in relatedProducts" :key="rp.productId" @click="go('/product/'+pathId(rp.productId))"><div class="detail-reco-photo"><ProductImage :src="rp.imageUrl" :alt="rp.title"/></div><strong>{{rp.title}}</strong><div class="detail-reco-foot"><b>{{money((priceSku(rp)||skuOf(rp))?.priceCent)}}</b><span>{{available(rp)>0?'有现货':'已售罄'}}</span></div></button></div>
    </section>
  </div>
  <div v-if="lightboxOpen" v-modal="() => lightboxOpen=false" class="ui-overlay lightbox-overlay" @click.self="lightboxOpen=false"><div class="lightbox-frame" role="dialog" aria-modal="true" :aria-label="product.title+'大图预览'"><button type="button" class="sheet-close lightbox-close" aria-label="关闭大图" @click="lightboxOpen=false"><Icon name="x" :size="20"/></button><button v-if="detailImages.length>1" type="button" class="lightbox-nav prev" aria-label="上一张大图" @click="prevImage">‹</button><div class="lightbox-img-wrap"><ProductImage :src="detailImages[imageIndex].url" :alt="product.title" loading="eager"/></div><button v-if="detailImages.length>1" type="button" class="lightbox-nav next" aria-label="下一张大图" @click="nextImage">›</button><div class="lightbox-caption">{{product.title}} · {{imageIndex+1}} / {{detailImages.length}}</div></div></div>
  </template><StatusPanel v-else state="empty" message="未找到商品"/></ConsumerShell>`,
};
