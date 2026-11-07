import BackofficeShell from '../components/BackofficeShell.js';
import { api } from '../services/api.js';
const { ref, computed } = Vue;

export default {
  name: 'KnowledgeDebug',
  components: { BackofficeShell },
  setup() {
    const question = ref(''),
      preview = ref(false),
      busy = ref(false),
      error = ref(''),
      result = ref(null);
    const role = computed(() => (location.hash.startsWith('#/admin') ? 'admin' : 'merchant'));
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
    return { question, preview, busy, error, result, role, run };
  },
  template: `<BackofficeShell :role="role" title="RAG 检索调试"><section class="knowledge-debug-page"><p class="muted">仅返回当前账号可读文档；回答预览和分数用于调试，不代表交易事实或答案正确性。</p><textarea v-model="question" maxlength="1000" rows="4" placeholder="输入要调试的知识问题"></textarea><label class="check-line"><input type="checkbox" v-model="preview"/> 请求回答预览（会显示实际模式）</label><button class="teal-button" :disabled="busy||!question.trim()" @click="run">{{busy?'检索中…':'开始检索'}}</button><p v-if="error" class="inline-error">{{error}}</p><div v-if="result" class="knowledge-debug-result"><div class="stat-row"><span>查询：{{result.query}}</span><span>检索模式：{{result.retrievalMode||'未知'}}</span><span>回答模式：{{result.answerMode||'未知'}}</span></div><p v-if="result.warning" class="muted">{{result.warning}}</p><blockquote v-if="result.answerPreview">{{result.answerPreview}}</blockquote><table v-if="result.hits?.length"><thead><tr><th>排名</th><th>文档/版本</th><th>片段</th><th>分数</th><th>类型</th></tr></thead><tbody><tr v-for="hit in result.hits" :key="hit.documentId+'-'+hit.rank"><td>{{hit.rank}}</td><td>{{hit.title}}<br/><small>{{hit.documentId}} · v{{hit.version}}</small></td><td>{{hit.snippet}}</td><td>{{hit.score}}</td><td>{{hit.scoreType}}</td></tr></tbody></table><p v-else class="muted">没有返回可展示的授权命中。</p></div></section></BackofficeShell>`,
};
