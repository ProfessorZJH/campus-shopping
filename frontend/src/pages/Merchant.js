import { api, idempotency } from '../services/api.js';
import AuthDialog from '../components/AuthDialog.js';
import ProductImage from '../components/ProductImage.js';
import ProductImageField from '../components/ProductImageField.js';
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
  hasPermission,
  switchMerchantContext,
} from '../services/store.js';
const { ref, computed, watch, nextTick, onMounted, onUnmounted } = Vue;
const MENU = [
  ['home', '工作台', '/merchant'],
  ['package', '商品管理', '/merchant/products'],
  ['box', '库存管理', '/merchant/inventory'],
  ['order', '订单管理', '/merchant/orders'],
  ['scan', '自提核销', '/merchant/pickup'],
  ['clipboard', '售后处理', '/merchant/aftersales'],
  ['users', '店员管理', '/merchant/team'],
  ['shield', '角色权限', '/merchant/roles'],
  ['book', '知识库', '/merchant/knowledge'],
  ['settings', '门店设置', '/merchant/settings'],
];
export default {
  name: 'Merchant',
  components: { AuthDialog, ProductImage, ProductImageField },
  setup() {
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
      skus: [{ specKey: '默认规格', price: '4.50' }],
    });
    const skuForm = ref({ specKey: '', price: '' });
    const info = ref({ title: '', description: '', categoryCode: 'food', imageUrl: '' });
    const createImageUploading = ref(false),
      editImageUploading = ref(false);
    const createImageInvalid = ref(false),
      editImageInvalid = ref(false);
    const merchant = computed(
      () =>
        store.merchants.find((m) => m.merchantId === store.merchantId) || store.merchants[0] || {},
    );
    const owned = computed(() => hasPermission('product.write'));
    const required = {
      '/merchant': 'order.read',
      '/merchant/products': 'product.read',
      '/merchant/inventory': 'stock.read',
      '/merchant/orders': 'order.read',
      '/merchant/pickup': 'pickup.verify',
      '/merchant/aftersales': 'aftersale.read',
      '/merchant/team': 'team.manage',
      '/merchant/roles': 'role.manage',
      '/merchant/knowledge': 'knowledge.read',
      '/merchant/settings': 'store.manage',
    };
    const visibleMenu = computed(() => MENU.filter(([, , path]) => hasPermission(required[path])));
    const mobileNav = ref(null);
    const alignMobileNav = () => {
      const nav = mobileNav.value;
      if (nav?.clientWidth)
        nav.querySelector('button.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    };
    watch(
      [() => store.route, () => visibleMenu.value.map((item) => item[2]).join('|')],
      async () => {
        await nextTick();
        alignMobileNav();
      },
      { immediate: true, flush: 'post' },
    );
    onMounted(() => window.addEventListener('resize', alignMobileNav));
    onUnmounted(() => window.removeEventListener('resize', alignMobileNav));
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
    const priceSku = (p) =>
      [...(p?.skus || [])]
        .filter((s) => s.status === 'ACTIVE')
        .sort((a, b) => Number(a.priceCent) - Number(b.priceCent))[0] || skuOf(p);
    const count = computed(() => ({
      all: items.value.length,
      published: items.value.filter((p) => p.status === 'PUBLISHED').length,
      unpublished: items.value.filter((p) => p.status !== 'PUBLISHED').length,
      low: items.value.filter((p) => p.status === 'PUBLISHED' && available(p) < 20).length,
    }));
    const filtered = computed(() => {
      if (!preview)
        return status.value === 'low'
          ? items.value.filter((p) => p.status === 'PUBLISHED' && available(p) < 20)
          : items.value;
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
      editImageInvalid.value = false;
      selectedId.value = p.productId;
      selectedSkuId.value = skuOf(p).skuId || '';
      drawerTab.value = 'stock';
    };
    watch(
      selected,
      (p) => {
        if (p) {
          if (!p.skus.some((s) => s.skuId === selectedSkuId.value))
            selectedSkuId.value = skuOf(p).skuId || '';
          info.value = {
            title: p.title,
            description: p.description || '',
            categoryCode: p.categoryCode,
            imageUrl: p.imageUrl || '',
          };
        }
      },
      { immediate: true },
    );
    let searchDelay;
    function refreshPage() {
      if (preview) return;
      loadMerchant({
        page: page.value,
        size: 9,
        q: search.value,
        category: category.value,
        status: status.value === 'low' ? '' : status.value,
        sort: sort.value,
      });
    }
    watch([category, status, sort], () => {
      page.value = 1;
      refreshPage();
    });
    watch(search, () => {
      page.value = 1;
      clearTimeout(searchDelay);
      searchDelay = setTimeout(refreshPage, 280);
    });
    watch(page, refreshPage);
    function openCreate() {
      createImageUploading.value = false;
      createImageInvalid.value = false;
      form.value = {
        title: '',
        description: '',
        categoryCode: store.categories.find((c) => c.active)?.code || 'food',
        imageUrl: '',
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
    async function publish(p) {
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
      await loadMerchant();
    }
    return {
      mobileNav,
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
      owned,
      merchant,
      visibleMenu,
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
      replenish,
      saveInfo,
      savePrice,
      switchMerchant,
    };
  },
  template: `
  <div class="merchant-shell">
    <aside class="merchant-sidebar">
      <button class="merchant-brand" @click="go('/')"><span class="brand-pin"><span></span></span><span class="brand-word">青柠校园<span class="brand-suffix"> / 商户端</span></span></button>
      
      <nav class="merchant-nav"><button v-for="([icon,label,path]) in visibleMenu" :key="path" :class="{active:store.route===path}" @click="go(path)"><Icon :name="icon" :size="19"/><span>{{label}}</span><span v-if="store.route===path" class="nav-left-bar"></span></button></nav>
      <div class="merchant-sidebar-bottom"><button class="sidebar-back" @click="go('/')"><Icon name="arrowLeft" :size="16"/> 返回购物端</button></div>
    </aside>
    <div class="merchant-content-shell">
      <header class="merchant-topbar"><div class="topbar-crumb">运营中心 <Icon name="chevronRight" :size="14"/> <strong>商品管理</strong></div><div class="merchant-topbar-tools"><div v-if="preview" class="admin-preview-tag"><Icon name="circleHelp" :size="14"/>演示数据</div><div class="topbar-merchant-select"><Icon name="store" :size="16"/><select :value="store.merchantId" @change="switchMerchant" :disabled="preview"><option v-for="m in store.merchants" :value="m.merchantId" :key="m.merchantId">{{m.name}} · {{m.storeName}}</option></select><Icon name="chevronDown" :size="13"/></div><span class="admin-avatar">{{store.user?.displayName?.slice(0,1)||'店'}}</span><span class="admin-user">{{store.user?.displayName||'店铺账号'}}</span></div></header>

      <nav ref="mobileNav" class="merchant-mobile-nav" aria-label="工作台导航"><button v-for="([icon,label,path]) in visibleMenu" :key="path" :class="{active:store.route===path}" @click="go(path)"><Icon :name="icon" :size="16"/>{{label}}</button></nav>

      <main class="merchant-main">
        <div class="merchant-page-heading"><div><h1>商品管理</h1></div><div class="head-actions"><button class="outline-button small" @click="loadMerchant" :disabled="store.loading"><Icon name="refresh" :size="16"/>刷新</button><button class="teal-button" @click="openCreate" :disabled="!owned"><Icon name="plus" :size="18"/>新增商品</button></div></div>
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
                <td><div class="table-product-cell"><ProductImage :src="p.imageUrl" :alt="p.title"/><div><strong>{{p.title}}</strong><span>{{p.description||'—'}}</span></div></div></td>
                <td><div class="sku-column"><span>{{skuOf(p).specKey||'—'}}</span><small>{{skuOf(p).skuId?.startsWith('preview')?'SKU-'+p.productId.slice(-2):skuOf(p).skuId?.slice(-8)||'—'}}</small></div></td>
                <td><span class="category-label">{{tableCategory(p)}}</span></td>
                <td class="t-right table-price">{{money(priceSku(p).priceCent)}}</td>
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
              <label class="field-label">选择规格</label><select v-model="selectedSkuId" class="inspector-select"><option v-for="s in selected.skus" :key="s.skuId" :value="s.skuId">{{s.specKey}}</option></select>
              <div class="stock-metrics"><div><small>实物库存</small><strong>{{stock?.onHand??'—'}}</strong></div><div><small>已预占</small><strong>{{stock?.reserved??'—'}}</strong></div><div><small>可售库存</small><strong class="mint-text">{{stock?.available??selectedSku?.available??'—'}}</strong></div></div>
              <div class="stock-progress"><div class="stock-progress-top"><span>可售占比</span><strong>{{Math.round(inventoryPercent)}}%</strong></div><div class="track"><span :style="{width:inventoryPercent+'%'}"></span></div></div>
              <div v-if="stock && stock.available<20" class="stock-warning"><Icon name="alert" :size="17"/>库存偏低，建议及时补货</div>
              <div class="inspector-divider"></div><h3 class="field-heading">库存补货</h3><label class="field-label" for="restock-n">增加数量</label><div class="number-input"><button @click="adjustment=Math.max(1,Number(adjustment)-1)" aria-label="减少补货数量"><Icon name="minus" :size="17" /></button><input id="restock-n" v-model.number="adjustment" type="number" min="1" max="1000000"/><button @click="adjustment=Math.min(1000000,Number(adjustment)+1)" aria-label="增加补货数量"><Icon name="plus" :size="17" /></button></div>
              <button class="teal-button inspector-submit" @click="replenish" :disabled="preview||saving||!canReplenish||!selectedSku?.skuId">确认补货</button>
            </div>
            <div class="inspector-body" v-else-if="drawerTab==='info'"><label class="field-label">商品名称</label><input class="admin-input" v-model="info.title" :disabled="!owned"/><label class="field-label">商品分类</label><select class="admin-input" v-model="info.categoryCode" :disabled="!owned"><option v-for="c in store.categories" :key="c.code" :value="c.code">{{c.name}}</option></select><label class="field-label">商品描述</label><textarea class="admin-input" rows="4" v-model="info.description" :disabled="!owned"></textarea><label class="field-label">商品主图</label><ProductImageField :key="'edit-'+selected.productId" v-model="info.imageUrl" :merchant-id="store.merchantId" :demo="preview" :disabled="!owned||saving" @busy="editImageUploading=$event" @invalid="editImageInvalid=$event"/><button class="teal-button inspector-submit" @click="saveInfo" :disabled="preview||saving||editImageUploading||editImageInvalid||!owned">保存修改</button><button class="inspector-link" @click="publish(selected)" :disabled="preview||saving||!owned">{{selected.status==='PUBLISHED'?'下架商品':'上架商品'}} <Icon name="chevronRight" :size="16"/></button></div>
            <div class="inspector-body" v-else><div class="sku-item" v-for="sku in selected.skus" :key="sku.skuId"><div><strong>{{sku.specKey}}</strong><small>{{sku.skuId}}</small></div><strong>{{money(sku.priceCent)}}</strong><button :disabled="!owned||preview" @click="openPrice(sku)" title="修改售价"><Icon name="edit" :size="17"/></button></div><button class="outline-button small" :disabled="!owned||preview||selected.skus.length>=20" @click="openAddSku"><Icon name="plus" :size="16"/>新增规格</button></div>
          </aside>
          <div v-else class="product-inspector empty-inspector"><Icon name="package" :size="28"/>选择商品以查看详情</div>
        </section>
      </template></main>
    </div>
    <AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="loadMerchant" />
    <div v-if="modal" class="ui-overlay" @click.self="modal=''">
      <form class="merchant-modal" v-if="modal==='create'" @submit.prevent="create"><div class="merchant-modal-header"><div><h2>新增商品</h2></div><button type="button" @click="modal=''" aria-label="关闭"><Icon name="x" :size="20"/></button></div><label class="field-label">商品名称</label><input class="admin-input" maxlength="100" v-model="form.title" placeholder="商品名称" required/><label class="field-label">分类</label><select v-model="form.categoryCode" class="admin-input"><option v-for="c in store.categories.filter(c=>c.active)" :value="c.code">{{c.name}}</option></select><label class="field-label">规格 / 售价（元）</label><div v-for="(item,index) in form.skus" :key="index" class="sku-create-row"><input class="admin-input" maxlength="100" v-model="item.specKey" required placeholder="例如 250ml"/><input class="admin-input" v-model="item.price" inputmode="decimal" placeholder="0.00" required/><button type="button" class="outline-button small" :disabled="form.skus.length===1" @click="removeCreateSku(index)" :aria-label="'移除规格'+(index+1)"><Icon name="x" :size="15"/></button></div><button type="button" class="outline-button small" :disabled="form.skus.length>=20" @click="addCreateSku"><Icon name="plus" :size="15"/>添加规格</button><label class="field-label">描述</label><textarea class="admin-input" rows="3" v-model="form.description" placeholder="选填"></textarea><label class="field-label">商品主图</label><ProductImageField v-model="form.imageUrl" :merchant-id="store.merchantId" :demo="preview" :disabled="saving||!owned" @busy="createImageUploading=$event" @invalid="createImageInvalid=$event"/><div class="form-buttons"><button type="button" class="outline-button" @click="modal=''">取消</button><button type="submit" class="teal-button" :disabled="preview||saving||createImageUploading||createImageInvalid||!owned">保存商品</button></div></form>
      <form class="merchant-modal narrow" v-else-if="modal==='addSku'" @submit.prevent="addSku"><div class="merchant-modal-header"><h2>新增规格</h2><button type="button" @click="modal=''" aria-label="关闭"><Icon name="x" :size="18"/></button></div><label class="field-label">规格名称</label><input class="admin-input" maxlength="100" v-model="skuForm.specKey" required placeholder="例如：500ml"/><label class="field-label">售价（元）</label><input class="admin-input" v-model="skuForm.price" inputmode="decimal" required placeholder="0.00"/><div class="form-buttons"><button type="button" class="outline-button" @click="modal=''">取消</button><button type="submit" class="teal-button" :disabled="preview||saving">保存规格</button></div></form><form class="merchant-modal narrow" v-else-if="modal==='price'" @submit.prevent="savePrice"><div class="merchant-modal-header"><div><h2>修改售价</h2></div><button type="button" @click="modal=''" aria-label="关闭"><Icon name="x" :size="20"/></button></div><div class="field-muted">{{selected?.title}} · {{activePriceSku?.specKey}}</div><label class="field-label">售价（元）</label><input class="admin-input" v-model="newPrice" inputmode="decimal" required/><div class="form-buttons"><button type="button" class="outline-button" @click="modal=''">取消</button><button type="submit" class="teal-button" :disabled="preview||saving">保存售价</button></div></form>
    </div>
  </div>`,
};
