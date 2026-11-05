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
  const { props, vm, events } = mount({ modelValue: Array(7).fill('/media/existing.png') });
  await vm.choose(event([file('a.png'), file('b.png')]));
  assert.match(vm.error.value, /最多保存 8 张/);
  await vm.choose(event([file('empty.png', 0)]));
  assert.match(vm.error.value, /JPG/);
  assert.equal(requests, 0);
  // 事件顺序不作为契约：只看最终父表单状态与最后一个 invalid 事件。
  assert.equal(props.invalid, true);
  assert.equal(events.filter(([name]) => name === 'invalid').at(-1)[1], true);
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

function uploadFetch(handler) {
  return (url, options = {}) => {
    if (String(url).endsWith('/auth/csrf'))
      return Promise.resolve(response({ headerName: 'X-CSRF', token: 'test' }));
    const body = options.body ? JSON.parse(options.body) : {};
    return handler(body.filename, body);
  };
}

function mediaUrl(index) {
  return `/media/00000000-0000-0000-0000-00000000000${index}.png`;
}

test('mixed valid and invalid files keep successful uploads and record failures', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0;
  globalThis.fetch = uploadFetch(() => {
    writes++;
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm } = mount();
  await vm.choose(
    event([file('good.png'), file('unsafe.svg', 20, 'image/svg+xml'), file('second.png')]),
  );
  assert.equal(writes, 2);
  assert.deepEqual(props.modelValue, [mediaUrl(1), mediaUrl(2)]);
  assert.equal(vm.failures.value.length, 1);
  assert.equal(vm.failures.value[0].name, 'unsafe.svg');
  assert.match(vm.failures.value[0].message, /JPG/);
  assert.match(vm.error.value, /unsafe\.svg/);
  assert.equal(props.invalid, true);
  assert.equal(vm.busy.value, false);
});

test('reordering or removing a successful image keeps unresolved failures', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0;
  globalThis.fetch = uploadFetch(() => {
    writes++;
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm } = mount();
  await vm.choose(event([file('a.png'), file('bad.svg', 20, 'image/svg+xml'), file('b.png')]));
  vm.move(0, 1);
  assert.deepEqual(props.modelValue, [mediaUrl(2), mediaUrl(1)]);
  assert.equal(vm.failures.value.length, 1);
  assert.equal(props.invalid, true);
  vm.remove(0);
  assert.deepEqual(props.modelValue, [mediaUrl(1)]);
  assert.equal(vm.failures.value.length, 1);
  assert.equal(props.invalid, true);
});

test('retry uploads only the failed file and restores the form when nothing is left', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0,
    online = false;
  globalThis.fetch = uploadFetch((name) => {
    writes++;
    if (name === 'b.png' && !online) return Promise.reject(new Error('boom'));
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm } = mount();
  await vm.choose(event([file('a.png'), file('b.png')]));
  assert.equal(writes, 2);
  assert.deepEqual(props.modelValue, [mediaUrl(1)]);
  assert.equal(vm.failures.value.length, 1);
  assert.equal(vm.failures.value[0].name, 'b.png');
  assert.match(vm.failures.value[0].message, /服务连接失败/);
  assert.equal(props.invalid, true);

  online = true;
  await vm.retry(vm.failures.value[0]);

  assert.equal(writes, 3);
  assert.deepEqual(props.modelValue, [mediaUrl(1), mediaUrl(3)]);
  assert.equal(vm.failures.value.length, 0);
  assert.equal(props.invalid, false);
  assert.equal(vm.error.value, '');
});

test('retrying an invalid file re-runs validation without any request', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requests = 0;
  globalThis.fetch = uploadFetch(() => {
    requests++;
    return Promise.resolve(response({ url: mediaUrl(1) }));
  });
  const { props, vm } = mount();
  await vm.choose(event([file('empty.png', 0), file('huge.png', 2000001)]));
  assert.equal(requests, 0);
  assert.equal(vm.failures.value.length, 2);
  assert.equal(props.invalid, true);

  await vm.retry(vm.failures.value[0]);
  await vm.retry(vm.failures.value[0]);

  assert.equal(requests, 0);
  assert.equal(vm.failures.value.length, 2);
  assert.equal(props.invalid, true);
});

test('only one request per identical file in the same batch', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0;
  globalThis.fetch = uploadFetch(() => {
    writes++;
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm } = mount();
  const same = () => file('same.png', 20, 'image/png');
  await vm.choose(event([same(), same()]));
  assert.equal(writes, 1);
  assert.deepEqual(props.modelValue, [mediaUrl(1)]);
  assert.equal(vm.failures.value.length, 1);
  assert.match(vm.failures.value[0].message, /重复/);
  assert.equal(props.invalid, true);

  vm.removeFailed(vm.failures.value[0].id);
  assert.equal(props.invalid, false);
  assert.deepEqual(props.modelValue, [mediaUrl(1)]);

  await vm.choose(event([same()]));
  assert.equal(writes, 2);
  assert.deepEqual(props.modelValue, [mediaUrl(1), mediaUrl(2)]);
});

test('removing the last failure restores the form and keeps successful images', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0;
  globalThis.fetch = uploadFetch(() => {
    writes++;
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm } = mount();
  await vm.choose(event([file('a.png'), file('bad.svg', 20, 'image/svg+xml')]));
  assert.equal(props.invalid, true);
  assert.deepEqual(props.modelValue, [mediaUrl(1)]);

  vm.removeFailed(vm.failures.value[0].id);

  assert.equal(vm.failures.value.length, 0);
  assert.equal(vm.error.value, '');
  assert.equal(props.invalid, false);
  assert.deepEqual(props.modelValue, [mediaUrl(1)]);
});

test('a late failure after a context switch is discarded', { timeout: 5000 }, async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  const upload = deferred(),
    started = deferred();
  globalThis.fetch = uploadFetch(() => {
    started.resolve();
    return upload.promise;
  });
  const { props, vm, events } = mount();
  const pending = vm.choose(event([file()]));
  await started.promise;
  props.contextKey = 'p2';
  flushWatchers();
  upload.promise.catch(() => {});
  upload.resolve(Promise.reject(new Error('late failure')));
  await pending;
  assert.equal(vm.failures.value.length, 0);
  assert.equal(events.filter(([name, value]) => name === 'invalid' && value === true).length, 0);
  assert.equal(events.filter(([name]) => name === 'update:modelValue').length, 0);
  assert.equal(vm.busy.value, false);
});

test('a failure arriving after unmount is not reported', { timeout: 5000 }, async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  const upload = deferred(),
    started = deferred();
  globalThis.fetch = uploadFetch(() => {
    started.resolve();
    return upload.promise;
  });
  const { vm, events, unmount } = mount();
  const pending = vm.choose(event([file()]));
  await started.promise;
  unmount();
  upload.promise.catch(() => {});
  upload.resolve(Promise.reject(new Error('late failure')));
  await pending;
  assert.equal(vm.failures.value.length, 0);
  assert.equal(events.filter(([name, value]) => name === 'invalid' && value === true).length, 0);
  assert.equal(events.filter(([name]) => name === 'update:modelValue').length, 0);
});

test('a retry still in flight cannot report into another product', { timeout: 5000 }, async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  const retried = deferred(),
    started = deferred();
  let writes = 0,
    attempts = 0;
  globalThis.fetch = uploadFetch((name) => {
    if (name === 'b.png') {
      attempts++;
      if (attempts === 1) return Promise.reject(new Error('offline'));
      started.resolve();
      return retried.promise;
    }
    writes++;
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm, events } = mount();
  await vm.choose(event([file('a.png'), file('b.png')]));
  assert.equal(writes, 1);
  assert.equal(vm.failures.value.length, 1);

  const pending = vm.retry(vm.failures.value[0]);
  await started.promise;
  // 父组件切到另一个商品：给它自己的图片，而不是清空别人的表单。
  props.contextKey = 'p2';
  props.modelValue = [mediaUrl(8)];
  flushWatchers();
  const afterSwitch = events.length;
  retried.resolve(response({ url: mediaUrl(9) }));
  await pending;

  const late = events.slice(afterSwitch);
  assert.deepEqual(props.modelValue, [mediaUrl(8)]);
  assert.equal(vm.failures.value.length, 0);
  assert.equal(late.filter(([name]) => name === 'update:modelValue').length, 0);
  assert.equal(late.filter(([name, value]) => name === 'invalid' && value === true).length, 0);
  assert.equal(vm.busy.value, false);
});

test('a new valid selection cannot clear an earlier failure', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0;
  globalThis.fetch = uploadFetch(() => {
    writes++;
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm } = mount();
  await vm.choose(event([file('bad.svg', 20, 'image/svg+xml')]));
  assert.equal(props.invalid, true);

  await vm.choose(event([file('good.png')]));

  assert.equal(writes, 1);
  assert.deepEqual(props.modelValue, [mediaUrl(1)]);
  assert.equal(vm.failures.value.length, 1);
  assert.equal(props.invalid, true);
});

test('remounting with invalid keeps blocking even after removing a saved image', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0;
  globalThis.fetch = uploadFetch(() => {
    writes++;
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm } = mount({ invalid: true, modelValue: [mediaUrl(5)] });

  vm.remove(0);
  assert.deepEqual(props.modelValue, []);
  assert.equal(props.invalid, true);

  await vm.choose(event([file('good.png')]));
  assert.equal(writes, 1);
  assert.deepEqual(props.modelValue, [mediaUrl(1)]);
  assert.equal(props.invalid, true);

  vm.clearInvalid();
  assert.equal(props.invalid, false);
  assert.match(vm.error.value, /^$/);
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
  globalThis.fetch = uploadFetch(() => {
    writes++;
    return Promise.resolve(response({ url: mediaUrl(writes) }));
  });
  const { props, vm } = mount();
  await vm.choose(event([file('a.png'), file('b.png')]));
  assert.equal(writes, 2);
  assert.deepEqual(props.modelValue, [mediaUrl(1), mediaUrl(2)]);
  vm.move(1, -1);
  vm.remove(1);
  assert.deepEqual(props.modelValue, [mediaUrl(2)]);
  assert.equal(vm.busy.value, false);
});

const qiniuUrl = (index) =>
  `/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c33${String(index).padStart(2, '0')}.png`;

test('QINIU upload paths are accepted and mixed with LOCAL images in order', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  let writes = 0;
  globalThis.fetch = uploadFetch(() => {
    writes++;
    return Promise.resolve(response({ url: qiniuUrl(writes) }));
  });
  const { props, vm } = mount({ modelValue: [mediaUrl(9)] });
  await vm.choose(event([file('a.png'), file('b.png')]));
  assert.equal(writes, 2);
  assert.deepEqual(props.modelValue, [mediaUrl(9), qiniuUrl(1), qiniuUrl(2)]);
  assert.equal(vm.failures.value.length, 0);
  assert.equal(props.invalid, false);
  // 混合顺序可调、可删，仍保持已保存的 LOCAL 图不被丢弃。
  vm.move(2, -1);
  assert.deepEqual(props.modelValue, [mediaUrl(9), qiniuUrl(2), qiniuUrl(1)]);
  vm.remove(0);
  assert.deepEqual(props.modelValue, [qiniuUrl(2), qiniuUrl(1)]);
  assert.equal(vm.busy.value, false);
});

test('non-contract upload results are recorded as failures and block saving', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  const rejected = [
    '/media/qiniu/3F2504E0-4F89-41D3-9A0C-0305E82C3301.png',
    '/media/qiniu/3f2504e04f8941d39a0c0305e82c3301.png',
    'https://evil.example.com/a.png',
    '//evil.example.com/a.png',
    'blob:http://127.0.0.1/abc',
    '/media/qiniu/../550e8400-e29b-41d4-a716-446655440000.png',
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png?sign=1',
    // 末尾换行/前后空白：JS 的 `$` 会匹配换行前位置，必须显式拒绝且不 trim 归一。
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png\n',
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png\r\n',
    ' /media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png',
    '/media/550e8400-e29b-41d4-a716-446655440000.png ',
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png#frag',
  ];
  for (const url of rejected) {
    globalThis.fetch = uploadFetch(() => Promise.resolve(response({ url })));
    const { props, vm } = mount();
    await vm.choose(event([file('a.png')]));
    assert.deepEqual(props.modelValue, [], '非法地址不得写入相册：' + url);
    assert.equal(vm.failures.value.length, 1, '必须记为可重试的失败项：' + url);
    assert.match(vm.failures.value[0].message, /图片上传返回地址无效/);
    assert.equal(props.invalid, true);
    assert.equal(vm.busy.value, false);
  }
});
