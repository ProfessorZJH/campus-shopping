import {DEMO_MERCHANTS,DEMO_CATEGORIES,DEMO_PRODUCTS,DEMO_STOCKS} from './demo.js';
import {api,query} from './api.js';
const { reactive }=Vue;
export const preview = window.__CAMPUS_TEST_DEMO__ === true || new URLSearchParams(location.search).get('demo')==='1';
export const store=reactive({
  preview, route:window.__CAMPUS_TEST_ROUTE__ || location.hash.replace(/^#/, '')||'/',
  products:[], merchants:[], categories:[], stocks:[], user:null, workspace:null, merchantId:'',
  loading:false, error:'', toast:'', cartCount:0, messages:[], conversationId:'', proposal:null,
  photo:null, reloadId:0, publicPage:{page:1,size:20,total:0,hasNext:false}, merchantPage:{page:1,size:12,total:0,hasNext:false}
});
export const money=cent=>'¥'+(Number(cent||0)/100).toFixed(2).replace(/\.00$/,'');
export const skuOf=p=>p?.skus?.find(s=>s.status==='ACTIVE')||p?.skus?.[0]||{};
export const available=p=>p?.skus?.filter(s=>s.status==='ACTIVE').reduce((n,s)=>n+Number(s.available||0),0)||0;
export const shopName=id=>store.merchants.find(m=>m.merchantId===id)?.name||'校内商户';
let toastTimer;
let merchantEpoch=0, sessionEpoch=0, publicEpoch=0;
const actorId=user=>user?.userId||user?.id||user?.username||'';
// 身份和商户发生切换后，任何已发出的旧请求都不得回写新上下文。
export function replaceSession(user){
  ++sessionEpoch;++merchantEpoch;++publicEpoch;
  store.user=user;store.workspace=null;store.merchantId='';
  store.products=[];store.stocks=[];store.merchants=[];
  store.conversationId='';store.messages=[];store.proposal=null;
}
export function switchMerchantContext(id){
  if(id===store.merchantId)return;
  ++merchantEpoch;store.merchantId=id;
  store.products=[];store.stocks=[];store.merchantPage={page:1,size:9,total:0,hasNext:false};store.error='';
}
export function beginPublicSearch(){return ++publicEpoch;}
export function publicSearchCurrent(stamp){return stamp===publicEpoch;}

export function notify(message){store.toast=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>store.toast='',3200);}
export function go(path){location.hash=path;}
export function setRoute(){
  const next=location.hash.replace(/^#/, '')||'/';
  if(next!==store.route){++publicEpoch;++merchantEpoch;store.loading=false;}
  store.route=next;window.scrollTo({top:0,left:0,behavior:'instant'});
}
export async function loadPublic(){
  const stamp=++publicEpoch;
  store.error='';store.loading=true;
  if(preview){
    store.products=DEMO_PRODUCTS.filter(p=>p.status==='PUBLISHED');store.merchants=DEMO_MERCHANTS;store.categories=DEMO_CATEGORIES;store.publicPage={page:1,size:20,total:store.products.length,hasNext:false};store.loading=false;return;
  }
  try{
    const [merchants,categories,products]=await Promise.all([api('/merchants/public/page'+query({page:1,size:50})),api('/categories'),api('/products/page'+query({page:1,size:20}))]);
    if(!publicSearchCurrent(stamp))return;
    store.merchants=merchants?.items||[];store.categories=categories||[];store.products=products?.items||[];store.publicPage={page:products?.page||1,size:products?.size||20,total:products?.total||0,hasNext:!!products?.hasNext};
  }catch(err){if(publicSearchCurrent(stamp)){store.error=err.message;store.products=[];}}
  finally{if(publicSearchCurrent(stamp))store.loading=false;}
}
export async function loadMerchant({page=1,size=9,q='',category='',status='',sort='NEWEST'}={}){
  // 同一页面可以有并发请求；只允许最近一次、当前登录主体与当前商户提交结果。
  const stamp=++merchantEpoch, authStamp=sessionEpoch;
  const requested=store.merchantId, originalActor=actorId(store.user);
  let target=requested;
  const current=()=>stamp===merchantEpoch&&authStamp===sessionEpoch&&store.route.startsWith('/merchant')&&
    store.merchantId===requested&&actorId(store.user)===originalActor;
  if(!['PUBLISHED','DRAFT','UNPUBLISHED'].includes(status))status='';
  store.error='';store.loading=true;
  if(preview){
    store.products=DEMO_PRODUCTS.filter(p=>p.merchantId==='preview-m1');store.stocks=DEMO_STOCKS;store.merchantPage={page:1,size:12,total:store.products.length,hasNext:false};
    store.categories=DEMO_CATEGORIES;store.merchants=DEMO_MERCHANTS;store.merchantId='preview-m1';
    store.workspace={merchants:DEMO_MERCHANTS.slice(0,1),memberships:[{merchantId:'preview-m1',role:'OWNER',status:'ACTIVE'}]};
    store.user={displayName:'演示店长'};store.loading=false;return;
  }
  try{
    const [user,workspace,categories]=await Promise.all([api('/auth/me'),api('/workspace'),api('/categories')]);
    if(!current())return;
    // 访问权限由服务端 workspace 决定，客户端只确定展示哪一个已授权商户。
    const options=workspace?.merchants||[];
    const next=options.find(m=>m.merchantId===requested)?.merchantId||options[0]?.merchantId||'';
    store.user=user;store.workspace=workspace;store.categories=categories||[];store.merchants=options;
    store.merchantId=next;target=next;
    if(!next){store.products=[];store.stocks=[];store.error='当前账号没有商户权限';return;}
    const id=encodeURIComponent(next),permissions=workspace?.merchantPermissions?.[next]||[];
    const [products,stocks]=await Promise.all([
      permissions.includes('product.read')?api(`/merchants/${id}/products/page`+query({page,size,q,category,status,sort})) : Promise.resolve({items:[],page:1,size,total:0,hasNext:false}),
      permissions.includes('stock.read')?api(`/merchants/${id}/stocks/page`+query({page:1,size:100})) : Promise.resolve({items:[]})
    ]);
    if(stamp!==merchantEpoch||authStamp!==sessionEpoch||!store.route.startsWith('/merchant')||store.merchantId!==next||actorId(store.user)!==actorId(user))return;
    store.products=products?.items||[];
    store.merchantPage={page:products?.page||1,size:products?.size||size,total:products?.total||0,hasNext:!!products?.hasNext};
    store.stocks=stocks?.items||[];
  }catch(err){
    if(stamp===merchantEpoch&&authStamp===sessionEpoch&&
        store.route.startsWith('/merchant')&&store.merchantId===target){
      store.error=err.status===401?'请先在现有站点登录商户账号':err.message;
      store.products=[];store.stocks=[];
    }
  }finally{if(stamp===merchantEpoch&&authStamp===sessionEpoch)store.loading=false;}
}
export async function loadSession(){
  if(preview)return;
  const stamp=sessionEpoch, original=actorId(store.user);
  try{const user=await api('/auth/me');if(stamp===sessionEpoch&&actorId(store.user)===original)store.user=user;}
  catch(err){if(stamp===sessionEpoch&&actorId(store.user)===original&&(err.status===401||err.code==='A0004'))store.user=null;}
}
/** Workspace permissions are a display hint only; every Java write endpoint rechecks current DB state. */
export function hasPermission(code,merchantId=store.merchantId){
  return preview||!!store.workspace?.merchantPermissions?.[merchantId]?.includes(code);
}
export function isOwner(){return preview||!!store.workspace?.memberships?.some(m=>m.merchantId===store.merchantId&&m.role==='OWNER'&&m.status==='ACTIVE');}
export function previewGuard(){if(!preview)return false;notify('设计预览：不会修改服务器数据');return true;}
