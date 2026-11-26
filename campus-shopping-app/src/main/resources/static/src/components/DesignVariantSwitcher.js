import { preview } from '../services/store.js';
import {
  CONSUMER_THEMES,
  HOME_LAYOUTS,
  ADMIN_THEMES,
  designTheme,
  setConsumerTheme,
  setHomeLayout,
  setAdminTheme,
  resetDesignTheme,
} from '../services/design-theme.js';
const { ref, onMounted, onUnmounted } = Vue;

/** 大厂视觉方案实时切换器：支持 4 套消费端主题 × 2 套首页首屏 × 3 套后台设计系统，预览模式自动隐藏。 */
export default {
  name: 'DesignVariantSwitcher',
  setup() {
    const open = ref(false);
    const rootRef = ref(null);

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
      CONSUMER_THEMES,
      HOME_LAYOUTS,
      ADMIN_THEMES,
      designTheme,
      toggleOpen,
      setConsumerTheme,
      setHomeLayout,
      setAdminTheme,
      resetDesignTheme,
    };
  },
  template: `
    <div v-if="!preview" ref="rootRef" class="variant-switcher">
      <div
        v-if="open"
        class="variant-switcher-panel"
        role="dialog"
        aria-label="大厂风格方案对比"
      >
        <div class="variant-panel-head">
          <div class="variant-panel-title-wrap">
            <strong class="variant-panel-title">大厂视觉方案对比</strong>
            <span class="variant-panel-sub">实时切换前台商城与后台工作台</span>
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
          <h3 class="variant-section-label">消费端风格（4 套）</h3>
          <div class="variant-grid-2">
            <button
              v-for="item in CONSUMER_THEMES"
              :key="item.id"
              type="button"
              :class="['variant-option-card', { 'is-active': designTheme.consumer === item.id }]"
              :aria-pressed="designTheme.consumer === item.id ? 'true' : 'false'"
              @click="setConsumerTheme(item.id)"
            >
              <span :class="['variant-swatch-pair', item.swatchClass]" aria-hidden="true">
                <i class="swatch-dot swatch-dot-a"></i>
                <i class="swatch-dot swatch-dot-b"></i>
              </span>
              <span class="variant-option-text">
                <strong>{{ item.label }}</strong>
                <small>{{ item.desc }}</small>
              </span>
            </button>
          </div>
        </section>

        <section class="variant-section">
          <h3 class="variant-section-label">首页首屏结构（2 套）</h3>
          <div class="variant-grid-2">
            <button
              v-for="item in HOME_LAYOUTS"
              :key="item.id"
              type="button"
              :class="['variant-option-card', 'variant-layout-card', { 'is-active': designTheme.layout === item.id }]"
              :aria-pressed="designTheme.layout === item.id ? 'true' : 'false'"
              @click="setHomeLayout(item.id)"
            >
              <span class="variant-option-text">
                <strong>{{ item.label }}</strong>
                <small>{{ item.desc }}</small>
              </span>
            </button>
          </div>
        </section>

        <section class="variant-section">
          <h3 class="variant-section-label">商家 / 平台后台（3 套）</h3>
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
                <strong>{{ item.label }}</strong>
                <small>{{ item.desc }}</small>
              </span>
            </button>
          </div>
        </section>
      </div>

      <button
        type="button"
        class="variant-switcher-fab"
        aria-label="切换大厂视觉方案"
        :aria-expanded="open ? 'true' : 'false'"
        @click="toggleOpen"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <circle cx="9" cy="7" r="2.2" fill="currentColor" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="15" cy="17" r="2.2" fill="currentColor" />
        </svg>
        <span>换风格</span>
      </button>
    </div>
  `,
};
