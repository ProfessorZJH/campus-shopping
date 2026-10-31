import test from 'node:test';
import assert from 'node:assert/strict';
import { api, resetCsrf, onUnauthorized } from '../src/services/api.js';
const response = (data, status = 200, code = '0000') =>
  new Response(JSON.stringify({ data, code }), { status });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { resolve, promise };
};

test('old CSRF completion cannot replace token or clear new pending request', async () => {
  resetCsrf();
  const old = deferred(),
    fresh = deferred(),
    writes = [];
  let tokens = 0;
  globalThis.fetch = (url, options) => {
    if (url.endsWith('/auth/csrf')) return (++tokens === 1 ? old : fresh).promise;
    writes.push(options.headers['X-CSRF-TOKEN']);
    return Promise.resolve(response(null));
  };
  const first = api('/cart', { method: 'PUT', body: { quantity: 1 } });
  const rejected = assert.rejects(first, { code: 'IDENTITY_CHANGED' });
  resetCsrf();
  const second = api('/cart', { method: 'PUT', body: { quantity: 2 } });
  old.resolve(response({ headerName: 'X-CSRF-TOKEN', token: 'old' }));
  await rejected;
  const third = api('/cart', { method: 'PUT', body: { quantity: 3 } });
  assert.equal(tokens, 2);
  fresh.resolve(response({ headerName: 'X-CSRF-TOKEN', token: 'new' }));
  await Promise.all([second, third]);
  assert.deepEqual(writes, ['new', 'new']);
});

test('delayed previous-account 401 does not expire the new account', async () => {
  resetCsrf();
  const old = deferred();
  let expired = 0;
  onUnauthorized(() => expired++);
  globalThis.fetch = () => old.promise;
  const pending = api('/orders');
  const rejected = assert.rejects(pending, { code: 'IDENTITY_CHANGED' });
  resetCsrf();
  old.resolve(response(null, 401, 'A0004'));
  await rejected;
  assert.equal(expired, 0);
  globalThis.fetch = async () => response(null, 401, 'A0004');
  await assert.rejects(api('/orders'), { status: 401 });
  assert.equal(expired, 1);
});

test('403 from an old identity cannot retry a write under the new identity', async () => {
  resetCsrf();
  const old = deferred();
  let writes = 0;
  globalThis.fetch = (url) =>
    url.endsWith('/auth/csrf')
      ? Promise.resolve(response({ headerName: 'X-CSRF-TOKEN', token: 'one' }))
      : (writes++, old.promise);
  const pending = api('/orders', { method: 'POST', body: { merchantId: 'one' } });
  const rejected = assert.rejects(pending, { code: 'IDENTITY_CHANGED' });
  await new Promise((r) => setTimeout(r, 0));
  resetCsrf();
  old.resolve(response(null, 403, 'A0005'));
  await rejected;
  assert.equal(writes, 1);
});
test('waiting for CSRF cannot change the captured write body', async () => {
  resetCsrf();
  const token = deferred();
  let received;
  globalThis.fetch = (url, options) =>
    url.endsWith('/auth/csrf')
      ? token.promise
      : ((received = options.body), Promise.resolve(response(null)));
  const body = { skuId: 'first', quantity: 1 };
  const pending = api('/cart', { method: 'PUT', body });
  body.skuId = 'second';
  body.quantity = 99;
  token.resolve(response({ headerName: 'X-CSRF-TOKEN', token: 'test' }));
  await pending;
  assert.deepEqual(JSON.parse(received), { skuId: 'first', quantity: 1 });
});
