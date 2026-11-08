import { api, query, stream } from './api.js';

const conversationPath = (id, suffix) =>
  '/ai/conversations/' + encodeURIComponent(id) + suffix;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function hasExpectedAnswer(messageHistory, expectedQuestion, knownLastMessage) {
  if (!expectedQuestion) return true;
  const lastQuestion = messageHistory.length - 2;
  const tailQuestion = messageHistory[lastQuestion];
  const tailAnswer = messageHistory[messageHistory.length - 1];
  let knownLastIndex = -1;
  if (knownLastMessage) {
    for (let index = messageHistory.length - 1; index >= 0; index -= 1) {
      const message = messageHistory[index];
      if (
        message.role === knownLastMessage.role &&
        message.content === knownLastMessage.content
      ) {
        knownLastIndex = index;
        break;
      }
    }
  }
  return (
    lastQuestion >= 0 &&
    tailQuestion?.role === 'user' &&
    tailQuestion.content === expectedQuestion &&
    tailAnswer?.role === 'assistant' &&
    (knownLastIndex < 0 || knownLastIndex < lastQuestion)
  );
}

function failedEventError(payload) {
  const code = payload?.errorCode || payload?.data?.errorCode || 'AI0001';
  return Object.assign(new Error('智能服务暂不可用，请稍后重试'), { code });
}

function disconnectedError() {
  return Object.assign(new Error('流式连接中断，请稍后重试'), { code: 'NETWORK' });
}

/**
 * 导购页面的 HTTP/SSE 传输边界。
 *
 * 页面仍负责 Vue 状态和身份代次；本模块只负责会话 API、流式事件归一化和断线恢复。
 * 依赖可注入，便于在不启动浏览器或后端的情况下验证协议行为。
 */
export function createGuideConversationTransport({
  request = api,
  streamRequest = stream,
  sleep = wait,
} = {}) {
  async function loadHistory(page, size = 20) {
    return request('/ai/conversations' + query({ page, size }));
  }

  async function loadSnapshot(id, { expectedQuestion = null, knownLastMessage = null } = {}) {
    const [history, proposals] = await Promise.all([
      request(conversationPath(id, '/messages')),
      request(conversationPath(id, '/proposals')),
    ]);
    const messageHistory = history || [];
    if (!hasExpectedAnswer(messageHistory, expectedQuestion, knownLastMessage)) return false;
    return {
      id,
      messages: messageHistory,
      proposal: (proposals || []).find((item) => item.status === 'PENDING') || null,
    };
  }

  async function recoverAfterDisconnect({
    id,
    isCurrent = () => true,
    expectedQuestion = null,
    knownLastMessage = null,
    onCancelRequested,
  }) {
    if (!id) return false;
    if (!isCurrent()) return true;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (!isCurrent()) return true;
      let status;
      try {
        status = await request(conversationPath(id, '/turn/status'), { timeoutMs: 5000 });
      } catch (error) {
        if (!['NETWORK', 'TIMEOUT'].includes(error?.code)) return false;
        await sleep(500);
        continue;
      }
      if (status?.status === 'CANCEL_REQUESTED') {
        onCancelRequested?.();
        await sleep(500);
        continue;
      }
      if (status?.status === 'IDLE') {
        try {
          return await loadSnapshot(id, { expectedQuestion, knownLastMessage });
        } catch (error) {
          if (!['NETWORK', 'TIMEOUT'].includes(error?.code)) return false;
          await sleep(500);
          continue;
        }
      }
      await sleep(500);
    }
    // 后端仍在执行时保留页面上的待处理用户消息，避免短暂断线被误显示为空轮次。
    return true;
  }

  async function cancelTurn(id) {
    return request(conversationPath(id, '/turn/cancel'), { method: 'POST' });
  }

  async function streamTurn({
    question,
    conversationId = null,
    signal,
    isCurrent = () => true,
    onConversationId,
    onProgress,
    onCompleted,
    onCancelled,
  }) {
    let activeConversationId = conversationId || null;
    let completed = false;
    let cancelled = false;
    await streamRequest('/ai/chat/stream', {
      signal,
      body: { question, conversationId: conversationId || null },
      onEvent: async (event, payload) => {
        if (!isCurrent()) return;
        const id = payload?.conversationId || payload?.data?.conversationId;
        if (id) {
          activeConversationId = id;
          onConversationId?.(id);
        }
        if (event === 'progress') {
          onProgress?.(Number(payload?.data?.bytes || payload?.bytes || 0));
        } else if (event === 'completed') {
          completed = true;
          await onCompleted?.(payload?.data);
        } else if (event === 'cancelled') {
          cancelled = true;
          onCancelled?.();
        } else if (event === 'failed') {
          throw failedEventError(payload);
        }
      },
    });
    if (!completed && !cancelled) throw disconnectedError();
    return { conversationId: activeConversationId, completed, cancelled };
  }

  return { loadHistory, loadSnapshot, recoverAfterDisconnect, cancelTurn, streamTurn };
}

