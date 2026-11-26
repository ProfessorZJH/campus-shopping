import GuideConversation from '../components/GuideConversation.vue';
import GuideHistory from '../components/GuideHistory.vue';
import GuideRecommendations from '../components/GuideRecommendations.vue';
import ConsumerShell from '../components/ConsumerShell.js';
import { api } from '../services/api.js';
import { citationsOf } from '../services/ai-citations';
import { DEMO_CHAT, DEMO_PRODUCTS } from '../services/demo.js';
import { createGuideConversationTransport } from '../services/guide-conversation.js';
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
  components: { ConsumerShell, GuideConversation, GuideHistory, GuideRecommendations },
  setup() {
    const conversationTransport = createGuideConversationTransport();
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
    const confirmingProposal = ref(false);
    const rejectingProposal = ref(false);
    const proposalBusy = computed(() => confirmingProposal.value || rejectingProposal.value);
    const proposalFeedback = ref('');
    const streamProgress = ref(0);
    const streamStage = ref('');
    const reconnecting = ref(false);
    const cancelRequested = ref(false);
    let conversationEpoch = 0,
      historyEpoch = 0,
      activeStreamController = null;
    const examples = computed(() => DEMO_PRODUCTS.slice(0, 3));
    const items = computed(() =>
      preview
        ? examples.value.map((p) => ({
            skuId: skuOf(p).skuId,
            productId: p.productId,
            product: p,
            title: p.title,
            specKey: skuOf(p).specKey,
            priceCent: skuOf(p).priceCent,
            quantity: 1,
            merchantId: p.merchantId,
            detailAvailable: true,
          }))
        : (proposal.value?.items || []).map((i) => ({ ...i })),
    );
    const total = computed(() =>
      items.value
        .filter((i) => selectedIds.value.includes(i.skuId))
        .reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity || 1), 0),
    );
    const showProposal = computed(() => preview || !!proposal.value?.items?.length);
    const formatTime = () =>
      new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const formatHistoryTime = (value) => {
      if (!value) return '暂无时间';
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? '暂无时间'
        : date.toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
    };
    // 同一 AI 页面内退出/切换账号时，不能保留上一身份的本地会话与回答。
    watch(
      () => store.user?.userId,
      (now, was) => {
        if (preview || now === was) return;
        stopActiveStream();
        ++conversationEpoch;
        ++historyEpoch;
        store.conversationId = '';
        messages.value = [];
        conversations.value = [];
        historyPage.value = 1;
        historyHasMore.value = false;
        proposal.value = null;
        selectedIds.value = [];
        proposalFeedback.value = '';
        mode.value = '';
        error.value = '';
        input.value = '';
        thinking.value = false;
        confirmingProposal.value = false;
        rejectingProposal.value = false;
        reconnecting.value = false;
        cancelRequested.value = false;
        streamProgress.value = 0;
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

    function stopActiveStream() {
      activeStreamController?.abort();
      activeStreamController = null;
    }

    function applyChatAnswer(answer, stamp) {
      if (stamp !== conversationEpoch || !answer) return;
      store.conversationId = answer.conversationId || store.conversationId;
      mode.value = answer.mode || '';
      messages.value.push({
        role: 'assistant',
        content: answer.answer || '暂时没有找到合适答案',
        warning: answer.warning,
        citations: citationsOf(answer),
        time: formatTime(),
      });
      proposal.value = answer.proposal || null;
      selectedIds.value = (proposal.value?.items || []).map((i) => i.skuId);
      proposalFeedback.value = '';
    }

    async function loadConversationSnapshot(
      id,
      stamp,
      expectedQuestion = null,
      knownLastMessage = null,
    ) {
      const snapshot = await conversationTransport.loadSnapshot(id, {
        expectedQuestion,
        knownLastMessage,
      });
      if (stamp !== conversationEpoch) return false;
      if (!snapshot) return false;
      applyConversationSnapshot(snapshot, id, stamp);
      return true;
    }

    function applyConversationSnapshot(snapshot, id, stamp) {
      if (stamp !== conversationEpoch || !snapshot) return false;
      const messageHistory = snapshot.messages;
      store.conversationId = id;
      messages.value = messageHistory.map((m) => ({
        role: m.role,
        content: m.content,
        citations: citationsOf(m),
        citationStatus: m.citationStatus || 'MISSING',
        time: '历史消息',
      }));
      proposal.value = snapshot.proposal;
      selectedIds.value = (proposal.value?.items || []).map((i) => i.skuId);
      return true;
    }

    async function recoverAfterDisconnect(
      stamp,
      actor,
      id,
      expectedQuestion,
      knownLastMessage,
      knownCount,
    ) {
      if (!id || actor !== store.user?.userId) return false;
      reconnecting.value = true;
      try {
        const recovered = await conversationTransport.recoverAfterDisconnect({
          id,
          isCurrent: () => stamp === conversationEpoch && actor === store.user?.userId,
          expectedQuestion,
          knownLastMessage,
          knownCount,
          onCancelRequested: () => {
            if (stamp === conversationEpoch) cancelRequested.value = true;
          },
        });
        if (recovered && recovered !== true) applyConversationSnapshot(recovered, id, stamp);
        else if (recovered === true && stamp === conversationEpoch)
          notify('后台仍在生成回答，稍后可重新打开当前会话查看结果');
        return recovered;
      } finally {
        if (stamp === conversationEpoch) reconnecting.value = false;
      }
    }

    async function cancelTurn() {
      const id = store.conversationId;
      if (preview || !thinking.value || !id || cancelRequested.value) return;
      cancelRequested.value = true;
      try {
        await conversationTransport.cancelTurn(id);
      } catch (err) {
        cancelRequested.value = false;
        notify(err?.message || '取消请求未完成，请稍后重试');
      }
    }

    async function ask(question = input.value) {
      const text = String(question || '').trim();
      if (!text || thinking.value || openingConversation.value || proposalBusy.value) return;
      if (text.length > 500) {
        notify('问题不能超过500字');
        return;
      }
      const stamp = ++conversationEpoch;
      const knownCount = messages.value.length;
      const knownLastMessage = messages.value[messages.value.length - 1] || null;
      input.value = '';
      error.value = '';
      proposalFeedback.value = '';
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
      streamProgress.value = 0;
      streamStage.value = 'recall';
      reconnecting.value = false;
      cancelRequested.value = false;
      activeStreamController = new AbortController();
      const controller = activeStreamController;
      const actor = store.user?.userId;
      let streamConversationId = store.conversationId || null;
      let completed = false;
      let cancelled = false;
      try {
        const result = await conversationTransport.streamTurn({
          question: text,
          conversationId: store.conversationId || null,
          signal: controller.signal,
          isCurrent: () => stamp === conversationEpoch,
          onConversationId: (id) => {
            streamConversationId = id;
            store.conversationId = id;
          },
          onStage: (stage) => {
            streamStage.value = stage;
          },
          onProgress: (bytes) => {
            streamProgress.value = bytes;
          },
          onCompleted: (answer) => {
            completed = true;
            streamStage.value = '';
            applyChatAnswer(answer, stamp);
          },
          onCancelled: () => {
            cancelled = true;
            cancelRequested.value = true;
          },
        });
        completed = result.completed;
        cancelled = result.cancelled;
        if (cancelled && !completed && stamp === conversationEpoch) {
          messages.value.pop();
          input.value = text;
          notify('已停止本次生成');
        }
      } catch (err) {
        if (err?.name === 'AbortError' && (cancelRequested.value || stamp !== conversationEpoch))
          return;
        if (err?.code === 'NETWORK' && streamConversationId) {
          const recovered = await recoverAfterDisconnect(
            stamp,
            actor,
            streamConversationId,
            text,
            knownLastMessage,
            knownCount,
          );
          if (recovered) return;
        }
        if (stamp === conversationEpoch && !cancelled) {
          error.value = err.status === 401 ? '请先登录账号再使用 AI 导购' : err.message;
          messages.value.pop();
          input.value = text;
        }
      } finally {
        if (activeStreamController === controller) activeStreamController = null;
        if (stamp === conversationEpoch) {
          thinking.value = false;
          cancelRequested.value = false;
        }
      }
    }
    async function loadHistory(reset = true) {
      if (preview) return;
      if (loadingHistory.value && !reset) return;
      const stamp = ++historyEpoch;
      const page = reset ? 1 : historyPage.value + 1;
      loadingHistory.value = true;
      try {
        const result = (await conversationTransport.loadHistory(page, 20)) || [];
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
      if (preview || thinking.value || proposalBusy.value || !c?.id) return;
      const stamp = ++conversationEpoch;
      openingConversation.value = true;
      try {
        await loadConversationSnapshot(c.id, stamp);
        if (stamp === conversationEpoch) {
          error.value = '';
          proposalFeedback.value = '';
          historyOpen.value = false;
        }
      } catch (e) {
        if (stamp === conversationEpoch) notify(e.message);
      } finally {
        if (stamp === conversationEpoch) openingConversation.value = false;
      }
    }
    /** 新对话只切换前端会话代次；旧请求仍可能在服务端完成，但不得写回当前页面。 */
    function newConversation() {
      if (proposalBusy.value) return;
      stopActiveStream();
      ++conversationEpoch;
      store.conversationId = '';
      messages.value = [];
      proposal.value = null;
      selectedIds.value = [];
      proposalFeedback.value = '';
      mode.value = '';
      error.value = '';
      input.value = '';
      thinking.value = false;
      reconnecting.value = false;
      cancelRequested.value = false;
      streamProgress.value = 0;
      openingConversation.value = false;
      historyOpen.value = false;
    }
    onUnmounted(() => {
      stopActiveStream();
      ++conversationEpoch;
      ++historyEpoch;
    });
    function toggle(id) {
      if (selectedIds.value.includes(id))
        selectedIds.value = selectedIds.value.filter((x) => x !== id);
      else selectedIds.value = [...selectedIds.value, id];
    }
    function openDetail(item) {
      if (preview) {
        if (item?.productId) go('/product/' + encodeURIComponent(item.productId));
        return;
      }
      if (!item?.detailAvailable || !item?.productId) {
        notify('该商品详情暂不可用，请重新咨询');
        return;
      }
      go('/product/' + encodeURIComponent(item.productId));
    }
    function proposalFailureMessage(err) {
      const messages = {
        AI0002: '这份推荐已过期，请重新咨询后再选择商品。',
        C0001: '其中商品已下架或暂不可售，请重新咨询后选择。',
        C0002: '商品价格或版本已变化，请重新查看推荐后确认。',
        I0001: '其中商品库存不足，请调整选择或重新咨询。',
        G0002: '这份推荐状态已变化，请重新打开会话后再试。',
        G0003: '这份推荐已经用另一组选择确认，不能更换选择重复加购。',
        NETWORK: '确认请求未完成，请稍后用相同选择重试。',
        TIMEOUT: '确认结果暂时未知，请稍后用相同选择重试。',
      };
      return messages[err?.code] || err?.message || '确认加购失败，请保留选择后重试。';
    }
    function currentProposal(stamp, actor, proposalId) {
      return (
        stamp === conversationEpoch &&
        actor === store.user?.userId &&
        proposal.value?.id === proposalId
      );
    }
    function currentRequest(stamp, actor) {
      return stamp === conversationEpoch && actor === store.user?.userId;
    }
    async function confirm() {
      if (previewGuard() || !proposal.value?.id || thinking.value || proposalBusy.value) return;
      const stamp = conversationEpoch,
        actor = store.user?.userId,
        proposalId = proposal.value.id,
        chosen = [...selectedIds.value];
      if (!selectedIds.value.length) {
        notify('至少选择一件商品');
        return;
      }
      proposalFeedback.value = '';
      confirmingProposal.value = true;
      try {
        const updated = await api('/ai/proposals/' + encodeURIComponent(proposalId) + '/confirm', {
          method: 'POST',
          body: { selectedSkuIds: chosen },
        });
        if (currentProposal(stamp, actor, proposalId)) {
          proposal.value = updated;
          selectedIds.value = chosen;
          notify('已加入，购物车已更新');
        }
      } catch (err) {
        if (currentProposal(stamp, actor, proposalId)) {
          proposalFeedback.value = proposalFailureMessage(err);
          notify(proposalFeedback.value);
        }
      } finally {
        if (currentProposal(stamp, actor, proposalId)) confirmingProposal.value = false;
      }
    }
    async function reject() {
      if (previewGuard() || !proposal.value?.id || thinking.value || proposalBusy.value) return;
      const stamp = conversationEpoch,
        actor = store.user?.userId,
        proposalId = proposal.value.id;
      proposalFeedback.value = '';
      rejectingProposal.value = true;
      try {
        await api('/ai/proposals/' + encodeURIComponent(proposalId) + '/reject', {
          method: 'POST',
        });
        if (currentProposal(stamp, actor, proposalId)) {
          proposal.value = null;
          notify('已收起推荐');
        }
      } catch (err) {
        if (currentProposal(stamp, actor, proposalId)) {
          proposalFeedback.value = err?.message || '操作未完成，请稍后重试。';
          notify(proposalFeedback.value);
        }
      } finally {
        if (currentRequest(stamp, actor)) rejectingProposal.value = false;
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
      openDetail,
      confirm,
      reject,
      historyOpen,
      conversations,
      formatHistoryTime,
      historyHasMore,
      loadingHistory,
      openingConversation,
      confirmingProposal,
      rejectingProposal,
      proposalBusy,
      proposalFeedback,
      streamProgress,
      streamStage,
      reconnecting,
      cancelRequested,
      cancelTurn,
      loadHistory,
      openConversation,
      newConversation,
    };
  },
  template: `
    <ConsumerShell active="ai">
      <section class="ai-hero">
        <div class="ai-hero-text"><h1><span>AI</span> 导购助手</h1><p>说出预算、口味、规格或自提问题，跨店实时核验库存后由你确认加购</p></div>
        <img src="./images/robot.webp" alt="AI 导购助手" class="ai-hero-robot"/>
      </section>
      <div class="ai-workspace" :class="{'has-proposal': showProposal}">
        <div class="ai-workspace-main">
          <GuideHistory v-if="!preview" :open="historyOpen" :conversations="conversations" :thinking="thinking" :opening-conversation="openingConversation" :confirming-proposal="proposalBusy" :has-more="historyHasMore" :loading="loadingHistory" :format-time="formatHistoryTime" @new="newConversation" @toggle="historyOpen=!historyOpen;historyOpen&&loadHistory()" @open="openConversation" @more="loadHistory(false)"/>
          <div class="quick-prompts" aria-label="快捷提问"><button v-for="p in prompts" :key="p.label" @click="ask(p.query)" :disabled="thinking||openingConversation||proposalBusy"><Icon :name="p.icon" :size="15"/>{{p.label}}</button></div>
          <GuideConversation :messages="messages" :thinking="thinking" :reconnecting="reconnecting" :cancel-requested="cancelRequested" :stream-progress="streamProgress" :stream-stage="streamStage" :error="error"/>
          <div class="chat-composer-placeholder" aria-hidden="true"></div>
          <form class="chat-composer" @submit.prevent="ask()"><input v-model="input" :disabled="thinking||openingConversation||proposalBusy" aria-label="输入问题" maxlength="500" placeholder="例如：预算20元买两瓶无糖乌龙茶，几点可以自提？"/><button v-if="thinking" type="button" class="stream-cancel" @click="cancelTurn" :disabled="cancelRequested||!store.conversationId">{{cancelRequested?'停止中…':'停止生成'}}</button><button v-else type="submit" :disabled="openingConversation||proposalBusy||!input.trim()" aria-label="发送问题"><Icon name="send" :size="19"/></button></form>
        </div>
        <aside v-if="showProposal" class="ai-workspace-side">
          <GuideRecommendations :items="items" :selected-ids="selectedIds" :total="total" :feedback="proposalFeedback" :preview="preview" :thinking="thinking" :confirming="confirmingProposal" :rejecting="rejectingProposal" :proposal-status="proposal?.status" @toggle="toggle" @detail="openDetail" @reject="reject" @confirm="confirm" @cart="go('/cart')"/>
        </aside>
      </div>
    </ConsumerShell>`,
};
