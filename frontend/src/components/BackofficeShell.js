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
const { ref, computed, watch, nextTick, onMounted, onUnmounted } = Vue;
export const merchantNav = [
  ['home', '工作台', '/merchant'],
  ['package', '商品管理', '/merchant/products'],
  ['box', '库存管理', '/merchant/inventory'],
  ['order', '订单管理', '/merchant/orders'],
  ['scan', '自提核销', '/merchant/pickup'],
  ['clipboard', '售后处理', '/merchant/aftersales'],
  ['users', '店员管理', '/merchant/team'],
  ['shield', '角色权限', '/merchant/roles'],
  ['book', '知识库', '/merchant/knowledge'],
  ['settings', '门店设置', '/merchant/settings'],
];
export const adminNav = [
  ['home', '平台总览', '/admin'],
  ['store', '商户审核', '/admin/applications'],
  ['users', '商户监管', '/admin/merchants'],
  ['package', '商品监管', '/admin/products'],
  ['order', '订单监管', '/admin/orders'],
  ['shield', '争议处理', '/admin/disputes'],
  ['book', '知识库', '/admin/knowledge'],
  ['grid', '分类管理', '/admin/categories'],
];
export default {
  name: 'BackofficeShell',
  props: { role: { type: String, default: 'merchant' }, title: String },
  components: { AuthDialog },
  setup() {
    const loginOpen = ref(false),
      mobileNav = ref(null);
    const required = {
      '/merchant': 'order.read',
      '/merchant/products': 'product.read',
      '/merchant/inventory': 'stock.read',
      '/merchant/orders': 'order.read',
      '/merchant/pickup': 'pickup.verify',
      '/merchant/aftersales': 'aftersale.read',
      '/merchant/team': 'team.manage',
      '/merchant/roles': 'role.manage',
      '/merchant/knowledge': 'knowledge.read',
      '/merchant/settings': 'store.manage',
    };
    const visibleMerchantNav = computed(() =>
      merchantNav.filter(([, , path]) => hasPermission(required[path])),
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
      await loadMerchant();
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
