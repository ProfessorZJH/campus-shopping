const PREFIX = '/api/v1';
let csrf = null;
let csrfPromise = null;
let generation = 0;
let unauthorized = () => {};
export function onUnauthorized(handler) {
  unauthorized = handler;
}
function requireIdentity(stamp) {
  if (stamp !== generation) throw fail('登录身份已变化，请重试', 'IDENTITY_CHANGED', 0);
}
function fail(message, code, status) {
  return Object.assign(new Error(message), { code, status });
}
async function getCsrf() {
  if (csrfPromise) return csrfPromise;
  const stamp = generation;
  const pending = (async () => {
    const data = await api('/auth/csrf', { retry: false });
    requireIdentity(stamp);
    csrf = data;
    return csrf;
  })();
  csrfPromise = pending;
  try {
    return await pending;
  } finally {
    if (csrfPromise === pending) csrfPromise = null;
  }
}
/** 校验业务code，不能把HTTP 200当成执行成功。 */
export async function api(path, options = {}) {
  if ((options.method || 'GET') !== 'GET') return request(path, options);
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 15000);
  try {
    return await request(path, { ...options, signal: controller.signal });
  } catch (e) {
    if (timedOut) throw fail('请求超时，请重试', 'TIMEOUT', 0);
    throw e;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
async function request(path, { method = 'GET', body, signal, key, retry = true } = {}) {
  const stamp = generation;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    const token = csrf || (await getCsrf());
    requireIdentity(stamp);
    headers[token.headerName] = token.token;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  let r;
  try {
    r = await fetch(PREFIX + path, {
      method,
      headers,
      body: payload,
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw fail('服务连接失败，请确认 Java 后端已启动', 'NETWORK', 0);
  }
  let j;
  try {
    j = await r.json();
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw fail('服务器响应格式异常', 'RESPONSE', r.status);
  }
  requireIdentity(stamp);
  if (r.status === 401 || j.code === 'A0004') unauthorized();
  if (r.status === 403 && j.code === 'A0005' && retry) {
    csrf = null;
    await getCsrf();
    requireIdentity(stamp);
    return api(path, {
      method,
      body: payload === undefined ? undefined : JSON.parse(payload),
      signal,
      key,
      retry: false,
    });
  }
  if (!r.ok || j.code !== '0000') throw fail(j.info || '请求失败', j.code || 'HTTP', r.status);
  return j.data;
}
export const resetCsrf = () => {
  ++generation;
  csrf = null;
  csrfPromise = null;
};
export const query = (params) =>
  '?' +
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
export const idempotency = () => crypto.randomUUID();

/**
 * 流式请求适配器：使用 POST + fetch + ReadableStream，复用 CSRF 令牌。
 * 支持服务端 text/event-stream 流式打字输出，同时兼容 application/json 普通响应降级。
 */
export async function apiStream(path, { body, signal } = {}, { onDelta, onDone } = {}) {
  const stamp = generation;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const token = csrf || (await getCsrf());
  requireIdentity(stamp);

  const headers = {
    Accept: 'text/event-stream, application/json',
    'Content-Type': 'application/json',
    [token.headerName]: token.token,
  };

  let r;
  try {
    r = await fetch(PREFIX + path, {
      method: 'POST',
      headers,
      body: payload,
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw fail('服务连接失败，请确认 Java 后端已启动', 'NETWORK', 0);
  }

  requireIdentity(stamp);
  if (r.status === 401) {
    unauthorized();
    throw fail('请先登录账号', 'A0004', 401);
  }

  const contentType = r.headers.get('content-type') || '';
  // 兼容普通 JSON 响应降级
  if (contentType.includes('application/json')) {
    const j = await r.json();
    if (!r.ok || j.code !== '0000') throw fail(j.info || '请求失败', j.code || 'HTTP', r.status);
    if (onDelta && j.data?.answer) onDelta(j.data.answer);
    if (onDone) onDone(j.data);
    return j.data;
  }

  // SSE 流式解析 (text/event-stream)
  const reader = r.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalResult = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed.startsWith('data:')) {
          const rawData = trimmed.slice(5).trim();
          if (rawData === '[DONE]') continue;
          try {
            const parsed = JSON.parse(rawData);
            if (parsed.delta) onDelta?.(parsed.delta);
            if (parsed.done || parsed.proposal || parsed.conversationId) {
              finalResult = { ...finalResult, ...parsed };
            }
          } catch {
            // 普通文本 chunk 直接作为增量内容
            onDelta?.(rawData);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (onDone) onDone(finalResult);
  return finalResult;
}
