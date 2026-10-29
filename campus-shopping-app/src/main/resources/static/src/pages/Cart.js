import ConsumerShell from '../components/ConsumerShell.js';
import ProductImage from '../components/ProductImage.js';
import {api,idempotency} from '../services/api.js';
import {store,go,money,preview,notify} from '../services/store.js';
import {DEMO_CART} from '../services/pages-demo.js';
import {pathId,positiveInt} from '../services/page-utils.js';
const {ref,computed,onMounted}=Vue;
export default {
 name:'Cart',components:{ConsumerShell,ProductImage},setup(){
  const items=ref([]),merchantId=ref(''),busy=ref(false),error=ref(''),orderKey=ref(''),fingerprint=ref('');
  const groups=computed(()=>Object.entries(Object.groupBy ? Object.groupBy(items.value,i=>i.merchantId) : items.value.reduce((a,i)=>{(a[i.merchantId]??=[]).push(i);return a;},{})).map(([id,rows])=>({id,rows,total:rows.reduce((s,i)=>s+Number(i.priceCent)*Number(i.quantity),0)})));
  const selected=computed(()=>items.value.filter(i=>i.merchantId===merchantId.value));const total=computed(()=>selected.value.reduce((n,i)=>n+Number(i.priceCent)*Number(i.quantity),0));
  const merchantName=id=>items.value.find(i=>i.merchantId===id)?.merchantName||store.merchants.find(m=>m.merchantId===id)?.name||'校内商户';
  async function load(){error.value='';if(preview){items.value=DEMO_CART.map(i=>({...i}));}else{try{items.value=await api('/cart')||[];}catch(e){error.value=e.message;items.value=[];}}
    if(!items.value.some(i=>i.merchantId===merchantId.value))merchantId.value=items.value[0]?.merchantId||'';
  }
  onMounted(load);
  async function quantity(i,d){if(preview)return;const n=Number(i.quantity)+d;if(n>99||n<0)return;busy.value=true;try{if(n)await api('/cart',{method:'PUT',body:{skuId:i.skuId,quantity:n}});else await api('/cart/'+pathId(i.skuId),{method:'DELETE'});orderKey.value='';await load();}catch(e){notify(e.message);}finally{busy.value=false;}}
  async function checkout(){if(preview||busy.value||!selected.value.length)return; if(selected.value.some(i=>!i.sellable||i.available<i.quantity)){notify('请先调整失效或库存不足的商品');return;}
    const body={merchantId:merchantId.value,items:selected.value.map(i=>({skuId:i.skuId,quantity:Number(i.quantity),expectedPriceCent:Number(i.priceCent),expectedVersion:Number(i.quoteVersion)}))};
    const next=JSON.stringify(body);if(fingerprint.value!==next){orderKey.value=idempotency();fingerprint.value=next;}
    busy.value=true;try{const created=await api('/orders',{method:'POST',body,key:orderKey.value});orderKey.value='';fingerprint.value='';notify('订单已创建');go('/orders/'+pathId(created.orderId));}catch(e){notify(e.message);}finally{busy.value=false;}
  }
  return {items,merchantId,busy,error,groups,selected,total,preview,go,money,merchantName,quantity,checkout,load};
 },
 template:`<ConsumerShell active="cart"><div class="mobile-page-top"><button @click="go('/')" aria-label="返回"><Icon name="arrowLeft"/></button><b>购物车</b><button @click="load" aria-label="刷新"><Icon name="refresh"/></button></div><div v-if="error" class="inline-error">{{error}}</div><div v-if="!items.length&&!error" class="mobile-empty"><Icon name="cart" :size="36"/><strong>购物车空空的</strong><button class="teal-button" @click="go('/')">去逛逛</button></div><template v-for="g in groups" :key="g.id"><section class="cart-store" :class="{selected:merchantId===g.id}"><button class="cart-store-head" @click="merchantId=g.id"><span class="radio-circle" :class="{active:merchantId===g.id}"><Icon name="check" :size="12"/></span><Icon name="store"/><strong>{{merchantName(g.id)}}</strong><span class="cart-store-total">{{money(g.total)}}</span></button><div class="cart-line" v-for="i in g.rows" :key="i.skuId"><ProductImage :src="i.imageUrl" :alt="i.title"/><div class="cart-line-info"><strong>{{i.title}}</strong><small>{{i.specKey}} <span v-if="!i.sellable||i.available<i.quantity" class="red-text">库存不足/失效</span></small><div class="cart-line-bottom"><b>{{money(i.priceCent)}}</b><div class="mini-qty"><button :disabled="busy||preview" :aria-label="'减少'+i.title" @click="quantity(i,-1)"><Icon name="minus" :size="15"/></button><span>{{i.quantity}}</span><button :disabled="busy||preview||i.quantity>=99||i.quantity>=i.available" :aria-label="'增加'+i.title" @click="quantity(i,1)"><Icon name="plus" :size="15"/></button></div></div></div></div></section></template><div v-if="groups.length>1" class="mobile-hint">一次结算一家商户，请选择要下单的店铺。</div><div v-if="items.length" class="mobile-summary"><div>商品金额 <strong>{{money(total)}}</strong></div><div>自提方式 <strong>校内门店自提</strong></div><div class="mobile-summary-total">应付 <b>{{money(total)}}</b></div></div><div v-if="items.length" class="mobile-checkout-bar"><div><small>本单合计</small><b>{{money(total)}}</b></div><button class="teal-button" :disabled="preview||busy||!selected.length" @click="checkout">{{busy?'提交中':'提交订单'}}</button></div></ConsumerShell>`
};
