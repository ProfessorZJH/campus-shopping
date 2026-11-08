import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideConversationTransport } from '../src/services/guide-conversation.js';

test('stream transport normalizes conversation ids, progress, completion and cancellation', async () => {
  const events = [];
  const transport = createGuideConversationTransport({
    streamRequest: async (_path, options) => {
      await options.onEvent('started', { conversationId: 'conv-1' });
      await options.onEvent('progress', { conversationId: 'conv-1', data: { bytes: 42 } });
      await options.onEvent('completed', {
        conversationId: 'conv-1',
        data: { conversationId: 'conv-1', answer: '完成' },
      });
    },
  });
  const result = await transport.streamTurn({
    question: '问题',
    onConversationId: (id) => events.push(['id', id]),
    onProgress: (bytes) => events.push(['progress', bytes]),
    onCompleted: (answer) => events.push(['completed', answer.answer]),
  });
  assert.deepEqual(result, { conversationId: 'conv-1', completed: true, cancelled: false });
  assert.deepEqual(events, [
    ['id', 'conv-1'],
    ['id', 'conv-1'],
    ['progress', 42],
    ['id', 'conv-1'],
    ['completed', '完成'],
  ]);
});

test('stream transport marks a cancelled turn without synthesizing a network failure', async () => {
  let cancelled = 0;
  const transport = createGuideConversationTransport({
    streamRequest: async (_path, options) => {
      await options.onEvent('cancelled', { conversationId: 'conv-cancelled' });
    },
  });
  const result = await transport.streamTurn({
    question: '停止',
    onCancelled: () => cancelled++,
  });
  assert.equal(cancelled, 1);
  assert.deepEqual(result, {
    conversationId: 'conv-cancelled',
    completed: false,
    cancelled: true,
  });
});

test('snapshot validation rejects a stale or incomplete answer', async () => {
  const transport = createGuideConversationTransport({
    request: async (path) => {
      if (path.endsWith('/messages'))
        return [{ role: 'user', content: '旧问题' }, { role: 'assistant', content: '旧回答' }];
      return [];
    },
  });
  assert.equal(await transport.loadSnapshot('conv-1', { expectedQuestion: '新问题' }), false);
  const snapshot = await transport.loadSnapshot('conv-1', { expectedQuestion: '旧问题' });
  assert.equal(snapshot.id, 'conv-1');
  assert.equal(snapshot.messages.at(-1).content, '旧回答');
});

test('disconnect recovery waits through cancellation and loads an idle snapshot', async () => {
  const statuses = ['CANCEL_REQUESTED', 'IDLE'];
  const calls = [];
  const transport = createGuideConversationTransport({
    request: async (path) => {
      calls.push(path);
      if (path.endsWith('/turn/status')) return { status: statuses.shift() };
      if (path.endsWith('/messages'))
        return [{ role: 'user', content: '问题' }, { role: 'assistant', content: '回答' }];
      return [{ status: 'PENDING', id: 'proposal-1', items: [] }];
    },
    sleep: async () => {},
  });
  let cancelRequested = 0;
  const snapshot = await transport.recoverAfterDisconnect({
    id: 'conv-1',
    isCurrent: () => true,
    expectedQuestion: '问题',
    onCancelRequested: () => cancelRequested++,
  });
  assert.equal(cancelRequested, 1);
  assert.equal(snapshot.id, 'conv-1');
  assert.deepEqual(calls, [
    '/ai/conversations/conv-1/turn/status',
    '/ai/conversations/conv-1/turn/status',
    '/ai/conversations/conv-1/messages',
    '/ai/conversations/conv-1/proposals',
  ]);
});
