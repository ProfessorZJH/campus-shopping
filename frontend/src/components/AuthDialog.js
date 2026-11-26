import { api, resetCsrf } from '../services/api.js';
import { notify, replaceSession } from '../services/store.js';
const { ref } = Vue;
/** 登录/注册只使用已有认证接口，不能由前端声明角色。
 * 注意键盘无障碍契约：form.login-dialog 内第一个可聚焦控件为关闭按钮，Tab 下一个为 #login-name。
 */
export default {
  name: 'AuthDialog',
  emits: ['close', 'success'],
  setup(props, { emit }) {
    const mode = ref('login');
    const username = ref('');
    const password = ref('');
    const displayName = ref('');
    const showPwd = ref(false);
    const busy = ref(false);
    const error = ref('');
    let lastSubmitMs = 0;

    function switchMode(next) {
      if (busy.value || mode.value === next) return;
      mode.value = next;
      error.value = '';
    }

    async function submit() {
      const now = Date.now();
      if (busy.value || now - lastSubmitMs < 380) return;
      error.value = '';
      if (!username.value.trim() || !password.value) {
        error.value = '请填写账号和密码';
        return;
      }
      if (mode.value === 'register') {
        if (!/^[a-z][a-z0-9_]{3,31}$/.test(username.value.trim().toLowerCase())) {
          error.value = '用户名须为4~32位，以字母开头，仅含字母、数字和下划线';
          return;
        }
        if (
          password.value.length < 8 ||
          password.value.length > 64 ||
          new TextEncoder().encode(password.value).length > 72
        ) {
          error.value = '密码须为8~64字符，且UTF-8编码不超过72字节';
          return;
        }
      }
      lastSubmitMs = now;
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
          notify('登录成功');
        }
      } catch (err) {
        error.value = err.message;
      } finally {
        busy.value = false;
      }
    }
    return { mode, username, password, displayName, showPwd, busy, error, switchMode, submit };
  },
  template: `
    <div v-modal="() => $emit('close')" class="ui-overlay auth-modal-overlay" @click.self="$emit('close')">
      <form class="login-dialog" @submit.prevent="submit" aria-label="账号登录">
        <div class="login-dialog-heading">
          <div class="auth-brand-mark">
            <BrandLogo :size="36" />
            <span class="auth-brand-wordmark">青柠校园</span>
          </div>
          <button type="button" class="auth-close-btn" @click="$emit('close')" aria-label="关闭登录窗">
            <Icon name="x" :size="18" />
          </button>
        </div>

        <h2>{{ mode === 'login' ? '登录' : '注册' }}</h2>

        <div class="auth-fields">
          <div class="auth-field">
            <label class="sr-only" for="login-name">账号</label>
            <div class="auth-input-wrap">
              <input
                id="login-name"
                v-model="username"
                autocomplete="username"
                :minlength="mode === 'register' ? 4 : undefined"
                required
                maxlength="32"
                :placeholder="mode === 'login' ? '账号' : '账号（字母开头，4-32位）'"
              />
            </div>
          </div>

          <div class="auth-field">
            <label class="sr-only" for="login-password">密码</label>
            <div class="auth-input-wrap">
              <input
                id="login-password"
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                required
                :minlength="mode === 'register' ? 8 : undefined"
                :maxlength="mode === 'register' ? 64 : undefined"
                :placeholder="mode === 'login' ? '密码' : '密码（8-64位）'"
              />
              <button
                type="button"
                class="auth-pwd-toggle"
                @click="showPwd = !showPwd"
                :aria-label="showPwd ? '隐藏密码' : '显示密码'"
              >
                <Icon :name="showPwd ? 'eyeOff' : 'eye'" :size="18" />
              </button>
            </div>
          </div>

          <div v-if="mode === 'register'" class="auth-field">
            <label class="sr-only" for="login-display">昵称</label>
            <div class="auth-input-wrap">
              <input
                id="login-display"
                v-model="displayName"
                maxlength="50"
                placeholder="昵称（选填）"
              />
            </div>
          </div>
        </div>

        <div v-if="error" class="login-error" role="alert">
          <Icon name="alert" :size="15" />
          <span>{{ error }}</span>
        </div>

        <button type="submit" class="primary-wide login-submit" :disabled="busy">
          {{ busy ? (mode === 'login' ? '登录中…' : '注册中…') : mode === 'login' ? '登录' : '注册' }}
        </button>

        <div class="auth-footer-switch">
          <button
            type="button"
            class="login-switch"
            @click="switchMode(mode === 'login' ? 'register' : 'login')"
          >
            {{ mode === 'login' ? '没有账号？注册' : '已有账号？登录' }}
          </button>
        </div>
      </form>
    </div>`,
};
