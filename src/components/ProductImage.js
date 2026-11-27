const { computed, ref, watch } = Vue;

/** 商品图统一占位；接口无图、链接失效时不借用其他商品的图片。 */
export default {
  name: 'ProductImage',
  props: {
    src: { type: String, default: '' },
    alt: { type: String, default: '商品图片' },
    loading: { type: String, default: 'lazy' },
  },
  setup(props) {
    const broken = ref(false);
    watch(
      () => props.src,
      () => {
        broken.value = false;
      },
    );
    const url = computed(() =>
      !broken.value && props.src?.trim() ? props.src : './images/product-placeholder.svg',
    );
    function handleError() {
      if (!broken.value) broken.value = true;
    }
    return { url, handleError };
  },
  template: `<img :src="url" :alt="alt" :loading="loading" @error="handleError"/>`,
};
