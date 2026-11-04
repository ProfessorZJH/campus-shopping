import { requestScope } from '../services/request-scope.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import { api } from '../services/api.js';
import { store, go, money, preview, notify, skuOf } from '../services/store.js';
import { pathId, safeDecodeId } from '../services/page-utils.js';
const { ref, computed, onMounted, watch } = Vue;
export default {
  name: 'ProductDetail',
  components: { ConsumerShell, ProductImage },
  setup() {
    const scope = requestScope();
    const product = ref(null),
      chosen = ref(''),
      count = ref(1),
      busy = ref(false),
      error = ref(''),
      imageIndex = ref(0),
      touchStartX = ref(null);
    const id = computed(() => safeDecodeId(store.route.split('/')[2] || ''));
    const sku = computed(
      () => product.value?.skus?.find((s) => s.skuId === chosen.value) || skuOf(product.value),
    );
    const merchant = computed(
      () => store.merchants.find((m) => m.merchantId === product.value?.merchantId) || {},
    );
    const detailImages = computed(() =>
      product.value?.images?.length
        ? product.value.images
        : [{ url: product.value?.imageUrl || '' }],
    );
    async function load() {
      const request = scope.begin();
      const target = id.value;
      product.value = null;
      error.value = '';
      if (preview) {
        product.value = store.products.find((p) => p.productId === target) || null;
      } else {
        try {
          if (!target) throw Error('无效商品地址');
          const p = await api('/products/' + pathId(target), { signal: request.signal });
          if (request.current()) product.value = p;
        } catch (e) {
          if (request.current()) error.value = e.message;
        }
      }
      if (!request.current()) return;
      chosen.value = skuOf(product.value).skuId || '';
      imageIndex.value = 0;
      count.value = 1;
    }
    onMounted(load);
    async function add() {
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
        if (current()) notify('已加入购物车');
      } catch (e) {
        if (current()) notify(e.message);
      } finally {
        if (current()) busy.value = false;
      }
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
      imageIndex.value =
        delta < 0
          ? (imageIndex.value + 1) % detailImages.value.length
          : (imageIndex.value + detailImages.value.length - 1) % detailImages.value.length;
    }

    return {
      product,
      sku,
      chosen,
      count,
      busy,
      error,
      preview,
      store,
      go,
      money,
      merchant,
      add,
      pathId,
      imageIndex,
      touchStart,
      touchEnd,
      detailImages,
    };
  },
  template: `<ConsumerShell active="home"><div class="mobile-page-top"><button @click="go('/')" aria-label="返回首页"><Icon name="arrowLeft"/></button><b>商品详情</b><button @click="go('/cart')" aria-label="购物车"><Icon name="cart"/></button></div><div v-if="error" class="inline-error">{{error}}</div><template v-else-if="product"><div class="detail-art" @touchstart.passive="touchStart" @touchend.passive="touchEnd"><ProductImage :src="detailImages[imageIndex].url" :alt="product.title" loading="eager"/><button v-if="detailImages.length>1" class="detail-image-prev" aria-label="上一张" @click="imageIndex=(imageIndex+detailImages.length-1)%detailImages.length">‹</button><button v-if="detailImages.length>1" class="detail-image-next" aria-label="下一张" @click="imageIndex=(imageIndex+1)%detailImages.length">›</button><div v-if="detailImages.length>1" class="detail-image-thumbs"><button v-for="(img,i) in detailImages" :key="img.imageId||img.url" :class="{active:i===imageIndex}" @click="imageIndex=i"><ProductImage :src="img.url" :alt="product.title"/></button></div><span v-if="product.status==='PUBLISHED'" class="corner-tag">校内自提</span></div><div class="detail-info"><div class="detail-price">{{money(sku.priceCent)}} <small>含税售价</small></div><h1>{{product.title}}</h1><p v-if="product.description" class="muted-short">{{product.description}}</p></div><div class="detail-card"><button class="detail-merchant" @click="go('/shops/'+pathId(product.merchantId))"><span class="merchant-logo"><Icon name="store"/></span><div><strong>{{product.merchantName||merchant.name||'校园商户'}}</strong><span>{{merchant.storeName||merchant.location||'校内自提门店'}}</span></div><Icon name="chevronRight"/></button></div><div class="detail-card"><div class="detail-subtitle">选择规格</div><div class="sku-picker"><button v-for="s in product.skus" :key="s.skuId" :class="{active:sku.skuId===s.skuId}" :aria-pressed="sku.skuId===s.skuId" :disabled="busy||s.status!=='ACTIVE'||!s.available" @click="chosen=s.skuId;count=1">{{s.specKey}}</button></div><div class="quantity-picker"><span>数量 <small>可售 {{sku.available||0}}</small></span><div><button aria-label="减少" :disabled="busy" @click="count=Math.max(1,count-1)"><Icon name="minus" :size="16"/></button><b>{{count}}</b><button aria-label="增加" :disabled="busy||count>=Math.min(99,Number(sku.available||0))" @click="count++"><Icon name="plus" :size="16"/></button></div></div></div><div class="detail-fixed"><button class="outline-button" @click="go('/cart')"><Icon name="cart" :size="18"/>购物车</button><button class="teal-button" :disabled="preview||busy||!sku.available||product.status!=='PUBLISHED'" @click="add">{{busy?'加入中…':'加入购物车'}}</button></div></template><div v-else class="mobile-empty">正在加载商品…</div></ConsumerShell>`,
};
