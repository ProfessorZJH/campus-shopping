import { go, store, preview, notify, replaceSession } from '../services/store.js';
import { api, resetCsrf } from '../services/api.js';
import AuthDialog from './AuthDialog.js';
const { ref, computed, onMounted, onUnmounted } = Vue;
const CAMPUS_ZONES = [
  '本部校区 · 全校自提圈',
  '学一食堂东侧自提点',
  '图书馆南门连廊窗',
  '北苑公寓4栋便利站',
  '南区活动中心鲜果站',
];
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
        notify('已退出');
        go('/');
      } catch (err) {
        notify(err.message);
      }
    }
    function cycleZone() {
      zoneIndex.value = (zoneIndex.value + 1) % CAMPUS_ZONES.length;
      notify('已切换自提片区：' + CAMPUS_ZONES[zoneIndex.value]);
    }
    function scrollTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      store.workspace?.merchants?.length ? '商家工作台' : '平台管理后台',
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
      scrollTop,
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
      <div class="mall-site-nav" aria-label="站点快捷栏">
        <div class="mall-site-nav-inner">
          <div class="mall-site-left">
            <button type="button" class="mall-zone-picker" @click="cycleZone" aria-label="切换校内自提片区">
              <Icon name="pin" :size="13" />
              <span>{{ currentZone }}</span>
              <small>[切换]</small>
            </button>
            <span class="mall-site-divider">|</span>
            <span class="mall-site-promise">⚡ 校内认证门店现货 · 下单锁库存 · 最快8分钟免排队自提</span>
          </div>
          <div class="mall-site-right">
            <span v-if="store.user" class="mall-site-welcome">你好，{{ store.user.displayName || store.user.username }}</span>
            <button v-else-if="!store.preview" type="button" class="mall-site-link highlight" @click="loginOpen=true">亲，请登录 / 免费注册</button>
            <button type="button" class="mall-site-link" @click="go('/orders')">我的订单</button>
            <button type="button" class="mall-site-link" @click="go('/account')">我的收藏</button>
            <button type="button" class="mall-site-link" @click="go('/ai')">✨ 问问导购</button>
            <button v-if="hasWorkbench && !store.preview" type="button" class="mall-site-link workbench" @click="go(workbenchPath)">{{ workbenchLabel }}</button>
            <button v-else type="button" class="mall-site-link" @click="go('/apply')">商家入驻</button>
          </div>
        </div>
      </div>
      <div class="consumer-width">
        <header class="consumer-header">
          <div class="consumer-header-inner">
            <button type="button" class="campus-location" @click="go('/')">
              <div class="brand-pin"><span>闪</span></div>
              <div>
                <div class="location-name">青柠闪购 <em class="brand-tag-pill">校内自提</em></div>
                <div class="location-sub">校园即时零售 · 正品现货秒提</div>
              </div>
            </button>
            <nav class="desktop-consumer-nav" aria-label="主导航">
              <button type="button" :class="{selected:active==='home'}" @click="go('/')" aria-label="首页"><Icon name="home" :size="16"/><span>首页逛逛</span></button>
              <button type="button" class="nav-ai-pill" :class="{selected:active==='ai'}" @click="go('/ai')" aria-label="AI导购"><Icon name="sparkles" :size="16"/><span>AI 问问导购</span></button>
              <button type="button" :class="{selected:active==='cart'}" @click="go('/cart')" aria-label="购物车"><Icon name="cart" :size="16"/><span>购物车</span><span v-if="store.cartCount>0" class="nav-cart-badge">{{store.cartCount}}</span></button>
              <button type="button" :class="{selected:active==='orders'}" @click="go('/orders')" aria-label="订单"><Icon name="order" :size="16"/><span>我的订单</span></button>
              <button type="button" :class="{selected:active==='account'}" @click="go('/account')" aria-label="我的"><Icon name="user" :size="16"/><span>个人中心</span></button>
            </nav>
            <div class="header-trailing">
              <button type="button" class="header-cart-capsule" @click="go('/cart')" aria-label="前往结算台">
                <Icon name="cart" :size="16"/>
                <span>去结算</span>
                <b class="capsule-count">{{store.cartCount || 0}}</b>
              </button>
              <button v-if="hasWorkbench&&!store.preview" type="button" class="header-workbench-btn" @click="go(workbenchPath)"><Icon name="store" :size="14"/><span>{{workbenchLabel}}</span></button>
              <span v-if="store.preview" class="demo-pill" title="仅用于视觉预览">设计预览</span>
              <button v-else-if="!store.user" class="header-login" @click="loginOpen=true">登录</button>
              <div v-else ref="menuWrap" class="user-menu-wrap">
                <button type="button" class="user-menu-btn" :aria-expanded="menuOpen" aria-haspopup="menu" @click.stop="menuOpen=!menuOpen"><span class="user-avatar-chip">{{userInitial}}</span><span class="user-menu-name">{{store.user.displayName||store.user.username||'同学'}}</span><Icon name="chevronDown" :size="13"/></button>
                <button type="button" class="account-pill" @click="logout" title="退出登录" aria-label="退出登录"><Icon name="logout" :size="13"/></button>
                <div v-if="menuOpen" class="user-menu-popover" role="menu">
                  <div class="user-menu-header"><strong>{{store.user.displayName||'校园同学'}}</strong><small>账号：{{store.user.username||''}}</small></div>
                  <button type="button" role="menuitem" @click="navigateFromMenu('/account')"><Icon name="heart" :size="15"/><span>个人中心 / 我的收藏</span></button>
                  <button type="button" role="menuitem" @click="navigateFromMenu('/orders')"><Icon name="order" :size="15"/><span>我的订单 / 取餐码</span></button>
                  <button v-if="hasWorkbench" type="button" role="menuitem" @click="navigateFromMenu(workbenchPath)"><Icon name="store" :size="15"/><span>进入{{workbenchLabel}}</span></button>
                  <button type="button" role="menuitem" class="menu-danger" @click="logout"><Icon name="logout" :size="15"/><span>退出当前账号</span></button>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main class="consumer-main"><slot /></main>
      </div>
      <aside class="mall-float-dock" aria-label="右侧悬浮快捷栏">
        <button type="button" class="dock-item ai" :class="{active:active==='ai'}" @click="go('/ai')" aria-label="悬浮AI导购">
          <Icon name="sparkles" :size="18"/>
          <span>问导购</span>
        </button>
        <button type="button" class="dock-item" :class="{active:active==='cart'}" @click="go('/cart')" aria-label="侧栏购物袋">
          <Icon name="cart" :size="18"/>
          <span>购物袋</span>
          <em v-if="store.cartCount>0" class="dock-badge">{{store.cartCount}}</em>
        </button>
        <button type="button" class="dock-item" :class="{active:active==='orders'}" @click="go('/orders')" aria-label="悬浮取件码">
          <Icon name="scan" :size="18"/>
          <span>取件码</span>
        </button>
        <button type="button" class="dock-item" :class="{active:active==='account'}" @click="go('/account')" aria-label="悬浮收藏夹">
          <Icon name="heart" :size="18"/>
          <span>收藏夹</span>
        </button>
        <button type="button" class="dock-item top" @click="scrollTop" aria-label="回到顶部">
          <span>↑</span>
          <span>顶部</span>
        </button>
      </aside>
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
