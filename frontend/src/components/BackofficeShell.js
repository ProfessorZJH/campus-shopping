import {
  store,
  go,
  preview,
  loadMerchant,
  notify,
  switchMerchantContext,
  hasPermission,
} from '../services/store.js';
import AuthDialog from './AuthDialog.js';
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
      loginOpen,
      mobileNav,
      soundOn,
      toggleSound,
      merchantNav,
      visibleMerchantNav,
      adminNav,
      groupedNav,
      switchShop,
    };
  },
  template: `<div class="merchant-shell"><aside class="merchant-sidebar"><button class="merchant-brand" @click="go('/')"><span class="brand-pin"><span>青</span></span><span class="brand-word">青柠校园 <span class="brand-suffix">{{role==='admin'?'管理后台':'商家后台'}}</span></span></button><nav class="merchant-nav"><template v-for="(entry, idx) in groupedNav" :key="entry.path||('g-'+idx)"><div v-if="entry.kind==='group'" class="nav-group-title">{{entry.label}}</div><button v-else :title="entry.label" :aria-label="entry.label" :class="{active:store.route===entry.path||(entry.path.endsWith('/knowledge')&&store.route===entry.path+'/debug')}" @click="go(entry.path)"><Icon :name="entry.ico" :size="17"/><span>{{entry.label}}</span></button></template></nav><div class="merchant-sidebar-bottom"><button class="sidebar-back" @click="go('/')" title="返回购物端" aria-label="返回购物端"><Icon name="arrowLeft" :size="15"/><span>返回商城</span></button></div></aside><div class="merchant-content-shell"><header class="merchant-topbar"><div class="topbar-crumb"><span class="crumb-role-badge">{{role==='admin'?'平台管理':'商家后台'}}</span><Icon name="chevronRight" :size="13"/><strong>{{title}}</strong></div><div class="merchant-topbar-tools"><span v-if="role==='merchant'&&!preview" class="merchant-live-status"><i class="live-dot"></i>营业中</span><span v-if="preview" class="admin-preview-tag">设计预览</span><button v-if="role==='merchant'&&!preview" type="button" class="topbar-chime-btn" :class="{active:soundOn}" :aria-pressed="soundOn" @click="toggleSound" :title="soundOn?'点击关闭新单提醒':'点击开启新单提醒'"><Icon name="volume" :size="14"/><span>{{soundOn?'提醒音开启':'已静音'}}</span></button><label class="topbar-merchant-select" v-if="role==='merchant'"><Icon name="store" :size="15"/><select :value="store.merchantId" @change="switchShop" :disabled="preview"><option v-for="m in store.merchants" :key="m.merchantId" :value="m.merchantId">{{m.name}}</option></select></label><button class="topbar-avatar" @click="loginOpen=true" title="切换账号"><Icon name="user" :size="16"/><span v-if="store.user?.displayName" class="admin-user">{{store.user.displayName}}</span></button></div></header><nav ref="mobileNav" class="merchant-mobile-nav" aria-label="工作台导航"><button type="button" @click="go('/')" aria-label="返回购物端"><Icon name="arrowLeft" :size="15"/>商城</button><button v-for="([ico,label,path]) in (role==='admin'?adminNav:visibleMerchantNav)" :key="path" :class="{active:store.route===path||(path.endsWith('/knowledge')&&store.route===path+'/debug')}" @click="go(path)"><Icon :name="ico" :size="15"/>{{label}}</button></nav><main class="merchant-main"><div class="merchant-page-heading"><div><h1>{{title}}</h1></div><slot name="actions"/></div><div v-if="store.error" class="inline-error merchant-error">{{store.error}}</div><slot/></main></div><AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="role==='merchant'?loadMerchant():null"/></div>`,
};
