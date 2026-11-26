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
            notify('🔔 新订单已付款' + code);
            if (soundOn.value) playOrderChime();
          } catch {
            notify('🔔 收到新付款订单');
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
        notify('新单语音提醒已开启');
      } else {
        notify('新单语音提醒已静音');
      }
    }
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
      switchShop,
    };
  },
  template: `<div class="merchant-shell"><aside class="merchant-sidebar"><button class="merchant-brand" @click="go('/')"><span class="brand-pin"><span></span></span><span class="brand-word">青柠校园 <span class="brand-suffix">/ {{role==='admin'?'平台端':'商户端'}}</span></span></button><nav class="merchant-nav"><button v-for="([ico,label,path]) in (role==='admin'?adminNav:visibleMerchantNav)" :key="path" :title="label" :aria-label="label" :class="{active:store.route===path||(path.endsWith('/knowledge')&&store.route===path+'/debug')}" @click="go(path)"><Icon :name="ico" :size="19"/><span>{{label}}</span><span v-if="store.route===path||(path.endsWith('/knowledge')&&store.route===path+'/debug')" class="nav-left-bar"></span></button></nav><div class="merchant-sidebar-bottom"><button class="sidebar-back" @click="go('/')" title="返回购物端" aria-label="返回购物端"><Icon name="arrowLeft" :size="16"/><span> 返回购物端</span></button></div></aside><div class="merchant-content-shell"><header class="merchant-topbar"><div class="topbar-crumb">{{role==='admin'?'平台管理':'店铺经营'}} <Icon name="chevronRight" :size="14"/><strong>{{title}}</strong></div><div class="merchant-topbar-tools"><span v-if="preview" class="admin-preview-tag">设计预览</span><button v-if="role==='merchant'&&!preview" type="button" class="topbar-chime-btn" :class="{active:soundOn}" :aria-pressed="soundOn" @click="toggleSound" :title="soundOn?'点击静音新单提醒':'点击开启新单提醒'"><Icon name="volume" :size="15"/><span>{{soundOn?'语音接单':'已静音'}}</span></button><label class="topbar-merchant-select" v-if="role==='merchant'"><Icon name="store" :size="16"/><select :value="store.merchantId" @change="switchShop" :disabled="preview"><option v-for="m in store.merchants" :key="m.merchantId" :value="m.merchantId">{{m.name}}</option></select></label><button class="topbar-avatar" @click="loginOpen=true" title="切换账号"><Icon name="user" :size="17"/><span v-if="store.user?.displayName" class="admin-user">{{store.user.displayName}}</span></button></div></header><nav ref="mobileNav" class="merchant-mobile-nav" aria-label="工作台导航"><button type="button" @click="go('/')" aria-label="返回购物端"><Icon name="arrowLeft" :size="16"/>购物端</button><button v-for="([ico,label,path]) in (role==='admin'?adminNav:visibleMerchantNav)" :key="path" :class="{active:store.route===path||(path.endsWith('/knowledge')&&store.route===path+'/debug')}" @click="go(path)"><Icon :name="ico" :size="16"/>{{label}}</button></nav><main class="merchant-main"><div class="merchant-page-heading"><div><h1>{{title}}</h1></div><slot name="actions"/></div><div v-if="store.error" class="inline-error merchant-error">{{store.error}}</div><slot/></main></div><AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="role==='merchant'?loadMerchant():null"/></div>`,
};
