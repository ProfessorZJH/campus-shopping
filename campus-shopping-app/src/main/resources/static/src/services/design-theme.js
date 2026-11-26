const { reactive } = Vue;

const STORAGE_KEY = 'campus_ui_theme_v7';

export const CONSUMER_THEMES = [
  {
    id: 'taobao',
    label: '淘宝 2025 / 京东',
    desc: '橙红高转化潮流零售',
    swatchClass: 'swatch-taobao',
  },
  {
    id: 'youpin',
    label: '小米有品 / 严选',
    desc: '黑金极简精品生活',
    swatchClass: 'swatch-youpin',
  },
  {
    id: 'hema',
    label: '盒马 / 山姆',
    desc: '品质生鲜蓝橙双色',
    swatchClass: 'swatch-hema',
  },
  {
    id: 'dingdong',
    label: '叮咚买菜 / 小象',
    desc: '明快即时鲜绿零售',
    swatchClass: 'swatch-dingdong',
  },
];

export const HOME_LAYOUTS = [
  {
    id: 'classic',
    label: '经典三栏大片首屏',
    desc: '分类侧栏 + 摄影轮播 + AI 导购舱',
  },
  {
    id: 'feed',
    label: '逛逛极简高密流',
    desc: '小红书 / 逛逛首屏直出五列商品流',
  },
];

export const ADMIN_THEMES = [
  {
    id: 'arco',
    label: '字节 Arco / 抖店后台',
    desc: '纯白侧栏 · 科技蓝 #165DFF',
    swatchClass: 'swatch-arco',
  },
  {
    id: 'antd',
    label: '阿里 AntD 5 / 千牛工作台',
    desc: '纯白侧栏 · 右侧竖标企业蓝',
    swatchClass: 'swatch-antd',
  },
  {
    id: 'meituan',
    label: '美团商家工具风',
    desc: '深蓝灰侧栏 · 金黄高光焦点',
    swatchClass: 'swatch-meituan',
  },
];

const DEFAULTS = {
  consumer: 'taobao',
  layout: 'classic',
  admin: 'arco',
};

const VALID_CONSUMER = new Set(CONSUMER_THEMES.map((item) => item.id));
const VALID_LAYOUT = new Set(HOME_LAYOUTS.map((item) => item.id));
const VALID_ADMIN = new Set(ADMIN_THEMES.map((item) => item.id));

export const designTheme = reactive({
  consumer: DEFAULTS.consumer,
  layout: DEFAULTS.layout,
  admin: DEFAULTS.admin,
});

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
        layout: designTheme.layout,
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
  root.dataset.homeLayout = designTheme.layout;
  root.dataset.adminTheme = designTheme.admin;
}

let hashListenerInstalled = false;

function syncFromHashQuery() {
  const hashParams = parseHashQuery();
  const ct = hashParams.get('ct');
  const hl = hashParams.get('hl');
  const at = hashParams.get('at');
  let changed = false;

  if (ct && VALID_CONSUMER.has(ct) && designTheme.consumer !== ct) {
    designTheme.consumer = ct;
    changed = true;
  }
  if (hl && VALID_LAYOUT.has(hl) && designTheme.layout !== hl) {
    designTheme.layout = hl;
    changed = true;
  }
  if (at && VALID_ADMIN.has(at) && designTheme.admin !== at) {
    designTheme.admin = at;
    changed = true;
  }

  if (changed) {
    applyDataset();
    persistTheme();
  }
}

export function initDesignTheme() {
  const saved = readStoredTheme();
  const searchParams = new URLSearchParams(window.location.search || '');
  const hashParams = parseHashQuery();

  const nextConsumer =
    hashParams.get('ct') || searchParams.get('ct') || saved?.consumer || DEFAULTS.consumer;
  const nextLayout =
    hashParams.get('hl') || searchParams.get('hl') || saved?.layout || DEFAULTS.layout;
  const nextAdmin =
    hashParams.get('at') || searchParams.get('at') || saved?.admin || DEFAULTS.admin;

  designTheme.consumer = VALID_CONSUMER.has(nextConsumer) ? nextConsumer : DEFAULTS.consumer;
  designTheme.layout = VALID_LAYOUT.has(nextLayout) ? nextLayout : DEFAULTS.layout;
  designTheme.admin = VALID_ADMIN.has(nextAdmin) ? nextAdmin : DEFAULTS.admin;

  applyDataset();

  if (
    hashParams.has('ct') ||
    hashParams.has('hl') ||
    hashParams.has('at') ||
    searchParams.has('ct') ||
    searchParams.has('hl') ||
    searchParams.has('at')
  ) {
    persistTheme();
  }

  if (!hashListenerInstalled && typeof window !== 'undefined') {
    window.addEventListener('hashchange', syncFromHashQuery);
    hashListenerInstalled = true;
  }
}

export function setConsumerTheme(id) {
  if (!VALID_CONSUMER.has(id)) return;
  designTheme.consumer = id;
  applyDataset();
  persistTheme();
}

export function setHomeLayout(id) {
  if (!VALID_LAYOUT.has(id)) return;
  designTheme.layout = id;
  applyDataset();
  persistTheme();
}

export function setAdminTheme(id) {
  if (!VALID_ADMIN.has(id)) return;
  designTheme.admin = id;
  applyDataset();
  persistTheme();
}

export function resetDesignTheme() {
  designTheme.consumer = DEFAULTS.consumer;
  designTheme.layout = DEFAULTS.layout;
  designTheme.admin = DEFAULTS.admin;
  applyDataset();
  persistTheme();
}
