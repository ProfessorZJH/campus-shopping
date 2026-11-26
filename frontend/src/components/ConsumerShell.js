import { go, store, preview, notify, replaceSession } from '../services/store.js';
import { api, resetCsrf } from '../services/api.js';
import AuthDialog from './AuthDialog.js';
const { ref, computed, onMounted, onUnmounted } = Vue;
const CAMPUS_ZONES = ['全校门店', '学一食堂', '图书馆南门', '北苑宿舍区', '南区活动中心'];
export default {
  name: 'ConsumerShell',
  components: { AuthDialog },
  props: { active: { type: String, default: 'home' } },
  setup() {
    const loginOpen = ref(false);
    const menuOpen = ref(false);
    const zoneIndex = ref(0);
    const menuWrap = ref(null);
    async function logout() {
      menuOpen.value = false;
      try {
        await api('/auth/logout', { method: 'POST' });
        resetCsrf();
        replaceSession(null);
        notify('已退出登录');
        go('/');
      } catch (err) {
        notify(err.message);
      }
    }
    function cycleZone() {
      zoneIndex.value = (zoneIndex.value + 1) % CAMPUS_ZONES.length;
      notify('已切换取货范围：' + CAMPUS_ZONES[zoneIndex.value]);
    }
    function navigateFromMenu(path) {
      menuOpen.value = false;
      go(path);
    }
    function onDocClick(event) {
      if (!menuOpen.value) return;
      if (menuWrap.value && !menuWrap.value.contains(event.target)) {
        menuOpen.value = false;
      }
    }
    function onDocKey(event) {
      if (event.key === 'Escape' && menuOpen.value) menuOpen.value = false;
    }
    onMounted(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onDocKey);
    });
    onUnmounted(() => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onDocKey);
    });
    const hasWorkbench = computed(
      () =>
        preview || !!store.workspace?.platformAdmin || Boolean(store.workspace?.merchants?.length),
    );
    const workbenchPath = computed(() =>
      store.workspace?.merchants?.length ? '/merchant' : '/admin',
    );
    const workbenchLabel = computed(() =>
      store.workspace?.merchants?.length ? '商家后台' : '管理后台',
    );
    const currentZone = computed(() => CAMPUS_ZONES[zoneIndex.value]);
    const userInitial = computed(() =>
      (store.user?.displayName || store.user?.username || '同').slice(0, 1).toUpperCase(),
    );
    return {
      go,
      store,
      preview,
      loginOpen,
      menuOpen,
      menuWrap,
      currentZone,
      cycleZone,
      logout,
      navigateFromMenu,
      hasWorkbench,
      workbenchPath,
      workbenchLabel,
      userInitial,
    };
  },
  template: `
    <div class="consumer-shell">
      <header class="consumer-header">
        <div class="consumer-header-inner">
          <div class="header-brand-group">
            <button type="button" class="campus-location" @click="go('/')">
              <BrandLogo :size="34" />
              <div class="brand-wordmark-col">
                <span class="location-name">青柠校园</span>
                <small class="brand-sub-en">CAMPUS MART</small>
              </div>
            </button>
            <button type="button" class="header-zone-pill" @click="cycleZone" aria-label="切换取货区域">
              <Icon name="pin" :size="13" />
              <span>{{ currentZone }}</span>
              <Icon name="chevronDown" :size="12" />
            </button>
          </div>
          <nav class="desktop-consumer-nav mobile-tabbar" aria-label="主导航">
            <div class="mobile-tabbar-inner">
              <button type="button" :class="{selected:active==='home'}" @click="go('/')" aria-label="首页"><Icon name="home" :size="18"/><span>首页</span></button>
              <button type="button" :class="{selected:active==='ai'}" @click="go('/ai')" aria-label="AI导购"><Icon name="sparkles" :size="18"/><span>AI 导购</span></button>
              <button type="button" :class="{selected:active==='cart'}" @click="go('/cart')" aria-label="购物车"><Icon name="cart" :size="18"/><span>购物车</span><span v-if="store.cartCount>0" class="nav-cart-badge">{{store.cartCount}}</span></button>
              <button type="button" :class="{selected:active==='orders'}" @click="go('/orders')" aria-label="订单"><Icon name="order" :size="18"/><span>订单</span></button>
              <button type="button" :class="{selected:active==='account'}" @click="go('/account')" aria-label="我的"><Icon name="user" :size="18"/><span>我的</span></button>
            </div>
          </nav>
          <div class="header-trailing">
            <button v-if="hasWorkbench&&!store.preview" type="button" class="header-workbench-btn" @click="go(workbenchPath)"><Icon name="store" :size="14"/><span>{{workbenchLabel}}</span></button>
            <span v-if="store.preview" class="demo-pill" title="仅用于视觉预览">设计预览</span>
            <button v-else-if="!store.user" class="header-login" @click="loginOpen=true">登录</button>
            <div v-else ref="menuWrap" class="user-menu-wrap">
              <button type="button" class="user-menu-btn" :aria-expanded="menuOpen" aria-haspopup="menu" @click.stop="menuOpen=!menuOpen"><span class="user-avatar-chip">{{userInitial}}</span><span class="user-menu-name">{{store.user.displayName||store.user.username||'同学'}}</span><Icon name="chevronDown" :size="13"/></button>
              <button type="button" class="account-pill" @click="logout" title="退出登录" aria-label="退出登录"><Icon name="logout" :size="13"/></button>
              <div v-if="menuOpen" class="user-menu-popover" role="menu">
                <div class="user-menu-header"><strong>{{store.user.displayName||'校园同学'}}</strong><small>{{store.user.username||''}}</small></div>
                <button type="button" role="menuitem" @click="navigateFromMenu('/account')"><Icon name="heart" :size="15"/><span>我的收藏与足迹</span></button>
                <button type="button" role="menuitem" @click="navigateFromMenu('/orders')"><Icon name="order" :size="15"/><span>我的订单</span></button>
                <button v-if="hasWorkbench" type="button" role="menuitem" @click="navigateFromMenu(workbenchPath)"><Icon name="store" :size="15"/><span>{{workbenchLabel}}</span></button>
                <button type="button" role="menuitem" class="menu-danger" @click="logout"><Icon name="logout" :size="15"/><span>退出登录</span></button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div class="consumer-width">
        <main class="consumer-main"><slot /></main>
      </div>
      <AuthDialog v-if="loginOpen" @close="loginOpen=false" />
    </div>`,
};
