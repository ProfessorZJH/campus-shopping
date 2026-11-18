import BackofficeShell from '../components/BackofficeShell.js';
import { api } from '../services/api.js';
import { store, go, loadMerchant } from '../services/store.js';
const { ref, computed, onMounted } = Vue;

export default {
  name: 'KnowledgeDebug',
  components: { BackofficeShell },
  setup() {
    const question = ref(''),
      preview = ref(false),
      busy = ref(false),
      error = ref(''),
      result = ref(null);
    const role = computed(() => (store.route.startsWith('/admin') ? 'admin' : 'merchant'));
    onMounted(() => {
      if (role.value === 'merchant' && !store.merchants.length) loadMerchant();
    });
    async function run() {
      const q = question.value.trim();
      if (!q || q.length > 1000 || busy.value) return;
      busy.value = true;
      error.value = '';
      try {
        result.value = await api('/ai/debug/retrieval', {
          method: 'POST',
          body: { question: q, answerPreview: preview.value },
        });
      } catch (e) {
        error.value = e.message;
      } finally {
        busy.value = false;
      }
    }
    return { question, preview, busy, error, result, role, go, run };
  },
  template: `<BackofficeShell :role="role" title="问答检索测试"><template #actions><button class="outline-button small" @click="go(role==='admin'?'/admin/knowledge':'/merchant/knowledge')"><Icon name="arrowLeft" :size="15"/>返回知识库</button></template><section class="ops-card knowledge-debug-page"><p class="kb-debug-desc">输入顾客常问的问题，验证当前已发布知识文档能否准确命中（仅做测试，不会写入导购记录）。</p><textarea class="admin-input kb-debug-input" v-model="question" maxlength="1000" rows="3" placeholder="例如：门店几点打烊？未提货怎么申请退款？"></textarea><div class="kb-debug-controls"><label class="check-line"><input type="checkbox" v-model="preview"/> 同时生成回答预览</label><button class="teal-button" :disabled="busy||!question.trim()" @click="run">{{busy?'检索中…':'开始检索'}}</button></div><p v-if="error" class="inline-error">{{error}}</p><div v-if="result" class="knowledge-debug-result"><div class="stat-row"><span>测试问题：<strong>{{result.query}}</strong></span><span>检索方式：{{result.retrievalMode||'默认'}}</span><span v-if="result.answerMode">回答方式：{{result.answerMode}}</span></div><p v-if="result.warning" class="kb-debug-warn">{{result.warning}}</p><blockquote v-if="result.answerPreview" class="kb-debug-answer">{{result.answerPreview}}</blockquote><div v-if="result.hits?.length" class="ops-table-wrap"><table class="ops-table"><thead><tr><th>排序</th><th>命中文档</th><th>匹配片段</th><th>相关度</th></tr></thead><tbody><tr v-for="hit in result.hits" :key="hit.documentId+'-'+hit.rank"><td>#{{hit.rank}}</td><td><strong>{{hit.title}}</strong><small>v{{hit.version}}</small></td><td class="kb-hit-snippet">{{hit.snippet}}</td><td>{{hit.score}}</td></tr></tbody></table></div><p v-else class="admin-empty">未匹配到当前可见的已发布文档</p></div></section></BackofficeShell>`,
};
