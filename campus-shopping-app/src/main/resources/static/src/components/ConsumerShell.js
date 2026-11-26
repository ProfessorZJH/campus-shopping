import { go, store, preview, notify, replaceSession } from '../services/store.js';
import { api, resetCsrf } from '../services/api.js';
import AuthDialog from './AuthDialog.js';
const { ref } = Vue;
export default {
  name: 'ConsumerShell',
  components: { AuthDialog },
  props: { active: { type: String, default: 'home' } },
  setup() {
    const loginOpen = ref(false);
    async function logout() {
      try {
        await api('/auth/logout', { method: 'POST' });
        resetCsrf();
        replaceSession(null);
        notify('已退出');
        go('/');
      } catch (err) {
        notify(err.message);
      }
    }
    const hasWorkbench = Vue.computed(
      () =>
        preview || !!store.workspace?.platformAdmin || Boolean(store.workspace?.merchants?.length),
    );
    const workbenchPath = Vue.computed(() =>
      store.workspace?.merchants?.length ? '/merchant' : '/admin',
    );
    return { go, store, preview, loginOpen, logout, hasWorkbench, workbenchPath };
  },
  template: `
    <div class="consumer-shell">
      <div class="consumer-width">
        <header class="consumer-header">
          <div class="consumer-header-inner">
            <button type="button" class="campus-location" @click="go('/')">
              <div class="brand-pin"><span></span></div>
              <div><div class="location-name">青柠校园</div><div class="location-sub">校内优选 · 当日自提</div></div>
            </button>
            <nav class="desktop-consumer-nav" aria-label="主导航">
              <button type="button" :class="{selected:active==='home'}" @click="go('/')" aria-label="首页"><Icon name="home" :size="16"/><span>首页</span></button>
              <button type="button" class="nav-ai-pill" :class="{selected:active==='ai'}" @click="go('/ai')" aria-label="AI导购"><Icon name="sparkles" :size="16"/><span>AI 导购</span></button>
              <button type="button" :class="{selected:active==='cart'}" @click="go('/cart')" aria-label="购物车"><Icon name="cart" :size="16"/><span>购物车</span><span v-if="store.cartCount>0" class="nav-cart-badge">{{store.cartCount}}</span></button>
              <button type="button" :class="{selected:active==='orders'}" @click="go('/orders')" aria-label="订单"><Icon name="order" :size="16"/><span>订单</span></button>
              <button type="button" :class="{selected:active==='account'}" @click="go('/account')" aria-label="我的"><Icon name="user" :size="16"/><span>我的</span></button>
            </nav>
            <div class="header-trailing">
              <button v-if="hasWorkbench&&!store.preview" type="button" class="header-workbench-btn" @click="go(workbenchPath)"><Icon name="store" :size="14"/><span>工作台</span></button>
              <span v-if="store.preview" class="demo-pill" title="仅用于视觉预览">设计预览</span>
              <button v-else-if="!store.user" class="header-login" @click="loginOpen=true">登录</button>
              <button v-else class="account-pill" @click="logout" title="退出登录">{{store.user.displayName?.slice(0,4)||'账号'}} · 退出 <Icon name="logout" :size="12" /></button>
            </div>
          </div>
        </header>
        <main class="consumer-main"><slot /></main>
      </div>
      <nav class="mobile-tabbar" aria-label="消费者导航">
        <div class="mobile-tabbar-inner">
          <button :class="{selected:active==='home'}" @click="go('/')" aria-label="首页"><Icon name="home" :size="23"/><span>首页</span></button>
          <button :class="{selected:active==='ai'}" @click="go('/ai')" aria-label="AI导购"><span class="tiny-orb"><Icon name="sparkles" :size="20"/></span><span>导购</span></button>
          <button :class="{selected:active==='cart'}" @click="go('/cart')" aria-label="购物车"><Icon name="cart" :size="23"/><span>购物车</span><span v-if="store.cartCount>0" class="nav-cart-badge">{{store.cartCount}}</span></button>
          <button :class="{selected:active==='orders'}" @click="go('/orders')"><Icon name="order" :size="23"/><span>订单</span></button>
          <button :class="{selected:active==='account'}" @click="go('/account')"><Icon name="user" :size="23"/><span>我的</span></button>
        </div>
      </nav>
      <AuthDialog v-if="loginOpen" @close="loginOpen=false" />
    </div>`,
};
