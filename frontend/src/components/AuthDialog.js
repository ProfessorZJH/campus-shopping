import { api, resetCsrf } from '../services/api.js';
import { store, notify, replaceSession } from '../services/store.js';
const { ref } = Vue;
/** 登录/注册只使用已有认证接口，不能由前端声明角色。 */
export default {
  name: 'AuthDialog',
  emits: ['close', 'success'],
  setup(props, { emit }) {
    const mode = ref('login');
    const username = ref('');
    const password = ref('');
    const displayName = ref('');
    const busy = ref(false);
    const error = ref('');
    async function submit() {
      if (busy.value) return;
      error.value = '';
      if (!username.value.trim() || !password.value) {
        error.value = '请填写账号和密码';
        return;
      }
      busy.value = true;
      try {
        if (mode.value === 'register') {
          await api('/auth/register', {
            method: 'POST',
            body: {
              username: username.value.trim(),
              password: password.value,
              displayName: displayName.value.trim() || username.value.trim(),
            },
          });
          mode.value = 'login';
          password.value = '';
          notify('注册成功，请登录');
        } else {
          const user = await api('/auth/login', {
            method: 'POST',
            body: { username: username.value.trim(), password: password.value },
          });
          resetCsrf();
          replaceSession(user);
          password.value = '';
          emit('success', user);
          emit('close');
          notify('已登录');
        }
      } catch (err) {
        error.value = err.message;
      } finally {
        busy.value = false;
      }
    }
    return { mode, username, password, displayName, busy, error, submit };
  },
  template: `<div class="ui-overlay" @click.self="$emit('close')"><form class="login-dialog" @submit.prevent="submit" aria-label="账号登录">
     <div class="login-dialog-heading"><span class="auth-logo"><Icon name="sparkles" :size="22"/></span><button type="button" @click="$emit('close')" aria-label="关闭登录窗"><Icon name="x" :size="20" /></button></div>
     <h2>{{mode==='login'?'欢迎回来':'创建账号'}}</h2>
     <label for="login-name">账号</label><input id="login-name" v-model="username" autocomplete="username" required maxlength="32" placeholder="用户名"/>
     <label for="login-password">密码</label><input id="login-password" v-model="password" type="password" :autocomplete="mode==='login'?'current-password':'new-password'" required placeholder="输入密码"/>
     <template v-if="mode==='register'"><label for="login-display">昵称</label><input id="login-display" v-model="displayName" maxlength="50" placeholder="昵称（选填）"/></template>
     <div v-if="error" class="login-error">{{error}}</div>
     <button type="submit" class="primary-wide login-submit" :disabled="busy">{{busy?'请稍候…':mode==='login'?'登录':'注册'}}</button>
     <button type="button" class="login-switch" @click="mode=mode==='login'?'register':'login';error=''">{{mode==='login'?'没有账号？注册':'已有账号？登录'}}</button>
  </form></div>`,
};
