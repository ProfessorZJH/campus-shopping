import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, query } from '../services/api.js';
import { store, go, money, skuOf, preview } from '../services/store.js';
const { ref, computed, onMounted, onUnmounted, watch } = Vue;
export default {
  name: 'Shop',
  components: { ConsumerShell, ProductImage },
  setup() {
    const merchant = ref(null),
      products = ref([]),
      error = ref(''),
      loading = ref(false),
      page = ref(1),
      hasNext = ref(false);
    const id = computed(() =>
      decodeURIComponent(store.route.slice('/shops/'.length).split('/')[0] || ''),
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
      merchant.value = null;
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
            api('/merchants/public/' + encodeURIComponent(current)),
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
    watch(id, () => {
      if (page.value !== 1) page.value = 1;
      else load();
    });
    watch(page, load);
    return { merchant, products, error, loading, page, hasNext, go, money, skuOf };
  },
  template: `<ConsumerShell active="home"><div class="mobile-page-top"><button @click="go('/')" aria-label="返回"><Icon name="arrowLeft"/></button><b>商户</b><span></span></div><div v-if="error" class="inline-error">{{error}}</div><template v-if="merchant"><section class="shop-hero"><span class="merchant-logo"><Icon name="store" :size="28"/></span><div><h1>{{merchant.name}}</h1><p>{{merchant.storeName}} · {{merchant.location}}</p></div></section><div class="section-heading"><h2>在售商品</h2></div><div class="shop-product-grid"><button v-for="p in products" :key="p.productId" class="shop-product-card" @click="go('/product/'+encodeURIComponent(p.productId))"><ProductImage :src="p.imageUrl" :alt="p.title"/><strong>{{p.title}}</strong><span>{{money(skuOf(p).priceCent)}}</span></button></div><div v-if="!products.length&&!loading" class="mobile-empty">暂无在售商品</div><div class="shop-pagination"><button :disabled="page===1||loading" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!hasNext||loading" @click="page++">下一页</button></div></template><div v-else-if="loading" class="mobile-empty">正在加载商户…</div></ConsumerShell>`,
};
