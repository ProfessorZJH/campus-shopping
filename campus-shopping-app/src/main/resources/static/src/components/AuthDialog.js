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
      <form class="login-dialog flagship-auth-dialog" @submit.prevent="submit" aria-label="账号登录">
        <aside class="auth-showcase-panel" aria-hidden="true">
          <div class="auth-showcase-glow"></div>
          <div class="auth-showcase-top">
            <div class="auth-brand-row">
              <BrandLogo :size="46" />
              <div>
                <strong class="auth-brand-name">青柠校园</strong>
                <span class="auth-brand-en">QINGNING CAMPUS</span>
              </div>
            </div>
            <h3 class="auth-showcase-slogan">校内好物<br/>下课顺路免排队即取</h3>
            <p class="auth-showcase-lead">连接校内认证便利店、书咖与鲜果站，手机先下单，到店凭码秒取。</p>
          </div>
          <ul class="auth-feature-list">
            <li><span class="auth-feat-dot"><Icon name="store" :size="15"/></span><div><strong>校内多店直供</strong><small>食堂、图书馆、南北宿舍区全覆盖</small></div></li>
            <li><span class="auth-feat-dot"><Icon name="sparkles" :size="15"/></span><div><strong>AI 智能凑单导购</strong><small>说出预算和口味，自动搭配现货</small></div></li>
            <li><span class="auth-feat-dot"><Icon name="scan" :size="15"/></span><div><strong>6 位取件码秒取</strong><small>支持课间与夜宵时段预约取餐</small></div></li>
          </ul>
        </aside>

        <div class="auth-form-panel">
          <div class="login-dialog-heading">
            <div class="auth-mobile-brand">
              <BrandLogo :size="34" />
              <strong>青柠校园</strong>
            </div>
            <button type="button" class="auth-close-btn" @click="$emit('close')" aria-label="关闭登录窗"><Icon name="x" :size="18" /></button>
          </div>

          <div class="auth-form-header">
            <h2>{{ mode === 'login' ? '欢迎登录青柠校园' : '创建青柠校园账号' }}</h2>
            <div class="auth-mode-tabs">
              <span class="auth-mode-tab" :class="{ active: mode === 'login' }" @click="switchMode('login')">账号密码登录</span>
              <span class="auth-mode-tab" :class="{ active: mode === 'register' }" @click="switchMode('register')">新用户注册</span>
            </div>
          </div>

          <div class="auth-fields">
            <div class="auth-field-group">
              <label for="login-name">账号</label>
              <div class="auth-input-wrap">
                <Icon name="user" :size="17" />
                <input id="login-name" v-model="username" autocomplete="username" :minlength="mode==='register'?4:undefined" required maxlength="32" :placeholder="mode==='login'?'请输入登录账号':'4~32位字母开头（含字母/数字/下划线）'"/>
              </div>
            </div>

            <div class="auth-field-group">
              <label for="login-password">密码</label>
              <div class="auth-input-wrap">
                <Icon name="shield" :size="17" />
                <input id="login-password" v-model="password" :type="showPwd ? 'text' : 'password'" :autocomplete="mode==='login'?'current-password':'new-password'" required :minlength="mode==='register'?8:undefined" :maxlength="mode==='register'?64:undefined" :placeholder="mode==='login'?'请输入登录密码':'请设置 8~64 位登录密码'"/>
                <button type="button" class="auth-pwd-toggle" @click="showPwd=!showPwd" :aria-label="showPwd?'隐藏密码':'显示密码'">{{ showPwd ? '隐藏' : '显示' }}</button>
              </div>
            </div>

            <template v-if="mode==='register'">
              <div class="auth-field-group">
                <label for="login-display">昵称 <em class="auth-opt-tag">选填</em></label>
                <div class="auth-input-wrap">
                  <Icon name="sparkles" :size="16" />
                  <input id="login-display" v-model="displayName" maxlength="50" placeholder="用于订单与评价展示，如：计科23级·小林"/>
                </div>
              </div>
              <small class="auth-hint">账号以字母开头（4~32位），密码长度 8~64 位</small>
            </template>
          </div>

          <div v-if="error" class="login-error" role="alert"><Icon name="alert" :size="15" /><span>{{ error }}</span></div>

          <button type="submit" class="primary-wide login-submit" :disabled="busy">{{ busy ? '正在提交…' : mode === 'login' ? '登录' : '注册' }}</button>

          <div class="auth-footer-switch">
            <button type="button" class="login-switch" @click="switchMode(mode==='login'?'register':'login')">{{ mode === 'login' ? '没有账号？注册' : '已有账号？登录' }}</button>
          </div>
        </div>
      </form>
    </div>`,
};
