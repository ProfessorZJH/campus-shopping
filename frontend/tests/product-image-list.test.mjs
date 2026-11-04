import test from 'node:test';
import assert from 'node:assert/strict';

let watchers = [],
  unmountHooks = [];
globalThis.window = { __CAMPUS_TEST_DEMO__: false };
globalThis.location = { search: '', hash: '' };
globalThis.Vue = {
  reactive: (value) => value,
  ref: (value) => ({ value }),
  computed: (getter) => ({
    get value() {
      return getter();
    },
  }),
  watch: (getter, callback) => watchers.push({ getter, callback, previous: getter() }),
  onBeforeUnmount: (callback) => unmountHooks.push(callback),
};
const { default: field } = await import('../src/components/ProductImageListField.js');
const { store } = await import('../src/services/store.js');
const { resetCsrf } = await import('../src/services/api.js');
const response = (data) => new Response(JSON.stringify({ code: '0000', data }), { status: 200 });
const file = (name = 'photo.png', size = 20, type = 'image/png') => ({ name, size, type });
const event = (files) => ({ target: { files, value: 'selected' } });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function flushWatchers() {
  for (const watcher of watchers) {
    const next = watcher.getter();
    if (next.some((value, index) => value !== watcher.previous[index])) {
      const previous = watcher.previous;
      watcher.previous = next;
      watcher.callback(next, previous);
    }
  }
}
function mount(options = {}) {
  watchers = [];
  unmountHooks = [];
  resetCsrf();
  store.identityVersion++;
  store.route = '/merchant/products';
  store.merchantId = 'm1';
  const props = {
    modelValue: [],
    merchantId: 'm1',
    contextKey: 'p1',
    invalid: false,
    disabled: false,
    demo: false,
    ...options,
  };
  const events = [];
  const vm = field.setup(props, {
    emit(name, value) {
      events.push([name, value]);
      if (name === 'update:modelValue') props.modelValue = value;
      if (name === 'invalid') props.invalid = value;
    },
  });
  return { props, vm, events, unmount: () => unmountHooks.forEach((callback) => callback()) };
}
function fastReader() {
  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = 'data:image/png;base64,YWJj';
      queueMicrotask(() => this.onload());
    }
  };
}

test('demo images remain local and object URLs are revoked on removal and unmount', async (t) => {
  const originalCreate = URL.createObjectURL,
    originalRevoke = URL.revokeObjectURL,
    originalFetch = globalThis.fetch;
  t.after(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    globalThis.fetch = originalFetch;
  });
  const revoked = [];
  let counter = 0,
    requests = 0;
  URL.createObjectURL = () => `blob:test-${++counter}`;
  URL.revokeObjectURL = (url) => revoked.push(url);
  globalThis.fetch = () => {
    requests++;
    throw new Error('demo must not make a request');
  };
  const { vm, events, unmount } = mount({ demo: true });
  await vm.choose(event([file('a.png'), file('b.png')]));
  assert.deepEqual(vm.values.value, ['blob:test-1', 'blob:test-2']);
  assert.match(vm.notice.value, /仅本地预览/);
  assert.equal(requests, 0);
  assert.equal(events.filter(([name]) => name === 'update:modelValue').length, 0);
  vm.move(1, -1);
  assert.deepEqual(vm.values.value, ['blob:test-2', 'blob:test-1']);
  vm.remove(0);
  assert.deepEqual(revoked, ['blob:test-2']);
  unmount();
  assert.deepEqual(revoked, ['blob:test-2', 'blob:test-1']);
});

test('invalid or excessive files are rejected before any upload', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requests = 0;
  globalThis.fetch = () => {
    requests++;
    throw new Error('unexpected request');
  };
  const { vm, events } = mount({ modelValue: Array(7).fill('/media/existing.png') });
  await vm.choose(event([file('a.png'), file('b.png')]));
  assert.match(vm.error.value, /最多保存 8 张/);
  await vm.choose(event([file('empty.png', 0)]));
  assert.match(vm.error.value, /JPG/);
  assert.equal(requests, 0);
  assert.equal(events.at(-1)[0], 'invalid');
  assert.equal(events.at(-1)[1], true);
});

test('invalid state survives unmount until the user explicitly abandons the selection', async () => {
  const first = mount();
  await first.vm.choose(event([file('bad.svg', 20, 'image/svg+xml')]));
  assert.equal(first.props.invalid, true);
  first.unmount();
  assert.equal(first.props.invalid, true);
  const restored = mount({ invalid: true });
  restored.vm.clearInvalid();
  assert.equal(restored.props.invalid, false);
  assert.deepEqual(restored.props.modelValue, []);
});

test('late upload cannot append to another selected product', { timeout: 5000 }, async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  const upload = deferred(),
    started = deferred();
  globalThis.fetch = (url) => {
    if (String(url).endsWith('/auth/csrf'))
      return Promise.resolve(response({ headerName: 'X-CSRF', token: 'test' }));
    started.resolve();
    return upload.promise;
  };
  const { props, vm, events } = mount();
  const pending = vm.choose(event([file()]));
  await started.promise;
  props.contextKey = 'p2';
  props.modelValue = ['/media/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png'];
  flushWatchers();
  upload.resolve(response({ url: '/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png' }));
  await pending;
  assert.deepEqual(props.modelValue, ['/media/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png']);
  assert.equal(events.filter(([name]) => name === 'update:modelValue').length, 0);
  assert.equal(vm.busy.value, false);
});

test('a changed context during file reading never starts the old upload', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  let reader,
    requests = 0;
  globalThis.FileReader = class {
    readAsDataURL() {
      reader = this;
    }
  };
  globalThis.fetch = () => {
    requests++;
    throw new Error('unexpected request');
  };
  const { props, vm } = mount();
  const pending = vm.choose(event([file()]));
  props.contextKey = 'p2';
  flushWatchers();
  reader.result = 'data:image/png;base64,YWJj';
  reader.onload();
  await pending;
  assert.equal(requests, 0);
  assert.equal(vm.busy.value, false);
});

test('successful multi-image upload preserves order and permits reordering and removal', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0;
  globalThis.fetch = (url) => {
    if (String(url).endsWith('/auth/csrf'))
      return Promise.resolve(response({ headerName: 'X-CSRF', token: 'test' }));
    writes++;
    return Promise.resolve(
      response({ url: `/media/00000000-0000-0000-0000-00000000000${writes}.png` }),
    );
  };
  const { props, vm } = mount();
  await vm.choose(event([file('a.png'), file('b.png')]));
  assert.equal(writes, 2);
  assert.deepEqual(props.modelValue, [
    '/media/00000000-0000-0000-0000-000000000001.png',
    '/media/00000000-0000-0000-0000-000000000002.png',
  ]);
  vm.move(1, -1);
  vm.remove(1);
  assert.deepEqual(props.modelValue, ['/media/00000000-0000-0000-0000-000000000002.png']);
  assert.equal(vm.busy.value, false);
});
