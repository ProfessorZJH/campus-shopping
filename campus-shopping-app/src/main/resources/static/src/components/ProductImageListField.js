import { requestScope } from '../services/request-scope.js';
import { store } from '../services/store.js';
import ProductImage from './ProductImage.js';
import { api } from '../services/api.js';
const { ref, computed, watch, onBeforeUnmount } = Vue;
const VALID_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif']);
const MAX_BYTES = 2000000;
const MAX_IMAGES = 8;

/** 图片上传不保存商品；过期请求不能修改新的商户或商品表单。 */
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
      demoValues = ref(null);
    const values = computed(() =>
      props.demo && demoValues.value ? demoValues.value : props.modelValue || [],
    );
    const scope = requestScope(),
      localUrls = new Set();
    let alive = true,
      epoch = 0;

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
    function clearInvalid() {
      if (props.disabled || busy.value) return;
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
      if (localUrls.delete(removed)) URL.revokeObjectURL(removed);
      error.value = '';
      notice.value = '';
      emit('invalid', false);
      update(next);
    }
    async function choose(event) {
      const files = [...(event.target.files || [])];
      event.target.value = '';
      if (!files.length || props.disabled || busy.value) return;
      error.value = '';
      notice.value = '';
      emit('invalid', false);
      if (values.value.length + files.length > MAX_IMAGES) {
        error.value = '商品最多保存 8 张图片';
        emit('invalid', true);
        return;
      }
      if (
        files.some((file) => !VALID_TYPES.has(file.type) || !file.size || file.size > MAX_BYTES)
      ) {
        error.value = '图片须为 JPG、PNG 或 GIF，且不超过 2 MB';
        emit('invalid', true);
        return;
      }
      if (props.demo) {
        const urls = [];
        try {
          for (const file of files) urls.push(URL.createObjectURL(file));
          for (const url of urls) localUrls.add(url);
          demoValues.value = values.value.concat(urls);
          notice.value = '仅本地预览，未上传';
        } catch {
          for (const url of urls) URL.revokeObjectURL(url);
          error.value = '图片预览失败';
          emit('invalid', true);
        }
        return;
      }
      const merchant = props.merchantId,
        context = props.contextKey,
        stamp = ++epoch,
        valid = scope.capture();
      const current = () =>
        alive &&
        valid() &&
        stamp === epoch &&
        merchant === props.merchantId &&
        context === props.contextKey &&
        !props.demo;
      busy.value = true;
      emit('busy', true);
      try {
        const urls = [];
        for (const file of files) {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('图片读取失败'));
            reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
            reader.readAsDataURL(file);
          });
          if (!current()) return;
          const result = await api('/merchants/' + encodeURIComponent(merchant) + '/images', {
            method: 'POST',
            body: { filename: file.name, contentType: file.type, base64 },
          });
          if (!current()) return;
          if (!/^\/media\/[a-f0-9-]+\.png$/.test(result?.url || ''))
            throw new Error('图片上传返回地址无效');
          urls.push(result.url);
        }
        if (values.value.length + urls.length > MAX_IMAGES)
          throw new Error('商品最多保存 8 张图片');
        emit('update:modelValue', values.value.concat(urls));
        emit('invalid', false);
        notice.value = '上传成功，保存商品后生效';
      } catch (err) {
        if (current()) {
          error.value = err.message || '图片上传失败';
          emit('invalid', true);
        }
      } finally {
        if (current()) {
          busy.value = false;
          emit('busy', false);
        }
      }
    }
    return { values, busy, error, notice, choose, move, remove, clearInvalid };
  },
  template: `<div class="product-image-list-field"><div class="product-image-list"><div v-for="(url,i) in values" :key="url" class="product-image-tile"><ProductImage :src="url" :alt="'商品图片'+(i+1)"/><span v-if="i===0">主图</span><div><button type="button" :aria-label="'左移商品图片'+(i+1)" :disabled="disabled||busy||i===0" @click="move(i,-1)">←</button><button type="button" :aria-label="'右移商品图片'+(i+1)" :disabled="disabled||busy||i===values.length-1" @click="move(i,1)">→</button><button type="button" :aria-label="'移除商品图片'+(i+1)" :disabled="disabled||busy" @click="remove(i)">删除</button></div></div></div><label class="image-upload-button" :class="{disabled:disabled||busy||values.length>=8}"><Icon name="upload" :size="15"/>{{busy?'上传中…':'添加图片'}}<input type="file" multiple accept="image/png,image/jpeg,image/gif" aria-label="选择商品图片" :disabled="disabled||busy||values.length>=8" @change="choose"/></label><small>最多 8 张；第一张为主图</small><span v-if="error||invalid" class="image-field-error" role="alert">{{error||'图片处理未完成，请重新选择或放弃本次选择'}}</span><span v-else-if="notice" class="image-field-notice" role="status">{{notice}}</span><button v-if="error||invalid" type="button" :disabled="disabled||busy" @click="clearInvalid">放弃本次图片选择</button></div>`,
};
