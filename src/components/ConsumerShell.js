import { go, store, preview, notify, replaceSession } from '../services/store.js';
import { api, resetCsrf } from '../services/api.js';
import { designTheme } from '../services/design-theme.js';
import AuthDialog from './AuthDialog.js';
const { ref, computed, provide, onMounted, onUnmounted } = Vue;

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
    const isDesktopXhs = ref(typeof window !== 'undefined' ? window.innerWidth >= 960 : true);

    provide('openConsumerLogin', () => {
      loginOpen.value = true;
    });

    const consumerMode = computed(() => designTheme.consumer || 'taobao');

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

    function submitQuickSearch() {
      const q = String(designTheme.searchDraft || '').trim();
      designTheme.searchDraft = q;
      go(q ? '/?q=' + encodeURIComponent(q) : '/');
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

    function onResize() {
      isDesktopXhs.value = window.innerWidth >= 960;
    }

    onMounted(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onDocKey);
      window.addEventListener('resize', onResize, { passive: true });
      onResize();
    });

    onUnmounted(() => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onDocKey);
      window.removeEventListener('resize', onResize);
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
    const xhsSwitcherAlign = computed(() => (isDesktopXhs.value ? 'up-left' : 'right'));

    return {
      go,
      store,
      preview,
      designTheme,
      consumerMode,
      loginOpen,
      menuOpen,
      menuWrap,
      currentZone,
      cycleZone,
      logout,
      navigateFromMenu,
      submitQuickSearch,
      hasWorkbench,
      workbenchPath,
      workbenchLabel,
      userInitial,
      xhsSwitcherAlign,
    };
  },
  template: `
    <div :class="['consumer-shell', 'consumer-mode-' + consumerMode]">
      <!-- ==================== 模式 4：小红书 Web 双栏骨架 (左侧固定白底竖向导航 + 右侧纯白吸顶搜索流) ==================== -->
      <div v-if="consumerMode === 'xiaohongshu'" class="xhs-app-frame">
        <aside class="xhs-left-sidebar" aria-label="小红书侧边栏">
          <div class="xhs-sidebar-top">
            <button type="button" class="campus-location xhs-logo-btn" @click="go('/')">
              <BrandLogo :size="34" />
              <div class="brand-wordmark-col">
                <span class="location-name">青柠市集</span>
                <small class="brand-sub-en">RED CAMPUS</small>
              </div>
            </button>

            <div class="xhs-mobile-tools">
              <span v-if="store.preview" class="demo-pill" title="仅用于视觉预览">设计预览</span>
              <button
                v-else-if="!store.user"
                type="button"
                class="header-login xhs-login-pill"
                @click="loginOpen = true"
              >
                登录
              </button>
              <div v-else ref="menuWrap" class="user-menu-wrap xhs-user-menu">
                <button
                  type="button"
                  class="user-menu-btn"
                  :aria-expanded="menuOpen"
                  aria-haspopup="menu"
                  @click.stop="menuOpen = !menuOpen"
                >
                  <span class="user-avatar-chip">{{ userInitial }}</span>
                  <span class="user-menu-name">{{
                    store.user.displayName || store.user.username || '同学'
                  }}</span>
                  <Icon name="chevronDown" :size="13" />
                </button>
                <button
                  type="button"
                  class="account-pill"
                  title="退出登录"
                  aria-label="退出登录"
                  @click="logout"
                >
                  <Icon name="logout" :size="13" />
                </button>
                <div v-if="menuOpen" class="user-menu-popover xhs-user-popover" role="menu">
                  <div class="user-menu-header">
                    <strong>{{ store.user.displayName || '校园同学' }}</strong>
                    <small>{{ store.user.username || '' }}</small>
                  </div>
                  <button type="button" role="menuitem" @click="navigateFromMenu('/account')">
                    <Icon name="heart" :size="15" /><span>我的收藏与足迹</span>
                  </button>
                  <button type="button" role="menuitem" @click="navigateFromMenu('/orders')">
                    <Icon name="order" :size="15" /><span>我的订单</span>
                  </button>
                  <button
                    v-if="hasWorkbench"
                    type="button"
                    role="menuitem"
                    @click="navigateFromMenu(workbenchPath)"
                  >
                    <Icon name="store" :size="15" /><span>{{ workbenchLabel }}</span>
                  </button>
                  <button type="button" role="menuitem" class="menu-danger" @click="logout">
                    <Icon name="logout" :size="15" /><span>退出登录</span>
                  </button>
                </div>
              </div>
              <div class="xhs-switcher-slot">
                <DesignVariantSwitcher :align="xhsSwitcherAlign" />
              </div>
            </div>
          </div>

          <nav class="desktop-consumer-nav mobile-tabbar xhs-vertical-nav" aria-label="主导航">
            <div class="mobile-tabbar-inner">
              <button
                type="button"
                :class="{ selected: active === 'home' }"
                aria-label="首页"
                @click="go('/')"
              >
                <Icon name="home" :size="19" /><span>首页</span>
              </button>
              <button
                type="button"
                :class="{ selected: active === 'ai' }"
                @click="go('/ai')"
              >
                <Icon name="sparkles" :size="19" /><span>AI 导购</span>
              </button>
              <button
                type="button"
                :class="{ selected: active === 'cart' }"
                aria-label="购物车"
                @click="go('/cart')"
              >
                <Icon name="cart" :size="19" /><span>购物车</span>
                <span v-if="store.cartCount > 0" class="nav-cart-badge">{{
                  store.cartCount
                }}</span>
              </button>
              <button
                type="button"
                :class="{ selected: active === 'orders' }"
                aria-label="订单"
                @click="go('/orders')"
              >
                <Icon name="order" :size="19" /><span>订单</span>
              </button>
              <button
                type="button"
                :class="{ selected: active === 'account' }"
                aria-label="我的"
                @click="go('/account')"
              >
                <Icon name="user" :size="19" /><span>我的</span>
              </button>
            </div>
          </nav>
        </aside>

        <div class="xhs-main-column">
          <header class="consumer-header header-xiaohongshu">
            <div class="consumer-header-inner xhs-header-inner">
              <div class="header-search-col xhs-search-col">
                <slot name="header-search">
                  <div class="big-search is-subpage">
                    <Icon name="search" :size="16" class="big-search-icon" />
                    <input
                      v-model="designTheme.searchDraft"
                      placeholder="搜索校内种草好物、饮品、零食…"
                      aria-label="搜索校园商品"
                      @keydown.enter="submitQuickSearch"
                    />
                    <button type="button" @click="submitQuickSearch">搜索</button>
                  </div>
                </slot>
              </div>
              <div class="xhs-header-right">
                <button
                  type="button"
                  class="header-zone-pill xhs-zone-pill"
                  aria-label="切换取货区域"
                  @click="cycleZone"
                >
                  <Icon name="pin" :size="13" class="zone-pin-icon" />
                  <span>{{ currentZone }}</span>
                </button>
                <a
                  v-if="hasWorkbench && !store.preview"
                  :href="'#' + workbenchPath"
                  class="header-workbench-btn xhs-workbench-link"
                  @click.prevent="go(workbenchPath)"
                >
                  <Icon name="store" :size="14" /><span>{{ workbenchLabel }}</span>
                </a>
              </div>
            </div>
          </header>

          <div class="consumer-width xhs-content-width">
            <main class="consumer-main"><slot /></main>
          </div>
        </div>
      </div>

      <!-- ==================== 模式 1 / 2 / 3：淘宝 2025 PC · 京东 PC · 小米有品 PC 经典双层顶栏骨架 ==================== -->
      <template v-else>
        <div :class="['bt-utility-bar', 'bt-utility-' + consumerMode]">
          <div class="bt-utility-inner">
            <div class="bt-utility-left">
              <button
                type="button"
                class="bt-zone-trigger"
                aria-label="切换取货区域"
                @click="cycleZone"
              >
                <Icon name="pin" :size="12" class="zone-pin-icon" />
                <span>{{ currentZone }}</span>
                <Icon name="chevronDown" :size="11" class="zone-chevron-icon" />
              </button>

              <!-- 淘宝 2025 经典左置亲切登录位 -->
              <template v-if="consumerMode === 'taobao'">
                <span v-if="store.preview" class="demo-pill" title="仅用于视觉预览">设计预览</span>
                <button
                  v-else-if="!store.user"
                  type="button"
                  class="header-login bt-taobao-login"
                  @click="loginOpen = true"
                >
                  登录
                </button>
                <div v-else ref="menuWrap" class="user-menu-wrap bt-user-menu">
                  <button
                    type="button"
                    class="user-menu-btn"
                    :aria-expanded="menuOpen"
                    aria-haspopup="menu"
                    @click.stop="menuOpen = !menuOpen"
                  >
                    <span class="user-avatar-chip">{{ userInitial }}</span>
                    <span class="user-menu-name">{{
                      store.user.displayName || store.user.username || '同学'
                    }}</span>
                    <Icon name="chevronDown" :size="12" />
                  </button>
                  <button
                    type="button"
                    class="account-pill"
                    title="退出登录"
                    aria-label="退出登录"
                    @click="logout"
                  >
                    <Icon name="logout" :size="13" />
                  </button>
                  <div v-if="menuOpen" class="user-menu-popover bt-popover-left" role="menu">
                    <div class="user-menu-header">
                      <strong>{{ store.user.displayName || '校园同学' }}</strong>
                      <small>{{ store.user.username || '' }}</small>
                    </div>
                    <button type="button" role="menuitem" @click="navigateFromMenu('/account')">
                      <Icon name="heart" :size="15" /><span>我的收藏与足迹</span>
                    </button>
                    <button type="button" role="menuitem" @click="navigateFromMenu('/orders')">
                      <Icon name="order" :size="15" /><span>我的订单</span>
                    </button>
                    <button
                      v-if="hasWorkbench"
                      type="button"
                      role="menuitem"
                      @click="navigateFromMenu(workbenchPath)"
                    >
                      <Icon name="store" :size="15" /><span>{{ workbenchLabel }}</span>
                    </button>
                    <button type="button" role="menuitem" class="menu-danger" @click="logout">
                      <Icon name="logout" :size="15" /><span>退出登录</span>
                    </button>
                  </div>
                </div>
                <span class="bt-util-slogan">校内现货 · 凭码免运费自提</span>
              </template>
              <span v-else-if="consumerMode === 'youpin'" class="bt-util-slogan">
                青柠严选校园品质好物 · 下课顺路即取
              </span>
            </div>

            <div class="bt-utility-right">
              <!-- 京东 PC / 小米有品 PC 经典右置登录位 -->
              <template v-if="consumerMode !== 'taobao'">
                <span v-if="store.preview" class="demo-pill" title="仅用于视觉预览">设计预览</span>
                <button
                  v-else-if="!store.user"
                  type="button"
                  :class="['header-login', 'bt-' + consumerMode + '-login']"
                  @click="loginOpen = true"
                >
                  登录
                </button>
                <div v-else ref="menuWrap" class="user-menu-wrap bt-user-menu">
                  <button
                    type="button"
                    class="user-menu-btn"
                    :aria-expanded="menuOpen"
                    aria-haspopup="menu"
                    @click.stop="menuOpen = !menuOpen"
                  >
                    <span class="user-avatar-chip">{{ userInitial }}</span>
                    <span class="user-menu-name">{{
                      store.user.displayName || store.user.username || '同学'
                    }}</span>
                    <Icon name="chevronDown" :size="12" />
                  </button>
                  <button
                    type="button"
                    class="account-pill"
                    title="退出登录"
                    aria-label="退出登录"
                    @click="logout"
                  >
                    <Icon name="logout" :size="13" />
                  </button>
                  <div v-if="menuOpen" class="user-menu-popover" role="menu">
                    <div class="user-menu-header">
                      <strong>{{ store.user.displayName || '校园同学' }}</strong>
                      <small>{{ store.user.username || '' }}</small>
                    </div>
                    <button type="button" role="menuitem" @click="navigateFromMenu('/account')">
                      <Icon name="heart" :size="15" /><span>我的收藏与足迹</span>
                    </button>
                    <button type="button" role="menuitem" @click="navigateFromMenu('/orders')">
                      <Icon name="order" :size="15" /><span>我的订单</span>
                    </button>
                    <button
                      v-if="hasWorkbench"
                      type="button"
                      role="menuitem"
                      @click="navigateFromMenu(workbenchPath)"
                    >
                      <Icon name="store" :size="15" /><span>{{ workbenchLabel }}</span>
                    </button>
                    <button type="button" role="menuitem" class="menu-danger" @click="logout">
                      <Icon name="logout" :size="15" /><span>退出登录</span>
                    </button>
                  </div>
                </div>
                <span class="bt-util-sep" aria-hidden="true"></span>
              </template>

              <a href="#/orders" class="bt-util-link bt-util-desktop" @click.prevent="go('/orders')">
                我的订单
              </a>
              <a
                v-if="consumerMode === 'taobao'"
                href="#/cart"
                class="bt-util-link bt-util-desktop"
                @click.prevent="go('/cart')"
              >
                <Icon name="cart" :size="12" /><span>购物车</span>
                <em v-if="store.cartCount > 0" class="bt-util-badge">{{ store.cartCount }}</em>
              </a>
              <a
                href="#/ai"
                class="bt-util-link bt-util-accent bt-util-desktop"
                @click.prevent="go('/ai')"
              >
                <Icon name="sparkles" :size="12" /><span>AI 导购</span>
              </a>
              <a
                v-if="hasWorkbench && !store.preview"
                :href="'#' + workbenchPath"
                class="bt-util-link bt-util-desktop header-workbench-link"
                @click.prevent="go(workbenchPath)"
              >
                <Icon name="store" :size="12" /><span>{{ workbenchLabel }}</span>
              </a>
              <DesignVariantSwitcher />
            </div>
          </div>
        </div>

        <header :class="['consumer-header', 'header-' + consumerMode]">
          <div :class="['consumer-header-inner', consumerMode + '-header-inner']">
            <div class="header-brand-group">
              <button type="button" class="campus-location" @click="go('/')">
                <BrandLogo :size="consumerMode === 'youpin' ? 35 : 38" />
                <div class="brand-wordmark-col">
                  <span class="location-name">{{
                    consumerMode === 'jd'
                      ? '青柠自营'
                      : consumerMode === 'youpin'
                        ? '青柠有品'
                        : '青柠校园'
                  }}</span>
                  <small class="brand-sub-en">{{
                    consumerMode === 'jd'
                      ? 'JD CAMPUS'
                      : consumerMode === 'youpin'
                        ? 'YOUPIN SELECT'
                        : 'TAOBAO CAMPUS'
                  }}</small>
                </div>
              </button>
            </div>

            <!-- 小米有品：居中极简水平频道主导航，右侧底线细搜索框 -->
            <template v-if="consumerMode === 'youpin'">
              <nav class="desktop-consumer-nav mobile-tabbar youpin-center-nav" aria-label="主导航">
                <div class="mobile-tabbar-inner">
                  <button
                    type="button"
                    :class="{ selected: active === 'home' }"
                    aria-label="首页"
                    @click="go('/')"
                  >
                    <Icon name="home" :size="18" /><span>首页</span>
                  </button>
                  <button
                    type="button"
                    :class="{ selected: active === 'ai' }"
                    @click="go('/ai')"
                  >
                    <Icon name="sparkles" :size="18" /><span>AI 导购</span>
                  </button>
                  <button
                    type="button"
                    :class="{ selected: active === 'cart' }"
                    aria-label="购物车"
                    @click="go('/cart')"
                  >
                    <Icon name="cart" :size="18" /><span>购物车</span>
                    <span v-if="store.cartCount > 0" class="nav-cart-badge">{{
                      store.cartCount
                    }}</span>
                  </button>
                  <button
                    type="button"
                    :class="{ selected: active === 'orders' }"
                    aria-label="订单"
                    @click="go('/orders')"
                  >
                    <Icon name="order" :size="18" /><span>订单</span>
                  </button>
                  <button
                    type="button"
                    :class="{ selected: active === 'account' }"
                    aria-label="我的"
                    @click="go('/account')"
                  >
                    <Icon name="user" :size="18" /><span>我的</span>
                  </button>
                </div>
              </nav>

              <div class="header-search-col youpin-search-col">
                <slot name="header-search">
                  <div class="big-search is-subpage">
                    <Icon name="search" :size="16" class="big-search-icon" />
                    <input
                      v-model="designTheme.searchDraft"
                      placeholder="搜有品校园严选…"
                      aria-label="搜索校园商品"
                      @keydown.enter="submitQuickSearch"
                    />
                    <button type="button" @click="submitQuickSearch">搜索</button>
                  </div>
                </slot>
              </div>
            </template>

            <!-- 淘宝 2025 PC & 京东 PC：居中标志性大搜索框 + 右侧购物车盒/紧凑主导航 -->
            <template v-else>
              <div :class="['header-search-col', consumerMode + '-search-col']">
                <slot name="header-search">
                  <div class="big-search is-subpage">
                    <Icon name="search" :size="17" class="big-search-icon" />
                    <input
                      v-model="designTheme.searchDraft"
                      placeholder="搜索饮品、零食、水果、文具…"
                      aria-label="搜索校园商品"
                      @keydown.enter="submitQuickSearch"
                    />
                    <button type="button" @click="submitQuickSearch">搜索</button>
                  </div>
                </slot>
              </div>

              <div class="header-trailing">
                <a
                  v-if="consumerMode === 'jd'"
                  href="#/cart"
                  class="jd-cart-box"
                  @click.prevent="go('/cart')"
                >
                  <Icon name="cart" :size="16" />
                  <span>我的购物车</span>
                  <em class="jd-cart-count">{{ store.cartCount || 0 }}</em>
                </a>

                <nav class="desktop-consumer-nav mobile-tabbar" aria-label="主导航">
                  <div class="mobile-tabbar-inner">
                    <button
                      type="button"
                      :class="{ selected: active === 'home' }"
                      aria-label="首页"
                      @click="go('/')"
                    >
                      <Icon name="home" :size="18" /><span>首页</span>
                    </button>
                    <button
                      type="button"
                      :class="{ selected: active === 'ai' }"
                      @click="go('/ai')"
                    >
                      <Icon name="sparkles" :size="18" /><span>AI 导购</span>
                    </button>
                    <button
                      type="button"
                      :class="{ selected: active === 'cart' }"
                      aria-label="购物车"
                      @click="go('/cart')"
                    >
                      <Icon name="cart" :size="18" /><span>购物车</span>
                      <span v-if="store.cartCount > 0" class="nav-cart-badge">{{
                        store.cartCount
                      }}</span>
                    </button>
                    <button
                      type="button"
                      :class="{ selected: active === 'orders' }"
                      aria-label="订单"
                      @click="go('/orders')"
                    >
                      <Icon name="order" :size="18" /><span>订单</span>
                    </button>
                    <button
                      type="button"
                      :class="{ selected: active === 'account' }"
                      aria-label="我的"
                      @click="go('/account')"
                    >
                      <Icon name="user" :size="18" /><span>我的</span>
                    </button>
                  </div>
                </nav>
              </div>
            </template>
          </div>
        </header>

        <div class="consumer-width">
          <main class="consumer-main"><slot /></main>
        </div>
      </template>

      <AuthDialog v-if="loginOpen" @close="loginOpen = false" />
    </div>
  `,
};
