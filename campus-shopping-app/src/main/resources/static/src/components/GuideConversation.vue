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
  error: string;
}>();
</script>

<template>
  <section class="chat-thread" aria-label="AI对话">
    <div v-if="!messages.length" class="chat-welcome">
      <span class="chat-welcome-icon"><Icon name="sparkles" :size="22" /></span>
      <h2>你好，同学。</h2>
      <p>告诉我预算或想买的东西。</p>
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
        <div class="chat-bubble">{{ message.content }}</div>
        <div v-if="message.warning" class="message-warning">{{ message.warning }}</div>
        <div v-if="message.citations?.length" class="citation-chips">
          <details
            v-for="(citation, ci) in message.citations"
            :key="citation.documentId || ci"
            class="citation-chip"
          >
            <summary><Icon name="book" :size="12" />{{ citation.title || '参考资料' }}</summary>
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
          >{{ message.time || '刚刚' }} <span v-if="message.demo">· 示例回答</span></span
        >
      </div>
    </div>
    <div v-if="thinking" class="chat-row is-assistant">
      <span class="chat-avatar"><img :src="robotImage" alt="AI" /></span>
      <div class="typing-bubble">
        <i></i><i></i><i></i>
        <small v-if="reconnecting">连接已断开，正在恢复原会话…</small>
        <small v-else-if="cancelRequested">正在停止本轮生成…</small>
        <small v-else-if="streamProgress">已读取 {{ streamProgress }} 字节</small>
      </div>
    </div>
    <div v-if="error" class="inline-error"><Icon name="alert" :size="17" />{{ error }}</div>
  </section>
</template>
