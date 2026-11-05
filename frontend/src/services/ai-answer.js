const AI_MODE_LABELS = {
  LLM: '大模型回答',
  LOCAL_RETRIEVAL_DEMO: '本地检索演示',
  LOCAL_FALLBACK: '本地降级回答',
};
const RETRIEVAL_MODE_LABELS = {
  REMOTE_EMBEDDING: '远程向量检索',
  LOCAL_CHAR_NGRAM_DEMO: '本地字面检索',
  BM25_DEGRADED: 'BM25 降级',
};

const text = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
const label = (labels, key) =>
  typeof key === 'string' && Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : '';

export function aiModeLabel(mode) {
  return label(AI_MODE_LABELS, mode);
}

export function aiModeClass(mode) {
  return aiModeLabel(mode) ? 'ai-mode-' + mode.toLowerCase().replace(/_/g, '-') : '';
}

export function retrievalModeLabel(mode) {
  return label(RETRIEVAL_MODE_LABELS, mode);
}

export function normalizeLatency(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function toCitation(value) {
  if (!value || typeof value !== 'object') return null;
  const title = text(value.title);
  const snippet = text(value.snippet);
  if (!title && !snippet) return null;
  return {
    documentId: text(value.documentId),
    title: title || '未命名来源',
    snippet,
  };
}

export function toAssistantMessage(answer, time) {
  const source = answer && typeof answer === 'object' ? answer : {};
  return {
    role: 'assistant',
    content: text(source.answer) || '暂时没有找到合适答案',
    warning: text(source.warning),
    mode: text(source.mode),
    retrievalMode: text(source.retrievalMode),
    latencyMs: normalizeLatency(source.latencyMs),
    citations: (Array.isArray(source.citations) ? source.citations : [])
      .map(toCitation)
      .filter(Boolean),
    time,
  };
}
