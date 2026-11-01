import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/services/api.js';

test('GET times out through response body and caller cancellation stays cancellation', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, { signal }) => ({
    json: () =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    status: 200,
    ok: true,
  });
  try {
    await assert.rejects(api('/held', { timeoutMs: 10 }), { code: 'TIMEOUT' });
    const controller = new AbortController();
    const pending = api('/held', { signal: controller.signal });
    setTimeout(() => controller.abort(), 5);
    await assert.rejects(pending, (err) => err.code !== 'TIMEOUT');
  } finally {
    globalThis.fetch = original;
  }
});
