import { modal } from './services/modal.js';
import Icon from './components/Icon.js';
import Home from './pages/Home.js';
import Guide from './pages/Guide.js';
import Merchant from './pages/Merchant.js';
import ProductDetail from './pages/ProductDetail.js';
import Shop from './pages/Shop.js';
import Cart from './pages/Cart.js';
import Orders from './pages/Orders.js';
import Account from './pages/Account.js';
import MerchantOps from './pages/MerchantOps.js';
import Knowledge from './pages/Knowledge.js';
import Platform from './pages/Platform.js';
import RoleManager from './pages/RoleManager.js';
import {
  store,
  setRoute,
  loadPublic,
  loadMerchant,
  loadSession,
  preview,
} from './services/store.js';
const { createApp, onMounted, onUnmounted, watch, computed } = Vue;
const App = {
  name: 'CampusApp',
  components: {
    Home,
    Guide,
    Merchant,
    ProductDetail,
    Shop,
    Cart,
    Orders,
    Account,
    MerchantOps,
    Knowledge,
    Platform,
    RoleManager,
  },
  setup() {
    const current = computed(() => {
      const r = store.route;
      if (r === '/merchant/products') return 'Merchant';
      if (r === '/merchant/roles') return 'RoleManager';
      if (r === '/merchant/knowledge' || r === '/admin/knowledge') return 'Knowledge';
      if (r.startsWith('/merchant')) return 'MerchantOps';
      if (r.startsWith('/admin')) return 'Platform';
      if (r.startsWith('/product/')) return 'ProductDetail';
      if (r.startsWith('/shops/')) return 'Shop';
      if (r === '/cart') return 'Cart';
      if (r === '/orders' || r.startsWith('/orders/')) return 'Orders';
      if (['/account', '/apply', '/invitations'].includes(r)) return 'Account';
      if (r === '/ai') return 'Guide';
      return 'Home';
    });
    async function refresh() {
      if (store.route.startsWith('/merchant')) await loadMerchant();
      else if (!store.route.startsWith('/admin')) await loadPublic();
    }
    onMounted(() => {
      window.addEventListener('hashchange', setRoute);
      refresh();
      if (!preview && !store.route.startsWith('/merchant')) loadSession();
    });
    onUnmounted(() => window.removeEventListener('hashchange', setRoute));
    watch([() => store.route, () => store.identityVersion], refresh);
    return { store, current };
  },
  template: `<div class="application" :class="{'admin-mode':current==='Merchant'||current==='MerchantOps'||current==='Platform'||current==='Knowledge'||current==='RoleManager'}"><component :is="current" :key="store.route+':'+store.identityVersion+':'+store.merchantId"/><div v-if="store.toast" class="toast" role="status">{{store.toast}}</div></div>`,
};
const app = createApp(App);
app.component('Icon', Icon);
app.directive('modal', modal);
app.mount('#app');
