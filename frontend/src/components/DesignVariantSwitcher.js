import { preview } from '../services/store.js';
import {
  CONSUMER_THEMES,
  ADMIN_THEMES,
  designTheme,
  setConsumerTheme,
  setAdminTheme,
  resetDesignTheme,
} from '../services/design-theme.js';
const { ref, computed, onMounted, onUnmounted } = Vue;

const SHORT_CONSUMER_BADGES = {
  taobao: '淘宝2025',
  jd: '京东PC',
  youpin: '小米有品',
  xiaohongshu: '小红书',
};

/** 嵌入式大厂 1:1 复刻切换器：内嵌于顶栏或侧栏底部，零 fixed 悬浮遮挡，预览模式自动隐藏。 */
export default {
  name: 'DesignVariantSwitcher',
  props: {
    compact: { type: Boolean, default: false },
    align: { type: String, default: 'right' },
  },
  setup(props) {
    const open = ref(false);
    const rootRef = ref(null);

    const alignClass = computed(() => {
      if (props.align === 'left') return 'align-left';
      if (props.align === 'up-left') return 'align-up-left';
      if (props.align === 'up-right') return 'align-up-right';
      return 'align-right';
    });

    const currentShortBadge = computed(
      () => SHORT_CONSUMER_BADGES[designTheme.consumer] || '淘宝2025',
    );

    function toggleOpen() {
      open.value = !open.value;
    }

    function onDocumentPointerDown(event) {
      if (!open.value) return;
      if (rootRef.value && !rootRef.value.contains(event.target)) {
        open.value = false;
      }
    }

    function onDocumentKeyDown(event) {
      if (open.value && event.key === 'Escape') {
        open.value = false;
      }
    }

    onMounted(() => {
      document.addEventListener('pointerdown', onDocumentPointerDown);
      document.addEventListener('keydown', onDocumentKeyDown);
    });

    onUnmounted(() => {
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    });

    return {
      preview,
      open,
      rootRef,
      alignClass,
      currentShortBadge,
      CONSUMER_THEMES,
      ADMIN_THEMES,
      designTheme,
      toggleOpen,
      setConsumerTheme,
      setAdminTheme,
      resetDesignTheme,
    };
  },
  template: `
    <div
      v-if="!preview"
      ref="rootRef"
      :class="['variant-switcher-inline', alignClass, { 'is-compact': compact, 'is-open': open }]"
    >
      <button
        type="button"
        :class="['variant-trigger-btn', { 'is-compact': compact, 'is-open': open }]"
        aria-label="切换大厂复刻版本"
        aria-haspopup="dialog"
        :aria-expanded="open ? 'true' : 'false'"
        @click="toggleOpen"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="variant-trigger-icon"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <circle cx="9" cy="7" r="2.2" fill="currentColor" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="15" cy="17" r="2.2" fill="currentColor" />
        </svg>
        <span v-if="compact" class="variant-trigger-text">大厂版</span>
        <span v-else class="variant-trigger-text">
          <span class="variant-trigger-prefix">切换大厂版 · </span>{{ currentShortBadge }}
        </span>
        <Icon :name="open ? 'chevronUp' : 'chevronDown'" :size="12" class="variant-trigger-chevron" />
      </button>

      <div
        v-if="open"
        class="variant-switcher-panel"
        role="dialog"
        aria-label="大厂 1:1 复刻切换"
      >
        <div class="variant-panel-head">
          <div class="variant-panel-title-wrap">
            <strong class="variant-panel-title">大厂 1:1 复刻切换</strong>
            <span class="variant-panel-sub">完整版式骨架 · 搜索头 · 货架与工作台</span>
          </div>
          <div class="variant-panel-actions">
            <button
              type="button"
              class="variant-reset-btn"
              @click="resetDesignTheme"
            >
              恢复默认
            </button>
            <button
              type="button"
              class="variant-close-btn"
              aria-label="收起风格面板"
              @click="open = false"
            >
              <Icon name="x" :size="15" />
            </button>
          </div>
        </div>

        <section class="variant-section">
          <h3 class="variant-section-label">消费端 1:1 大厂复刻（4 套完整布局）</h3>
          <div class="variant-grid-1">
            <button
              v-for="item in CONSUMER_THEMES"
              :key="item.id"
              type="button"
              :class="['variant-option-row', { 'is-active': designTheme.consumer === item.id }]"
              :aria-pressed="designTheme.consumer === item.id ? 'true' : 'false'"
              @click="setConsumerTheme(item.id)"
            >
              <span :class="['variant-swatch-pair', item.swatchClass]" aria-hidden="true">
                <i class="swatch-dot swatch-dot-a"></i>
                <i class="swatch-dot swatch-dot-b"></i>
              </span>
              <span class="variant-option-text">
                <strong>{{ item.name }}</strong>
                <small>{{ item.desc }}</small>
              </span>
              <span
                v-if="designTheme.consumer === item.id"
                class="variant-active-check"
                aria-hidden="true"
              >
                <Icon name="check" :size="14" />
              </span>
            </button>
          </div>
        </section>

        <section class="variant-section">
          <h3 class="variant-section-label">后台 1:1 大厂复刻（3 套完整工作台）</h3>
          <div class="variant-grid-1">
            <button
              v-for="item in ADMIN_THEMES"
              :key="item.id"
              type="button"
              :class="['variant-option-row', { 'is-active': designTheme.admin === item.id }]"
              :aria-pressed="designTheme.admin === item.id ? 'true' : 'false'"
              @click="setAdminTheme(item.id)"
            >
              <span :class="['variant-swatch-pair', item.swatchClass]" aria-hidden="true">
                <i class="swatch-dot swatch-dot-a"></i>
                <i class="swatch-dot swatch-dot-b"></i>
              </span>
              <span class="variant-option-text">
                <strong>{{ item.name }}</strong>
                <small>{{ item.desc }}</small>
              </span>
              <span
                v-if="designTheme.admin === item.id"
                class="variant-active-check"
                aria-hidden="true"
              >
                <Icon name="check" :size="14" />
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
};
