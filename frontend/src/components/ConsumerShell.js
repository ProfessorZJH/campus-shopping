import {go,store,preview,notify,replaceSession,loadPublic} from '../services/store.js';
import {api,resetCsrf} from '../services/api.js';
import AuthDialog from './AuthDialog.js';
const {ref}=Vue;
export default {
  name:'ConsumerShell',components:{AuthDialog},
  props:{active:{type:String,default:'home'}},
  setup(){
    const loginOpen=ref(false);
    async function logout(){try{await api('/auth/logout',{method:'POST'});resetCsrf();replaceSession(null);notify('已退出');go('/');loadPublic();}catch(err){notify(err.message);}}
    return {go,store,preview,loginOpen,logout,loadPublic};
  },
  template:`
    <div class="consumer-shell">
      <div class="consumer-width">
        <header class="consumer-header">
          <div class="campus-location">
            <div class="brand-pin"><span></span></div>
            <div><div class="location-name">青柠校园</div><div class="location-sub">校园好物 · 到店自提</div></div>
          </div>
          <div class="header-trailing"><span v-if="store.preview" class="demo-pill" title="仅用于视觉预览">设计预览</span><button v-else-if="!store.user" class="header-login" @click="loginOpen=true">登录</button><button v-else class="account-pill" @click="logout" title="退出登录">{{store.user.displayName?.slice(0,2)||'我'}} <Icon name="logout" :size="12" /></button></div>
        </header>
        <main class="consumer-main"><slot /></main>
      </div>
      <nav class="mobile-tabbar" aria-label="消费者导航">
        <div class="mobile-tabbar-inner">
          <button :class="{selected:active==='home'}" @click="go('/')" aria-label="首页"><Icon name="home" :size="23"/><span>首页</span></button>
          <button :class="{selected:active==='ai'}" @click="go('/ai')" aria-label="AI导购"><span class="tiny-orb"><Icon name="sparkles" :size="20"/></span><span>导购</span></button>
          <button :class="{selected:active==='cart'}" @click="go('/cart')"><Icon name="cart" :size="23"/><span>购物车</span></button>
          <button :class="{selected:active==='orders'}" @click="go('/orders')"><Icon name="order" :size="23"/><span>订单</span></button>
          <button :class="{selected:active==='account'}" @click="go('/account')"><Icon name="user" :size="23"/><span>我的</span></button>
        </div>
      </nav>
      <AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="loadPublic" />
    </div>`
};
