<script setup lang="ts">
withDefaults(
  defineProps<{
    page: number;
    hasNext: boolean;
    busy?: boolean;
    label?: string;
  }>(),
  { busy: false, label: '分页' },
);

const emit = defineEmits<{ previous: []; next: [] }>();
</script>

<template>
  <nav class="sdd-pager" :aria-label="label">
    <span v-if="$slots.default"><slot /></span>
    <button type="button" :disabled="busy || page <= 1" @click="emit('previous')">上一页</button>
    <span :aria-label="`第 ${page} 页`">{{ page }}</span>
    <button type="button" :disabled="busy || !hasNext" @click="emit('next')">下一页</button>
  </nav>
</template>
