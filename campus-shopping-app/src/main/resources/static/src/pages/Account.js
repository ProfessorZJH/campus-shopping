import ConsumerShell from '../components/ConsumerShell.js';
import AuthDialog from '../components/AuthDialog.js';
import { api, idempotency, query } from '../services/api.js';
import { store, go, preview, notify, loadSession } from '../services/store.js';
import { DEMO_APPLICATIONS } from '../services/pages-demo.js';
import { label } from '../services/page-utils.js';
const { ref, computed, onMounted, watch } = Vue;
export default {
  name: 'Account',
  components: { ConsumerShell, AuthDialog },
  setup() {
    const page = ref(1),
      pageInfo = ref({ total: 0, hasNext: false });
    const login = ref(false),
      apps = ref([]),
      invitations = ref([]),
      error = ref(''),
      busy = ref(false),
      key = ref('');
    const form = ref({
      merchantName: '',
      category: '便利零售',
      contactName: '',
      contactPhone: '',
      storeName: '',
      location: '',
    });
    const isApply = computed(() => store.route === '/apply');
    const isInvite = computed(() => store.route === '/invitations');
    async function load() {
      error.value = '';
      if (preview) {
        apps.value = DEMO_APPLICATIONS;
        invitations.value = [
          {
            id: 'INV-01',
            merchantId: 'preview-m1',
            status: 'PENDING',
            expiresAt: '2026-10-30T12:00:00Z',
          },
        ];
        return;
      }
      try {
        await loadSession();
        if (!store.user) {
          apps.value = [];
          invitations.value = [];
          return;
        }
        const [a, i] = await Promise.all([
          api('/merchant-applications/mine/page' + query({ page: page.value, size: 10 })),
          api('/invitations'),
        ]);
        apps.value = a.items || [];
        pageInfo.value = a;
        invitations.value = i || [];
      } catch (e) {
        error.value = e.message;
      }
    }
    onMounted(load);
    watch(() => store.route, load);
    watch(page, load);
    async function submit() {
      if (preview || busy.value) return;
      const f = form.value;
      if (!Object.values(f).every((x) => String(x).trim())) {
        notify('请补全申请资料');
        return;
      }
      if (!key.value) key.value = idempotency();
      busy.value = true;
      try {
        await api('/merchant-applications', { method: 'POST', body: { ...f }, key: key.value });
        key.value = '';
        notify('申请已提交');
        await load();
        go('/account');
      } catch (e) {
        notify(e.message);
      } finally {
        busy.value = false;
      }
    }
    async function accept(i) {
      if (preview || busy.value) return;
      busy.value = true;
      try {
        await api('/invitations/' + encodeURIComponent(i.id) + '/accept', { method: 'POST' });
        notify('邀请已接受');
        await load();
      } catch (e) {
        notify(e.message);
      } finally {
        busy.value = false;
      }
    }
    return {
      store,
      go,
      preview,
      login,
      apps,
      page,
      pageInfo,
      invitations,
      error,
      busy,
      form,
      isApply,
      isInvite,
      submit,
      accept,
      label,
      load,
    };
  },
  template: `<ConsumerShell active="account"><div class="mobile-page-top"><button @click="go('/account')" aria-label="返回"><Icon name="arrowLeft"/></button><b>{{isApply?'商户入驻':isInvite?'收到的邀请':'个人中心'}}</b><button v-if="!isApply&&!isInvite" @click="load" aria-label="刷新"><Icon name="refresh"/></button></div>
 <template v-if="!isApply&&!isInvite"><section class="account-profile"><div class="profile-avatar"><Icon name="user" :size="30"/></div><div><h1>{{store.user?.displayName||'校园同学'}}</h1><p>{{store.user?.username||'登录后查看订单与申请'}}</p></div><button v-if="!store.user&&!preview" class="outline-button" @click="login=true">登录 / 注册</button><span v-if="preview" class="demo-pill">设计预览</span></section><div class="account-quick"><button @click="go('/orders')"><Icon name="order"/><span>我的订单</span></button><button @click="go('/cart')"><Icon name="cart"/><span>购物车</span></button><button @click="go('/apply')"><Icon name="store"/><span>商户入驻</span></button><button @click="go('/invitations')"><Icon name="users"/><span>邀请</span></button></div><div class="account-section-head"><h2>入驻记录</h2><button @click="go('/apply')">去申请 <Icon name="chevronRight" :size="15"/></button></div><div v-if="error" class="inline-error">{{error}}</div><div class="account-application" v-for="a in apps" :key="a.applicationId"><div><strong>{{a.merchantName}}</strong><span>{{a.storeName}} · {{a.location}}</span></div><b class="status-tag" :class="a.status==='APPROVED'?'published':'draft'">{{label(a.status)}}</b><p v-if="a.rejectionReason">{{a.rejectionReason}}</p></div><div v-if="!apps.length&&!error" class="mobile-empty">暂无入驻记录</div><div class="sdd-pager" v-if="!preview&&pageInfo.total>0"><span>{{pageInfo.total}} 条</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext" @click="page++">下一页</button></div></template>
 <form v-else-if="isApply" class="account-form detail-card" @submit.prevent="submit"><label>经营名称<input v-model.trim="form.merchantName" required maxlength="100" placeholder="商户名称"/></label><label>经营品类<select v-model="form.category"><option>便利零售</option><option>水果生鲜</option><option>文具用品</option><option>饮品</option><option>其他</option></select></label><label>联系人<input v-model.trim="form.contactName" required maxlength="50"/></label><label>联系电话<input v-model.trim="form.contactPhone" required maxlength="30"/></label><label>首个门店名称<input v-model.trim="form.storeName" required maxlength="100"/></label><label>自提位置<input v-model.trim="form.location" required maxlength="200" placeholder="如：学一食堂一层"/></label><button class="teal-button" type="submit" :disabled="preview||busy||!store.user">{{!store.user&&!preview?'请先登录':'提交入驻申请'}}</button></form>
 <section v-else class="detail-card"><h2>待处理邀请</h2><div class="invitation-line" v-for="i in invitations" :key="i.id"><div><strong>{{i.merchantId}}</strong><small>{{label(i.status)}}</small></div><button class="outline-button" :disabled="preview||busy||i.status!=='PENDING'" @click="accept(i)">接受</button></div><div v-if="!invitations.length" class="mobile-empty">暂无邀请</div></section><AuthDialog v-if="login" @close="login=false" @success="load"/></ConsumerShell>`,
};
