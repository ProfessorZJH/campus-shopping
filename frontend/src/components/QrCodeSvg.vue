<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    value: string;
    label?: string;
  }>(),
  {
    value: '',
    label: '核验二维码',
  },
);

const SIZE = 25;

function inFinderArea(x: number, y: number): boolean {
  return (x < 8 && y < 8) || (x >= SIZE - 8 && y < 8) || (x < 8 && y >= SIZE - 8);
}

function finderBit(x: number, y: number): boolean {
  const localX = x < 8 ? x : x - (SIZE - 7);
  const localY = y < 8 ? y : y - (SIZE - 7);
  if (localX < 0 || localY < 0 || localX >= 7 || localY >= 7) return false;
  if (localX === 0 || localX === 6 || localY === 0 || localY === 6) return true;
  if (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4) return true;
  return false;
}

function inAlignment(x: number, y: number): boolean {
  return x >= 16 && x <= 20 && y >= 16 && y <= 20;
}

function alignmentBit(x: number, y: number): boolean {
  const dx = Math.abs(x - 18);
  const dy = Math.abs(y - 18);
  return dx === 2 || dy === 2 || (dx === 0 && dy === 0);
}

function buildMatrix(raw: string): { k: string; x: number; y: number }[] {
  const text = String(raw || 'CAMPUS-PICKUP');
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= ch + (i + 1) * 31;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  let state = (h1 ^ (h2 << 13) ^ (h2 >>> 17) ^ 0xa5a55a5a) >>> 0;
  if (state === 0) state = 0x12345678;
  const nextBit = (idx: number): boolean => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const ch = text.charCodeAt(idx % text.length);
    return (((state >>> (idx % 16)) ^ (ch >>> (idx % 7))) & 1) === 1;
  };

  const cells: { k: string; x: number; y: number }[] = [];
  let dataIndex = 0;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let dark = false;
      if (inFinderArea(x, y)) {
        dark = finderBit(x, y);
      } else if (inAlignment(x, y)) {
        dark = alignmentBit(x, y);
      } else if (x === 6 || y === 6) {
        dark = (x + y) % 2 === 0;
      } else if (x === 8 && y === SIZE - 8) {
        dark = true;
      } else {
        dark = nextBit(dataIndex);
        dataIndex += 1;
      }
      if (dark) {
        cells.push({ k: `${x}-${y}`, x, y });
      }
    }
  }
  return cells;
}

const modules = computed(() => buildMatrix(props.value));
</script>

<template>
  <svg
    class="qr-svg"
    viewBox="0 0 29 29"
    role="img"
    :aria-label="label"
    shape-rendering="crispEdges"
  >
    <rect x="0" y="0" width="29" height="29" rx="1.5" class="qr-bg" />
    <rect
      v-for="m in modules"
      :key="m.k"
      :x="m.x + 2"
      :y="m.y + 2"
      width="1"
      height="1"
      class="qr-cell"
    />
  </svg>
</template>
