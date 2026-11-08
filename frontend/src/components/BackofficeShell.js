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
import {
  merchantNav,
  adminNav,
  merchantPermissions,
} from '../services/backoffice-metadata.js';
const { ref, computed, watch, nextTick, onMounted, onUnmounted } = Vue;
export default {
  name: 'BackofficeShell',
  props: { role: { type: String, default: 'merchant' }, title: String },
  components: { AuthDialog },
  setup() {
    const loginOpen = ref(false),
      mobileNav = ref(null);
    const visibleMerchantNav = computed(() =>
      merchantNav.filter(([, , path]) => hasPermission(merchantPermissions[path])),
    );
    const alignMobileNav = () => {
      const nav = mobileNav.value;
      if (nav?.clientWidth)
        nav.querySelector('button.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    };
    watch(
      [() => store.route, () => visibleMerchantNav.value.map((item) => item[2]).join('|')],
      async () => {
        await nextTick();
        alignMobileNav();
      },
      { immediate: true, flush: 'post' },
    );
    onMounted(() => window.addEventListener('resize', alignMobileNav));
    onUnmounted(() => window.removeEventListener('resize', alignMobileNav));
    async function switchShop(e) {
      if (preview) {
        notify('演示模式不能切换真实商户');
        return;
      }
      switchMerchantContext(e.target.value);
    }
    return {
      store,
      go,
      preview,
      loginOpen,
      mobileNav,
      merchantNav,
      visibleMerchantNav,
      adminNav,
      switchShop,
    };
  },
  template: `<div class="merchant-shell"><aside class="merchant-sidebar"><button class="merchant-brand" @click="go('/')"><span class="brand-pin"><span></span></span><span class="brand-word">青柠校园 <span class="brand-suffix">/ {{role==='admin'?'平台端':'商户端'}}</span></span></button><nav class="merchant-nav"><button v-for="([ico,label,path]) in (role==='admin'?adminNav:visibleMerchantNav)" :key="path" :class="{active:store.route===path}" @click="go(path)"><Icon :name="ico" :size="19"/><span>{{label}}</span><span v-if="store.route===path" class="nav-left-bar"></span></button></nav><div class="merchant-sidebar-bottom"><button class="sidebar-back" @click="go('/')"><Icon name="arrowLeft" :size="16"/> 返回购物端</button></div></aside><div class="merchant-content-shell"><header class="merchant-topbar"><div class="topbar-crumb">{{role==='admin'?'平台运营':'店铺运营'}} <Icon name="chevronRight" :size="14"/><strong>{{title}}</strong></div><div class="merchant-topbar-tools"><span v-if="preview" class="admin-preview-tag">设计预览</span><label class="topbar-merchant-select" v-if="role==='merchant'"><Icon name="store" :size="16"/><select :value="store.merchantId" @change="switchShop" :disabled="preview||store.loading"><option v-for="m in store.merchants" :key="m.merchantId" :value="m.merchantId">{{m.name}}</option></select></label><button class="topbar-avatar" @click="loginOpen=true"><Icon name="user" :size="18"/></button></div></header><nav ref="mobileNav" class="merchant-mobile-nav" aria-label="工作台导航"><button v-for="([ico,label,path]) in (role==='admin'?adminNav:visibleMerchantNav)" :key="path" :class="{active:store.route===path}" @click="go(path)"><Icon :name="ico" :size="16"/>{{label}}</button></nav><main class="merchant-main"><div class="merchant-page-heading"><div><h1>{{title}}</h1></div><slot name="actions"/></div><div v-if="store.error" class="inline-error merchant-error">{{store.error}}</div><slot/></main></div><AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="role==='merchant'?loadMerchant():null"/></div>`,
};
