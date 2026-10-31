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
    const r = await fetch(PREFIX + '/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    let j;
    try {
      j = await r.json();
    } catch {
      throw fail('安全令牌响应异常', 'RESPONSE', r.status);
    }
    if (!r.ok || j.code !== '0000') throw fail('无法获取安全令牌', j.code, r.status);
    requireIdentity(stamp);
    csrf = j.data;
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
export async function api(path, { method = 'GET', body, signal, key, retry = true } = {}) {
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
  } catch {
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
