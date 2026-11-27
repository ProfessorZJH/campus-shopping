import {
  store,
  go,
  preview,
  loadMerchant,
  notify,
  switchMerchantContext,
  hasPermission,
  replaceSession,
} from '../services/store.js';
import { api, resetCsrf } from '../services/api.js';
import AuthDialog from './AuthDialog.js';
import { designTheme } from '../services/design-theme.js';
import { merchantNav, adminNav, merchantPermissions } from '../services/backoffice-metadata.js';
const { ref, computed, watch, nextTick, onMounted, onUnmounted } = Vue;

function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.08, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.26);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}

export default {
  name: 'BackofficeShell',
  props: { role: { type: String, default: 'merchant' }, title: String },
  components: { AuthDialog },
  setup(props) {
    const loginOpen = ref(false),
      mobileNav = ref(null),
      soundOn = ref(true);
    let eventSource = null;
    const adminTheme = computed(() => designTheme.admin || 'arco');
    const currentPath = computed(() => store.route.split('?')[0] || '/');
    const visibleMerchantNav = computed(() =>
      merchantNav.filter(([, , path]) => hasPermission(merchantPermissions[path])),
    );
    const alignMobileNav = () => {
      const nav = mobileNav.value;
      if (nav?.clientWidth)
        nav.querySelector('button.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    };
    function closeStream() {
      if (eventSource) {
        try {
          eventSource.close();
        } catch {}
        eventSource = null;
      }
    }
    function connectStream() {
      closeStream();
      if (
        props.role !== 'merchant' ||
        preview ||
        !store.user ||
        typeof EventSource === 'undefined' ||
        !location.protocol.startsWith('http') ||
        window.__contractApi
      ) {
        return;
      }
      try {
        const suffix = store.merchantId
          ? '?merchantId=' + encodeURIComponent(store.merchantId)
          : '';
        eventSource = new EventSource('/api/v1/events/stream' + suffix);
        eventSource.addEventListener('ORDER_PAID', (ev) => {
          try {
            const data = JSON.parse(ev.data || '{}');
            const code = data.pickupCode ? ` · 取餐号 ${data.pickupCode}` : '';
            notify('收到新订单' + code);
            if (soundOn.value) playOrderChime();
          } catch {
            notify('收到新订单');
          }
        });
      } catch {
        closeStream();
      }
    }
    watch(
      [() => store.route, () => visibleMerchantNav.value.map((item) => item[2]).join('|')],
      async () => {
        await nextTick();
        alignMobileNav();
      },
      { immediate: true, flush: 'post' },
    );
    watch(
      [() => props.role, () => store.merchantId, () => store.user?.userId],
      () => {
        connectStream();
      },
      { immediate: true },
    );
    onMounted(() => window.addEventListener('resize', alignMobileNav));
    onUnmounted(() => {
      window.removeEventListener('resize', alignMobileNav);
      closeStream();
    });
    async function switchShop(e) {
      if (preview) {
        notify('演示模式不能切换真实商户');
        return;
      }
      switchMerchantContext(e.target.value);
    }
    function toggleSound() {
      soundOn.value = !soundOn.value;
      if (soundOn.value) {
        playOrderChime();
        notify('新单提醒音已开启');
      } else {
        notify('新单提醒音已关闭');
      }
    }
    async function logout() {
      if (preview) {
        go('/');
        return;
      }
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
    const groupedNav = computed(() => {
      const list = props.role === 'admin' ? adminNav : visibleMerchantNav.value;
      const groupTitleOf = (path) => {
        if (props.role === 'admin') {
          if (path === '/admin') return '概览';
          if (['/admin/applications', '/admin/merchants', '/admin/products'].includes(path))
            return '商户与商品';
          if (['/admin/orders', '/admin/disputes'].includes(path)) return '交易与售后';
          return '系统设置';
        }
        if (path === '/merchant') return '概览';
        if (['/merchant/orders', '/merchant/pickup', '/merchant/aftersales'].includes(path))
          return '订单处理';
        if (['/merchant/products', '/merchant/inventory'].includes(path)) return '商品与库存';
        return '门店管理';
      };
      const out = [];
      let lastGroup = '';
      for (const item of list) {
        const g = groupTitleOf(item[2]);
        if (g !== lastGroup) {
          out.push({ kind: 'group', label: g });
          lastGroup = g;
        }
        out.push({ kind: 'item', ico: item[0], label: item[1], path: item[2] });
      }
      return out;
    });
    return {
      store,
      go,
      preview,
      designTheme,
      adminTheme,
      loginOpen,
      mobileNav,
      soundOn,
      toggleSound,
      logout,
      merchantNav,
      visibleMerchantNav,
      adminNav,
      groupedNav,
      currentPath,
      switchShop,
    };
  },
  template: `
    <div class="merchant-shell" :class="'shell-' + adminTheme">
      <header class="merchant-topbar">
        <div class="topbar-left">
          <button
            v-if="adminTheme !== 'meituan'"
            type="button"
            class="topbar-brand-btn"
            @click="go('/')"
          >
            <BrandLogo :size="28" />
            <span class="topbar-brand-word">青柠校园</span>
            <span class="topbar-brand-divider" aria-hidden="true"></span>
            <span
              class="crumb-role-badge"
              :class="role === 'admin' ? 'role-badge-admin' : 'role-badge-merchant'"
            >
              {{ role === 'admin' ? '平台管理' : '商家工作台' }}
            </span>
          </button>
          <div v-if="adminTheme === 'arco'" class="topbar-crumb arco-crumb">
            <Icon name="chevronRight" :size="13" />
            <strong>{{ title }}</strong>
          </div>
          <div v-if="adminTheme === 'meituan'" class="topbar-crumb">
            <span
              class="crumb-role-badge"
              :class="role === 'admin' ? 'role-badge-admin' : 'role-badge-merchant'"
            >
              {{ role === 'admin' ? '平台管理' : '商家工作台' }}
            </span>
            <Icon name="chevronRight" :size="13" />
            <strong>{{ title }}</strong>
          </div>
        </div>

        <div class="merchant-topbar-actions merchant-topbar-tools">
          <DesignVariantSwitcher compact />
          <span
            v-if="role === 'merchant' && adminTheme === 'meituan'"
            class="merchant-live-status is-meituan"
          >
            <i class="live-dot" aria-hidden="true"></i>营业中 · 接单正常
          </span>
          <span
            v-else-if="role === 'merchant' && !preview"
            class="merchant-live-status"
          >
            <i class="live-dot" aria-hidden="true"></i>营业中
          </span>
          <span v-if="preview" class="admin-preview-tag">设计预览</span>
          <button
            v-if="role === 'merchant' && (!preview || adminTheme === 'meituan')"
            type="button"
            class="topbar-chime-btn"
            :class="{ active: soundOn }"
            :aria-pressed="soundOn"
            :title="soundOn ? '点击关闭新单提醒' : '点击开启新单提醒'"
            @click="toggleSound"
          >
            <Icon name="volume" :size="14" />
            <span>{{ soundOn ? '提醒音开启' : '已静音' }}</span>
          </button>
          <label v-if="role === 'merchant'" class="topbar-merchant-select">
            <Icon name="store" :size="15" />
            <select :value="store.merchantId" :disabled="preview" @change="switchShop">
              <option v-for="m in store.merchants" :key="m.merchantId" :value="m.merchantId">
                {{ m.name }}
              </option>
            </select>
          </label>
          <button type="button" class="topbar-ghost-btn topbar-mall-btn" @click="go('/')">
            返回商城
          </button>
          <button type="button" class="topbar-avatar" title="切换账号" @click="loginOpen = true">
            <Icon name="user" :size="15" />
            <span v-if="store.user?.displayName" class="admin-user">{{
              store.user.displayName
            }}</span>
          </button>
          <button
            v-if="store.user && !preview"
            type="button"
            class="topbar-ghost-btn topbar-logout-btn"
            title="退出当前账号"
            @click="logout"
          >
            退出
          </button>
        </div>
      </header>

      <aside class="merchant-sidebar">
        <button
          v-if="adminTheme === 'meituan'"
          type="button"
          class="merchant-brand"
          @click="go('/')"
        >
          <BrandLogo :size="32" />
          <span class="brand-word-stack">
            <span class="brand-word">青柠校园</span>
            <span
              class="brand-suffix"
              :class="role === 'admin' ? 'role-badge-admin' : 'role-badge-merchant'"
            >
              {{ role === 'admin' ? '平台管理' : '商家工作台' }}
            </span>
          </span>
        </button>
        <nav class="merchant-nav">
          <template v-for="(entry, idx) in groupedNav" :key="entry.path || 'g-' + idx">
            <div v-if="entry.kind === 'group'" class="nav-group-title">{{ entry.label }}</div>
            <button
              v-else
              type="button"
              :title="entry.label"
              :aria-label="entry.label"
              :class="{
                active:
                  currentPath === entry.path ||
                  (entry.path.endsWith('/knowledge') && currentPath === entry.path + '/debug'),
              }"
              @click="go(entry.path)"
            >
              <Icon :name="entry.ico" :size="17" />
              <span>{{ entry.label }}</span>
            </button>
          </template>
        </nav>
        <div class="merchant-sidebar-bottom">
          <button
            type="button"
            class="sidebar-back"
            title="返回购物端"
            aria-label="返回购物端"
            @click="go('/')"
          >
            <Icon name="arrowLeft" :size="15" />
            <span>返回商城</span>
          </button>
        </div>
      </aside>

      <div class="merchant-content-shell merchant-content">
        <nav ref="mobileNav" class="merchant-mobile-nav" aria-label="工作台导航">
          <button type="button" aria-label="返回购物端" @click="go('/')">
            <Icon name="arrowLeft" :size="15" />商城
          </button>
          <button
            v-for="([ico, label, path]) in role === 'admin' ? adminNav : visibleMerchantNav"
            :key="path"
            type="button"
            :class="{
              active:
                currentPath === path ||
                (path.endsWith('/knowledge') && currentPath === path + '/debug'),
            }"
            @click="go(path)"
          >
            <Icon :name="ico" :size="15" />{{ label }}
          </button>
        </nav>

        <section
          v-if="adminTheme === 'antd'"
          class="antd-page-header"
          aria-label="页面路径与标题"
        >
          <nav class="antd-breadcrumb" aria-label="面包屑">
            <button type="button" class="antd-crumb-link" @click="go('/')">首页</button>
            <span class="antd-crumb-sep" aria-hidden="true">/</span>
            <button
              type="button"
              class="antd-crumb-link"
              @click="go(role === 'admin' ? '/admin' : '/merchant')"
            >
              {{ role === 'admin' ? '平台管理' : '商家工作台' }}
            </button>
            <span class="antd-crumb-sep" aria-hidden="true">/</span>
            <span class="antd-crumb-current">{{ title }}</span>
          </nav>
          <div class="merchant-page-heading antd-heading-row">
            <div>
              <h1>{{ title }}</h1>
            </div>
            <slot name="actions" />
          </div>
        </section>

        <main class="merchant-main">
          <div v-if="adminTheme !== 'antd'" class="merchant-page-heading">
            <div>
              <h1>{{ title }}</h1>
            </div>
            <slot name="actions" />
          </div>
          <div v-if="store.error" class="inline-error merchant-error">{{ store.error }}</div>
          <slot />
        </main>
      </div>

      <AuthDialog
        v-if="loginOpen"
        @close="loginOpen = false"
        @success="role === 'merchant' ? loadMerchant() : null"
      />
    </div>
  `,
};
