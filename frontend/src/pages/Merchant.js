import MerchantCreateForm from '../components/MerchantCreateForm.vue';
import { requestScope } from '../services/request-scope.js';
import { priceSku } from '../services/page-utils.js';
import { api, idempotency } from '../services/api.js';
import AuthDialog from '../components/AuthDialog.js';
import ProductImage from '../components/ProductImage.js';
import ProductImageField from '../components/ProductImageField.js';
import ProductImageListField from '../components/ProductImageListField.js';
import BackofficeShell from '../components/BackofficeShell.js';
import {
  store,
  go,
  money,
  skuOf,
  available,
  preview,
  previewGuard,
  notify,
  loadMerchant,
  invalidateMerchantSearch,
  hasPermission,
  switchMerchantContext,
} from '../services/store.js';
const { ref, computed, watch, nextTick, onMounted, onUnmounted } = Vue;
export default {
  name: 'Merchant',
  components: {
    BackofficeShell,
    AuthDialog,
    ProductImage,
    ProductImageField,
    ProductImageListField,
    MerchantCreateForm,
  },
  setup() {
    const scope = requestScope();
    const search = ref('');
    const category = ref('');
    const status = ref('');
    const sort = ref('NEWEST');
    const page = ref(1);
    const selectedId = ref('');
    const selectedSkuId = ref('');
    const drawerTab = ref('stock');
    const loginOpen = ref(false);
    const adjustment = ref(1);
    const pendingReplenishKey = ref('');
    const pendingReplenishPayload = ref('');
    const saving = ref(false);
    const modal = ref('');
    const activePriceSku = ref(null);
    const newPrice = ref('');
    const form = ref({
      title: '',
      description: '',
      categoryCode: 'food',
      imageUrl: '',
      imageUrls: [],
      skus: [{ specKey: '默认规格', price: '4.50' }],
    });
    const skuForm = ref({ specKey: '', price: '' });
    const info = ref({
      title: '',
      description: '',
      categoryCode: 'food',
      imageUrl: '',
      imageUrls: [],
    });
    const createImageUploading = ref(false),
      editImageUploading = ref(false);
    const createImageInvalid = ref(false),
      editImageInvalid = ref(false);
    const merchant = computed(
      () =>
        store.merchants.find((m) => m.merchantId === store.merchantId) || store.merchants[0] || {},
    );
    const owned = computed(() => hasPermission('product.write'));
    const canReplenish = computed(() => hasPermission('stock.replenish'));
    const canRead = computed(() => hasPermission('product.read'));
    const items = computed(() => store.products.filter((p) => p.merchantId === store.merchantId));
    const selected = computed(
      () => items.value.find((p) => p.productId === selectedId.value) || items.value[0] || null,
    );
    const selectedSku = computed(
      () =>
        selected.value?.skus?.find((s) => s.skuId === selectedSkuId.value) || skuOf(selected.value),
    );
    const stock = computed(
      () => store.stocks.find((s) => s.skuId === selectedSku.value?.skuId) || null,
    );
    const activeSkuCount = (p) => (p?.skus || []).filter((s) => s.status === 'ACTIVE').length;
    const skuStatusReason = (p, s) =>
      p?.status === 'PUBLISHED' && s.status === 'ACTIVE' && activeSkuCount(p) <= 1
        ? '已上架商品须保留至少一个有效规格'
        : '';
    const publishReason = (p) =>
      p?.status !== 'PUBLISHED' && !activeSkuCount(p) ? '请先启用至少一个规格再上架' : '';
    const count = computed(() => ({
      all: items.value.length,
      published: items.value.filter((p) => p.status === 'PUBLISHED').length,
      unpublished: items.value.filter((p) => p.status !== 'PUBLISHED').length,
      low: items.value.filter((p) => p.status === 'PUBLISHED' && available(p) < 20).length,
    }));
    const filtered = computed(() => {
      if (!preview) return items.value;
      const q = search.value.trim().toLowerCase();
      return items.value.filter(
        (p) =>
          (!q ||
            p.title.toLowerCase().includes(q) ||
            p.skus.some(
              (s) => s.specKey.toLowerCase().includes(q) || s.skuId.toLowerCase().includes(q),
            )) &&
          (!category.value || p.categoryCode === category.value) &&
          (!status.value ||
            (status.value === 'low'
              ? p.status === 'PUBLISHED' && available(p) < 20
              : p.status === status.value)),
      );
    });
    const totalPages = computed(() =>
      Math.max(1, Math.ceil((preview ? filtered.value.length : store.merchantPage.total) / 9)),
    );
    const pageRows = computed(() =>
      preview ? filtered.value.slice((page.value - 1) * 9, page.value * 9) : filtered.value,
    );
    const inventoryPercent = computed(() =>
      Math.min(
        100,
        (Number(stock.value?.available || 0) / Math.max(1, Number(stock.value?.onHand || 0))) * 100,
      ),
    );
    const tableCategory = (p) =>
      store.categories.find((c) => c.code === p.categoryCode)?.name || p.categoryCode;
    const choose = (p) => {
      if (p.productId !== selected.value?.productId) editImageInvalid.value = false;
      selectedId.value = p.productId;
      selectedSkuId.value = skuOf(p).skuId || '';
      drawerTab.value = 'stock';
    };
    watch(
      selected,
      (p, previous) => {
        if (p?.productId !== previous?.productId) {
          editImageInvalid.value = false;
          editImageUploading.value = false;
        }
        if (p) {
          if (!p.skus.some((s) => s.skuId === selectedSkuId.value))
            selectedSkuId.value = skuOf(p).skuId || '';
          info.value = {
            title: p.title,
            description: p.description || '',
            categoryCode: p.categoryCode,
            imageUrl: p.imageUrl || '',
            imageUrls: p.images?.length
              ? p.images.map((i) => i.url)
              : p.imageUrl
                ? [p.imageUrl]
                : [],
          };
        }
      },
      { immediate: true },
    );
    let searchDelay;
    function refreshPage() {
      if (preview) return;
      loadMerchant({
        signal: scope.begin().signal,
        page: page.value,
        size: 9,
        q: search.value,
        category: category.value,
        status: status.value === 'low' ? 'LOW_STOCK' : status.value,
        sort: sort.value,
      });
    }
    onMounted(refreshPage);
    onUnmounted(() => clearTimeout(searchDelay));
    let resettingPage = false;
    watch(
      [page, search, category, status, sort],
      (next, previous) => {
        if (resettingPage) return;
        clearTimeout(searchDelay);
        if (!preview) {
          invalidateMerchantSearch();
          scope.begin();
          store.loading = true;
        }
        const changed = next.slice(1).some((v, i) => v !== previous[i + 1]);
        if (changed) {
          resettingPage = true;
          page.value = 1;
          resettingPage = false;
        }
        searchDelay = setTimeout(refreshPage, next[1] !== previous[1] ? 280 : 0);
      },
      { flush: 'sync' },
    );
    function openCreate() {
      createImageUploading.value = false;
      createImageInvalid.value = false;
      form.value = {
        title: '',
        description: '',
        categoryCode: store.categories.find((c) => c.active)?.code || 'food',
        imageUrl: '',
        imageUrls: [],
        skus: [{ specKey: '默认规格', price: '' }],
      };
      modal.value = 'create';
    }
    function openPrice(sku) {
      activePriceSku.value = sku;
      newPrice.value = (Number(sku.priceCent) / 100).toFixed(2);
      modal.value = 'price';
    }
    function yuanToCent(value) {
      const v = String(value).trim();
      if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) throw new Error('请输入正确金额（最多两位小数）');
      const [a, b = ''] = v.split('.');
      const cent = Number(a) * 100 + Number((b + '00').slice(0, 2));
      if (cent <= 0) throw new Error('价格必须大于零');
      if (cent > 100000000) throw new Error('价格不能超过1,000,000元');
      return cent;
    }
    async function create() {
      if (previewGuard() || saving.value || createImageUploading.value) return;
      if (createImageInvalid.value) {
        notify('请重新选择图片，或移除失败的图片');
        return;
      }
      const f = form.value;
      if (!f.title.trim() || !f.skus.length || f.skus.length > 20) {
        notify('请填写商品名称及1至20个规格');
        return;
      }
      const keys = new Set();
      let skus;
      try {
        skus = f.skus.map((item) => {
          const specKey = item.specKey.trim();
          if (!specKey || specKey.length > 100 || keys.has(specKey))
            throw new Error('规格不能为空且不能重复');
          keys.add(specKey);
          return { specKey, priceCent: yuanToCent(item.price) };
        });
      } catch (e) {
        notify(e.message);
        return;
      }
      saving.value = true;
      try {
        await api('/merchants/' + encodeURIComponent(store.merchantId) + '/products', {
          method: 'POST',
          body: {
            title: f.title.trim(),
            description: f.description.trim(),
            categoryCode: f.categoryCode,
            imageUrl: f.imageUrl || '',
            imageUrls: f.imageUrls,
            skus,
          },
        });
        modal.value = '';
        await loadMerchant();
        notify('商品已创建（草稿）');
      } catch (e) {
        notify(e.message);
      } finally {
        saving.value = false;
      }
    }
    function addCreateSku() {
      if (form.value.skus.length < 20) form.value.skus.push({ specKey: '', price: '' });
    }
    function removeCreateSku(index) {
      if (form.value.skus.length > 1) form.value.skus.splice(index, 1);
    }
    function openAddSku() {
      skuForm.value = { specKey: '', price: '' };
      modal.value = 'addSku';
    }
    async function addSku() {
      if (previewGuard() || saving.value || !owned.value || !selected.value) return;
      const specKey = skuForm.value.specKey.trim();
      if (
        !specKey ||
        specKey.length > 100 ||
        selected.value.skus.some((s) => s.specKey === specKey)
      ) {
        notify('规格不能为空且不能重复');
        return;
      }
      let priceCent;
      try {
        priceCent = yuanToCent(skuForm.value.price);
      } catch (e) {
        notify(e.message);
        return;
      }
      saving.value = true;
      try {
        await api(
          '/merchants/' +
            encodeURIComponent(store.merchantId) +
            '/products/' +
            encodeURIComponent(selected.value.productId) +
            '/skus',
          { method: 'POST', body: { specKey, priceCent } },
        );
        modal.value = '';
        await loadMerchant();
        notify('规格已新增');
        drawerTab.value = 'sku';
      } catch (e) {
        notify(e.message);
      } finally {
        saving.value = false;
      }
    }
    async function changeSkuStatus(sku) {
      if (skuStatusReason(selected.value, sku)) {
        notify(skuStatusReason(selected.value, sku));
        return;
      }
      if (previewGuard() || saving.value || !owned.value || !selected.value) return;
      saving.value = true;
      try {
        await api(
          '/merchants/' +
            encodeURIComponent(store.merchantId) +
            '/products/' +
            encodeURIComponent(selected.value.productId) +
            '/skus/' +
            encodeURIComponent(sku.skuId) +
            '/status',
          {
            method: 'PUT',
            body: { active: sku.status !== 'ACTIVE', expectedVersion: selected.value.version },
          },
        );
        await loadMerchant();
        notify('规格状态已更新');
      } catch (e) {
        notify(e.message);
      } finally {
        saving.value = false;
      }
    }
    async function publish(p) {
      if (publishReason(p)) {
        notify(publishReason(p));
        return;
      }
      if (previewGuard() || saving.value || !owned.value) return;
      saving.value = true;
      try {
        await api(
          '/merchants/' +
            encodeURIComponent(store.merchantId) +
            '/products/' +
            encodeURIComponent(p.productId) +
            '/publish',
          { method: 'POST', body: { published: p.status !== 'PUBLISHED' } },
        );
        await loadMerchant();
        notify(p.status === 'PUBLISHED' ? '已下架' : '已上架');
      } catch (err) {
        notify(err.message);
      } finally {
        saving.value = false;
      }
    }
    async function replenish() {
      if (previewGuard() || saving.value || !canReplenish.value || !selectedSku.value?.skuId)
        return;
      const n = Number(adjustment.value);
      if (!Number.isInteger(n) || n < 1 || n > 1000000) {
        notify('补货数量必须为1~1000000');
        return;
      }
      const fingerprint = store.merchantId + ':' + selectedSku.value.skuId + ':' + n;
      if (fingerprint !== pendingReplenishPayload.value) {
        pendingReplenishKey.value = idempotency();
        pendingReplenishPayload.value = fingerprint;
      }
      saving.value = true;
      try {
        await api(
          '/merchants/' +
            encodeURIComponent(store.merchantId) +
            '/stocks/' +
            encodeURIComponent(selectedSku.value.skuId) +
            '/replenish',
          { method: 'POST', body: { quantity: n }, key: pendingReplenishKey.value },
        );
        pendingReplenishKey.value = '';
        pendingReplenishPayload.value = '';
        adjustment.value = 1;
        await loadMerchant();
        notify('补货完成');
      } catch (err) {
        notify(err.message);
      } finally {
        saving.value = false;
      }
    }
    async function saveInfo() {
      if (
        previewGuard() ||
        !owned.value ||
        saving.value ||
        editImageUploading.value ||
        !selected.value
      )
        return;
      if (editImageInvalid.value) {
        notify('请重新选择图片，或移除失败的图片');
        return;
      }
      if (!info.value.title.trim()) {
        notify('商品名称不能为空');
        return;
      }
      saving.value = true;
      try {
        await api(
          '/merchants/' +
            encodeURIComponent(store.merchantId) +
            '/products/' +
            encodeURIComponent(selected.value.productId),
          {
            method: 'PUT',
            body: {
              title: info.value.title.trim(),
              description: info.value.description.trim(),
              categoryCode: info.value.categoryCode,
              imageUrl: info.value.imageUrl || '',
              imageUrls: info.value.imageUrls,
              expectedVersion: selected.value.version,
            },
          },
        );
        await loadMerchant();
        notify('商品信息已更新');
      } catch (err) {
        notify(err.message);
      } finally {
        saving.value = false;
      }
    }
    async function savePrice() {
      if (
        previewGuard() ||
        !owned.value ||
        saving.value ||
        !activePriceSku.value ||
        !selected.value
      )
        return;
      let cent;
      try {
        cent = yuanToCent(newPrice.value);
      } catch (e) {
        notify(e.message);
        return;
      }
      saving.value = true;
      try {
        await api(
          '/merchants/' +
            encodeURIComponent(store.merchantId) +
            '/products/' +
            encodeURIComponent(selected.value.productId) +
            '/skus/' +
            encodeURIComponent(activePriceSku.value.skuId) +
            '/price',
          { method: 'PUT', body: { priceCent: cent, expectedVersion: selected.value.version } },
        );
        modal.value = '';
        await loadMerchant();
        notify('售价已更新');
      } catch (err) {
        notify(err.message);
      } finally {
        saving.value = false;
      }
    }
    async function switchMerchant(e) {
      if (preview) {
        notify('设计预览：仅展示示例门店');
        return;
      }
      switchMerchantContext(e.target.value);
      selectedId.value = '';
    }
    return {
      priceSku,
      sort,
      canRead,
      canReplenish,
      skuForm,
      addCreateSku,
      removeCreateSku,
      openAddSku,
      addSku,
      loginOpen,
      store,
      go,
      money,
      skuOf,
      available,
      preview,
      previewGuard,
      notify,
      loadMerchant,
      invalidateMerchantSearch,
      owned,
      merchant,
      search,
      category,
      status,
      page,
      selectedId,
      selectedSkuId,
      drawerTab,
      adjustment,
      saving,
      modal,
      activePriceSku,
      newPrice,
      form,
      info,
      selected,
      selectedSku,
      stock,
      count,
      filtered,
      totalPages,
      pageRows,
      inventoryPercent,
      tableCategory,
      createImageUploading,
      editImageUploading,
      createImageInvalid,
      editImageInvalid,
      choose,
      openCreate,
      openPrice,
      create,
      publish,
      skuStatusReason,
      publishReason,
      changeSkuStatus,
      replenish,
      saveInfo,
      savePrice,
      switchMerchant,
    };
  },
  template: `
  <BackofficeShell title="商品管理">
    <template #actions><div class="head-actions"><button class="outline-button small" @click="loadMerchant" :disabled="store.loading"><Icon name="refresh" :size="16"/>刷新</button><button class="teal-button" @click="openCreate" :disabled="!owned"><Icon name="plus" :size="18"/>新增商品</button></div></template>
        <div v-if="store.error" class="inline-error merchant-error"><Icon name="alert" :size="18"/>{{store.error}}<button v-if="!preview" class="merchant-login-action" @click="loginOpen=true">登录账号</button></div>
        <div v-if="!canRead" class="ops-card access-denied">当前角色没有商品查看权限，请联系商户经营者授权。</div><template v-else><section class="inventory-summary" aria-label="商品概况">
          <div class="summary-piece"><span class="summary-icon blue"><Icon name="package" :size="20"/></span><div><span>{{preview?'全部商品':'筛选商品'}}</span><strong>{{preview?count.all:store.merchantPage.total}}</strong></div></div>
          <div class="summary-piece"><span class="summary-icon green"><Icon name="check" :size="20"/></span><div><span>本页在售</span><strong>{{count.published}}</strong></div></div>
          <div class="summary-piece"><span class="summary-icon orange"><Icon name="box" :size="20"/></span><div><span>本页未上架</span><strong>{{count.unpublished}}</strong></div></div>
          <div class="summary-piece"><span class="summary-icon red"><Icon name="alert" :size="20"/></span><div><span>本页低库存</span><strong>{{count.low}}</strong></div></div>
          <div class="summary-stockbar"><span>本页上架率</span><div class="summary-stockbar-track"><span :style="{width:(count.all?count.published/count.all*100:0)+'%'}"></span></div><strong>{{count.all?Math.round(count.published/count.all*100):0}}%</strong></div>
        </section>
        <section class="product-workspace">
          <div class="product-list-panel">
            <div class="product-tabs"><button :class="{active:status===''}" @click="status=''">全部 <b v-if="preview||status===''">{{preview?count.all:store.merchantPage.total}}</b></button><button :class="{active:status==='PUBLISHED'}" @click="status='PUBLISHED'">在售 <b v-if="preview||status==='PUBLISHED'">{{preview?count.published:store.merchantPage.total}}</b></button><button :class="{active:status==='UNPUBLISHED'}" @click="status='UNPUBLISHED'">已下架</button><button :class="{active:status==='low'}" @click="status='low'">本页低库存 <b>{{count.low}}</b></button></div>
            <div class="product-toolbar"><label class="table-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="商品名称 / SKU / 规格" aria-label="搜索商品"/></label><label class="table-select"><select v-model="category" aria-label="分类筛选"><option value="">全部分类</option><option v-for="c in store.categories" :value="c.code">{{c.name}}</option></select><Icon name="chevronDown" :size="14"/></label><label class="table-select"><select v-model="sort" aria-label="全局排序"><option value="NEWEST">最新上架</option><option value="PRICE_ASC">全局价格升序</option><option value="STOCK_DESC">全局可售库存</option></select></label><button class="filter-reset" @click="search='';category='';status='';sort='NEWEST'">重置</button><span class="toolbar-count">{{preview?filtered.length:store.merchantPage.total}} 件</span></div>
            <div class="product-table-scroll"><table class="product-table"><thead><tr><th>商品</th><th>SKU / 规格</th><th>分类</th><th class="t-right">售价</th><th class="t-right">可售</th><th>状态</th><th class="t-right">操作</th></tr></thead><tbody>
              <tr v-for="p in pageRows" :key="p.productId" :class="{'row-selected':selected?.productId===p.productId}" @click="choose(p)">
                <td><div class="table-product-cell"><ProductImage :src="p.imageUrl" :alt="p.title"/><div><button class="row-link" @click.stop="choose(p)" :aria-pressed="selected?.productId===p.productId">{{p.title}}</button><span>{{p.description||'—'}}</span></div></div></td>
                <td><div class="sku-column"><span>{{skuOf(p).specKey||'—'}}</span><small>{{skuOf(p).skuId?.startsWith('preview')?'SKU-'+p.productId.slice(-2):skuOf(p).skuId?.slice(-8)||'—'}}</small></div></td>
                <td><span class="category-label">{{tableCategory(p)}}</span></td>
                <td class="t-right table-price">{{priceSku(p) ? money(priceSku(p).priceCent)+' 起' : '暂无有效规格'}}</td>
                <td class="t-right" :class="{'red-text':available(p)<20}">{{available(p)}}</td>
                <td><span class="status-tag" :class="p.status==='PUBLISHED'?'published':p.status==='DRAFT'?'draft':'unpublished'"><i></i>{{p.status==='PUBLISHED'?'在售':p.status==='DRAFT'?'草稿':'已下架'}}</span></td>
                <td class="t-right"><button class="row-link" @click.stop="choose(p)">查看 <Icon name="chevronRight" :size="14" /></button></td>
              </tr></tbody></table>
              <div v-if="!pageRows.length" class="admin-empty"><Icon name="search" :size="23"/><span>没有符合条件的商品</span></div>
            </div>
            <div class="table-footer"><span>共 {{preview?filtered.length:store.merchantPage.total}} 条</span><div><button :disabled="page<=1" @click="page--" aria-label="上一页"><Icon name="arrowLeft" :size="16"/></button><button v-for="n in totalPages" :key="n" :class="{active:page===n}" @click="page=n">{{n}}</button><button :disabled="page>=totalPages" @click="page++" aria-label="下一页"><Icon name="chevronRight" :size="16"/></button></div></div>
          </div>
          <aside class="product-inspector" v-if="selected">
            <div class="inspector-head"><span class="inspector-title">商品详情</span><span class="inspector-id">{{selected.productId?.slice(-9)}}</span></div>
            <div class="inspector-product"><ProductImage :src="selected.imageUrl" :alt="selected.title"/><div><strong>{{selected.title}}</strong><span>{{tableCategory(selected)}} · {{selected.skus.length}} 个规格</span><span class="status-tag compact" :class="selected.status==='PUBLISHED'?'published':'unpublished'"><i></i>{{selected.status==='PUBLISHED'?'在售':'未上架'}}</span></div></div>
            <div class="inspector-tabs"><button :class="{active:drawerTab==='stock'}" @click="drawerTab='stock'">库存</button><button :class="{active:drawerTab==='info'}" @click="drawerTab='info'">基本信息</button><button :class="{active:drawerTab==='sku'}" @click="drawerTab='sku'">规格售价</button></div>
            <div class="inspector-body" v-if="drawerTab==='stock'">
              <label class="field-label" for="merchant-field-1">选择规格</label><select id="merchant-field-1" v-model="selectedSkuId" class="inspector-select"><option v-for="s in selected.skus" :key="s.skuId" :value="s.skuId">{{s.specKey}}</option></select>
              <div class="stock-metrics"><div><small>实物库存</small><strong>{{stock?.onHand??'—'}}</strong></div><div><small>已预占</small><strong>{{stock?.reserved??'—'}}</strong></div><div><small>可售库存</small><strong class="mint-text">{{stock?.available??selectedSku?.available??'—'}}</strong></div></div>
              <div class="stock-progress"><div class="stock-progress-top"><span>可售占比</span><strong>{{Math.round(inventoryPercent)}}%</strong></div><div class="track"><span :style="{width:inventoryPercent+'%'}"></span></div></div>
              <div v-if="stock && stock.available<20" class="stock-warning"><Icon name="alert" :size="17"/>库存偏低，建议及时补货</div>
              <div class="inspector-divider"></div><h3 class="field-heading">库存补货</h3><label class="field-label" for="restock-n">增加数量</label><div class="number-input"><button @click="adjustment=Math.max(1,Number(adjustment)-1)" aria-label="减少补货数量"><Icon name="minus" :size="17" /></button><input id="restock-n" v-model.number="adjustment" type="number" min="1" max="1000000"/><button @click="adjustment=Math.min(1000000,Number(adjustment)+1)" aria-label="增加补货数量"><Icon name="plus" :size="17" /></button></div>
              <button class="teal-button inspector-submit" @click="replenish" :disabled="preview||saving||!canReplenish||!selectedSku?.skuId">确认补货</button>
            </div>
            <div class="inspector-body" v-else-if="drawerTab==='info'"><label class="field-label" for="merchant-field-2">商品名称</label><input id="merchant-field-2" class="admin-input" v-model="info.title" :disabled="!owned"/><label class="field-label" for="merchant-field-3">商品分类</label><select id="merchant-field-3" class="admin-input" v-model="info.categoryCode" :disabled="!owned"><option v-for="c in store.categories" :key="c.code" :value="c.code">{{c.name}}</option></select><label class="field-label" for="merchant-field-4">商品描述</label><textarea id="merchant-field-4" class="admin-input" rows="4" v-model="info.description" :disabled="!owned"></textarea><label class="field-label">商品主图</label><ProductImageListField v-model="info.imageUrls" :merchant-id="store.merchantId" :context-key="selected.productId" :invalid="editImageInvalid" :demo="preview" :disabled="!owned||saving" @busy="editImageUploading=$event" @invalid="editImageInvalid=$event"/><button class="teal-button inspector-submit" @click="saveInfo" :disabled="preview||saving||editImageUploading||editImageInvalid||!owned">保存修改</button><button class="inspector-link" @click="publish(selected)" :disabled="preview||saving||!owned||!!publishReason(selected)" :title="publishReason(selected)">{{selected.status==='PUBLISHED'?'下架商品':'上架商品'}} <Icon name="chevronRight" :size="16"/></button><p v-if="publishReason(selected)" class="mobile-hint">{{publishReason(selected)}}</p></div>
            <div class="inspector-body" v-else><div class="sku-item" v-for="sku in selected.skus" :key="sku.skuId"><div><strong>{{sku.specKey}}</strong><small>{{sku.skuId}} · {{sku.status==='ACTIVE'?'在售':'已停用'}}</small></div><strong>{{money(sku.priceCent)}}</strong><button :disabled="!owned||preview||saving||!!skuStatusReason(selected,sku)" :title="skuStatusReason(selected,sku)" @click="changeSkuStatus(sku)" :aria-label="(sku.status==='ACTIVE'?'停用':'启用')+sku.specKey">{{sku.status==='ACTIVE'?'停用':'启用'}}</button><button :disabled="!owned||preview||saving" @click="openPrice(sku)" title="修改售价"><Icon name="edit" :size="17"/></button></div><p v-if="selected.status==='PUBLISHED'" class="mobile-hint">已上架商品须保留至少一个有效规格。</p><button class="outline-button small" :disabled="!owned||preview||selected.skus.length>=20" @click="openAddSku"><Icon name="plus" :size="16"/>新增规格</button></div>
          </aside>
          <div v-else class="product-inspector empty-inspector"><Icon name="package" :size="28"/>选择商品以查看详情</div>
        </section>
      </template>
    <div v-if="modal" v-modal="() => modal=''" class="ui-overlay" @click.self="modal=''">
      <MerchantCreateForm v-if="modal==='create'" v-model:form="form" :categories="store.categories" :merchant-id="store.merchantId" :preview="preview" :owned="owned" :saving="saving" :image-uploading="createImageUploading" :image-invalid="createImageInvalid" @close="modal=''" @submit="create" @add-sku="addCreateSku" @remove-sku="removeCreateSku" @image-busy="createImageUploading=$event" @image-invalid="createImageInvalid=$event"/>
      <form class="merchant-modal narrow" v-else-if="modal==='addSku'" @submit.prevent="addSku"><div class="merchant-modal-header"><h2>新增规格</h2><button type="button" @click="modal=''" aria-label="关闭"><Icon name="x" :size="18"/></button></div><label class="field-label" for="merchant-field-8">规格名称</label><input id="merchant-field-8" class="admin-input" maxlength="100" v-model="skuForm.specKey" required placeholder="例如：500ml"/><label class="field-label" for="merchant-field-9">售价（元）</label><input id="merchant-field-9" class="admin-input" v-model="skuForm.price" inputmode="decimal" required placeholder="0.00"/><div class="form-buttons"><button type="button" class="outline-button" @click="modal=''">取消</button><button type="submit" class="teal-button" :disabled="preview||saving">保存规格</button></div></form><form class="merchant-modal narrow" v-else-if="modal==='price'" @submit.prevent="savePrice"><div class="merchant-modal-header"><div><h2>修改售价</h2></div><button type="button" @click="modal=''" aria-label="关闭"><Icon name="x" :size="20"/></button></div><div class="field-muted">{{selected?.title}} · {{activePriceSku?.specKey}}</div><label class="field-label" for="merchant-field-10">售价（元）</label><input id="merchant-field-10" class="admin-input" v-model="newPrice" inputmode="decimal" required/><div class="form-buttons"><button type="button" class="outline-button" @click="modal=''">取消</button><button type="submit" class="teal-button" :disabled="preview||saving">保存售价</button></div></form>
    </div>
    <AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="loadMerchant" />
  </BackofficeShell>`,
};
