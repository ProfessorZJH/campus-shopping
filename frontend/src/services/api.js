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

/** 读取独立 SSE 协议；事件数据始终是 JSON，断线由调用方决定是否恢复原会话。 */
export async function stream(path, { body, signal, onEvent, retry = true } = {}) {
  const stamp = generation;
  const token = csrf || (await getCsrf());
  requireIdentity(stamp);
  const headers = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    [token.headerName]: token.token,
  };
  let response;
  try {
    response = await fetch(PREFIX + path, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw fail('服务连接失败，请确认 Java 后端已启动', 'NETWORK', 0);
  }
  if (response.status === 403 && retry) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {}
    if (payload?.code === 'A0005') {
      csrf = null;
      await getCsrf();
      requireIdentity(stamp);
      return stream(path, { body, signal, onEvent, retry: false });
    }
  }
  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {}
    if (response.status === 401 || payload?.code === 'A0004') unauthorized();
    throw fail(payload?.info || '请求失败', payload?.code || 'HTTP', response.status);
  }
  if (!response.body) throw fail('服务器没有返回流式响应', 'RESPONSE', response.status);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let data = [];
  const dispatch = async () => {
    if (!eventName && !data.length) return;
    const raw = data.join('\n');
    const name = eventName || 'message';
    eventName = '';
    data = [];
    if (!raw) return;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw fail('服务器响应格式异常', 'RESPONSE', response.status);
    }
    requireIdentity(stamp);
    if (onEvent) await onEvent(name, payload);
  };
  const consume = async (line) => {
    if (line.length > 65536) throw fail('流式响应超过大小限制', 'RESPONSE', response.status);
    if (!line) return dispatch();
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) {
      data.push(line.slice(5).trim());
      if (data.join('\n').length > 1_000_000)
        throw fail('流式响应超过大小限制', 'RESPONSE', response.status);
    }
  };
  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, '');
      buffer = buffer.slice(end + 1);
      await consume(line);
    }
    if (chunk.done) break;
  }
  if (buffer) await consume(buffer.replace(/\r$/, ''));
  await dispatch();
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
