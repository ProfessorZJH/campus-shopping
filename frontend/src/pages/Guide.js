import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import { api, apiStream, query } from '../services/api.js';
import {
  aiModeClass,
  aiModeLabel,
  retrievalModeLabel,
  toAssistantMessage,
} from '../services/ai-answer.js';
import { DEMO_CHAT, DEMO_PRODUCTS } from '../services/demo.js';
import { store, go, money, skuOf, preview, previewGuard, notify, openAuthModal } from '../services/store.js';
import { formatAiMessage } from '../services/page-utils.js';
const { ref, computed, onMounted, onUnmounted, watch, nextTick } = Vue;
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
    const chatThreadRef = ref(null);
    const pendingQuestion = ref('');
    const activeDetailProduct = ref(null);
    const loadingDetail = ref(false);
    const currentAbortController = ref(null);
    let conversationEpoch = 0,
      historyEpoch = 0;
    const examples = computed(() => DEMO_PRODUCTS.slice(0, 3));
    const items = computed(() =>
      preview
        ? examples.value.map((p) => ({
            skuId: skuOf(p).skuId,
            product: p,
            productId: p.productId,
            title: p.title,
            specKey: skuOf(p).specKey,
            imageUrl: skuOf(p).imageUrl || p.imageUrl,
            priceCent: skuOf(p).priceCent,
            quantity: 1,
            merchantId: p.merchantId,
            merchantName: store.merchants.find((m) => m.merchantId === p.merchantId)?.name || '校园商户',
          }))
        : (proposal.value?.items || []).map((i) => {
            const matchedProduct = store.products.find((p) => p.skus?.some((s) => s.skuId === i.skuId));
            const mName = store.merchants.find((m) => m.merchantId === i.merchantId)?.name;
            return {
              ...i,
              productId: matchedProduct?.productId || '',
              product: matchedProduct,
              imageUrl: i.imageUrl || matchedProduct?.imageUrl || '',
              merchantName: mName || matchedProduct?.merchantName || '校内商户',
            };
          }),
    );
    const total = computed(() =>
      items.value
        .filter((i) => selectedIds.value.includes(i.skuId))
        .reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity || 1), 0),
    );
    const suggestions = computed(() => {
      if (preview || !proposal.value?.items?.length) return [];
      return ['换便宜一点的', '换个其他口味', '推荐适合搭配的饮料'];
    });
    const formatTime = () =>
      new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    // 滚动到底部（支持智能滚动判断：若用户正在查看历史则不打扰）
    function scrollToBottom(force = false) {
      nextTick(() => {
        const el = chatThreadRef.value;
        if (!el) return;
        const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (force || distanceToBottom < 100) {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
      });
    }

    function stopStreaming() {
      if (currentAbortController.value) {
        currentAbortController.value.abort();
        currentAbortController.value = null;
      }
      ++conversationEpoch;
      thinking.value = false;
      notify('已停止生成');
    }

    function startNewChat() {
      stopStreaming();
      ++conversationEpoch;
      store.conversationId = '';
      messages.value = [];
      proposal.value = null;
      selectedIds.value = [];
      mode.value = '';
      error.value = '';
      input.value = '';
      pendingQuestion.value = '';
      thinking.value = false;
      openingConversation.value = false;
      historyOpen.value = false;
      notify('已开启新对话');
    }
      error.value = '';
      input.value = '';
      pendingQuestion.value = '';
      thinking.value = false;
      openingConversation.value = false;
      historyOpen.value = false;
      notify('已开启新对话');
    }

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
        if (now) {
          loadHistory();
          // 登录唤醒后如果有暂存的问题，恢复输入并自动触发提问
          if (pendingQuestion.value) {
            const q = pendingQuestion.value;
            pendingQuestion.value = '';
            nextTick(() => ask(q));
          }
        } else {
          pendingQuestion.value = '';
        }
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
      if (!preview && !store.user) {
        pendingQuestion.value = text;
        openAuthModal();
        notify('请先登录账号使用 AI 导购');
        return;
      }
      if (text.length > 500) {
        notify('问题不能超过500字');
        return;
      }
      const stamp = ++conversationEpoch;
      input.value = '';
      error.value = '';
      messages.value.push({ role: 'user', content: text, time: formatTime() });
      scrollToBottom(true);
      if (preview) {
        messages.value.push({
          role: 'assistant',
          content: '为你挑了几款商品，看看有没有喜欢的。',
          time: formatTime(),
          demo: true,
        });
        scrollToBottom(true);
        notify('设计预览 · 未请求真实 AI');
        return;
      }
      thinking.value = true;
      scrollToBottom(true);
      const assistantMsg = {
        role: 'assistant',
        content: '',
        warning: '',
        citations: [],
        time: formatTime(),
        streaming: true,
      };
      messages.value.push(assistantMsg);
      const controller = new AbortController();
      currentAbortController.value = controller;

      try {
        const answer = await apiStream(
          '/ai/chat',
          { body: { question: text, conversationId: store.conversationId || null }, signal: controller.signal },
          {
            onDelta: (delta) => {
              if (stamp !== conversationEpoch) return;
              assistantMsg.content += delta;
              scrollToBottom();
            },
            onDone: (finalData) => {
              if (stamp !== conversationEpoch) return;
              assistantMsg.streaming = false;
              if (finalData) {
                if (finalData.conversationId) store.conversationId = finalData.conversationId;
                if (finalData.mode) mode.value = finalData.mode;
                if (finalData.warning) assistantMsg.warning = finalData.warning;
                if (finalData.citations) assistantMsg.citations = finalData.citations.map((c) => c.title || c);
                if (finalData.proposal) {
                  proposal.value = finalData.proposal;
                  selectedIds.value = (proposal.value?.items || []).map((i) => i.skuId);
                }
              }
              scrollToBottom();
            },
          },
        );
        if (stamp !== conversationEpoch) return;
        if (answer) {
          store.conversationId = answer.conversationId || store.conversationId;
          mode.value = answer.mode || '';
          if (!assistantMsg.content && answer.answer) assistantMsg.content = answer.answer;
          assistantMsg.warning = answer.warning;
          assistantMsg.citations = (answer.citations || []).map((c) => c.title || c);
          proposal.value = answer.proposal || null;
          selectedIds.value = (proposal.value?.items || []).map((i) => i.skuId);
        }
        assistantMsg.streaming = false;
        scrollToBottom();
      } catch (err) {
        if (stamp === conversationEpoch) {
          if (err.name === 'AbortError') return;
          error.value = err.status === 401 ? '请先登录账号再使用 AI 导购' : err.message;
          messages.value = messages.value.filter((m) => m !== assistantMsg);
          input.value = text;
          if (err.status === 401) {
            pendingQuestion.value = text;
            openAuthModal();
          }
        }
      } finally {
        if (stamp === conversationEpoch) {
          thinking.value = false;
          currentAbortController.value = null;
          assistantMsg.streaming = false;
        }
      }
    }
      } catch (err) {
        if (stamp === conversationEpoch) {
          error.value = err.status === 401 ? '请先登录账号再使用 AI 导购' : err.message;
          messages.value.pop();
          input.value = text;
          if (err.status === 401) {
            pendingQuestion.value = text;
            openAuthModal();
          }
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
    async function showItemDetail(item) {
      if (preview) {
        activeDetailProduct.value = item.product || {
          title: item.title,
          description: '校园热销优质好物，品质保障。',
          imageUrl: item.imageUrl,
          skus: [{ skuId: item.skuId, specKey: item.specKey, priceCent: item.priceCent, available: 10, status: 'ACTIVE' }],
          merchantName: item.merchantName,
        };
        return;
      }
      // 1. 如果已有关联的 product 且有 productId，直接使用或请求详情
      const pid = item.productId || item.product?.productId;
      if (pid) {
        loadingDetail.value = true;
        try {
          const detail = await api('/products/' + encodeURIComponent(pid));
          activeDetailProduct.value = detail;
        } catch {
          // 降级使用提案中的快照信息展示弹窗，避免白屏或报错打断体验
          activeDetailProduct.value = item.product || {
            title: item.title,
            imageUrl: item.imageUrl,
            skus: [{ skuId: item.skuId, specKey: item.specKey, priceCent: item.priceCent, available: '可售', status: 'ACTIVE' }],
            merchantName: item.merchantName,
          };
        } finally {
          loadingDetail.value = false;
        }
        return;
      }
      // 2. 如果缺少 productId（因跨页未加载对应商品聚合），直接基于提案安全快照展示微型详情卡片
      activeDetailProduct.value = {
        title: item.title,
        imageUrl: item.imageUrl,
        skus: [{ skuId: item.skuId, specKey: item.specKey, priceCent: item.priceCent, available: '可售', status: 'ACTIVE' }],
        merchantName: item.merchantName,
      };
    }

    function closeItemDetail() {
      activeDetailProduct.value = null;
    }

    return {
      stopStreaming,
      activeDetailProduct,
      loadingDetail,
      showItemDetail,
      closeItemDetail,
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
      suggestions,
      showProposal: computed(() => preview || !!proposal.value?.items?.length),
      proposal,
      error,
      mode,
      ask,
      toggle,
      confirm,
      reject,
      startNewChat,
      chatThreadRef,
      formatAiMessage,
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
      <div v-if="!preview" class="ai-history-head">
        <button class="ai-history-toggle" @click="historyOpen=!historyOpen;historyOpen&&loadHistory()"><Icon name="clock" :size="15"/> 历史会话 <Icon name="chevronDown" :size="14"/></button>
        <button class="ai-new-chat-btn" @click="startNewChat" :disabled="thinking||openingConversation" title="开启新对话"><Icon name="plus" :size="15"/> 新对话</button>
      </div>
      <div v-if="historyOpen" class="ai-history-list">
        <button v-for="c in conversations" :key="c.id" @click="openConversation(c)" :disabled="thinking||openingConversation"><Icon name="order" :size="16"/> {{c.title||'对话'}} <Icon name="chevronRight" :size="14"/></button>
        <span v-if="!conversations.length">暂无历史记录</span>
        <button v-if="historyHasMore" @click="loadHistory(false)" :disabled="loadingHistory">加载更多会话</button>
      </div>
      <div class="quick-prompts" aria-label="快捷提问"><button v-for="p in prompts" :key="p.label" @click="ask(p.query)" :disabled="thinking||openingConversation"><Icon :name="p.icon" :size="15"/>{{p.label}}</button></div>
      <section class="chat-thread" ref="chatThreadRef" aria-label="AI对话">
        <div v-if="!messages.length" class="chat-welcome"><span class="chat-welcome-icon"><Icon name="sparkles" :size="22"/></span><h2>你好，同学。</h2><p>告诉我预算或想买的东西。</p></div>
        <div class="chat-row" v-for="(message,index) in messages" :key="index" :class="message.role==='user'?'is-user':'is-assistant'">
          <span v-if="message.role!=='user'" class="chat-avatar"><img src="./images/robot.webp" alt="AI"/></span>
          <div class="chat-body">
            <div v-if="message.role==='user'" class="chat-bubble">{{message.content}}</div>
            <div v-else class="chat-bubble ai-formatted-bubble">
              <span v-if="!message.content && message.streaming" class="ai-streaming-placeholder">AI 思考中…</span>
              <div v-else v-html="formatAiMessage(message.content)"></div>
              <span v-if="message.streaming" class="ai-streaming-cursor"></span>
            </div>
            <div v-if="message.warning" class="message-warning">{{message.warning}}</div>
            <div v-if="message.citations?.length" class="citation-chips"><span v-for="c in message.citations" :key="c"><Icon name="book" :size="12"/>{{c}}</span></div>
            <span class="chat-timestamp">{{message.time||'刚刚'}} <span v-if="message.demo">· 示例回答</span></span>
          </div>
        </div>
        <div v-if="thinking && !messages.some((m) => m.streaming)" class="chat-row is-assistant"><span class="chat-avatar"><img src="./images/robot.webp" alt="AI"/></span><div class="typing-bubble"><i></i><i></i><i></i></div></div>
        <div v-if="error" class="inline-error"><Icon name="alert" :size="17"/>{{error}}</div>
      </section>
      <section v-if="showProposal" class="recommendation-panel">
        <div class="recommendation-header"><div><h2>为你选了 <em>{{items.length}}</em> 件好物</h2></div></div>
        <div class="rec-cards">
          <article class="rec-item" v-for="item in items" :key="item.skuId">
            <button class="rec-check" :class="{checked:selectedIds.includes(item.skuId)}" @click="toggle(item.skuId)" :aria-label="'选择'+item.title"><Icon name="check" :size="13"/></button>
            <div class="rec-photo" @click="showItemDetail(item)" style="cursor:pointer" title="点击查看商品详情"><ProductImage :src="item.imageUrl" :alt="item.title"/></div>
            <div class="rec-card-content" @click="showItemDetail(item)" style="cursor:pointer">
              <div class="rec-item-merchant"><Icon name="store" :size="11"/> {{item.merchantName}}</div>
              <strong>{{item.title}}</strong>
              <small>{{item.specKey}}</small>
              <div class="rec-price"><span>{{money(item.priceCent)}}</span><span class="pick-mini" @click.stop="toggle(item.skuId)"><Icon :name="selectedIds.includes(item.skuId)?'check':'plus'" :size="14"/></span></div>
            </div>
          </article>
        </div>
        <div class="proposal-footer"><div class="proposal-total"><span>已选 {{selectedIds.length}} 件</span><strong>{{money(total)}}</strong></div><div class="proposal-actions"><button v-if="!preview&&proposal?.status==='PENDING'" class="ghost-decline" @click="reject">放弃</button><button class="confirm-button" @click="confirm" :disabled="preview||thinking||!selectedIds.length||(!preview&&proposal?.status!=='PENDING')"><Icon name="check" :size="17"/>{{proposal?.status==='CONFIRMED'?'已确认':'确认加购'}}</button></div></div>
      </section>
      <div v-if="suggestions.length" class="rec-suggestions"><button v-for="s in suggestions" :key="s" @click="ask(s)" :disabled="thinking||openingConversation"><Icon name="sparkles" :size="13"/>{{s}}</button></div>
      <div class="chat-composer-placeholder" aria-hidden="true"></div>
      <form class="chat-composer" @submit.prevent="ask()">
        <input v-model="input" :disabled="thinking||openingConversation" aria-label="输入问题" maxlength="500" placeholder="问问 AI，帮你找好物…"/>
        <button v-if="thinking" type="button" class="chat-stop-btn" @click="stopStreaming" aria-label="停止生成" title="停止生成"><Icon name="close" :size="16"/></button>
        <button v-else type="submit" :disabled="openingConversation||!input.trim()" aria-label="发送问题"><Icon name="send" :size="20"/></button>
      </form>
      <div v-if="activeDetailProduct" class="modal-backdrop" @click="closeItemDetail">
        <div class="rec-detail-modal" @click.stop>
          <button class="rec-modal-close" @click="closeItemDetail" aria-label="关闭"><Icon name="close" :size="16"/></button>
          <div class="rec-modal-art"><ProductImage :src="activeDetailProduct.imageUrl" :alt="activeDetailProduct.title"/></div>
          <div class="rec-modal-body">
            <div class="rec-modal-price">{{money(activeDetailProduct.skus?.[0]?.priceCent)}}</div>
            <h3>{{activeDetailProduct.title}}</h3>
            <p v-if="activeDetailProduct.description" class="rec-modal-desc">{{activeDetailProduct.description}}</p>
            <div class="rec-modal-shop"><Icon name="store" :size="13"/> {{activeDetailProduct.merchantName || '校内商户'}}</div>
            <div class="rec-modal-specs"><span>规格：{{activeDetailProduct.skus?.[0]?.specKey || '标配'}}</span><span class="rec-modal-stock">状态：{{activeDetailProduct.skus?.[0]?.available != null ? '在售有货' : '可售'}}</span></div>
          </div>
        </div>
      </div>
    </ConsumerShell>`,
};
