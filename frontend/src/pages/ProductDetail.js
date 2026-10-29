import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import {api} from '../services/api.js';
import {store,go,money,preview,notify,skuOf} from '../services/store.js';
import {pathId} from '../services/page-utils.js';
const {ref,computed,onMounted,watch}=Vue;
export default {
 name:'ProductDetail',components:{ConsumerShell,ProductImage},
 setup(){
   const product=ref(null),chosen=ref(''),count=ref(1),busy=ref(false),error=ref('');
   const id=computed(()=>decodeURIComponent(store.route.split('/')[2]||''));
   const sku=computed(()=>product.value?.skus?.find(s=>s.skuId===chosen.value)||skuOf(product.value));
   const merchant=computed(()=>store.merchants.find(m=>m.merchantId===product.value?.merchantId)||{});
   async function load(){const target=id.value;product.value=null;error.value='';if(preview){product.value=store.products.find(p=>p.productId===target)||null;}else{try{const p=await api('/products/'+pathId(target));if(target===id.value)product.value=p;}catch(e){if(target===id.value)error.value=e.message;}}chosen.value=skuOf(product.value).skuId||'';count.value=1;}
   onMounted(load);watch(id,load);
   async function add(){if(preview||busy.value||!sku.value?.skuId)return;busy.value=true;try{const actual=await api('/products/'+pathId(product.value.productId));const real=actual.skus.find(s=>s.skuId===sku.value.skuId);if(actual.status!=='PUBLISHED'||!real||real.status!=='ACTIVE'||Number(real.available)<count.value)throw Error('商品库存或状态已变化');const list=await api('/cart');const old=list.find(i=>i.skuId===real.skuId);const quantity=Number(old?.quantity||0)+count.value;if(quantity>99)throw Error('单个规格最多99件');await api('/cart',{method:'PUT',body:{skuId:real.skuId,quantity}});notify('已加入购物车');}catch(e){notify(e.message);}finally{busy.value=false;}}
   
   return {product,sku,chosen,count,busy,error,preview,store,go,money,merchant,add};
 },
 template:`<ConsumerShell active="home"><div class="mobile-page-top"><button @click="go('/')" aria-label="返回首页"><Icon name="arrowLeft"/></button><b>商品详情</b><button @click="go('/cart')" aria-label="购物车"><Icon name="cart"/></button></div><div v-if="error" class="inline-error">{{error}}</div><template v-else-if="product"><div class="detail-art"><ProductImage :src="product.imageUrl" :alt="product.title" loading="eager"/><span v-if="product.status==='PUBLISHED'" class="corner-tag">校内自提</span></div><div class="detail-info"><div class="detail-price">{{money(sku.priceCent)}} <small>含税售价</small></div><h1>{{product.title}}</h1><p v-if="product.description" class="muted-short">{{product.description}}</p></div><div class="detail-card"><button class="detail-merchant" @click="go('/shops/'+product.merchantId)"><span class="merchant-logo"><Icon name="store"/></span><div><strong>{{merchant.name||'校园商户'}}</strong><span>{{merchant.storeName||merchant.location||'校内自提门店'}}</span></div><Icon name="chevronRight"/></button></div><div class="detail-card"><div class="detail-subtitle">选择规格</div><div class="sku-picker"><button v-for="s in product.skus" :key="s.skuId" :class="{active:sku.skuId===s.skuId}" :disabled="s.status!=='ACTIVE'||!s.available" @click="chosen=s.skuId;count=1">{{s.specKey}}</button></div><div class="quantity-picker"><span>数量 <small>可售 {{sku.available||0}}</small></span><div><button aria-label="减少" @click="count=Math.max(1,count-1)"><Icon name="minus" :size="16"/></button><b>{{count}}</b><button aria-label="增加" :disabled="count>=Math.min(99,Number(sku.available||0))" @click="count++"><Icon name="plus" :size="16"/></button></div></div></div><div class="detail-fixed"><button class="outline-button" @click="go('/cart')"><Icon name="cart" :size="18"/>购物车</button><button class="teal-button" :disabled="preview||busy||!sku.available||product.status!=='PUBLISHED'" @click="add">{{busy?'加入中…':'加入购物车'}}</button></div></template><div v-else class="mobile-empty">正在加载商品…</div></ConsumerShell>`
};
