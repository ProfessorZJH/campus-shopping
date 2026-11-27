<script setup lang="ts">
import ProductImageListField from './ProductImageListField.js';

interface SkuDraft {
  specKey: string;
  price: string;
}
interface ProductDraft {
  title: string;
  description: string;
  categoryCode: string;
  imageUrl: string;
  imageUrls: string[];
  skus: SkuDraft[];
}
interface Category {
  code: string;
  name: string;
  active: boolean;
}

const props = defineProps<{
  form: ProductDraft;
  categories: Category[];
  merchantId: string;
  preview: boolean;
  owned: boolean;
  saving: boolean;
  imageUploading: boolean;
  imageInvalid: boolean;
}>();
const emit = defineEmits<{
  'update:form': [form: ProductDraft];
  close: [];
  submit: [];
  'add-sku': [];
  'remove-sku': [index: number];
  'image-busy': [busy: boolean];
  'image-invalid': [invalid: boolean];
}>();

function updateField(key: 'title' | 'description' | 'categoryCode', event: Event) {
  emit('update:form', { ...props.form, [key]: (event.target as HTMLInputElement).value });
}
function updateSku(index: number, key: keyof SkuDraft, event: Event) {
  const skus = props.form.skus.map((sku, i) =>
    i === index ? { ...sku, [key]: (event.target as HTMLInputElement).value } : sku,
  );
  emit('update:form', { ...props.form, skus });
}
function updateImages(imageUrls: string[]) {
  emit('update:form', { ...props.form, imageUrls });
}
</script>

<template>
  <form class="merchant-modal" @submit.prevent="$emit('submit')">
    <div class="merchant-modal-header">
      <div><h2>新增商品</h2></div>
      <button type="button" aria-label="关闭" @click="$emit('close')">
        <Icon name="x" :size="20" />
      </button>
    </div>
    <label class="field-label" for="merchant-field-5">商品名称</label>
    <input
      id="merchant-field-5"
      class="admin-input"
      maxlength="100"
      :value="form.title"
      placeholder="商品名称"
      required
      @input="updateField('title', $event)"
    />
    <label class="field-label" for="merchant-field-6">分类</label>
    <select
      id="merchant-field-6"
      class="admin-input"
      :value="form.categoryCode"
      @change="updateField('categoryCode', $event)"
    >
      <option
        v-for="category in categories.filter((c) => c.active)"
        :key="category.code"
        :value="category.code"
      >
        {{ category.name }}
      </option>
    </select>
    <label class="field-label">规格 / 售价（元）</label>
    <div v-for="(item, index) in form.skus" :key="index" class="sku-create-row">
      <input
        class="admin-input"
        maxlength="100"
        :value="item.specKey"
        required
        placeholder="例如 250ml"
        @input="updateSku(index, 'specKey', $event)"
      />
      <input
        class="admin-input"
        :value="item.price"
        inputmode="decimal"
        placeholder="0.00"
        required
        @input="updateSku(index, 'price', $event)"
      />
      <button
        type="button"
        class="outline-button small"
        :disabled="form.skus.length === 1"
        :aria-label="'移除规格' + (index + 1)"
        @click="$emit('remove-sku', index)"
      >
        <Icon name="x" :size="15" />
      </button>
    </div>
    <button
      type="button"
      class="outline-button small"
      :disabled="form.skus.length >= 20"
      @click="$emit('add-sku')"
    >
      <Icon name="plus" :size="15" />添加规格
    </button>
    <label class="field-label" for="merchant-field-7">描述</label>
    <textarea
      id="merchant-field-7"
      class="admin-input"
      rows="3"
      :value="form.description"
      placeholder="选填"
      @input="updateField('description', $event)"
    ></textarea>
    <label class="field-label">商品主图</label>
    <ProductImageListField
      :model-value="form.imageUrls"
      :merchant-id="merchantId"
      :invalid="imageInvalid"
      :demo="preview"
      :disabled="saving || !owned"
      @update:model-value="updateImages"
      @busy="$emit('image-busy', $event)"
      @invalid="$emit('image-invalid', $event)"
    />
    <div class="form-buttons">
      <button type="button" class="outline-button" @click="$emit('close')">取消</button>
      <button
        type="submit"
        class="teal-button"
        :disabled="preview || saving || imageUploading || imageInvalid || !owned"
      >
        保存商品
      </button>
    </div>
  </form>
</template>
