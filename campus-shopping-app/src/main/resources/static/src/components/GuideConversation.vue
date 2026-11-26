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

const robotImage = './images/robot.webp';

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
        <span class="chat-welcome-icon"><Icon name="sparkles" :size="19" /></span>
        <div>
          <h2>今天想买点什么？</h2>
          <p>说出预算、口味或场景，直接帮你挑好商品</p>
        </div>
      </div>
      <div class="wenwen-scene-grid">
        <div class="wenwen-scene-card">
          <strong>深夜夜宵</strong><small>30元内搭配泡面与冰饮</small>
        </div>
        <div class="wenwen-scene-card">
          <strong>课间咖啡</strong><small>生椰冰拿铁或鲜牛奶</small>
        </div>
        <div class="wenwen-scene-card">
          <strong>查订单进度</strong><small>直接问“我的餐备好了吗”</small>
        </div>
      </div>
    </div>
    <div
      v-for="(message, index) in messages"
      :key="index"
      class="chat-row"
      :class="message.role === 'user' ? 'is-user' : 'is-assistant'"
    >
      <span v-if="message.role !== 'user'" class="chat-avatar"
        ><img :src="robotImage" alt="AI"
      /></span>
      <div class="chat-body">
        <div v-if="message.role === 'user'" class="chat-bubble">{{ message.content }}</div>
        <div v-else class="chat-bubble chat-rich-lines">
          <p
            v-for="(part, pi) in splitRichLines(message.content)"
            :key="pi"
            class="chat-rich-line"
            :class="part.kind === 'knowledge' ? 'chat-rich-knowledge' : ''"
          >
            {{ part.text }}
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
            <summary><Icon name="book" :size="12" />{{ citation.title || '参考说明' }}</summary>
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
      <span class="chat-avatar"><img :src="robotImage" alt="AI" /></span>
      <div class="chat-body">
        <div v-if="streamingText" class="chat-bubble chat-rich-lines chat-streaming-bubble">
          <p
            v-for="(part, pi) in splitRichLines(streamingText)"
            :key="pi"
            class="chat-rich-line"
            :class="part.kind === 'knowledge' ? 'chat-rich-knowledge' : ''"
          >
            {{ part.text
            }}<span
              v-if="pi === splitRichLines(streamingText).length - 1"
              class="stream-cursor"
              aria-hidden="true"
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
