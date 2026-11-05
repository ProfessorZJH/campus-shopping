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
const { default: field } = await import('../src/components/ProductImageField.js');
const { store } = await import('../src/services/store.js');
const { resetCsrf } = await import('../src/services/api.js');
const response = (data) => new Response(JSON.stringify({ code: '0000', data }), { status: 200 });
const file = (name = 'photo.png', size = 20, type = 'image/png') => ({ name, size, type });
const event = (selected) => ({ target: { files: [selected], value: 'selected' } });
const QINIU = '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png';
const LOCAL = '/media/550e8400-e29b-41d4-a716-446655440000.png';
// Node 的 URL.createObjectURL 只接受真实 Blob；组件只需要预览占位，这里替换成稳定值。
URL.createObjectURL = () => 'blob:preview';
URL.revokeObjectURL = () => {};

function fastReader() {
  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = 'data:image/png;base64,YWJj';
      queueMicrotask(() => this.onload());
    }
  };
}
function mount(options = {}) {
  watchers = [];
  unmountHooks = [];
  resetCsrf();
  store.identityVersion++;
  store.route = '/merchant/products';
  store.merchantId = 'm1';
  const props = {
    modelValue: '',
    merchantId: 'm1',
    contextKey: 'p1',
    disabled: false,
    demo: false,
    ...options,
  };
  const events = [];
  const vm = field.setup(props, {
    emit(name, value) {
      events.push([name, value]);
      if (name === 'update:modelValue') props.modelValue = value;
    },
  });
  return { props, vm, events };
}
function stubUpload(url) {
  return (target, options = {}) => {
    if (String(target).endsWith('/auth/csrf'))
      return Promise.resolve(response({ headerName: 'X-CSRF', token: 'test' }));
    return Promise.resolve(response({ url: typeof url === 'function' ? url(options) : url }));
  };
}

test('QINIU upload path is accepted and written to the form model', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  globalThis.fetch = stubUpload(QINIU);
  const { props, vm, events } = mount();
  await vm.choose(event(file()));
  assert.equal(props.modelValue, QINIU);
  assert.equal(vm.displayed.value, QINIU);
  assert.match(vm.notice.value, /上传成功/);
  assert.equal(vm.error.value, '');
  assert.equal(events.filter(([name, value]) => name === 'invalid' && value === true).length, 0);
});

test('legacy LOCAL upload path still accepted', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  globalThis.fetch = stubUpload(LOCAL);
  const { props, vm } = mount();
  await vm.choose(event(file()));
  assert.equal(props.modelValue, LOCAL);
});

test('shared media URL guard rejects non-string and whitespace-padded values', async () => {
  const { uploadedImageUrl } = await import('../src/services/media-url.js');
  const ok = '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png';
  assert.equal(uploadedImageUrl(ok), ok);
  assert.equal(
    uploadedImageUrl('/media/550e8400-e29b-41d4-a716-446655440000.png'),
    '/media/550e8400-e29b-41d4-a716-446655440000.png',
  );
  for (const value of [null, undefined, 42, {}, [], { url: ok }, true]) {
    assert.equal(uploadedImageUrl(value), '', '非字符串必须拒绝：' + String(value));
  }
  for (const value of [ok + '\n', ok + '\r', '\t' + ok, ' ' + ok + ' ', ok + '\u00a0']) {
    assert.equal(uploadedImageUrl(value), '', '前后空白/换行必须拒绝且不归一化');
  }
  // 不接受把非法值“修好”：返回值只能是原样合法值或空串。
  assert.equal(uploadedImageUrl('  /media/550e8400-e29b-41d4-a716-446655440000.png'), '');
});

test('non-contract upload results are rejected without touching the model', async (t) => {
  const originalFetch = globalThis.fetch,
    originalReader = globalThis.FileReader;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalReader;
  });
  fastReader();
  const rejected = [
    // 大写 UUID 不属于契约形状
    '/media/qiniu/3F2504E0-4F89-41D3-9A0C-0305E82C3301.png',
    // 非分组 UUID
    '/media/qiniu/3f2504e04f8941d39a0c0305e82c3301.png',
    // 外链与协议相对地址
    'https://evil.example.com/a.png',
    '//evil.example.com/a.png',
    'blob:http://127.0.0.1/abc',
    // 目录穿越与查询串
    '/media/qiniu/../550e8400-e29b-41d4-a716-446655440000.png',
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png?sign=1',
    // 只有 qiniu 命名空间前缀、没有合法对象名
    '/media/qiniu/',
    '/media/qiniu/x.png',
    '',
    // JS 的 `$` 会容忍末尾换行：前后空白与换行必须显式拒绝，且不做 trim 归一。
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png\n',
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png\r\n',
    ' /media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png',
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png ',
    '/media/550e8400-e29b-41d4-a716-446655440000.png\n',
    // 片段与查询串不属于稳定路径
    '/media/qiniu/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png#x',
  ];
  for (const url of rejected) {
    globalThis.fetch = stubUpload(url);
    const { props, vm, events } = mount();
    await vm.choose(event(file()));
    assert.equal(props.modelValue, '', '非法地址不得写入表单：' + url);
    assert.equal(vm.error.value, '图片上传返回地址无效', '必须给出明确错误：' + url);
    assert.equal(
      events.filter(([name]) => name === 'update:modelValue').length,
      0,
      '不得派发 model 更新：' + url,
    );
    assert.equal(events.filter(([name, value]) => name === 'invalid' && value === true).length, 1);
    assert.equal(vm.busy.value, false);
  }
});
