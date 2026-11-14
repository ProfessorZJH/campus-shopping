import UiPagination from '../components/UiPagination.vue';
import StatusPanel from '../components/StatusPanel.vue';
import { safeDecodeId } from '../services/page-utils.js';
import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, query } from '../services/api.js';
import { store, go, money, skuOf, preview } from '../services/store.js';
const { ref, computed, onMounted, onUnmounted, watch } = Vue;
export default {
  name: 'Shop',
  components: { ConsumerShell, ProductImage, UiPagination, StatusPanel },
  setup() {
    const merchant = ref(null),
      products = ref([]),
      error = ref(''),
      loading = ref(false),
      page = ref(1),
      hasNext = ref(false);
    const id = computed(() =>
      safeDecodeId(store.route.slice('/shops/'.length).split('/')[0] || ''),
    );
    let loadVersion = 0;
    async function load() {
      const stamp = ++loadVersion,
        current = id.value,
        currentPage = page.value;
      const valid = () =>
        stamp === loadVersion && current === id.value && currentPage === page.value;
      error.value = '';
      loading.value = true;
      if (merchant.value?.merchantId !== current) merchant.value = null;
      products.value = [];
      hasNext.value = false;
      try {
        if (preview) {
          merchant.value = store.merchants.find((m) => m.merchantId === current) || null;
          const all = store.products.filter(
            (p) => p.merchantId === current && p.status === 'PUBLISHED',
          );
          products.value = all.slice((currentPage - 1) * 12, currentPage * 12);
          hasNext.value = all.length > currentPage * 12;
        } else {
          const [m, p] = await Promise.all([
            merchant.value
              ? Promise.resolve(merchant.value)
              : api('/merchants/public/' + encodeURIComponent(current)),
            api('/products/page' + query({ merchantId: current, page: currentPage, size: 12 })),
          ]);
          if (!valid()) return;
          merchant.value = m;
          products.value = p?.items || [];
          hasNext.value = !!p?.hasNext;
        }
      } catch (e) {
        if (valid()) error.value = e.message;
      } finally {
        if (valid()) loading.value = false;
      }
    }
    onMounted(load);
    onUnmounted(() => ++loadVersion);
    watch(page, load);
    return { merchant, products, error, loading, page, hasNext, go, money, skuOf, load };
  },
  template: `<ConsumerShell active="home"><div class="mobile-page-top"><button @click="go('/')" aria-label="返回"><Icon name="arrowLeft"/></button><b>商户</b><span></span></div><StatusPanel v-if="error" state="error" :message="error" action-label="重新加载" :busy="loading" @retry="load"/><template v-if="merchant"><section class="shop-hero"><ProductImage v-if="merchant.imageUrl" class="shop-hero-image" :src="merchant.imageUrl" :alt="merchant.name+'门店图片'"/><span v-else class="merchant-logo"><Icon name="store" :size="28"/></span><div><h1>{{merchant.name}}</h1><p>{{merchant.storeName}} · {{merchant.location}}</p></div></section><section class="detail-card shop-intro"><h2>门店介绍</h2><p v-if="merchant.description">{{merchant.description}}</p><p v-else class="muted-short">未填写</p><h2>营业时间</h2><p v-if="merchant.businessHours">{{merchant.businessHours}} <small>（北京时间）</small></p><p v-else class="muted-short">未填写</p></section><div class="section-heading"><h2>在售商品</h2></div><StatusPanel v-if="loading" state="loading" message="正在加载商品…"/><div class="shop-product-grid"><button v-for="p in products" :key="p.productId" class="shop-product-card" @click="go('/product/'+encodeURIComponent(p.productId))"><ProductImage :src="p.imageUrl" :alt="p.title"/><strong>{{p.title}}</strong><span>{{money(skuOf(p).priceCent)}}</span></button></div><StatusPanel v-if="!products.length&&!loading&&!error" state="empty" message="暂无在售商品"/><UiPagination class="shop-pagination" :page="page" :has-next="hasNext" :busy="loading" @previous="page--" @next="page++"/></template><StatusPanel v-else-if="loading" state="loading" message="正在加载商户…"/></ConsumerShell>`,
};
