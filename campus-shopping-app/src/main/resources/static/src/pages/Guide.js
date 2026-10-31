import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, query } from '../services/api.js';
import { DEMO_CHAT, DEMO_PRODUCTS } from '../services/demo.js';
import { store, go, money, skuOf, preview, previewGuard, notify } from '../services/store.js';
const { ref, computed, onMounted, onUnmounted, watch } = Vue;
const prompts = [
  { label: '30元内夜宵', icon: 'clock', query: '30元以内，推荐几样适合复习时吃的夜宵' },
  { label: '高蛋白零食', icon: 'sparkles', query: '想买点高蛋白的零食，有什么推荐？' },
  { label: '复习清单', icon: 'book', query: '帮我列一个考试周的购物清单' },
  { label: '找点好喝的', icon: 'cart', query: '推荐适合夏天喝的饮料' },
];
export default {
  name: 'Guide',
  components: { ConsumerShell, ProductImage },
  setup() {
    const input = ref('');
    const thinking = ref(false);
    const selectedIds = ref([]);
    const messages = ref([]);
    const proposal = ref(null);
    const mode = ref('');
    const error = ref('');
    const historyOpen = ref(false);
    const conversations = ref([]);
    const historyPage = ref(1);
    const historyHasMore = ref(false);
    const loadingHistory = ref(false);
    const openingConversation = ref(false);
    let conversationEpoch = 0,
      historyEpoch = 0;
    const examples = computed(() => DEMO_PRODUCTS.slice(0, 3));
    const items = computed(() =>
      preview
        ? examples.value.map((p) => ({
            skuId: skuOf(p).skuId,
            product: p,
            title: p.title,
            specKey: skuOf(p).specKey,
            priceCent: skuOf(p).priceCent,
            quantity: 1,
            merchantId: p.merchantId,
          }))
        : (proposal.value?.items || []).map((i) => ({
            ...i,
            product: store.products.find((p) => p.skus.some((s) => s.skuId === i.skuId)),
          })),
    );
    const total = computed(() =>
      items.value
        .filter((i) => selectedIds.value.includes(i.skuId))
        .reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity || 1), 0),
    );
    const showProposal = computed(() => preview || !!proposal.value?.items?.length);
    const formatTime = () =>
      new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    // 同一 AI 页面内退出/切换账号时，不能保留上一身份的本地会话与回答。
    watch(
      () => store.user?.userId,
      (now, was) => {
        if (preview || now === was) return;
        ++conversationEpoch;
        ++historyEpoch;
        store.conversationId = '';
        messages.value = [];
        conversations.value = [];
        historyPage.value = 1;
        historyHasMore.value = false;
        proposal.value = null;
        selectedIds.value = [];
        mode.value = '';
        error.value = '';
        input.value = '';
        thinking.value = false;
        openingConversation.value = false;
        loadingHistory.value = false;
        historyOpen.value = false;
        if (now) loadHistory();
      },
    );
    onMounted(() => {
      if (!preview) loadHistory();
      if (preview) {
        messages.value = DEMO_CHAT.map((m) => ({ ...m, time: '20:14' }));
        selectedIds.value = examples.value.map((p) => skuOf(p).skuId);
      }
    });
    async function ask(question = input.value) {
      const text = String(question || '').trim();
      if (!text || thinking.value || openingConversation.value) return;
      if (text.length > 500) {
        notify('问题不能超过500字');
        return;
      }
      const stamp = ++conversationEpoch;
      input.value = '';
      error.value = '';
      messages.value.push({ role: 'user', content: text, time: formatTime() });
      if (preview) {
        messages.value.push({
          role: 'assistant',
          content: '为你挑了几款商品，看看有没有喜欢的。',
          time: formatTime(),
          demo: true,
        });
        notify('设计预览 · 未请求真实 AI');
        return;
      }
      thinking.value = true;
      try {
        const answer = await api('/ai/chat', {
          method: 'POST',
          body: { question: text, conversationId: store.conversationId || null },
        });
        if (stamp !== conversationEpoch) return;
        store.conversationId = answer.conversationId || store.conversationId;
        mode.value = answer.mode || '';
        messages.value.push({
          role: 'assistant',
          content: answer.answer || '暂时没有找到合适答案',
          warning: answer.warning,
          citations: (answer.citations || []).map((c) => c.title),
          time: formatTime(),
        });
        proposal.value = answer.proposal || null;
        selectedIds.value = (proposal.value?.items || []).map((i) => i.skuId);
      } catch (err) {
        if (stamp === conversationEpoch) {
          error.value = err.status === 401 ? '请先登录账号再使用 AI 导购' : err.message;
          messages.value.pop();
          input.value = text;
        }
      } finally {
        if (stamp === conversationEpoch) thinking.value = false;
      }
    }
    async function loadHistory(reset = true) {
      if (preview) return;
      if (loadingHistory.value && !reset) return;
      const stamp = ++historyEpoch;
      const page = reset ? 1 : historyPage.value + 1;
      loadingHistory.value = true;
      try {
        const result = (await api('/ai/conversations' + query({ page, size: 20 }))) || [];
        if (stamp === historyEpoch) {
          conversations.value = reset
            ? result
            : [...new Map([...conversations.value, ...result].map((c) => [c.id, c])).values()];
          historyPage.value = page;
          historyHasMore.value = result.length === 20;
        }
      } catch {
        if (stamp === historyEpoch && reset) conversations.value = [];
      } finally {
        if (stamp === historyEpoch) loadingHistory.value = false;
      }
    }
    async function openConversation(c) {
      if (preview || thinking.value || !c?.id) return;
      const stamp = ++conversationEpoch;
      openingConversation.value = true;
      try {
        const id = encodeURIComponent(c.id);
        const [history, proposals] = await Promise.all([
          api('/ai/conversations/' + id + '/messages'),
          api('/ai/conversations/' + id + '/proposals'),
        ]);
        if (stamp !== conversationEpoch) return;
        store.conversationId = c.id;
        messages.value = (history || []).map((m) => ({
          role: m.role,
          content: m.content,
          time: '历史消息',
        }));
        proposal.value = (proposals || []).find((p) => p.status === 'PENDING') || null;
        selectedIds.value = (proposal.value?.items || []).map((i) => i.skuId);
        historyOpen.value = false;
      } catch (e) {
        if (stamp === conversationEpoch) notify(e.message);
      } finally {
        if (stamp === conversationEpoch) openingConversation.value = false;
      }
    }
    onUnmounted(() => {
      ++conversationEpoch;
      ++historyEpoch;
    });
    function toggle(id) {
      if (selectedIds.value.includes(id))
        selectedIds.value = selectedIds.value.filter((x) => x !== id);
      else selectedIds.value = [...selectedIds.value, id];
    }
    async function confirm() {
      if (previewGuard() || !proposal.value?.id || thinking.value) return;
      const stamp = conversationEpoch,
        actor = store.user?.userId;
      if (!selectedIds.value.length) {
        notify('至少选择一件商品');
        return;
      }
      thinking.value = true;
      try {
        const updated = await api(
          '/ai/proposals/' + encodeURIComponent(proposal.value.id) + '/confirm',
          { method: 'POST', body: { selectedSkuIds: selectedIds.value } },
        );
        if (stamp === conversationEpoch && actor === store.user?.userId) {
          proposal.value = updated;
          notify('已确认提案，购物车已更新');
        }
      } catch (err) {
        notify(err.message);
      } finally {
        thinking.value = false;
      }
    }
    async function reject() {
      if (previewGuard() || !proposal.value?.id || thinking.value) return;
      const stamp = conversationEpoch,
        actor = store.user?.userId;
      thinking.value = true;
      try {
        await api('/ai/proposals/' + encodeURIComponent(proposal.value.id) + '/reject', {
          method: 'POST',
        });
        if (stamp === conversationEpoch && actor === store.user?.userId) {
          proposal.value = null;
          notify('已放弃提案');
        }
      } catch (err) {
        notify(err.message);
      } finally {
        thinking.value = false;
      }
    }
    return {
      store,
      go,
      money,
      skuOf,
      preview,
      prompts,
      messages,
      input,
      thinking,
      items,
      selectedIds,
      total,
      showProposal,
      proposal,
      error,
      mode,
      ask,
      toggle,
      confirm,
      reject,
      historyOpen,
      conversations,
      historyHasMore,
      loadingHistory,
      openingConversation,
      loadHistory,
      openConversation,
    };
  },
  template: `
    <ConsumerShell active="ai">
      <section class="ai-hero">
        <div class="ai-hero-text"><h1><span>AI</span> 导购助手</h1><p>想买什么？问我就好。</p></div>
        <img src="./images/robot.webp" alt="AI 导购机器人" class="ai-hero-robot"/>
        <span class="orb-decoration orb-one">✦</span><span class="orb-decoration orb-two">✧</span>
      </section>
      <div v-if="!preview" class="ai-history-head"><button @click="historyOpen=!historyOpen;historyOpen&&loadHistory()"><Icon name="clock" :size="15"/> 历史会话 <Icon name="chevronDown" :size="14"/></button></div><div v-if="historyOpen" class="ai-history-list"><button v-for="c in conversations" :key="c.id" @click="openConversation(c)" :disabled="thinking||openingConversation"><Icon name="order" :size="16"/> {{c.title||'对话'}} <Icon name="chevronRight" :size="14"/></button><span v-if="!conversations.length">暂无历史记录</span><button v-if="historyHasMore" @click="loadHistory(false)" :disabled="loadingHistory">加载更多会话</button></div>
      <div class="quick-prompts" aria-label="快捷提问"><button v-for="p in prompts" :key="p.label" @click="ask(p.query)" :disabled="thinking||openingConversation"><Icon :name="p.icon" :size="15"/>{{p.label}}</button></div>
      <section class="chat-thread" aria-label="AI对话">
        <div v-if="!messages.length" class="chat-welcome"><span class="chat-welcome-icon"><Icon name="sparkles" :size="22"/></span><h2>你好，同学。</h2><p>告诉我预算或想买的东西。</p></div>
        <div class="chat-row" v-for="(message,index) in messages" :key="index" :class="message.role==='user'?'is-user':'is-assistant'">
          <span v-if="message.role!=='user'" class="chat-avatar"><img src="./images/robot.webp" alt="AI"/></span>
          <div class="chat-body"><div class="chat-bubble">{{message.content}}</div><div v-if="message.warning" class="message-warning">{{message.warning}}</div><div v-if="message.citations?.length" class="citation-chips"><span v-for="c in message.citations" :key="c"><Icon name="book" :size="12"/>{{c}}</span></div><span class="chat-timestamp">{{message.time||'刚刚'}} <span v-if="message.demo">· 示例回答</span></span></div>
        </div>
        <div v-if="thinking" class="chat-row is-assistant"><span class="chat-avatar"><img src="./images/robot.webp" alt="AI"/></span><div class="typing-bubble"><i></i><i></i><i></i></div></div>
        <div v-if="error" class="inline-error"><Icon name="alert" :size="17"/>{{error}}</div>
      </section>
      <section v-if="showProposal" class="recommendation-panel">
        <div class="recommendation-header"><div><h2>为你选了 <em>{{items.length}}</em> 件好物</h2></div></div>
        <div class="rec-cards">
          <article class="rec-item" v-for="(item,index) in items" :key="item.skuId">
            <button class="rec-check" :class="{checked:selectedIds.includes(item.skuId)}" @click="toggle(item.skuId)" :aria-label="'选择'+item.title"><Icon name="check" :size="13"/></button>
            <div class="rec-photo"><ProductImage :src="item.imageUrl||item.product?.imageUrl" :alt="item.title"/></div>
            <div class="rec-card-content"><div class="rec-item-tag">{{index===0?'HOT PICK':index===1?'DAILY':'GOOD VALUE'}}</div><strong>{{item.title}}</strong><small>{{item.specKey}}</small><div class="rec-price"><span>{{money(item.priceCent)}}</span><span class="pick-mini"><Icon name="plus" :size="15"/></span></div></div>
          </article>
        </div>
        <div class="proposal-footer"><div class="proposal-total"><span>已选 {{selectedIds.length}} 件</span><strong>{{money(total)}}</strong></div><div class="proposal-actions"><button v-if="!preview&&proposal?.status==='PENDING'" class="ghost-decline" @click="reject">放弃</button><button class="confirm-button" @click="confirm" :disabled="preview||thinking||!selectedIds.length||(!preview&&proposal?.status!=='PENDING')"><Icon name="check" :size="17"/>{{proposal?.status==='CONFIRMED'?'已确认':'确认加购'}}</button></div></div>
      </section>
      <div class="chat-composer-placeholder" aria-hidden="true"></div>
      <form class="chat-composer" @submit.prevent="ask()"><input v-model="input" :disabled="thinking||openingConversation" aria-label="输入问题" maxlength="500" placeholder="问问 AI，帮你找好物…"/><button type="submit" :disabled="thinking||openingConversation||!input.trim()" aria-label="发送问题"><Icon name="send" :size="20"/></button></form>
    </ConsumerShell>`,
};
