<script setup lang="ts">
interface Citation {
  documentId?: string;
  title?: string;
  snippet?: string;
}
interface Message {
  role: string;
  content: string;
  warning?: string;
  citations?: Citation[];
  citationStatus?: string;
  time?: string;
  demo?: boolean;
}

defineProps<{
  messages: Message[];
  thinking: boolean;
  reconnecting: boolean;
  cancelRequested: boolean;
  streamProgress: number;
  streamStage?: string;
  streamingText?: string;
  error: string;
}>();

defineEmits<{
  prompt: [query: string];
}>();

const sceneCards = [
  {
    title: '深夜复习夜宵',
    desc: '30元内搭配泡面、零食与冰饮',
    icon: 'flame',
    query: '30元内配一套熬夜复习泡面零食加饮料',
  },
  {
    title: '课间低糖提神',
    desc: '20元内无糖茶饮与门店营业时间',
    icon: 'clock',
    query: '预算20元推荐无糖饮料，顺便问自提几点关门？',
  },
  {
    title: '宿舍常备补给',
    desc: '高性价比抽纸与纯牛奶组合挑好',
    icon: 'package',
    query: '推荐宿舍常备抽纸和牛奶',
  },
  {
    title: '实时取餐进度',
    desc: '直接查询我的订单是否备好可取',
    icon: 'order',
    query: '帮我看看我的订单备好货了吗？',
  },
];

function splitRichLines(content: string): { kind: 'knowledge' | 'text'; text: string }[] {
  const rawLines = String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const cleaned = rawLines.filter(
    (line) =>
      !line.startsWith('确认后只加入购物车') && !line.startsWith('根据当前允许访问的知识资料'),
  );
  const lines = cleaned.length > 0 ? cleaned : rawLines;
  return lines.map((line) => ({
    kind: line.startsWith('《') ? 'knowledge' : 'text',
    text: line,
  }));
}

function friendlyWarning(raw?: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (
    text.includes('远程模型不可用') ||
    text.includes('未调用大语言模型') ||
    text.includes('本地检索演示')
  ) {
    return '';
  }
  return text;
}
</script>

<template>
  <section class="chat-thread" aria-label="AI对话">
    <div v-if="!messages.length" class="chat-welcome wenwen-welcome">
      <div class="wenwen-welcome-head">
        <span class="chat-welcome-icon" aria-hidden="true">
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11 3L13.1 8.9L19 11L13.1 13.1L11 19L8.9 13.1L3 11L8.9 8.9L11 3Z"
              fill="currentColor"
              fill-opacity="0.18"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
            <path
              d="M18.5 15L19.4 17.6L22 18.5L19.4 19.4L18.5 22L17.6 19.4L15 18.5L17.6 17.6L18.5 15Z"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <div>
          <h2>今天想买点什么？</h2>
          <p>说出预算、口味或场景，直接帮你挑好校内在售商品并核验门店规则</p>
        </div>
      </div>
      <div class="wenwen-scene-grid">
        <button
          v-for="scene in sceneCards"
          :key="scene.title"
          type="button"
          class="wenwen-scene-card"
          :disabled="thinking"
          @click="$emit('prompt', scene.query)"
        >
          <span class="wenwen-scene-top" aria-hidden="true">
            <span class="wenwen-scene-ico"><Icon :name="scene.icon" :size="15" /></span>
            <span class="wenwen-scene-arrow"><Icon name="arrowUpRight" :size="14" /></span>
          </span>
          <strong>{{ scene.title }}</strong>
          <small>{{ scene.desc }}</small>
        </button>
      </div>
    </div>
    <div
      v-for="(message, index) in messages"
      :key="index"
      class="chat-row"
      :class="message.role === 'user' ? 'is-user' : 'is-assistant'"
    >
      <span v-if="message.role !== 'user'" class="chat-avatar" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11 3L13.1 8.9L19 11L13.1 13.1L11 19L8.9 13.1L3 11L8.9 8.9L11 3Z"
            fill="currentColor"
            fill-opacity="0.18"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linejoin="round"
          />
          <path
            d="M18.5 15L19.4 17.6L22 18.5L19.4 19.4L18.5 22L17.6 19.4L15 18.5L17.6 17.6L18.5 15Z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <div class="chat-body">
        <div v-if="message.role === 'user'" class="chat-bubble">{{ message.content }}</div>
        <div v-else class="chat-bubble chat-rich-lines">
          <p
            v-for="(part, pi) in splitRichLines(message.content)"
            :key="pi"
            class="chat-rich-line"
            :class="part.kind === 'knowledge' ? 'chat-rich-knowledge' : ''"
          >
            <span
              v-if="part.kind === 'knowledge'"
              class="knowledge-source-badge"
              aria-hidden="true"
            >
              <Icon name="book" :size="13" />
            </span>
            <span v-if="part.kind === 'knowledge'" class="knowledge-source-text">{{
              part.text
            }}</span>
            <template v-else>{{ part.text }}</template>
          </p>
        </div>
        <div v-if="friendlyWarning(message.warning)" class="message-warning">
          {{ friendlyWarning(message.warning) }}
        </div>
        <div v-if="message.citations?.length" class="citation-chips">
          <details
            v-for="(citation, ci) in message.citations"
            :key="citation.documentId || ci"
            class="citation-chip"
          >
            <summary>
              <span class="citation-book-badge" aria-hidden="true">
                <Icon name="book" :size="13" />
              </span>
              <span class="citation-title-text">{{ citation.title || '参考说明' }}</span>
              <span class="citation-chevron" aria-hidden="true">
                <Icon name="chevronDown" :size="13" />
              </span>
            </summary>
            <p v-if="citation.snippet">{{ citation.snippet }}</p>
          </details>
        </div>
        <div
          v-if="message.role === 'assistant' && message.citationStatus === 'MISSING'"
          class="message-warning"
        >
          历史消息没有可恢复的引用记录
        </div>
        <div
          v-if="message.role === 'assistant' && message.citationStatus === 'HIDDEN'"
          class="message-warning"
        >
          当前无法核验这条历史引用，来源已隐藏
        </div>
        <span class="chat-timestamp"
          >{{ message.time || '刚刚' }} <span v-if="message.demo">· 示例</span></span
        >
      </div>
    </div>
    <div v-if="thinking" class="chat-row is-assistant">
      <span class="chat-avatar" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11 3L13.1 8.9L19 11L13.1 13.1L11 19L8.9 13.1L3 11L8.9 8.9L11 3Z"
            fill="currentColor"
            fill-opacity="0.18"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linejoin="round"
          />
          <path
            d="M18.5 15L19.4 17.6L22 18.5L19.4 19.4L18.5 22L17.6 19.4L15 18.5L17.6 17.6L18.5 15Z"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <div class="chat-body">
        <div v-if="streamingText" class="chat-bubble chat-rich-lines chat-streaming-bubble">
          <p
            v-for="(part, pi) in splitRichLines(streamingText)"
            :key="pi"
            class="chat-rich-line"
            :class="part.kind === 'knowledge' ? 'chat-rich-knowledge' : ''"
          >
            <span
              v-if="part.kind === 'knowledge'"
              class="knowledge-source-badge"
              aria-hidden="true"
            >
              <Icon name="book" :size="13" />
            </span>
            <span class="streaming-line-text"
              >{{ part.text
              }}<span
                v-if="pi === splitRichLines(streamingText).length - 1"
                class="stream-cursor"
                aria-hidden="true"
              ></span
            ></span>
          </p>
        </div>
        <div class="typing-bubble">
          <div class="typing-head">
            <i></i><i></i><i></i>
            <small v-if="reconnecting">网络波动，正在恢复…</small>
            <small v-else-if="cancelRequested">正在停止…</small>
            <small v-else>正在为你挑选商品…</small>
          </div>
        </div>
      </div>
    </div>
    <div v-if="error" class="inline-error"><Icon name="alert" :size="17" />{{ error }}</div>
  </section>
</template>
