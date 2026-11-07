import './vue-runtime.js';
import { createApp, ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { api } from './services/api.js';
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
import KnowledgeDebug from './pages/KnowledgeDebug.js';
import Platform from './pages/Platform.js';
import RoleManager from './pages/RoleManager.js';
import AuthDialog from './components/AuthDialog.js';
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
      const r = store.route;
      if (r === '/merchant/products') return 'Merchant';
      if (r === '/merchant/roles') return 'RoleManager';
      if (r === '/merchant/knowledge' || r === '/admin/knowledge') return 'Knowledge';
      if (r === '/merchant/knowledge/debug' || r === '/admin/knowledge/debug')
        return 'KnowledgeDebug';
      if (
        [
          '/merchant',
          '/merchant/inventory',
          '/merchant/orders',
          '/merchant/pickup',
          '/merchant/aftersales',
          '/merchant/team',
          '/merchant/settings',
        ].includes(r)
      )
        return 'MerchantOps';
      if (
        [
          '/admin',
          '/admin/applications',
          '/admin/merchants',
          '/admin/products',
          '/admin/orders',
          '/admin/disputes',
          '/admin/categories',
        ].includes(r)
      )
        return 'Platform';
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
      sessionPending;
    async function refresh() {
      const stamp = ++version;
      ready.value = false;
      contextError.value = '';
      authRequired.value = false;
      try {
        if (!preview) {
          const identity = store.identityVersion;
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
        if (store.route.startsWith('/merchant')) await loadMerchant({ contextOnly: true });
        else if (!preview && store.route.startsWith('/admin')) {
          const workspace = await api('/workspace');
          if (stamp !== version) return;
          store.workspace = workspace;
        } else if (preview) await loadPublic();
      } catch (e) {
        if (stamp === version) {
          if (e.status === 401 || e.code === 'A0004') authRequired.value = true;
          else contextError.value = e.message;
        }
      } finally {
        if (stamp === version) ready.value = true;
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
app.directive('modal', modal);
app.mount('#app');
