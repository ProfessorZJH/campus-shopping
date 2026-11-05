import { requestScope } from '../services/request-scope.js';
import { uploadedImageUrl } from '../services/media-url.js';
import { store } from '../services/store.js';
import ProductImage from './ProductImage.js';
import { api } from '../services/api.js';
const { ref, computed, watch, onBeforeUnmount } = Vue;
const VALID_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif']);
const MAX_BYTES = 2000000;
const MAX_IMAGES = 8;
const INVALID_FILE = '图片须为 JPG、PNG 或 GIF，且不超过 2 MB';
const DUPLICATE_FILE = '同一批中重复选择（同名、同大小、同类型），已跳过';
const DUPLICATE_URL = '图片不能重复';
const LIMIT_MESSAGE = '商品最多保存 8 张图片';

/** 逐张校验与上传：成功的图片按选择顺序写入表单，失败项单独记录以便重试或移除。 */
export default {
  name: 'ProductImageListField',
  components: { ProductImage },
  props: {
    modelValue: { type: Array, default: () => [] },
    merchantId: { type: String, required: true },
    contextKey: { type: String, default: '' },
    invalid: Boolean,
    disabled: Boolean,
    demo: Boolean,
  },
  emits: ['update:modelValue', 'busy', 'invalid'],
  setup(props, { emit }) {
    const busy = ref(false),
      error = ref(''),
      notice = ref(''),
      demoValues = ref(null),
      failures = ref([]),
      // 未恢复的错误标记：重挂载时的 props.invalid 与整批超限都只能由放弃选择或上下文重置解除。
      blocked = ref(Boolean(props.invalid));
    const values = computed(() =>
      props.demo && demoValues.value ? demoValues.value : props.modelValue || [],
    );
    const scope = requestScope(),
      localUrls = new Set();
    let alive = true,
      epoch = 0,
      failureSequence = 0;

    function release() {
      for (const url of localUrls) URL.revokeObjectURL(url);
      localUrls.clear();
      demoValues.value = null;
    }
    function reset() {
      ++epoch;
      release();
      busy.value = false;
      error.value = '';
      notice.value = '';
      failures.value = [];
      blocked.value = false;
      emit('busy', false);
      emit('invalid', false);
    }
    watch(
      () => [
        props.merchantId,
        props.contextKey,
        props.demo,
        store.identityVersion,
        store.route,
        store.merchantId,
      ],
      reset,
    );
    onBeforeUnmount(() => {
      alive = false;
      ++epoch;
      release();
      if (busy.value) emit('busy', false);
    });
    function update(next) {
      if (props.demo) demoValues.value = next;
      else emit('update:modelValue', next);
    }
    function releaseUrl(url) {
      if (localUrls.delete(url)) URL.revokeObjectURL(url);
    }
    /** 未解决的失败项与未恢复错误共同决定 invalid；删除成功图片不能顺手解除它们。 */
    function syncInvalid() {
      const pending = failures.value;
      if (pending.length)
        error.value =
          '有 ' +
          pending.length +
          ' 张图片未完成：' +
          pending.map((item) => item.name + '（' + item.message + '）').join('；');
      else if (!blocked.value) error.value = '';
      emit('invalid', pending.length > 0 || blocked.value);
    }
    function clearInvalid() {
      if (props.disabled || busy.value) return;
      failures.value = [];
      blocked.value = false;
      error.value = '';
      notice.value = '';
      emit('invalid', false);
    }
    function move(i, d) {
      if (props.disabled || busy.value) return;
      const next = values.value.slice(),
        j = i + d;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      update(next);
    }
    function remove(i) {
      if (props.disabled || busy.value) return;
      const next = values.value.slice(),
        removed = next.splice(i, 1)[0];
      releaseUrl(removed);
      update(next);
      syncInvalid();
    }
    function removeFailed(id) {
      if (props.disabled || busy.value) return;
      failures.value = failures.value.filter((item) => item.id !== id);
      syncInvalid();
    }
    function validate(file) {
      if (!VALID_TYPES.has(file.type) || !file.size || file.size > MAX_BYTES) return INVALID_FILE;
      return '';
    }
    /** 只按选择批内的名称、大小、类型判重，不冒充内容哈希去重。 */
    function fingerprint(file) {
      return [file.name, file.size, file.type].join('\u0000');
    }
    function readBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.readAsDataURL(file);
      });
    }
    function previewUrl(file) {
      const url = URL.createObjectURL(file);
      localUrls.add(url);
      return url;
    }
    async function uploadFile(file, base64, merchant) {
      const result = await api('/merchants/' + encodeURIComponent(merchant) + '/images', {
        method: 'POST',
        body: { filename: file.name, contentType: file.type, base64 },
      });
      const url = uploadedImageUrl(result?.url);
      if (!url) throw new Error('图片上传返回地址无效');
      return url;
    }
    async function process(entries) {
      if (!entries.length || !alive || props.disabled || busy.value) return;
      const merchant = props.merchantId,
        context = props.contextKey,
        demo = props.demo,
        stamp = ++epoch,
        valid = demo ? null : scope.capture();
      // 商户、商品、身份、路由、组件存活或再次选择都会让旧结果失效。
      const current = () =>
        alive &&
        stamp === epoch &&
        merchant === props.merchantId &&
        context === props.contextKey &&
        demo === props.demo &&
        (demo || valid());
      const working = values.value.slice(),
        seen = new Set(),
        batch = [];
      busy.value = true;
      emit('busy', true);
      try {
        for (const entry of entries) {
          const file = entry.file;
          try {
            if (!current()) return;
            const invalid = validate(file);
            if (invalid) throw new Error(invalid);
            const key = fingerprint(file);
            if (seen.has(key)) throw new Error(DUPLICATE_FILE);
            seen.add(key);
            if (working.length >= MAX_IMAGES) throw new Error(LIMIT_MESSAGE);
            let url;
            if (demo) {
              url = previewUrl(file);
            } else {
              const base64 = await readBase64(file);
              // 读文件期间可能已换商户/商品或卸载，不能再用旧上下文发上传请求。
              if (!current()) return;
              url = await uploadFile(file, base64, merchant);
            }
            if (!current()) {
              releaseUrl(url);
              return;
            }
            if (working.includes(url)) {
              releaseUrl(url);
              throw new Error(DUPLICATE_URL);
            }
            working.push(url);
            update(working.slice());
          } catch (cause) {
            batch.push({
              id: entry.id || ++failureSequence,
              file,
              name: file.name || '未命名图片',
              message: cause?.message || '图片上传失败',
            });
          }
        }
      } finally {
        if (current()) {
          if (batch.length) failures.value = failures.value.concat(batch);
          if (!failures.value.length && !blocked.value)
            notice.value = demo ? '仅本地预览，未上传' : '上传成功，保存商品后生效';
          busy.value = false;
          emit('busy', false);
          syncInvalid();
        }
      }
    }
    async function choose(event) {
      const files = [...(event.target.files || [])];
      event.target.value = '';
      if (!files.length || props.disabled || busy.value) return;
      notice.value = '';
      // 未解决的失败与超限提示不因新选一次而重新解锁。
      syncInvalid();
      // 整批先挡住超量选择，避免逐张上传后才发现装不下。
      if (values.value.length + files.length > MAX_IMAGES) {
        blocked.value = true;
        error.value = LIMIT_MESSAGE;
        emit('invalid', true);
        return;
      }
      await process(files.map((file) => ({ file })));
    }
    async function retry(item) {
      if (props.disabled || busy.value || !alive) return;
      failures.value = failures.value.filter((candidate) => candidate.id !== item.id);
      syncInvalid();
      await process([{ file: item.file, id: item.id }]);
    }
    return {
      values,
      busy,
      error,
      notice,
      failures,
      choose,
      move,
      remove,
      retry,
      removeFailed,
      clearInvalid,
    };
  },
  template: `<div class="product-image-list-field"><div class="product-image-list"><div v-for="(url,i) in values" :key="url" class="product-image-tile"><ProductImage :src="url" :alt="'商品图片'+(i+1)"/><span v-if="i===0">主图</span><div><button type="button" :aria-label="'左移商品图片'+(i+1)" :disabled="disabled||busy||i===0" @click="move(i,-1)">←</button><button type="button" :aria-label="'右移商品图片'+(i+1)" :disabled="disabled||busy||i===values.length-1" @click="move(i,1)">→</button><button type="button" :aria-label="'移除商品图片'+(i+1)" :disabled="disabled||busy" @click="remove(i)">删除</button></div></div></div><div v-if="failures.length" class="product-image-failures" role="status"><div v-for="item in failures" :key="item.id" class="product-image-failure"><span>{{item.name}}：{{item.message}}</span><button type="button" :aria-label="'重试图片'+item.name" :disabled="disabled||busy" @click="retry(item)">重试</button><button type="button" :aria-label="'移除失败图片'+item.name" :disabled="disabled||busy" @click="removeFailed(item.id)">移除</button></div></div><label class="image-upload-button" :class="{disabled:disabled||busy||values.length>=8}"><Icon name="upload" :size="15"/>{{busy?'上传中…':'添加图片'}}<input type="file" multiple accept="image/png,image/jpeg,image/gif" aria-label="选择商品图片" :disabled="disabled||busy||values.length>=8" @change="choose"/></label><small>最多 8 张；第一张为主图</small><span v-if="error||invalid" class="image-field-error" role="alert">{{error||'图片处理未完成，请重新选择或放弃本次选择'}}</span><span v-else-if="notice" class="image-field-notice" role="status">{{notice}}</span><button v-if="error||invalid" type="button" :disabled="disabled||busy" @click="clearInvalid">放弃本次图片选择</button></div>`,
};
