import BackofficeShell from '../components/BackofficeShell.js';
import { api } from '../services/api.js';
import { store, preview, hasPermission, notify, loadMerchant } from '../services/store.js';
import { pathId } from '../services/page-utils.js';
import { DEMO_RBAC_ROLES, DEMO_RBAC_PERMISSIONS, DEMO_MEMBERS } from '../services/pages-demo.js';
const { ref, computed, onMounted, onUnmounted, watch } = Vue;

/** 商户级 RBAC 管理，服务端返回权限白名单。切换商户后不允许旧请求回写。 */
export default {
  name: 'RoleManager',
  components: { BackofficeShell },
  setup() {
    const roles = ref([]),
      permissions = ref([]),
      selected = ref(''),
      name = ref(''),
      grants = ref([]);
    const error = ref(''),
      busy = ref(false),
      loading = ref(false),
      count = ref(0);
    const canManage = computed(() => hasPermission('role.manage'));
    const current = computed(() => roles.value.find((r) => r.code === selected.value) || null);
    const assigned = computed(() => count.value);
    let epoch = 0;
    const prefix = () => '/merchants/' + pathId(store.merchantId) + '/rbac';
    function reset() {
      selected.value = '';
      name.value = '';
      grants.value = [];
      roles.value = [];
      permissions.value = [];
      count.value = 0;
    }
    function choose(role) {
      selected.value = role.code;
      name.value = role.name;
      grants.value = [...(role.permissions || [])];
    }
    function create() {
      selected.value = '';
      name.value = '';
      grants.value = ['product.read', 'order.read'];
    }
    function checked(code) {
      return grants.value.includes(code);
    }
    function toggle(code, enabled) {
      const dependency = {
        'product.write': 'product.read',
        'stock.replenish': 'stock.read',
        'order.prepare': 'order.read',
        'pickup.verify': 'order.read',
        'aftersale.review': 'aftersale.read',
        'knowledge.manage': 'knowledge.read',
        'dashboard.read': 'order.read',
      };
      let values = new Set(grants.value);
      if (enabled) {
        values.add(code);
        if (dependency[code]) values.add(dependency[code]);
      } else {
        values.delete(code);
        for (const [action, read] of Object.entries(dependency))
          if (read === code) values.delete(action);
      }
      grants.value = [...values];
    }
    async function load() {
      const stamp = ++epoch,
        mid = store.merchantId,
        actor = store.user?.userId;
      reset();
      error.value = '';
      if (preview) {
        roles.value = DEMO_RBAC_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] }));
        permissions.value = DEMO_RBAC_PERMISSIONS;
        count.value = DEMO_MEMBERS.length;
        choose(roles.value[0]);
        return;
      }
      loading.value = true;
      try {
        if (!mid) await loadMerchant();
        const id = store.merchantId,
          uid = store.user?.userId;
        if (stamp !== epoch || (!mid ? false : mid !== id) || !hasPermission('role.manage')) return;
        const [rs, ps, ms] = await Promise.all([
          api(prefix() + '/roles'),
          api(prefix() + '/permissions'),
          api('/merchants/' + pathId(id) + '/members'),
        ]);
        if (
          stamp !== epoch ||
          store.merchantId !== id ||
          store.user?.userId !== uid ||
          (!mid ? false : actor !== uid)
        )
          return;
        roles.value = rs || [];
        permissions.value = ps || [];
        count.value = (ms || []).filter((m) => m.status === 'ACTIVE').length;
        if (roles.value.length) choose(roles.value[0]);
      } catch (e) {
        if (stamp === epoch) error.value = e.message;
      } finally {
        if (stamp === epoch) loading.value = false;
      }
    }
    async function save() {
      if (preview || busy.value || !canManage.value || current.value?.builtin) return;
      if (!name.value.trim() || grants.value.length === 0) {
        notify('请输入角色名称并选择至少一项权限');
        return;
      }
      const id = store.merchantId,
        uid = store.user?.userId,
        stamp = epoch;
      busy.value = true;
      try {
        const code = selected.value;
        const result = await api(prefix() + '/roles' + (code ? '/' + pathId(code) : ''), {
          method: code ? 'PUT' : 'POST',
          body: { name: name.value.trim(), permissions: grants.value },
        });
        if (stamp !== epoch || id !== store.merchantId || uid !== store.user?.userId) return;
        notify(code ? '角色已更新' : '角色已创建');
        await load();
        if (id === store.merchantId) {
          const found = roles.value.find((r) => r.code === result.code);
          if (found) choose(found);
        }
      } catch (e) {
        if (stamp === epoch) notify(e.message);
      } finally {
        busy.value = false;
      }
    }
    async function remove() {
      if (preview || busy.value || !canManage.value || !selected.value || current.value?.builtin)
        return;
      if (!window.confirm('确定删除角色「' + current.value?.name + '」？')) return;
      const id = store.merchantId,
        uid = store.user?.userId,
        stamp = epoch;
      busy.value = true;
      try {
        await api(prefix() + '/roles/' + pathId(selected.value), { method: 'DELETE' });
        if (stamp !== epoch || id !== store.merchantId || uid !== store.user?.userId) return;
        notify('角色已删除');
        await load();
      } catch (e) {
        if (stamp === epoch) notify(e.message);
      } finally {
        busy.value = false;
      }
    }
    onMounted(load);
    onUnmounted(() => ++epoch);
    watch([() => store.merchantId, () => store.user?.userId, canManage], load);
    return {
      store,
      roles,
      permissions,
      selected,
      name,
      grants,
      error,
      busy,
      loading,
      canManage,
      current,
      assigned,
      choose,
      create,
      checked,
      toggle,
      save,
      remove,
      preview,
    };
  },
  template: `<BackofficeShell role="merchant" title="角色权限">
    <template #actions><button v-if="canManage" class="teal-button" @click="create" :disabled="preview||busy"><Icon name="plus" :size="16"/>新增自定义角色</button></template>
    <div v-if="error" class="inline-error">{{error}}</div>
    <div v-if="!canManage" class="ops-card access-denied"><Icon name="shield" :size="32"/><h2>无权管理角色</h2></div>
    <div v-else class="ops-grid rbac-layout">
      <section class="ops-card rbac-roles"><div class="ops-card-header"><h2>商户角色</h2><span>{{roles.length}} 个 · {{assigned}} 名成员</span></div>
        <button v-for="r in roles" :key="r.code" class="rbac-role" :class="{active:selected===r.code}" @click="choose(r)">
          <span class="mini-icon"><Icon :name="r.builtin?'shield':'users'" :size="18"/></span>
          <span><strong>{{r.name}}</strong><small>{{r.builtin?'内置角色':r.permissions.length+' 项权限'}}</small></span>
          <Icon name="chevronRight" :size="16"/>
        </button>
        <div v-if="!roles.length&&!loading" class="admin-empty">暂无角色</div>
      </section>
      <form class="ops-card rbac-editor" @submit.prevent="save"><div class="ops-card-header"><h2>{{selected?'角色权限':'创建新角色'}}</h2><span v-if="current?.builtin" class="status-tag">系统内置</span></div>
        <label class="field-label">角色名称</label><input class="admin-input" v-model.trim="name" maxlength="40" required :disabled="preview||!!current?.builtin||busy" placeholder="例如：商品管理员"/>
        <h3 class="field-heading">权限配置 <span class="rbac-grant-count">已选 {{grants.length}} 项</span></h3>
        <div class="rbac-permissions"><label v-for="p in permissions" :key="p.code" :data-permission="p.code" class="rbac-permission" :class="{protected:!p.grantable}">
            <input type="checkbox" :checked="checked(p.code)" :disabled="preview||!!current?.builtin||!p.grantable||busy" @change="toggle(p.code,$event.target.checked)"/>
            <span><strong>{{p.label}}</strong></span><Icon v-if="!p.grantable" name="lock" :size="15" title="仅经营者"/>
          </label></div>
        <div class="form-buttons" v-if="!current?.builtin"><button type="button" v-if="selected" class="outline-button" :disabled="preview||busy" @click="remove">删除角色</button><button type="submit" class="teal-button" :disabled="preview||busy||!grants.length||!name.trim()">{{busy?'保存中':'保存角色'}}</button></div>
        
      </form>
    </div>
  </BackofficeShell>`,
};
