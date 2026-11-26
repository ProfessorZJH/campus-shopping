import './vue-runtime.js';
import { createApp, ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { api } from './services/api.js';
import { modal } from './services/modal.js';
import { installCustomSelects } from './services/custom-select.js';
import Icon from './components/Icon.js';
import BrandLogo from './components/BrandLogo.js';
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
import KnowledgeDebug from './pages/KnowledgeDebug.js';
import Platform from './pages/Platform.js';
import RoleManager from './pages/RoleManager.js';
import AuthDialog from './components/AuthDialog.js';
import { backofficeRoutes } from './services/backoffice-metadata.js';
import {
  store,
  setRoute,
  loadPublic,
  loadMerchant,
  loadSession,
  preview,
} from './services/store.js';
const App = {
  name: 'CampusApp',
  components: {
    AuthDialog,
    NotFound: {
      template: `<main class="mobile-empty"><h1>404</h1><p>页面不存在</p><a href="#/">返回首页</a></main>`,
    },
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
    KnowledgeDebug,
    Platform,
    RoleManager,
  },
  setup() {
    const current = computed(() => {
      const r = store.route.split('?')[0] || '/';
      if (r === '/merchant/products') return 'Merchant';
      if (r === '/merchant/roles') return 'RoleManager';
      if (r === '/merchant/knowledge' || r === '/admin/knowledge') return 'Knowledge';
      if (r === '/merchant/knowledge/debug' || r === '/admin/knowledge/debug')
        return 'KnowledgeDebug';
      if (backofficeRoutes.includes(r) && r.startsWith('/merchant')) return 'MerchantOps';
      if (backofficeRoutes.includes(r) && r.startsWith('/admin')) return 'Platform';
      if (r.startsWith('/product/')) return 'ProductDetail';
      if (r.startsWith('/shops/')) return 'Shop';
      if (r === '/cart') return 'Cart';
      if (r === '/orders' || r.startsWith('/orders/')) return 'Orders';
      if (['/account', '/apply', '/invitations'].includes(r)) return 'Account';
      if (r === '/ai') return 'Guide';
      return r === '/' ? 'Home' : 'NotFound';
    });
    const ready = ref(false),
      contextError = ref(''),
      authRequired = ref(false),
      loginOpen = ref(false);
    const backoffice = computed(() =>
      [
        'Merchant',
        'MerchantOps',
        'Platform',
        'Knowledge',
        'KnowledgeDebug',
        'RoleManager',
      ].includes(current.value),
    );
    let version = 0,
      restoredIdentity = -1,
      booted = false,
      sessionPending;
    async function refresh() {
      const stamp = ++version;
      const identity = store.identityVersion;
      const needsBlockingGate =
        !booted ||
        (backoffice.value &&
          (restoredIdentity !== identity ||
            (store.route.startsWith('/admin') && !store.workspace) ||
            (store.route.startsWith('/merchant') && !store.merchants.length)));
      if (needsBlockingGate) ready.value = false;
      contextError.value = '';
      authRequired.value = false;
      try {
        if (!preview) {
          if (restoredIdentity !== identity) {
            restoredIdentity = identity;
            sessionPending = loadSession();
          }
          try {
            await sessionPending;
          } catch (e) {
            if (restoredIdentity === identity) restoredIdentity = -1;
            // 公开页面允许会话服务暂不可用时继续浏览，后台仍须完成身份核验。
            if (backoffice.value) throw e;
          }
        }
        if (stamp !== version) return;
        if (!preview && backoffice.value && !store.user) {
          authRequired.value = true;
          return;
        }
        if (store.route.startsWith('/merchant')) {
          if (preview || !store.merchants.length || !store.merchantId) {
            await loadMerchant({ contextOnly: true });
          }
        } else if (!preview && store.route.startsWith('/admin')) {
          if (!store.workspace) {
            const workspace = await api('/workspace');
            if (stamp !== version) return;
            store.workspace = workspace;
          }
        } else if (preview) await loadPublic();
      } catch (e) {
        if (stamp === version) {
          if (e.status === 401 || e.code === 'A0004') authRequired.value = true;
          else contextError.value = e.message;
        }
      } finally {
        if (stamp === version) {
          booted = true;
          ready.value = true;
        }
      }
    }
    onMounted(() => {
      window.addEventListener('hashchange', setRoute);
      refresh();
    });
    onUnmounted(() => {
      ++version;
      window.removeEventListener('hashchange', setRoute);
    });
    watch([() => store.route, () => store.identityVersion], refresh);
    return { store, current, ready, contextError, authRequired, loginOpen, refresh };
  },
  template: `<div class="application" :class="{'admin-mode':current==='Merchant'||current==='MerchantOps'||current==='Platform'||current==='Knowledge'||current==='KnowledgeDebug'||current==='RoleManager'}"><div v-if="!ready" class="inline-loading" role="status">正在恢复身份与权限…</div><div v-else-if="authRequired" class="mobile-empty"><h1>请先登录</h1><p>登录后继续访问当前后台页面</p><button class="teal-button" @click="loginOpen=true">登录</button></div><div v-else-if="contextError" class="inline-error">{{contextError}} <button @click="refresh">重试</button></div><component v-else :is="current" :key="store.route+':'+store.identityVersion+':'+store.merchantId"/><AuthDialog v-if="loginOpen" @close="loginOpen=false"/><div v-if="store.toast" class="toast" role="status">{{store.toast}}</div></div>`,
};
const app = createApp(App);
app.component('Icon', Icon);
app.component('BrandLogo', BrandLogo);
app.directive('modal', modal);
installCustomSelects();
app.mount('#app');
