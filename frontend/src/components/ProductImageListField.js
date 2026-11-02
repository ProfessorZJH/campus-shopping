import ProductImage from './ProductImage.js';
import { api } from '../services/api.js';
const { ref, computed } = Vue;
export default {
  name: 'ProductImageListField',
  components: { ProductImage },
  props: {
    modelValue: { type: Array, default: () => [] },
    merchantId: { type: String, required: true },
    disabled: Boolean,
    demo: Boolean,
  },
  emits: ['update:modelValue', 'busy', 'invalid'],
  setup(props, { emit }) {
    const busy = ref(false),
      error = ref(''),
      values = computed(() => props.modelValue || []);
    function move(i, d) {
      const a = values.value.slice(),
        j = i + d;
      if (j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]];
      emit('update:modelValue', a);
    }
    function remove(i) {
      const a = values.value.slice();
      a.splice(i, 1);
      emit('update:modelValue', a);
    }
    async function choose(e) {
      const files = [...(e.target.files || [])];
      e.target.value = '';
      if (!files.length || props.disabled || busy.value) return;
      if (values.value.length + files.length > 8) {
        error.value = '商品最多保存 8 张图片';
        emit('invalid', true);
        return;
      }
      busy.value = true;
      emit('busy', true);
      error.value = '';
      try {
        const urls = [];
        for (const file of files) {
          if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type) || file.size > 2000000)
            throw Error('图片须为 JPG、PNG 或 GIF，且不超过 2 MB');
          const base64 = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onerror = () => reject(Error('图片读取失败'));
            r.onload = () => resolve(String(r.result).split(',')[1] || '');
            r.readAsDataURL(file);
          });
          const result = await api(
            '/merchants/' + encodeURIComponent(props.merchantId) + '/images',
            { method: 'POST', body: { filename: file.name, contentType: file.type, base64 } },
          );
          if (!/^\/media\/[a-f0-9-]+\.png$/.test(result?.url || ''))
            throw Error('图片上传返回地址无效');
          urls.push(result.url);
        }
        emit('update:modelValue', values.value.concat(urls));
      } catch (e) {
        error.value = e.message || '图片上传失败';
        emit('invalid', true);
      } finally {
        busy.value = false;
        emit('busy', false);
      }
    }
    return { values, busy, error, choose, move, remove };
  },
  template: `<div class="product-image-list-field"><div class="product-image-list"><div v-for="(url,i) in values" :key="url" class="product-image-tile"><ProductImage :src="url" :alt="'商品图片'+(i+1)"/><span v-if="i===0">主图</span><div><button type="button" :disabled="disabled||busy||i===0" @click="move(i,-1)">←</button><button type="button" :disabled="disabled||busy||i===values.length-1" @click="move(i,1)">→</button><button type="button" :disabled="disabled||busy" @click="remove(i)">删除</button></div></div></div><label class="image-upload-button" :class="{disabled:disabled||busy||values.length>=8}"><Icon name="upload" :size="15"/>{{busy?'上传中…':'添加图片'}}<input type="file" multiple accept="image/png,image/jpeg,image/gif" :disabled="disabled||busy||values.length>=8" @change="choose"/></label><small>最多 8 张；第一张为主图</small><span v-if="error" class="image-field-error" role="alert">{{error}}</span></div>`,
};
