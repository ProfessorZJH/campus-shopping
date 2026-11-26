<script setup lang="ts">
import { computed } from 'vue';

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

const props = defineProps<{
  messages: Message[];
  thinking: boolean;
  reconnecting: boolean;
  cancelRequested: boolean;
  streamProgress: number;
  streamStage?: string;
  streamingText?: string;
  error: string;
}>();

const STAGES = [
  { key: 'recall', label: '① 召回现货与规则' },
  { key: 'generating', label: '② 模型匹配方案' },
  { key: 'verifying', label: '③ 复核库存价格' },
];

const stageRank = computed(() => {
  if (props.streamStage === 'verifying') return 2;
  if (props.streamStage === 'generating' || props.streamProgress > 0) return 1;
  return 0;
});

function splitRichLines(content: string): { kind: 'knowledge' | 'note' | 'text'; text: string }[] {
  const lines = String(content || '')
    .split('\n')
    .filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    if (line.startsWith('《')) return { kind: 'knowledge', text: line };
    if (line.startsWith('确认后只加入购物车') || line.startsWith('根据当前允许访问的知识资料')) {
      return { kind: 'note', text: line };
    }
    return { kind: 'text', text: line };
  });
}
function friendlyWarning(raw?: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (text.includes('远程模型不可用')) {
    return '✨ 已通过校内现货检索引擎为您匹配商品与门店规则（库存价格实时核验）';
  }
  return text;
}
</script>

<template>
  <section class="chat-thread" aria-label="AI对话">
    <div v-if="!messages.length" class="chat-welcome wenwen-welcome">
      <div class="wenwen-welcome-head">
        <span class="chat-welcome-icon"><Icon name="sparkles" :size="20" /></span>
        <div>
          <h2>Hi 同学，今天想喝点或买点什么？</h2>
          <p>支持跨店预算凑单、无糖/低卡筛选、门店营业时间咨询与个人自提进度秒查</p>
        </div>
      </div>
      <div class="wenwen-scene-grid">
        <div class="wenwen-scene-card">
          <strong>🍜 深夜复习夜宵</strong><small>30元配齐热汤泡面+零食+冰饮</small>
        </div>
        <div class="wenwen-scene-card">
          <strong>☕ 早八课间提神</strong><small>生椰冰拿铁 / 巴氏鲜奶顺路取</small>
        </div>
        <div class="wenwen-scene-card">
          <strong>🎫 实时取餐查询</strong><small>直接问“我的订单备好货了吗”</small>
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
            :class="
              part.kind === 'knowledge'
                ? 'chat-rich-knowledge'
                : part.kind === 'note'
                  ? 'chat-rich-note'
                  : ''
            "
          >
            {{ part.text }}
          </p>
        </div>
        <div v-if="message.warning" class="message-warning">
          {{ friendlyWarning(message.warning) }}
        </div>
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
      <div class="chat-body">
        <div v-if="streamingText" class="chat-bubble chat-rich-lines chat-streaming-bubble">
          <p
            v-for="(part, pi) in splitRichLines(streamingText)"
            :key="pi"
            class="chat-rich-line"
            :class="
              part.kind === 'knowledge'
                ? 'chat-rich-knowledge'
                : part.kind === 'note'
                  ? 'chat-rich-note'
                  : ''
            "
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
            <small v-if="reconnecting">网络波动，正在恢复对话…</small>
            <small v-else-if="cancelRequested">正在停止…</small>
            <small v-else-if="streamingText">正在实时输出回复…</small>
            <small v-else-if="streamProgress">正在为你挑选合适商品…</small>
            <small v-else>正在分析你的需求…</small>
          </div>
          <div v-if="!reconnecting && !cancelRequested" class="typing-stages">
            <span
              v-for="(stage, idx) in STAGES"
              :key="stage.key"
              class="typing-stage-pill"
              :class="{ done: idx < stageRank, active: idx === stageRank }"
            >
              {{ stage.label }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="error" class="inline-error"><Icon name="alert" :size="17" />{{ error }}</div>
  </section>
</template>
