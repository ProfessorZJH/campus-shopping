const { reactive } = Vue;

const STORAGE_KEY = 'campus_ui_theme_v8';

export const CONSUMER_THEMES = [
  {
    id: 'taobao',
    name: '淘宝 2025 PC',
    label: '淘宝 2025 PC',
    shortName: '淘宝2025',
    desc: '顶栏+橙色大搜索+三栏好店+6列猜你喜欢（默认）',
    swatchClass: 'swatch-taobao',
  },
  {
    id: 'jd',
    name: '京东 PC 版',
    label: '京东 PC 版',
    shortName: '京东PC',
    desc: '京东红方正搜索+秒杀横条+4块货架首屏',
    swatchClass: 'swatch-jd',
  },
  {
    id: 'youpin',
    name: '小米有品 PC',
    label: '小米有品 PC',
    shortName: '小米有品',
    desc: '深黑顶栏+深棕悬浮分类大图+极简画廊',
    swatchClass: 'swatch-youpin',
  },
  {
    id: 'xiaohongshu',
    name: '小红书 Web',
    label: '小红书 Web',
    shortName: '小红书',
    desc: '左侧固定竖导航+无横幅4:5笔记瀑布流',
    swatchClass: 'swatch-xiaohongshu',
  },
];

export const ADMIN_THEMES = [
  {
    id: 'antd',
    name: '阿里 AntD / 千牛',
    label: '阿里 AntD / 千牛',
    shortName: 'AntD 千牛',
    desc: '深海蓝顶栏+4张分析卡+趋势&热销双拼卡（默认）',
    swatchClass: 'swatch-antd',
  },
  {
    id: 'arco',
    name: '字节 Arco Pro',
    label: '字节 Arco Pro',
    shortName: 'Arco Pro',
    desc: '通栏白顶栏+左7右3工作台+一体式指标卡',
    swatchClass: 'swatch-arco',
  },
  {
    id: 'meituan',
    name: '美团商家版',
    label: '美团商家版',
    shortName: '美团商家',
    desc: '深蓝灰全高侧栏+顶部暖金核销指挥条',
    swatchClass: 'swatch-meituan',
  },
];

const DEFAULTS = {
  consumer: 'taobao',
  admin: 'antd',
};

const VALID_CONSUMER = new Set(CONSUMER_THEMES.map((item) => item.id));
const VALID_ADMIN = new Set(ADMIN_THEMES.map((item) => item.id));

export const designTheme = reactive({
  consumer: DEFAULTS.consumer,
  admin: DEFAULTS.admin,
  showcase: false,
  searchDraft: '',
});

function detectShowcaseMode(searchParams, hashParams) {
  if (typeof document !== 'undefined' && document.documentElement?.dataset?.showcaseEntry === '1') {
    return true;
  }
  return (
    searchParams.get('showcase') === '1' ||
    hashParams.get('showcase') === '1' ||
    searchParams.has('ct') ||
    searchParams.has('at') ||
    hashParams.has('ct') ||
    hashParams.has('at')
  );
}

function normalizeConsumer(id) {
  return VALID_CONSUMER.has(id) ? id : DEFAULTS.consumer;
}

function normalizeAdmin(id) {
  return VALID_ADMIN.has(id) ? id : DEFAULTS.admin;
}

function readStoredTheme() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function persistTheme() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        consumer: designTheme.consumer,
        admin: designTheme.admin,
      }),
    );
  } catch {
    // 隐私模式或受限沙箱下忽略本地存储写入异常，保持内存态生效。
  }
}

function parseHashQuery() {
  const rawHash = window.location.hash || '';
  const queryIdx = rawHash.indexOf('?');
  return new URLSearchParams(queryIdx >= 0 ? rawHash.slice(queryIdx + 1) : '');
}

function applyDataset() {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;
  root.dataset.consumerTheme = designTheme.consumer;
  root.dataset.adminTheme = designTheme.admin;
}

let hashListenerInstalled = false;

function syncFromHashQuery() {
  const searchParams = new URLSearchParams(window.location.search || '');
  const hashParams = parseHashQuery();
  if (detectShowcaseMode(searchParams, hashParams)) {
    designTheme.showcase = true;
  }
  let changed = false;

  if (hashParams.has('ct')) {
    const nextConsumer = normalizeConsumer(hashParams.get('ct'));
    if (designTheme.consumer !== nextConsumer) {
      designTheme.consumer = nextConsumer;
      changed = true;
    }
  }

  if (hashParams.has('at')) {
    const nextAdmin = normalizeAdmin(hashParams.get('at'));
    if (designTheme.admin !== nextAdmin) {
      designTheme.admin = nextAdmin;
      changed = true;
    }
  }

  if (changed) {
    applyDataset();
    if (designTheme.showcase) persistTheme();
  } else if (hashParams.has('ct') || hashParams.has('at')) {
    applyDataset();
    if (designTheme.showcase) persistTheme();
  }
}

export function initDesignTheme() {
  const searchParams = new URLSearchParams(window.location.search || '');
  const hashParams = parseHashQuery();
  const showcase = detectShowcaseMode(searchParams, hashParams);
  designTheme.showcase = showcase;

  // 正式环境默认锁定为淘宝 2025 PC + 阿里 AntD/千牛，不读取历史实验缓存，保持单品牌视觉纯净；
  // 仅在 GitHub Pages 展示页或显式传入 ?showcase=1 / ?ct= / ?at= 时启用多套大厂复刻切换。
  const saved = showcase ? readStoredTheme() : null;

  const rawConsumer = showcase
    ? (hashParams.get('ct') ?? searchParams.get('ct') ?? saved?.consumer ?? DEFAULTS.consumer)
    : DEFAULTS.consumer;
  const rawAdmin = showcase
    ? (hashParams.get('at') ?? searchParams.get('at') ?? saved?.admin ?? DEFAULTS.admin)
    : DEFAULTS.admin;

  designTheme.consumer = normalizeConsumer(rawConsumer);
  designTheme.admin = normalizeAdmin(rawAdmin);

  applyDataset();

  if (
    showcase &&
    (hashParams.has('ct') ||
      hashParams.has('at') ||
      searchParams.has('ct') ||
      searchParams.has('at'))
  ) {
    persistTheme();
  }

  if (!hashListenerInstalled && typeof window !== 'undefined') {
    window.addEventListener('hashchange', syncFromHashQuery);
    hashListenerInstalled = true;
  }
}

export function setConsumerTheme(id) {
  designTheme.consumer = normalizeConsumer(id);
  applyDataset();
  persistTheme();
}

export function setAdminTheme(id) {
  designTheme.admin = normalizeAdmin(id);
  applyDataset();
  persistTheme();
}

export function resetDesignTheme() {
  designTheme.consumer = DEFAULTS.consumer;
  designTheme.admin = DEFAULTS.admin;
  applyDataset();
  persistTheme();
}
