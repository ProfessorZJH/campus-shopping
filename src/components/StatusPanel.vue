<script setup lang="ts">
import Icon from './Icon.js';

type PanelState = 'loading' | 'empty' | 'error';

withDefaults(
  defineProps<{
    state: PanelState;
    message?: string;
    actionLabel?: string;
    busy?: boolean;
  }>(),
  { message: '', actionLabel: '', busy: false },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <section
    class="status-panel surface-card"
    :class="`status-panel--${state}`"
    :role="state === 'error' ? 'alert' : 'status'"
    :aria-live="state === 'error' ? 'assertive' : 'polite'"
  >
    <span v-if="state === 'loading'" class="mini-spinner" aria-hidden="true"></span>
    <Icon v-else :name="state === 'error' ? 'alert' : 'order'" :size="26" aria-hidden="true" />
    <div class="status-panel-copy">
      <strong>{{ state === 'loading' ? message || '正在加载…' : message }}</strong>
    </div>
    <button
      v-if="actionLabel && state !== 'loading'"
      type="button"
      class="outline-button"
      :disabled="busy"
      @click="emit('retry')"
    >
      {{ actionLabel }}
    </button>
  </section>
</template>
