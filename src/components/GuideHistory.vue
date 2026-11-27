<script setup lang="ts">
interface Conversation {
  id: string;
  summary?: string;
  title?: string;
  lastActiveAt?: string;
  createdAt?: string;
}
defineProps<{
  open: boolean;
  conversations: Conversation[];
  thinking: boolean;
  openingConversation: boolean;
  confirmingProposal: boolean;
  hasMore: boolean;
  loading: boolean;
  formatTime: (time?: string) => string;
}>();
defineEmits<{
  new: [];
  toggle: [];
  open: [conversation: Conversation];
  more: [];
}>();
</script>

<template>
  <div class="ai-history-head">
    <button
      class="ai-new-chat"
      :disabled="openingConversation || confirmingProposal"
      @click="$emit('new')"
    >
      <Icon name="plus" :size="15" /> 新对话
    </button>
    <button :aria-expanded="open" @click="$emit('toggle')">
      <Icon name="clock" :size="15" /> 历史会话 <Icon name="chevronDown" :size="14" />
    </button>
  </div>
  <div v-if="open" class="ai-history-list">
    <button
      v-for="conversation in conversations"
      :key="conversation.id"
      :disabled="thinking || openingConversation"
      @click="$emit('open', conversation)"
    >
      <Icon name="order" :size="16" />
      <span class="ai-history-copy">
        <strong>{{ conversation.summary || conversation.title || '对话' }}</strong>
        <small>{{ formatTime(conversation.lastActiveAt || conversation.createdAt) }}</small>
      </span>
      <Icon name="chevronRight" :size="14" />
    </button>
    <span v-if="!conversations.length">暂无历史记录</span>
    <button v-if="hasMore" :disabled="loading" @click="$emit('more')">加载更多会话</button>
  </div>
</template>
