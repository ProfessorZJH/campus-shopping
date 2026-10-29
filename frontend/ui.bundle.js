/* 本脚本由 scripts/build-ui-bundle.py 预编译，无需 unsafe-eval。 */
var _Vue = Vue;
const M_services_demo_js = (()=>{

// 只供 ?demo=1 的视觉预览使用，不作为实际商户、价格或库存数据。
const DEMO_MERCHANTS = [
  {merchantId:'preview-m1',name:'东湖便利',storeName:'学一食堂店',location:'东湖校区 · 学一食堂一层',category:'便利零售',status:'ACTIVE',image:'./images/merch-convenience.webp'},
  {merchantId:'preview-m2',name:'青果时间',storeName:'生活区店',location:'生活区 B 栋',category:'水果生鲜',status:'ACTIVE',image:'./images/merch-fruit.webp'},
  {merchantId:'preview-m3',name:'学伴文具',storeName:'图书馆店',location:'图书馆一层',category:'文具用品',status:'ACTIVE',image:'./images/merch-supermarket.webp'}
];
const DEMO_CATEGORIES = [
  {code:'food',name:'零食',active:true,image:'./images/category-snacks.webp'},
  {code:'drink',name:'饮料',active:true,image:'./images/category-drinks.webp'},
  {code:'fruit',name:'水果',active:true,image:'./images/category-fruit.webp'},
  {code:'stationery',name:'文具',active:true,image:'./images/category-stationery.webp'},
  {code:'daily',name:'日用',active:true,image:'./images/category-daily.webp'}
];
const sku=(n,spec,price,available)=>({skuId:'preview-sku-'+n,specKey:spec,priceCent:price,status:'ACTIVE',quoteVersion:1,available});
const DEMO_PRODUCTS = [
  {productId:'preview-p1',merchantId:'preview-m1',title:'红烧牛肉面 · 经典桶',description:'经典浓香，随时享用。',categoryCode:'food',imageUrl:'./images/noodles.webp',status:'PUBLISHED',version:1,skus:[sku(1,'109g',450,320)],tag:'热卖',sub:'109g'},
  {productId:'preview-p2',merchantId:'preview-m1',title:'纯牛奶 250ml',description:'原味纯牛奶',categoryCode:'drink',imageUrl:'./images/milk.webp',status:'PUBLISHED',version:1,skus:[sku(2,'250ml',280,86)],tag:'精选',sub:'250ml'},
  {productId:'preview-p3',merchantId:'preview-m1',title:'经典原味薯片',description:'香脆轻食',categoryCode:'food',imageUrl:'./images/chips.webp',status:'PUBLISHED',version:1,skus:[sku(3,'70g',420,168)],tag:'热卖',sub:'70g'},
  {productId:'preview-p4',merchantId:'preview-m2',title:'鲜脆青苹果',description:'新鲜水果',categoryCode:'fruit',imageUrl:'./images/category-fruit.webp',status:'PUBLISHED',version:2,skus:[sku(4,'单个',180,76)],tag:'当季',sub:'约200g'},
  {productId:'preview-p5',merchantId:'preview-m3',title:'考试中性笔',description:'顺滑书写',categoryCode:'stationery',imageUrl:'./images/category-stationery.webp',status:'PUBLISHED',version:2,skus:[sku(5,'0.5mm',250,123)],tag:'常备',sub:'单支'},
  {productId:'preview-p6',merchantId:'preview-m1',title:'牛奶 250ml · 整箱',description:'12盒装',categoryCode:'drink',imageUrl:'./images/milk.webp',status:'PUBLISHED',version:3,skus:[sku(6,'12盒装',3150,12)],tag:'好价',sub:'12盒装'},
  {productId:'preview-p7',merchantId:'preview-m1',title:'经典桶面 · 香辣',description:'更浓郁的味道',categoryCode:'food',imageUrl:'./images/noodles.webp',status:'UNPUBLISHED',version:3,skus:[sku(7,'109g',450,0)],sub:'109g'},
  {productId:'preview-p8',merchantId:'preview-m1',title:'洗护旅行装',description:'便携日用',categoryCode:'daily',imageUrl:'./images/category-daily.webp',status:'PUBLISHED',version:1,skus:[sku(8,'100ml',690,16)],sub:'100ml'},
  {productId:'preview-p9',merchantId:'preview-m1',title:'红烧牛肉面 · 整箱',description:'整箱囤货',categoryCode:'food',imageUrl:'./images/noodles.webp',status:'PUBLISHED',version:1,skus:[sku(9,'12桶装',4950,8)],sub:'12桶装'},
  {productId:'preview-p10',merchantId:'preview-m1',title:'青苹果 · 礼盒',description:'节日礼盒',categoryCode:'fruit',imageUrl:'./images/category-fruit.webp',status:'DRAFT',version:1,skus:[sku(10,'8枚装',2280,0)],sub:'8枚装'}
];
const DEMO_STOCKS = DEMO_PRODUCTS.filter(p=>p.merchantId==='preview-m1').flatMap(p=>p.skus.map(s=>({skuId:s.skuId,storeId:'preview-s1',onHand:s.available+2,reserved:2,available:s.available,version:1})));
const DEMO_CHAT = [
  {role:'user',content:'我想买点夜宵，预算 30 元以内，吃得饱一点。'},
  {role:'assistant',content:'给你挑了 3 件方便自提的好物。',demo:true}
];

return {DEMO_MERCHANTS,DEMO_CATEGORIES,DEMO_PRODUCTS,DEMO_STOCKS,DEMO_CHAT};
})();

const M_services_api_js = (()=>{

const PREFIX='/api/v1';
let csrf=null;
let csrfPromise=null;
function fail(message,code,status){return Object.assign(new Error(message),{code,status});}
async function getCsrf(){
  if(csrfPromise)return csrfPromise;
  csrfPromise=(async()=>{
    const r=await fetch(PREFIX+'/auth/csrf',{credentials:'same-origin',cache:'no-store'});
    let j;try{j=await r.json();}catch{throw fail('安全令牌响应异常','RESPONSE',r.status);}
    if(!r.ok || j.code!=='0000')throw fail('无法获取安全令牌',j.code,r.status);
    csrf=j.data;
    return csrf;
  })();
  try{return await csrfPromise;}finally{csrfPromise=null;}
}
/** 校验业务code，不能把HTTP 200当成执行成功。 */
async function api(path,{method='GET',body,signal,key,retry=true}={}){
  const headers={Accept:'application/json'};
  if(method!=='GET'){
    const token=csrf||await getCsrf();
    headers[token.headerName]=token.token;
  }
  if(body!==undefined)headers['Content-Type']='application/json';
  if(key)headers['Idempotency-Key']=key;
  let r;
  try{
    r=await fetch(PREFIX+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal,credentials:'same-origin',cache:'no-store'});
  }catch(err){
    if(err.name==='AbortError')throw err;
    throw fail('服务连接失败，请确认 Java 后端已启动','NETWORK',0);
  }
  let j;try{j=await r.json();}catch{throw fail('服务器响应格式异常','RESPONSE',r.status);}
  if(r.status===403 && j.code==='A0005' && retry){csrf=null;await getCsrf();return api(path,{method,body,signal,key,retry:false});}
  if(!r.ok || j.code!=='0000')throw fail(j.info||'请求失败',j.code||'HTTP',r.status);
  return j.data;
}
const resetCsrf=()=>{csrf=null;csrfPromise=null;};
const query = params=>'?'+new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!=='')).toString();
const idempotency=()=>crypto.randomUUID();

return {resetCsrf,query,idempotency,api};
})();

const M_services_store_js = (()=>{
const {DEMO_MERCHANTS,DEMO_CATEGORIES,DEMO_PRODUCTS,DEMO_STOCKS} = M_services_demo_js;
const {api,query} = M_services_api_js;


const { reactive }=Vue;
const preview = window.__CAMPUS_TEST_DEMO__ === true || new URLSearchParams(location.search).get('demo')==='1';
const store=reactive({
  preview, route:window.__CAMPUS_TEST_ROUTE__ || location.hash.replace(/^#/, '')||'/',
  products:[], merchants:[], categories:[], stocks:[], user:null, workspace:null, merchantId:'',
  loading:false, error:'', toast:'', cartCount:0, messages:[], conversationId:'', proposal:null,
  photo:null, reloadId:0, publicPage:{page:1,size:20,total:0,hasNext:false}, merchantPage:{page:1,size:12,total:0,hasNext:false}
});
const money=cent=>'¥'+(Number(cent||0)/100).toFixed(2).replace(/\.00$/,'');
const skuOf=p=>p?.skus?.find(s=>s.status==='ACTIVE')||p?.skus?.[0]||{};
const available=p=>p?.skus?.filter(s=>s.status==='ACTIVE').reduce((n,s)=>n+Number(s.available||0),0)||0;
const shopName=id=>store.merchants.find(m=>m.merchantId===id)?.name||'校内商户';
let toastTimer;
let merchantEpoch=0, sessionEpoch=0, publicEpoch=0;
const actorId=user=>user?.userId||user?.id||user?.username||'';
// 身份和商户发生切换后，任何已发出的旧请求都不得回写新上下文。
function replaceSession(user){
  ++sessionEpoch;++merchantEpoch;++publicEpoch;
  store.user=user;store.workspace=null;store.merchantId='';
  store.products=[];store.stocks=[];store.merchants=[];
  store.conversationId='';store.messages=[];store.proposal=null;
}
function switchMerchantContext(id){
  if(id===store.merchantId)return;
  ++merchantEpoch;store.merchantId=id;
  store.products=[];store.stocks=[];store.merchantPage={page:1,size:9,total:0,hasNext:false};store.error='';
}
function beginPublicSearch(){return ++publicEpoch;}
function publicSearchCurrent(stamp){return stamp===publicEpoch;}

function notify(message){store.toast=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>store.toast='',3200);}
function go(path){location.hash=path;}
function setRoute(){
  const next=location.hash.replace(/^#/, '')||'/';
  if(next!==store.route){++publicEpoch;++merchantEpoch;store.loading=false;}
  store.route=next;window.scrollTo({top:0,left:0,behavior:'instant'});
}
async function loadPublic(){
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
async function loadMerchant({page=1,size=9,q='',category='',status='',sort='NEWEST'}={}){
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
async function loadSession(){
  if(preview)return;
  const stamp=sessionEpoch, original=actorId(store.user);
  try{const user=await api('/auth/me');if(stamp===sessionEpoch&&actorId(store.user)===original)store.user=user;}
  catch(err){if(stamp===sessionEpoch&&actorId(store.user)===original&&(err.status===401||err.code==='A0004'))store.user=null;}
}
/** Workspace permissions are a display hint only; every Java write endpoint rechecks current DB state. */
function hasPermission(code,merchantId=store.merchantId){
  return preview||!!store.workspace?.merchantPermissions?.[merchantId]?.includes(code);
}
function isOwner(){return preview||!!store.workspace?.memberships?.some(m=>m.merchantId===store.merchantId&&m.role==='OWNER'&&m.status==='ACTIVE');}
function previewGuard(){if(!preview)return false;notify('设计预览：不会修改服务器数据');return true;}

return {preview,store,money,skuOf,available,shopName,loadPublic,loadMerchant,loadSession,replaceSession,switchMerchantContext,beginPublicSearch,publicSearchCurrent,notify,go,setRoute,hasPermission,isOwner,previewGuard};
})();

const M_services_pages_demo_js = (()=>{
const {DEMO_PRODUCTS,DEMO_MERCHANTS} = M_services_demo_js;
/* 仅 ?demo=1 预览使用。所有写请求在演示模式禁用。 */

const t='2026-10-27T11:40:00Z';
const items=[{skuId:'preview-sku-1',title:'红烧牛肉面 · 经典桶',specKey:'109g',unitPriceCent:450,quantity:1},{skuId:'preview-sku-2',title:'纯牛奶 · 250ml',specKey:'250ml',unitPriceCent:280,quantity:2}];
const DEMO_CART=[{merchantId:'preview-m1',skuId:'preview-sku-1',title:items[0].title,specKey:'109g',quantity:1,priceCent:450,quoteVersion:1,available:320,sellable:true},{merchantId:'preview-m1',skuId:'preview-sku-2',title:items[1].title,specKey:'250ml',quantity:2,priceCent:280,quoteVersion:1,available:18,sellable:true},{merchantId:'preview-m2',skuId:'preview-sku-3',title:'苹果 · 清甜脆爽',specKey:'单个',quantity:2,priceCent:190,quoteVersion:1,available:46,sellable:true}];
const DEMO_ORDERS=[
 {orderId:'CS202610280001',buyerId:'preview-user',merchantId:'preview-m1',storeId:'preview-s1',status:'PAID',totalCent:1010,createdAt:t,deadline:'2026-10-29T11:40:00Z',items,pickup:{status:'READY',expiresAt:null}},
 {orderId:'CS202610270016',buyerId:'preview-user',merchantId:'preview-m2',storeId:'preview-s2',status:'COMPLETED',totalCent:570,createdAt:'2026-10-26T10:30:00Z',items:[{skuId:'preview-sku-3',title:'苹果 · 清甜脆爽',specKey:'单个',unitPriceCent:190,quantity:3}],pickup:{status:'COMPLETED'}},
 {orderId:'CS202610280003',buyerId:'preview-user',merchantId:'preview-m1',storeId:'preview-s1',status:'PENDING_PAYMENT',totalCent:450,createdAt:t,deadline:'2026-10-29T11:40:00Z',items:items.slice(0,1),pickup:null}
];
const DEMO_APPLICATIONS=[
 {applicationId:'AP-1025',merchantName:'东湖便利',category:'便利零售',contactName:'店主 A',contactPhone:'13800000000',storeName:'学一食堂店',location:'东湖校区 · 学一食堂',status:'SUBMITTED',rejectionReason:''},
 {applicationId:'AP-1024',merchantName:'青果时间',category:'水果生鲜',contactName:'店主 B',contactPhone:'13900000000',storeName:'生活区店',location:'生活区 B 栋',status:'APPROVED',merchantId:'preview-m2'},
 {applicationId:'AP-1023',merchantName:'学伴文具',category:'文具用品',contactName:'店主 C',contactPhone:'13600000000',storeName:'图书馆店',location:'图书馆一层',status:'REJECTED',rejectionReason:'信息不完整'}
];
const DEMO_MEMBERS=[{merchantId:'preview-m1',userId:'preview-user',role:'OWNER',status:'ACTIVE'},{merchantId:'preview-m1',userId:'preview-clerk',role:'CLERK',status:'ACTIVE'}];
const DEMO_BASES=[{id:'KB-01',name:'门店服务指南',merchantId:'preview-m1',visibility:'PUBLIC'},{id:'KB-02',name:'内部运营指引',merchantId:'preview-m1',visibility:'MERCHANT_INTERNAL'}];
const DEMO_DOCS=[{id:'D-11',baseId:'KB-01',rootId:'R-11',title:'门店营业信息',version:2,status:'PUBLISHED',indexStatus:'READY',content:'营业时间与自提注意事项',createdAt:t},{id:'D-12',baseId:'KB-01',rootId:'R-12',title:'商品分类说明',version:1,status:'DRAFT',indexStatus:'READY',content:'零食与饮品',createdAt:t}];
const DEMO_STATS={totalOrders:168,pendingCount:12,paidCount:28,completedCount:128,refundedCount:3,completedAmountCent:286050};
const DEMO_MERCHANT_ORDERS=DEMO_ORDERS.map((o,i)=>({...o,orderId:'M'+String(i+1).padStart(5,'0'),buyerId:'preview-buyer-'+i,merchantId:'preview-m1',status:['PAID','COMPLETED','PENDING_PAYMENT'][i],pickup:i===0?{status:'WAIT_PREP'}:o.pickup}));
const DEMO_AFTERSALES=[{id:'AF-008',orderId:'M00002',merchantId:'preview-m1',status:'REQUESTED',reason:'商品临时不需要',createdAt:t},{id:'AF-007',orderId:'M00003',merchantId:'preview-m1',status:'DISPUTED',reason:'未提货申请退款',createdAt:t}];
const DEMO_STOCK_MOVES=[{id:'MV-11',skuId:DEMO_PRODUCTS[0].skus[0].skuId,type:'REPLENISH',quantity:20,createdAt:t,bizKey:'DEMO-01'}];
// 只用于只读页面预览；权限码和角色默认值与 SDD-RBAC-05 一致。
const RBAC_LABELS=[['dashboard.read','经营统计'],['product.read','查看商品'],['product.write','管理商品及价格'],
 ['stock.read','查看库存与流水'],['stock.replenish','补货'],['order.read','查看订单'],
 ['order.prepare','备货'],['pickup.verify','自提核销'],['aftersale.read','查看售后'],
 ['aftersale.review','审核售后'],['knowledge.read','读取知识库'],['knowledge.manage','管理知识库'],
 ['team.manage','邀请和撤销成员'],['store.manage','修改门店资料'],['role.manage','角色与权限管理']];
const DEMO_RBAC_PERMISSIONS=RBAC_LABELS.map(([code,label])=>({code,label,grantable:!['team.manage','store.manage','role.manage'].includes(code)}));
const DEMO_RBAC_ROLES=[
 {code:'OWNER',name:'经营者',builtin:true,permissions:RBAC_LABELS.map(([code])=>code)},
 {code:'CLERK',name:'店员',builtin:true,permissions:['product.read','stock.read','stock.replenish','order.read','order.prepare','pickup.verify']},
 {code:'preview-operator',name:'商品运营',builtin:false,permissions:['product.read','product.write','stock.read']}
];
const DEMO_PUBLIC_MERCHANTS=DEMO_MERCHANTS;

return {DEMO_CART,DEMO_ORDERS,DEMO_APPLICATIONS,DEMO_MEMBERS,DEMO_BASES,DEMO_DOCS,DEMO_STATS,DEMO_MERCHANT_ORDERS,DEMO_AFTERSALES,DEMO_STOCK_MOVES,DEMO_RBAC_PERMISSIONS,DEMO_RBAC_ROLES,DEMO_PUBLIC_MERCHANTS};
})();

const M_services_page_utils_js = (()=>{
const {store,money,skuOf} = M_services_store_js;

const stateName={PENDING_PAYMENT:'待付款',PAID:'已支付',COMPLETED:'已完成',CANCELED:'已取消',REFUNDED:'已退款',PENDING:'待审核',SUBMITTED:'待审核',APPROVED:'已通过',REJECTED:'已驳回',DISPUTED:'平台介入',REQUESTED:'待处理',PREPARING:'备货中',READY:'待自提',CREATED:'待备货',WAIT_PREP:'待备货',ACTIVE:'营业中',INACTIVE:'已停用',PUBLISHED:'已发布',UNPUBLISHED:'已下架',DRAFT:'草稿',INDEXING:'索引中',FAILED:'失败',MERCHANT_INTERNAL:'商户内部',PLATFORM_INTERNAL:'平台内部',PUBLIC:'公开'};
function label(s){return stateName[s]||s||'—';}
function dateTime(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function pathId(v){return encodeURIComponent(String(v||''));}
function coverSku(skuId){const p=store.products.find(p=>p.skus?.some(s=>s.skuId===skuId));return p?.imageUrl||'';}
function amount(row){return money(Number(row?.quantity||1)*Number(row?.priceCent||row?.unitPriceCent||0));}
function positiveInt(v,max=99){return Number.isInteger(Number(v))&&Number(v)>=1&&Number(v)<=max;}

return {stateName,label,dateTime,pathId,coverSku,amount,positiveInt};
})();

const M_components_Icon_js = (()=>{

const paths = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  sparkles: '<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
  cart: '<circle cx="10" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 3h2l3 13h13l2-9H5"/>',
  order: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-7 8-7s8 2 8 7"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  store: '<path d="M3 9 5 3h14l2 6M3 9v11h18V9M9 20v-7h6v7"/><path d="M2 9c0 3 4 3 5 0 1 3 4 3 5 0 1 3 4 3 5 0 1 3 5 3 5 0"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  package: '<path d="m12 2 9 5-9 5-9-5zM3 7v10l9 5 9-5V7M12 12v10"/>',
  box: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M7 12h10M7 16h7"/>',
  clipboard: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 5V3h6v2M8 11h8M8 15h8"/>',
  scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M19 20v-2a6 6 0 0 0-3-5"/>',
  book: '<path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2zM12 6v15"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M5 5 19 19M19 5 5 19"/>',
  check: '<path d="M4 12 10 18 20 6"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5L3 9M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3M21 21v-6h-6"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16zM14 6l4 4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v8M14 10v8"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="m12 2 9 4v6c0 5-3 8-9 10-6-2-9-5-9-10V6z"/><path d="m8 12 3 3 5-6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c2 2 6 2 8 0M8 9h.01M16 9h.01"/>',
  circleHelp: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9.5a2.5 2.5 0 0 1 4.3 1.6c0 1.7-2.1 2-2.1 3.4M12 18h.01"/>',
  alert: '<path d="m12 2 10 18H2zM12 8v5M12 17h.01"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  logout: '<path d="M9 3H4v18h5M13 7l5 5-5 5M7 12h11"/>',
}
const __default = {
  name: 'UiIcon',
  props: { name: {type:String, required:true}, size: {type:[Number,String],default:20}, stroke:{type:Number,default:1.85} },
  setup(props){
    return ()=> Vue.h('svg', { viewBox:'0 0 24 24', width:props.size, height:props.size,
      'aria-hidden':'true', fill:'none', stroke:'currentColor', 'stroke-width':props.stroke,
      'stroke-linecap':'round', 'stroke-linejoin':'round', innerHTML:paths[props.name]||paths.circleHelp });
  }
};

return {default:__default};
})();

const M_components_ProductImage_js = (()=>{

const {computed,ref,watch}=Vue;

/** 商品图统一占位；接口无图、链接失效时不借用其他商品的图片。 */
const __default = {
  name:'ProductImage',
  props:{src:{type:String,default:''},alt:{type:String,default:'商品图片'},loading:{type:String,default:'lazy'}},
  setup(props){
    const broken=ref(false);
    watch(()=>props.src,()=>{broken.value=false;});
    const url=computed(()=>!broken.value&&props.src?.trim()?props.src:'./images/product-placeholder.svg');
    function handleError(){if(!broken.value)broken.value=true;}
    return {url,handleError};
  },
  template:`<img :src="url" :alt="alt" :loading="loading" @error="handleError"/>`
};

return {default:__default};
})();

const M_components_ProductImageField_js = (()=>{
const ProductImage = M_components_ProductImage_js.default;
const {api} = M_services_api_js;


const {ref,computed,onBeforeUnmount,watch}=Vue;
const VALID_TYPES=new Set(['image/jpeg','image/png','image/gif']);
const MAX_BYTES=2000000;

/** 选择文件 -> 预览 -> 上传 -> 收到 /media/ 路径。真正保存由商品表单负责。 */
const __default = {
  name:'ProductImageField',components:{ProductImage},
  props:{modelValue:{type:String,default:''},merchantId:{type:String,required:true},disabled:{type:Boolean,default:false},demo:{type:Boolean,default:false}},
  emits:['update:modelValue','busy','invalid'],
  setup(props,{emit}){
    const busy=ref(false),error=ref(''),notice=ref(''),localUrl=ref('');
    let alive=true;
    function release(){if(localUrl.value){URL.revokeObjectURL(localUrl.value);localUrl.value='';}}
    onBeforeUnmount(()=>{alive=false;release();if(busy.value)emit('busy',false);if(error.value)emit('invalid',false);});
    watch(()=>props.modelValue,()=>{if(!busy.value)release();});
    const displayed=computed(()=>localUrl.value||props.modelValue||'');
    function clear(){if(props.disabled||busy.value)return;release();error.value='';notice.value='';emit('invalid',false);emit('update:modelValue','');}
    async function choose(event){
      const file=event.target.files?.[0];event.target.value='';
      if(!file||props.disabled||busy.value)return;
      error.value='';notice.value='';emit('invalid',false);
      if(!VALID_TYPES.has(file.type)){error.value='请选择 JPG、PNG 或 GIF 图片';emit('invalid',true);return;}
      if(!file.size||file.size>MAX_BYTES){error.value='图片大小不能超过 2 MB';emit('invalid',true);return;}
      release();localUrl.value=URL.createObjectURL(file);
      if(props.demo){notice.value='仅本地预览，未上传';return;}
      busy.value=true;emit('busy',true);
      try{
        const base64=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onerror=()=>reject(new Error('图片读取失败'));
          reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
          reader.readAsDataURL(file);
        });
        const result=await api('/merchants/'+encodeURIComponent(props.merchantId)+'/images',{
          method:'POST',body:{filename:file.name,contentType:file.type,base64}
        });
        if(!/^\/media\/[a-f0-9-]+\.png$/.test(result?.url||''))throw new Error('图片上传返回地址无效');
        if(!alive)return;
        emit('update:modelValue',result.url);
        notice.value='上传成功，保存商品后生效';
        release();
      }catch(err){if(alive){error.value=err.message||'上传失败';emit('invalid',true);release();}}
      finally{if(alive){busy.value=false;emit('busy',false);}}
    }
    return {choose,clear,displayed,busy,error,notice};
  },
  template:`<div class="product-image-field">
    <div class="product-image-preview"><ProductImage :src="displayed" alt="商品主图预览" loading="eager"/><span v-if="busy" class="product-image-busy">上传中…</span></div>
    <div class="product-image-controls">
      <label class="image-upload-button" :class="{disabled:disabled||busy}">
        <Icon name="upload" :size="15"/>{{modelValue||displayed?'更换主图':'上传主图'}}
        <input type="file" accept="image/png,image/jpeg,image/gif" aria-label="选择商品主图" :disabled="disabled||busy" @change="choose"/>
      </label>
      <button v-if="modelValue||displayed||error" class="image-remove-button" type="button" :disabled="disabled||busy" @click="clear">移除</button>
      <small>JPG / PNG / GIF · ≤ 2MB</small>
      <span v-if="error" class="image-field-error" role="alert">{{error}}</span>
      <span v-else-if="notice" class="image-field-notice" role="status">{{notice}}</span>
    </div>
  </div>`
};

return {default:__default};
})();

const M_components_AuthDialog_js = (()=>{
const {api,resetCsrf} = M_services_api_js;
const {store,notify,replaceSession} = M_services_store_js;


const {ref}=Vue;
/** 登录/注册只使用已有认证接口，不能由前端声明角色。 */
const __default = {
  name:'AuthDialog',
  emits:['close','success'],
  setup(props,{emit}){
    const mode=ref('login');const username=ref('');const password=ref('');const displayName=ref('');const busy=ref(false);const error=ref('');
    async function submit(){
      if(busy.value)return;
      error.value='';if(!username.value.trim()||!password.value){error.value='请填写账号和密码';return;}
      busy.value=true;
      try{
        if(mode.value==='register'){
          await api('/auth/register',{method:'POST',body:{username:username.value.trim(),password:password.value,displayName:displayName.value.trim()||username.value.trim()}});
          mode.value='login';password.value='';notify('注册成功，请登录');
        }else{
          const user=await api('/auth/login',{method:'POST',body:{username:username.value.trim(),password:password.value}});
          resetCsrf();replaceSession(user);password.value='';emit('success',user);emit('close');notify('已登录');
        }
      }catch(err){error.value=err.message;}finally{busy.value=false;}
    }
    return {mode,username,password,displayName,busy,error,submit};
  },
  template:`<div class="ui-overlay" @click.self="$emit('close')"><form class="login-dialog" @submit.prevent="submit" aria-label="账号登录">
     <div class="login-dialog-heading"><span class="auth-logo"><Icon name="sparkles" :size="22"/></span><button type="button" @click="$emit('close')" aria-label="关闭登录窗"><Icon name="x" :size="20" /></button></div>
     <h2>{{mode==='login'?'欢迎回来':'创建账号'}}</h2>
     <label for="login-name">账号</label><input id="login-name" v-model="username" autocomplete="username" required maxlength="40" placeholder="用户名"/>
     <label for="login-password">密码</label><input id="login-password" v-model="password" type="password" :autocomplete="mode==='login'?'current-password':'new-password'" required placeholder="输入密码"/>
     <template v-if="mode==='register'"><label for="login-display">昵称</label><input id="login-display" v-model="displayName" maxlength="40" placeholder="昵称（选填）"/></template>
     <div v-if="error" class="login-error">{{error}}</div>
     <button type="submit" class="primary-wide login-submit" :disabled="busy">{{busy?'请稍候…':mode==='login'?'登录':'注册'}}</button>
     <button type="button" class="login-switch" @click="mode=mode==='login'?'register':'login';error=''">{{mode==='login'?'没有账号？注册':'已有账号？登录'}}</button>
  </form></div>`
};

return {default:__default};
})();

const M_components_ConsumerShell_js = (()=>{
const {go,store,preview,notify,replaceSession,loadPublic} = M_services_store_js;
const {api,resetCsrf} = M_services_api_js;
const AuthDialog = M_components_AuthDialog_js.default;



const {ref}=Vue;
const __default = {
  name:'ConsumerShell',components:{AuthDialog},
  props:{active:{type:String,default:'home'}},
  setup(){
    const loginOpen=ref(false);
    async function logout(){try{await api('/auth/logout',{method:'POST'});resetCsrf();replaceSession(null);notify('已退出');go('/');loadPublic();}catch(err){notify(err.message);}}
    return {go,store,preview,loginOpen,logout,loadPublic};
  },
  template:`
    <div class="consumer-shell">
      <div class="consumer-width">
        <header class="consumer-header">
          <div class="campus-location">
            <div class="brand-pin"><span></span></div>
            <div><div class="location-name">青柠校园</div><div class="location-sub">校园好物 · 到店自提</div></div>
          </div>
          <div class="header-trailing"><span v-if="store.preview" class="demo-pill" title="仅用于视觉预览">设计预览</span><button v-else-if="!store.user" class="header-login" @click="loginOpen=true">登录</button><button v-else class="account-pill" @click="logout" title="退出登录">{{store.user.displayName?.slice(0,2)||'我'}} <Icon name="logout" :size="12" /></button></div>
        </header>
        <main class="consumer-main"><slot /></main>
      </div>
      <nav class="mobile-tabbar" aria-label="消费者导航">
        <div class="mobile-tabbar-inner">
          <button :class="{selected:active==='home'}" @click="go('/')" aria-label="首页"><Icon name="home" :size="23"/><span>首页</span></button>
          <button :class="{selected:active==='ai'}" @click="go('/ai')" aria-label="AI导购"><span class="tiny-orb"><Icon name="sparkles" :size="20"/></span><span>导购</span></button>
          <button :class="{selected:active==='cart'}" @click="go('/cart')"><Icon name="cart" :size="23"/><span>购物车</span></button>
          <button :class="{selected:active==='orders'}" @click="go('/orders')"><Icon name="order" :size="23"/><span>订单</span></button>
          <button :class="{selected:active==='account'}" @click="go('/account')"><Icon name="user" :size="23"/><span>我的</span></button>
        </div>
      </nav>
      <AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="loadPublic" />
    </div>`
};

return {default:__default};
})();

const M_components_BackofficeShell_js = (()=>{
const {store,go,preview,loadMerchant,notify,switchMerchantContext,hasPermission} = M_services_store_js;
const AuthDialog = M_components_AuthDialog_js.default;


const {ref,computed,watch,nextTick,onMounted,onUnmounted}=Vue;
const merchantNav=[['home','工作台','/merchant'],['package','商品管理','/merchant/products'],['box','库存管理','/merchant/inventory'],['order','订单管理','/merchant/orders'],['scan','自提核销','/merchant/pickup'],['clipboard','售后处理','/merchant/aftersales'],['users','店员管理','/merchant/team'],['shield','角色权限','/merchant/roles'],['book','知识库','/merchant/knowledge'],['settings','门店设置','/merchant/settings']];
const adminNav=[['home','平台总览','/admin'],['store','商户审核','/admin/applications'],['users','商户监管','/admin/merchants'],['package','商品监管','/admin/products'],['order','订单监管','/admin/orders'],['shield','争议处理','/admin/disputes'],['book','知识库','/admin/knowledge'],['grid','分类管理','/admin/categories']];
const __default = {
 name:'BackofficeShell',props:{role:{type:String,default:'merchant'},title:String},components:{AuthDialog},
 setup(){
   const loginOpen=ref(false),mobileNav=ref(null);
   const required={'/merchant':'order.read','/merchant/products':'product.read','/merchant/inventory':'stock.read',
     '/merchant/orders':'order.read','/merchant/pickup':'pickup.verify','/merchant/aftersales':'aftersale.read',
     '/merchant/team':'team.manage','/merchant/roles':'role.manage','/merchant/knowledge':'knowledge.read','/merchant/settings':'store.manage'};
   const visibleMerchantNav=computed(()=>merchantNav.filter(([, ,path])=>hasPermission(required[path])));
   const alignMobileNav=()=>{const nav=mobileNav.value;if(nav?.clientWidth)nav.querySelector('button.active')?.scrollIntoView({inline:'center',block:'nearest'});};
   watch([()=>store.route,()=>visibleMerchantNav.value.map(item=>item[2]).join('|')],async()=>{await nextTick();alignMobileNav();},{immediate:true,flush:'post'});
   onMounted(()=>window.addEventListener('resize',alignMobileNav));
   onUnmounted(()=>window.removeEventListener('resize',alignMobileNav));
   async function switchShop(e){if(preview){notify('演示模式不能切换真实商户');return;}switchMerchantContext(e.target.value);await loadMerchant();}
   return {store,go,preview,loginOpen,mobileNav,merchantNav,visibleMerchantNav,adminNav,switchShop};
 },
 template:`<div class="merchant-shell"><aside class="merchant-sidebar"><button class="merchant-brand" @click="go('/')"><span class="brand-pin"><span></span></span><span class="brand-word">青柠校园 <span class="brand-suffix">/ {{role==='admin'?'平台端':'商户端'}}</span></span></button><nav class="merchant-nav"><button v-for="([ico,label,path]) in (role==='admin'?adminNav:visibleMerchantNav)" :key="path" :class="{active:store.route===path}" @click="go(path)"><Icon :name="ico" :size="19"/><span>{{label}}</span><span v-if="store.route===path" class="nav-left-bar"></span></button></nav><div class="merchant-sidebar-bottom"><button class="sidebar-back" @click="go('/')"><Icon name="arrowLeft" :size="16"/> 返回购物端</button></div></aside><div class="merchant-content-shell"><header class="merchant-topbar"><div class="topbar-crumb">{{role==='admin'?'平台运营':'店铺运营'}} <Icon name="chevronRight" :size="14"/><strong>{{title}}</strong></div><div class="merchant-topbar-tools"><span v-if="preview" class="admin-preview-tag">设计预览</span><label class="topbar-merchant-select" v-if="role==='merchant'"><Icon name="store" :size="16"/><select :value="store.merchantId" @change="switchShop" :disabled="preview||store.loading"><option v-for="m in store.merchants" :key="m.merchantId" :value="m.merchantId">{{m.name}}</option></select></label><button class="topbar-avatar" @click="loginOpen=true"><Icon name="user" :size="18"/></button></div></header><nav ref="mobileNav" class="merchant-mobile-nav" aria-label="工作台导航"><button v-for="([ico,label,path]) in (role==='admin'?adminNav:visibleMerchantNav)" :key="path" :class="{active:store.route===path}" @click="go(path)"><Icon :name="ico" :size="16"/>{{label}}</button></nav><main class="merchant-main"><div class="merchant-page-heading"><div><h1>{{title}}</h1></div><slot name="actions"/></div><div v-if="store.error" class="inline-error merchant-error">{{store.error}}</div><slot/></main></div><AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="role==='merchant'?loadMerchant():null"/></div>`
};

return {merchantNav,adminNav,default:__default};
})();

const M_pages_Home_js = (()=>{
const ConsumerShell = M_components_ConsumerShell_js.default;
const ProductImage = M_components_ProductImage_js.default;
const {api,query} = M_services_api_js;
const {store,go,money,skuOf,available,shopName,preview,previewGuard,notify,beginPublicSearch,publicSearchCurrent} = M_services_store_js;




const {ref,computed,onUnmounted}=Vue;
const staticCategoryArt={food:'./images/category-snacks.webp',drink:'./images/category-drinks.webp',fruit:'./images/category-fruit.webp',stationery:'./images/category-stationery.webp',daily:'./images/category-daily.webp'};
const __default = {
  name:'Home',components:{ConsumerShell,ProductImage},
  setup(){
    const keywords=['泡面','牛奶','水果','文具','纸巾','零食'];
    const search=ref('');const category=ref('');const merchant=ref('');const sort=ref('popular');
    const page=ref(1);const selected=ref(null);const chosenSku=ref('');const count=ref(1);const saving=ref(false);
    const categories=computed(()=>store.categories.filter(c=>c.active).slice(0,5));
    const shops=computed(()=>store.merchants.filter(m=>m.status==='ACTIVE').slice(0,3));
    const shown=computed(()=>{
      let arr=store.products.filter(p=>p.status==='PUBLISHED');
      if(preview){const q=search.value.trim().toLowerCase();if(q)arr=arr.filter(p=>(p.title+' '+p.description).toLowerCase().includes(q));}
      if(category.value)arr=arr.filter(p=>p.categoryCode===category.value);
      if(merchant.value)arr=arr.filter(p=>p.merchantId===merchant.value);
      if(preview&&sort.value==='price')arr=[...arr].sort((a,b)=>Number(skuOf(a).priceCent)-Number(skuOf(b).priceCent));
      if(preview&&sort.value==='stock')arr=[...arr].sort((a,b)=>available(b)-available(a));
      return arr;
    });
    const priceSku=p=>[...(p?.skus||[])].filter(s=>s.status==='ACTIVE').sort((a,b)=>Number(a.priceCent)-Number(b.priceCent))[0]||skuOf(p);
    const pageInfo=computed(()=>store.publicPage);const chosen=computed(()=>selected.value?.skus?.find(s=>s.skuId===chosenSku.value)||skuOf(selected.value));
    const productCategory=p=>store.categories.find(c=>c.code===p.categoryCode)?.name||'好物';
    const currentShop=p=>store.merchants.find(m=>m.merchantId===p.merchantId)||{};
    async function loadSearch(){
      if(preview)return;
      const stamp=beginPublicSearch();
      const params={q:search.value,category:category.value,merchantId:merchant.value,page:page.value,size:20,sort:sort.value==='price'?'PRICE_ASC':sort.value==='stock'?'STOCK_DESC':'NEWEST'};
      store.loading=true;store.error='';
      try{
        const result=await api('/products/page'+query(params));
        if(!publicSearchCurrent(stamp))return;
        store.products=result.items||[];
        store.publicPage={page:result.page,size:result.size,total:result.total,hasNext:result.hasNext};
      }catch(err){if(publicSearchCurrent(stamp))store.error=err.message;}
      finally{if(publicSearchCurrent(stamp))store.loading=false;}
    }
    onUnmounted(()=>beginPublicSearch());
    function setCategory(c){category.value=category.value===c?'':c;page.value=1;loadSearch();}
    function applyKeyword(word){search.value=word;page.value=1;loadSearch();}
    function showDetail(p){selected.value=p;chosenSku.value=skuOf(p).skuId||'';count.value=1;}
    async function addCart(){
      if(!selected.value||saving.value||previewGuard())return;
      if(!chosen.value?.skuId){notify('请选择有效规格');return;}
      saving.value=true;
      try{
        const current=await api('/products/'+encodeURIComponent(selected.value.productId));
        const real=current.skus.find(s=>s.skuId===chosenSku.value);
        if(!real||real.status!=='ACTIVE'||Number(real.available)<count.value)throw new Error('库存不足或商品不可售');
        const cart=await api('/cart');const old=(cart||[]).find(i=>i.skuId===real.skuId);
        const n=Number(old?.quantity||0)+count.value;
        if(n>99)throw new Error('单个规格最多购买99件');
        await api('/cart',{method:'PUT',body:{skuId:real.skuId,quantity:n}});
        selected.value=null;notify('已加入购物车');
      }catch(err){notify(err.status===401?'请先登录后再加购':err.message);}finally{saving.value=false;}
    }
    return {store,go,money,skuOf,priceSku,available,shopName,preview,keywords,search,category,merchant,sort,page,pageInfo,categories,shops,shown,selected,chosen,chosenSku,count,saving,productCategory,currentShop,staticCategoryArt,loadSearch,setCategory,applyKeyword,showDetail,addCart};
  },
  template:`
  <ConsumerShell active="home">
    <section class="search-section">
      <div class="big-search"><Icon name="search" :size="22"/><input v-model="search" placeholder="搜索商品、商户名称、规格" aria-label="搜索校园商品" @keydown.enter="page=1;loadSearch()"/><button @click="page=1;loadSearch()">搜索</button></div>
      <div class="popular-tags"><button v-for="k in keywords" :key="k" @click="applyKeyword(k)" :class="{active:search===k}">{{k}}</button></div>
    </section>
    <button class="hero-shopping" @click="go('/ai')" aria-label="进入 AI 导购">
      <div class="hero-lines"><div class="hero-title"><span>AI</span> 导购</div><h1>你的校园购物小助手</h1><span class="hero-cta">开始探索 <Icon name="arrowUpRight" :size="17" /></span></div>
      <div class="hero-robot-wrap"><img src="./images/robot.webp" alt="AI 导购机器人"/></div><span class="hero-star hstar-one">✦</span><span class="hero-star hstar-two">✧</span>
    </button>
    <section class="category-section" aria-label="商品分类">
      <button v-for="c in categories" :key="c.code" class="category-item" @click="setCategory(c.code)" :class="{categoryActive:category===c.code}"><span class="category-picture"><img :src="staticCategoryArt[c.code]||'./images/category-snacks.webp'" :alt="c.name"/></span><strong>{{c.name}}</strong></button>
    </section>
    <section class="merchant-section">
      <div class="section-head"><div class="section-title"><span class="head-accent mint"><Icon name="store" :size="21"/></span><h2>附近商家</h2></div><span class="tiny-note">校内自提</span></div>
      <div class="merchant-cards"><button class="merchant-card" v-for="(m,idx) in shops" :key="m.merchantId" @click="merchant=m.merchantId;page=1;loadSearch()" :class="{active:merchant===m.merchantId}">
        <span class="merchant-logo" :class="'store-'+idx"><img v-if="m.image" :src="m.image" :alt="m.name"/><Icon v-else name="store" :size="21"/></span>
        <strong>{{m.name}}</strong><small>{{m.storeName||m.location||'校内门店'}}</small><span class="merchant-chip"><span class="merchant-chip-dot"></span> 可自提</span>
      </button></div>
      <div v-if="merchant" class="merchant-filter-bar">当前：{{shopName(merchant)}}<button @click="merchant='';page=1;loadSearch()">清除筛选 <Icon name="x" :size="13" /></button></div>
    </section>
    <section class="reco-section">
      <div class="section-head reco-heading"><div class="section-title"><span class="flame-icon">✦</span><h2>为你推荐</h2></div><div class="sort-tabs"><button :class="{active:sort==='popular'}" @click="sort='popular';page=1;loadSearch()">最新</button><button :class="{active:sort==='stock'}" @click="sort='stock';page=1;loadSearch()">全局库存</button><button :class="{active:sort==='price'}" @click="sort='price';page=1;loadSearch()">全局价格</button></div></div>
      <div v-if="store.loading" class="inline-loading"><div class="mini-spinner"></div>正在加载</div>
      <div v-if="store.error" class="inline-error"><Icon name="alert" :size="18"/>{{store.error}} <a v-if="!preview" href="/?demo=1#/">查看设计预览</a></div>
      <div v-if="!store.loading&&!shown.length&&!store.error" class="no-results"><Icon name="search" :size="22"/>暂无相关商品<button @click="search='';category='';merchant='';page=1;loadSearch()">查看全部</button></div>
      <div class="home-product-grid">
        <article class="home-product" v-for="p in shown" :key="p.productId" @click="showDetail(p)">
          <div class="home-product-photo"><ProductImage :src="p.imageUrl" :alt="p.title"/><span v-if="p.tag" class="corner-tag">{{p.tag}}</span><span class="floating-pickup">可自提</span></div>
          <div class="home-product-info"><strong>{{p.title}}</strong><div class="product-minor"><span>{{skuOf(p).specKey}}</span><span>库存 {{available(p)>0?'充足':'售罄'}}</span></div><div class="product-price-row"><span class="price-main">{{money(priceSku(p).priceCent)}}</span><button @click.stop="showDetail(p)" :aria-label="'查看'+p.title"><Icon name="plus" :size="20" /></button></div></div>
        </article>
      </div>
      <div class="sdd-pager" v-if="!preview && pageInfo.total>0"><span>共 {{pageInfo.total}} 件</span><button :disabled="page<=1||store.loading" @click="page--;loadSearch()">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext||store.loading" @click="page++;loadSearch()">下一页</button></div>
    </section>
    
    <div v-if="selected" class="ui-overlay" @click.self="selected=null"><div class="product-sheet" role="dialog" aria-modal="true" :aria-label="selected.title">
      <button class="sheet-close" @click="selected=null" aria-label="关闭"><Icon name="x" :size="19"/></button>
      <div class="sheet-product-line"><ProductImage :src="selected.imageUrl" :alt="selected.title"/><div><span class="mini-category">{{productCategory(selected)}}</span><h3>{{selected.title}}</h3><div class="sheet-price">{{money(chosen.priceCent)}}</div><span class="sheet-muted">{{currentShop(selected).name||'校内商户'}}</span></div></div>
      <button class="more-product-detail" @click="go('/product/'+selected.productId);selected=null">查看商品详情 <Icon name="chevronRight" :size="15"/></button><label class="sheet-field-label">选择规格</label><div class="sku-picker"><button v-for="sku in selected.skus" :key="sku.skuId" :class="{active:chosenSku===sku.skuId}" :disabled="sku.status!=='ACTIVE'||sku.available===0" @click="chosenSku=sku.skuId">{{sku.specKey}}</button></div>
      <div class="quantity-picker"><span>购买数量</span><div><button @click="count=Math.max(1,count-1)" aria-label="减少数量"><Icon name="minus" :size="17" /></button><b>{{count}}</b><button @click="count=Math.min(99,Number(chosen.available||0),count+1)" aria-label="增加数量" :disabled="count>=Number(chosen.available||0)"><Icon name="plus" :size="17"/></button></div></div>
      <button class="primary-wide" :disabled="!chosen.skuId || !chosen.available || saving || preview" @click="addCart">{{saving?'加入中…':'加入购物车'}}</button>
    </div></div>
  </ConsumerShell>`
};

return {default:__default};
})();

const M_pages_Guide_js = (()=>{
const ConsumerShell = M_components_ConsumerShell_js.default;
const ProductImage = M_components_ProductImage_js.default;
const {api} = M_services_api_js;
const {DEMO_CHAT,DEMO_PRODUCTS} = M_services_demo_js;
const {store,go,money,skuOf,preview,previewGuard,notify} = M_services_store_js;





const {ref,computed,onMounted,onUnmounted,watch}=Vue;
const prompts=[
  {label:'30元内夜宵',icon:'clock',query:'30元以内，推荐几样适合复习时吃的夜宵'},
  {label:'高蛋白零食',icon:'sparkles',query:'想买点高蛋白的零食，有什么推荐？'},
  {label:'复习清单',icon:'book',query:'帮我列一个考试周的购物清单'},
  {label:'找点好喝的',icon:'cart',query:'推荐适合夏天喝的饮料'}
];
const __default = {
  name:'Guide',components:{ConsumerShell,ProductImage},
  setup(){
    const input=ref('');const thinking=ref(false);const selectedIds=ref([]);
    const messages=ref([]);const proposal=ref(null);const mode=ref('');const error=ref('');
    const historyOpen=ref(false);const conversations=ref([]);const loadingHistory=ref(false);const openingConversation=ref(false);
    let conversationEpoch=0,historyEpoch=0;
    const examples=computed(()=>DEMO_PRODUCTS.slice(0,3));
    const items=computed(()=>preview ? examples.value.map(p=>({skuId:skuOf(p).skuId,product:p,title:p.title,specKey:skuOf(p).specKey,priceCent:skuOf(p).priceCent,quantity:1,merchantId:p.merchantId})) : (proposal.value?.items||[]).map(i=>({...i,product:store.products.find(p=>p.skus.some(s=>s.skuId===i.skuId))})));
    const total=computed(()=>items.value.filter(i=>selectedIds.value.includes(i.skuId)).reduce((n,i)=>n+Number(i.priceCent)*Number(i.quantity||1),0));
    const showProposal=computed(()=>preview || !!(proposal.value?.items?.length));
    const formatTime=()=>new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
    // 同一 AI 页面内退出/切换账号时，不能保留上一身份的本地会话与回答。
    watch(()=>store.user?.userId, (now,was)=>{
      if(preview||now===was)return;
      ++conversationEpoch;++historyEpoch;
      store.conversationId='';messages.value=[];conversations.value=[];proposal.value=null;
      selectedIds.value=[];mode.value='';error.value='';input.value='';thinking.value=false;
      openingConversation.value=false;loadingHistory.value=false;historyOpen.value=false;
      if(now)loadHistory();
    });
    onMounted(()=>{
      if(!preview)loadHistory();
      if(preview){messages.value=DEMO_CHAT.map(m=>({...m,time:'20:14'}));selectedIds.value=examples.value.map(p=>skuOf(p).skuId);}
    });
    async function ask(question=input.value){
      const text=String(question||'').trim();if(!text||thinking.value||openingConversation.value)return;
      if(text.length>500){notify('问题不能超过500字');return;}
      const stamp=++conversationEpoch;input.value='';error.value='';messages.value.push({role:'user',content:text,time:formatTime()});
      if(preview){
        messages.value.push({role:'assistant',content:'为你挑了几款商品，看看有没有喜欢的。',time:formatTime(),demo:true});
        notify('设计预览 · 未请求真实 AI');return;
      }
      thinking.value=true;
      try{
        const answer=await api('/ai/chat',{method:'POST',body:{question:text,conversationId:store.conversationId||null}});
        if(stamp!==conversationEpoch)return;
        store.conversationId=answer.conversationId||store.conversationId;
        mode.value=answer.mode||'';
        messages.value.push({role:'assistant',content:answer.answer||'暂时没有找到合适答案',warning:answer.warning,citations:(answer.citations||[]).map(c=>c.title),time:formatTime()});
        proposal.value=answer.proposal||null;
        selectedIds.value=(proposal.value?.items||[]).map(i=>i.skuId);
      }catch(err){if(stamp===conversationEpoch){error.value=err.status===401?'请先登录账号再使用 AI 导购':err.message;messages.value.pop();input.value=text;}}
      finally{if(stamp===conversationEpoch)thinking.value=false;}
    }
    async function loadHistory(){
      if(preview)return;
      const stamp=++historyEpoch;loadingHistory.value=true;
      try{const result=await api('/ai/conversations');if(stamp===historyEpoch)conversations.value=result||[];}
      catch{if(stamp===historyEpoch)conversations.value=[];}
      finally{if(stamp===historyEpoch)loadingHistory.value=false;}
    }
    async function openConversation(c){
      if(preview||thinking.value||!c?.id)return;
      const stamp=++conversationEpoch;openingConversation.value=true;
      try{
        const id=encodeURIComponent(c.id);
        const [history,proposals]=await Promise.all([
          api('/ai/conversations/'+id+'/messages'),api('/ai/conversations/'+id+'/proposals')
        ]);
        if(stamp!==conversationEpoch)return;
        store.conversationId=c.id;
        messages.value=(history||[]).map(m=>({role:m.role,content:m.content,time:'历史消息'}));
        proposal.value=(proposals||[]).find(p=>p.status==='PENDING')||null;
        selectedIds.value=(proposal.value?.items||[]).map(i=>i.skuId);
        historyOpen.value=false;
      }catch(e){if(stamp===conversationEpoch)notify(e.message);}
      finally{if(stamp===conversationEpoch)openingConversation.value=false;}
    }
    onUnmounted(()=>{++conversationEpoch;++historyEpoch;});
    function toggle(id){if(selectedIds.value.includes(id))selectedIds.value=selectedIds.value.filter(x=>x!==id);else selectedIds.value=[...selectedIds.value,id];}
    async function confirm(){
      if(previewGuard() || !proposal.value?.id || thinking.value)return;
      const stamp=conversationEpoch,actor=store.user?.userId;
      if(!selectedIds.value.length){notify('至少选择一件商品');return;}
      thinking.value=true;
      try{
        const updated=await api('/ai/proposals/'+encodeURIComponent(proposal.value.id)+'/confirm',{method:'POST',body:{selectedSkuIds:selectedIds.value}});
        if(stamp===conversationEpoch&&actor===store.user?.userId){proposal.value=updated;notify('已确认提案，购物车已更新');}
      }catch(err){notify(err.message);}finally{thinking.value=false;}
    }
    async function reject(){
      if(previewGuard()||!proposal.value?.id||thinking.value)return;
      const stamp=conversationEpoch,actor=store.user?.userId;
      thinking.value=true;
      try{await api('/ai/proposals/'+encodeURIComponent(proposal.value.id)+'/reject',{method:'POST'});if(stamp===conversationEpoch&&actor===store.user?.userId){proposal.value=null;notify('已放弃提案');}}
      catch(err){notify(err.message);}finally{thinking.value=false;}
    }
    return {store,go,money,skuOf,preview,prompts,messages,input,thinking,items,selectedIds,total,showProposal,proposal,error,mode,ask,toggle,confirm,reject,historyOpen,conversations,loadingHistory,openingConversation,loadHistory,openConversation};
  },
  template:`
    <ConsumerShell active="ai">
      <section class="ai-hero">
        <div class="ai-hero-text"><h1><span>AI</span> 导购助手</h1><p>想买什么？问我就好。</p></div>
        <img src="./images/robot.webp" alt="AI 导购机器人" class="ai-hero-robot"/>
        <span class="orb-decoration orb-one">✦</span><span class="orb-decoration orb-two">✧</span>
      </section>
      <div v-if="!preview" class="ai-history-head"><button @click="historyOpen=!historyOpen;historyOpen&&loadHistory()"><Icon name="clock" :size="15"/> 历史会话 <Icon name="chevronDown" :size="14"/></button></div><div v-if="historyOpen" class="ai-history-list"><button v-for="c in conversations" :key="c.id" @click="openConversation(c)" :disabled="thinking||openingConversation"><Icon name="order" :size="16"/> {{c.title||'对话'}} <Icon name="chevronRight" :size="14"/></button><span v-if="!conversations.length">暂无历史记录</span></div>
      <div class="quick-prompts" aria-label="快捷提问"><button v-for="p in prompts" :key="p.label" @click="ask(p.query)" :disabled="thinking||openingConversation"><Icon :name="p.icon" :size="15"/>{{p.label}}</button></div>
      <section class="chat-thread" aria-label="AI对话">
        <div v-if="!messages.length" class="chat-welcome"><span class="chat-welcome-icon"><Icon name="sparkles" :size="22"/></span><h2>你好，同学。</h2><p>告诉我预算或想买的东西。</p></div>
        <div class="chat-row" v-for="(message,index) in messages" :key="index" :class="message.role==='user'?'is-user':'is-assistant'">
          <span v-if="message.role!=='user'" class="chat-avatar"><img src="./images/robot.webp" alt="AI"/></span>
          <div class="chat-body"><div class="chat-bubble">{{message.content}}</div><div v-if="message.warning" class="message-warning">{{message.warning}}</div><div v-if="message.citations?.length" class="citation-chips"><span v-for="c in message.citations" :key="c"><Icon name="book" :size="12"/>{{c}}</span></div><span class="chat-timestamp">{{message.time||'刚刚'}} <span v-if="message.demo">· 示例回答</span></span></div>
        </div>
        <div v-if="thinking" class="chat-row is-assistant"><span class="chat-avatar"><img src="./images/robot.webp" alt="AI"/></span><div class="typing-bubble"><i></i><i></i><i></i></div></div>
        <div v-if="error" class="inline-error"><Icon name="alert" :size="17"/>{{error}}</div>
      </section>
      <section v-if="showProposal" class="recommendation-panel">
        <div class="recommendation-header"><div><h2>为你选了 <em>{{items.length}}</em> 件好物</h2></div></div>
        <div class="rec-cards">
          <article class="rec-item" v-for="(item,index) in items" :key="item.skuId">
            <button class="rec-check" :class="{checked:selectedIds.includes(item.skuId)}" @click="toggle(item.skuId)" :aria-label="'选择'+item.title"><Icon name="check" :size="13"/></button>
            <div class="rec-photo"><ProductImage :src="item.imageUrl||item.product?.imageUrl" :alt="item.title"/></div>
            <div class="rec-card-content"><div class="rec-item-tag">{{index===0?'HOT PICK':index===1?'DAILY':'GOOD VALUE'}}</div><strong>{{item.title}}</strong><small>{{item.specKey}}</small><div class="rec-price"><span>{{money(item.priceCent)}}</span><span class="pick-mini"><Icon name="plus" :size="15"/></span></div></div>
          </article>
        </div>
        <div class="proposal-footer"><div class="proposal-total"><span>已选 {{selectedIds.length}} 件</span><strong>{{money(total)}}</strong></div><div class="proposal-actions"><button v-if="!preview&&proposal?.status==='PENDING'" class="ghost-decline" @click="reject">放弃</button><button class="confirm-button" @click="confirm" :disabled="preview||thinking||!selectedIds.length||(!preview&&proposal?.status!=='PENDING')"><Icon name="check" :size="17"/>{{proposal?.status==='CONFIRMED'?'已确认':'确认加购'}}</button></div></div>
      </section>
      <div class="chat-composer-placeholder" aria-hidden="true"></div>
      <form class="chat-composer" @submit.prevent="ask()"><input v-model="input" :disabled="thinking||openingConversation" aria-label="输入问题" maxlength="500" placeholder="问问 AI，帮你找好物…"/><button type="submit" :disabled="thinking||openingConversation||!input.trim()" aria-label="发送问题"><Icon name="send" :size="20"/></button></form>
    </ConsumerShell>`
};

return {default:__default};
})();

const M_pages_Merchant_js = (()=>{
const {api,idempotency} = M_services_api_js;
const AuthDialog = M_components_AuthDialog_js.default;
const ProductImage = M_components_ProductImage_js.default;
const ProductImageField = M_components_ProductImageField_js.default;
const {store,go,money,skuOf,available,preview,previewGuard,notify,loadMerchant,hasPermission,switchMerchantContext} = M_services_store_js;





const {ref,computed,watch,nextTick,onMounted,onUnmounted}=Vue;
const MENU=[
  ['home','工作台','/merchant'],['package','商品管理','/merchant/products'],['box','库存管理','/merchant/inventory'],
  ['order','订单管理','/merchant/orders'],['scan','自提核销','/merchant/pickup'],['clipboard','售后处理','/merchant/aftersales'],
  ['users','店员管理','/merchant/team'],['shield','角色权限','/merchant/roles'],['book','知识库','/merchant/knowledge'],['settings','门店设置','/merchant/settings']
];
const __default = {
  name:'Merchant',components:{AuthDialog,ProductImage,ProductImageField},
  setup(){
    const search=ref('');const category=ref('');const status=ref('');const sort=ref('NEWEST');const page=ref(1);
    const selectedId=ref('');const selectedSkuId=ref('');const drawerTab=ref('stock');
    const loginOpen=ref(false);const adjustment=ref(1);const pendingReplenishKey=ref('');const pendingReplenishPayload=ref('');const saving=ref(false);const modal=ref('');const activePriceSku=ref(null);const newPrice=ref('');
    const form=ref({title:'',description:'',categoryCode:'food',imageUrl:'',skus:[{specKey:'默认规格',price:'4.50'}]});
    const skuForm=ref({specKey:'',price:''});
    const info=ref({title:'',description:'',categoryCode:'food',imageUrl:''});
    const createImageUploading=ref(false),editImageUploading=ref(false);
    const createImageInvalid=ref(false),editImageInvalid=ref(false);
    const merchant=computed(()=>store.merchants.find(m=>m.merchantId===store.merchantId)||store.merchants[0]||{});
    const owned=computed(()=>hasPermission('product.write'));
    const required={'/merchant':'order.read','/merchant/products':'product.read','/merchant/inventory':'stock.read',
      '/merchant/orders':'order.read','/merchant/pickup':'pickup.verify','/merchant/aftersales':'aftersale.read',
      '/merchant/team':'team.manage','/merchant/roles':'role.manage','/merchant/knowledge':'knowledge.read','/merchant/settings':'store.manage'};
    const visibleMenu=computed(()=>MENU.filter(([, ,path])=>hasPermission(required[path])));
    const mobileNav=ref(null);
    const alignMobileNav=()=>{const nav=mobileNav.value;if(nav?.clientWidth)nav.querySelector('button.active')?.scrollIntoView({inline:'center',block:'nearest'});};
    watch([()=>store.route,()=>visibleMenu.value.map(item=>item[2]).join('|')],async()=>{await nextTick();alignMobileNav();},{immediate:true,flush:'post'});
    onMounted(()=>window.addEventListener('resize',alignMobileNav));
    onUnmounted(()=>window.removeEventListener('resize',alignMobileNav));
    const canReplenish=computed(()=>hasPermission('stock.replenish'));
    const canRead=computed(()=>hasPermission('product.read'));
    const items=computed(()=>store.products.filter(p=>p.merchantId===store.merchantId));
    const selected=computed(()=>items.value.find(p=>p.productId===selectedId.value)||items.value[0]||null);
    const selectedSku=computed(()=>selected.value?.skus?.find(s=>s.skuId===selectedSkuId.value)||skuOf(selected.value));
    const stock=computed(()=>store.stocks.find(s=>s.skuId===selectedSku.value?.skuId)||null);
    const priceSku=p=>[...(p?.skus||[])].filter(s=>s.status==='ACTIVE').sort((a,b)=>Number(a.priceCent)-Number(b.priceCent))[0]||skuOf(p);
    const count=computed(()=>({all:items.value.length,published:items.value.filter(p=>p.status==='PUBLISHED').length,unpublished:items.value.filter(p=>p.status!=='PUBLISHED').length,low:items.value.filter(p=>p.status==='PUBLISHED'&&available(p)<20).length}));
    const filtered=computed(()=>{
      if(!preview)return status.value==='low'?items.value.filter(p=>p.status==='PUBLISHED'&&available(p)<20):items.value;
      const q=search.value.trim().toLowerCase();
      return items.value.filter(p=>
        (!q || p.title.toLowerCase().includes(q) || p.skus.some(s=>s.specKey.toLowerCase().includes(q)||s.skuId.toLowerCase().includes(q))) &&
        (!category.value||p.categoryCode===category.value) &&
        (!status.value||(status.value==='low'?(p.status==='PUBLISHED'&&available(p)<20):p.status===status.value))
      );
    });
    const totalPages=computed(()=>Math.max(1,Math.ceil((preview?filtered.value.length:store.merchantPage.total)/9)));
    const pageRows=computed(()=>preview?filtered.value.slice((page.value-1)*9,page.value*9):filtered.value);
    const inventoryPercent=computed(()=>Math.min(100,(Number(stock.value?.available||0)/Math.max(1,Number(stock.value?.onHand||0)))*100));
    const tableCategory=p=>store.categories.find(c=>c.code===p.categoryCode)?.name||p.categoryCode;
    const choose=p=>{editImageInvalid.value=false;selectedId.value=p.productId;selectedSkuId.value=skuOf(p).skuId||'';drawerTab.value='stock';};
    watch(selected, p=>{if(p){if(!p.skus.some(s=>s.skuId===selectedSkuId.value))selectedSkuId.value=skuOf(p).skuId||'';info.value={title:p.title,description:p.description||'',categoryCode:p.categoryCode,imageUrl:p.imageUrl||''};}}, {immediate:true});
    let searchDelay;
    function refreshPage(){if(preview)return;loadMerchant({page:page.value,size:9,q:search.value,category:category.value,status:status.value==='low'?'':status.value,sort:sort.value});}
    watch([category,status,sort],()=>{page.value=1;refreshPage();});
    watch(search,()=>{page.value=1;clearTimeout(searchDelay);searchDelay=setTimeout(refreshPage,280);});
    watch(page,refreshPage);
    function openCreate(){createImageUploading.value=false;createImageInvalid.value=false;form.value={title:'',description:'',categoryCode:store.categories.find(c=>c.active)?.code||'food',imageUrl:'',skus:[{specKey:'默认规格',price:''}]};modal.value='create';}
    function openPrice(sku){activePriceSku.value=sku;newPrice.value=(Number(sku.priceCent)/100).toFixed(2);modal.value='price';}
    function yuanToCent(value){const v=String(value).trim();if(!/^\d{1,7}(\.\d{1,2})?$/.test(v))throw new Error('请输入正确金额（最多两位小数）');const [a,b='']=v.split('.');const cent=Number(a)*100+Number((b+'00').slice(0,2));if(cent<=0)throw new Error('价格必须大于零');return cent;}
    async function create(){
      if(previewGuard()||saving.value||createImageUploading.value)return;
      if(createImageInvalid.value){notify('请重新选择图片，或移除失败的图片');return;}
      const f=form.value;if(!f.title.trim()||!f.skus.length||f.skus.length>20){notify('请填写商品名称及1至20个规格');return;}
      const keys=new Set();let skus;
      try{skus=f.skus.map(item=>{const specKey=item.specKey.trim();if(!specKey||specKey.length>100||keys.has(specKey))throw new Error('规格不能为空且不能重复');keys.add(specKey);return {specKey,priceCent:yuanToCent(item.price)};});}
      catch(e){notify(e.message);return;}
      saving.value=true;
      try{
        await api('/merchants/'+encodeURIComponent(store.merchantId)+'/products',{method:'POST',body:{title:f.title.trim(),description:f.description.trim(),categoryCode:f.categoryCode,imageUrl:f.imageUrl||'',skus}});
        modal.value='';await loadMerchant();notify('商品已创建（草稿）');
      }catch(e){notify(e.message);}finally{saving.value=false;}
    }
    function addCreateSku(){if(form.value.skus.length<20)form.value.skus.push({specKey:'',price:''});}
    function removeCreateSku(index){if(form.value.skus.length>1)form.value.skus.splice(index,1);}
    function openAddSku(){skuForm.value={specKey:'',price:''};modal.value='addSku';}
    async function addSku(){
      if(previewGuard()||saving.value||!owned.value||!selected.value)return;
      const specKey=skuForm.value.specKey.trim();if(!specKey||specKey.length>100||selected.value.skus.some(s=>s.specKey===specKey)){notify('规格不能为空且不能重复');return;}
      let priceCent;try{priceCent=yuanToCent(skuForm.value.price);}catch(e){notify(e.message);return;}
      saving.value=true;
      try{await api('/merchants/'+encodeURIComponent(store.merchantId)+'/products/'+encodeURIComponent(selected.value.productId)+'/skus',{method:'POST',body:{specKey,priceCent}});modal.value='';await loadMerchant();notify('规格已新增');drawerTab.value='sku';}
      catch(e){notify(e.message);}finally{saving.value=false;}
    }
    async function publish(p){
      if(previewGuard()||saving.value||!owned.value)return;
      saving.value=true;
      try{await api('/merchants/'+encodeURIComponent(store.merchantId)+'/products/'+encodeURIComponent(p.productId)+'/publish',{method:'POST',body:{published:p.status!=='PUBLISHED'}});await loadMerchant();notify(p.status==='PUBLISHED'?'已下架':'已上架');}
      catch(err){notify(err.message);}finally{saving.value=false;}
    }
    async function replenish(){
      if(previewGuard()||saving.value||!canReplenish.value||!selectedSku.value?.skuId)return;
      const n=Number(adjustment.value);if(!Number.isInteger(n)||n<1||n>1000000){notify('补货数量必须为1~1000000');return;}
      const fingerprint=store.merchantId+':'+selectedSku.value.skuId+':'+n;
      if(fingerprint!==pendingReplenishPayload.value){pendingReplenishKey.value=idempotency();pendingReplenishPayload.value=fingerprint;}
      saving.value=true;
      try{
        await api('/merchants/'+encodeURIComponent(store.merchantId)+'/stocks/'+encodeURIComponent(selectedSku.value.skuId)+'/replenish',{method:'POST',body:{quantity:n},key:pendingReplenishKey.value});
        pendingReplenishKey.value='';pendingReplenishPayload.value='';adjustment.value=1;await loadMerchant();notify('补货完成');
      }catch(err){notify(err.message);}finally{saving.value=false;}
    }
    async function saveInfo(){
      if(previewGuard()||!owned.value||saving.value||editImageUploading.value||!selected.value)return;
      if(editImageInvalid.value){notify('请重新选择图片，或移除失败的图片');return;}
      if(!info.value.title.trim()){notify('商品名称不能为空');return;}
      saving.value=true;
      try{await api('/merchants/'+encodeURIComponent(store.merchantId)+'/products/'+encodeURIComponent(selected.value.productId),{method:'PUT',body:{title:info.value.title.trim(),description:info.value.description.trim(),categoryCode:info.value.categoryCode,imageUrl:info.value.imageUrl||'',expectedVersion:selected.value.version}});await loadMerchant();notify('商品信息已更新');}
      catch(err){notify(err.message);}finally{saving.value=false;}
    }
    async function savePrice(){
      if(previewGuard()||!owned.value||saving.value||!activePriceSku.value||!selected.value)return;
      let cent;try{cent=yuanToCent(newPrice.value);}catch(e){notify(e.message);return;}
      saving.value=true;
      try{await api('/merchants/'+encodeURIComponent(store.merchantId)+'/products/'+encodeURIComponent(selected.value.productId)+'/skus/'+encodeURIComponent(activePriceSku.value.skuId)+'/price',{method:'PUT',body:{priceCent:cent,expectedVersion:selected.value.version}});modal.value='';await loadMerchant();notify('售价已更新');}
      catch(err){notify(err.message);}finally{saving.value=false;}
    }
    async function switchMerchant(e){if(preview){notify('设计预览：仅展示示例门店');return;}switchMerchantContext(e.target.value);selectedId.value='';await loadMerchant();}
    return {mobileNav,priceSku,sort,canRead,canReplenish,skuForm,addCreateSku,removeCreateSku,openAddSku,addSku,loginOpen,store,go,money,skuOf,available,preview,previewGuard,notify,loadMerchant,owned,merchant,visibleMenu,search,category,status,page,selectedId,selectedSkuId,drawerTab,adjustment,saving,modal,activePriceSku,newPrice,form,info,selected,selectedSku,stock,count,filtered,totalPages,pageRows,inventoryPercent,tableCategory,createImageUploading,editImageUploading,createImageInvalid,editImageInvalid,choose,openCreate,openPrice,create,publish,replenish,saveInfo,savePrice,switchMerchant};
  },
  template:`
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
      </main>
    </div></template>
    <AuthDialog v-if="loginOpen" @close="loginOpen=false" @success="loadMerchant" />
    <div v-if="modal" class="ui-overlay" @click.self="modal=''">
      <form class="merchant-modal" v-if="modal==='create'" @submit.prevent="create"><div class="merchant-modal-header"><div><h2>新增商品</h2></div><button type="button" @click="modal=''" aria-label="关闭"><Icon name="x" :size="20"/></button></div><label class="field-label">商品名称</label><input class="admin-input" maxlength="100" v-model="form.title" placeholder="商品名称" required/><label class="field-label">分类</label><select v-model="form.categoryCode" class="admin-input"><option v-for="c in store.categories.filter(c=>c.active)" :value="c.code">{{c.name}}</option></select><label class="field-label">规格 / 售价（元）</label><div v-for="(item,index) in form.skus" :key="index" class="sku-create-row"><input class="admin-input" maxlength="100" v-model="item.specKey" required placeholder="例如 250ml"/><input class="admin-input" v-model="item.price" inputmode="decimal" placeholder="0.00" required/><button type="button" class="outline-button small" :disabled="form.skus.length===1" @click="removeCreateSku(index)" :aria-label="'移除规格'+(index+1)"><Icon name="x" :size="15"/></button></div><button type="button" class="outline-button small" :disabled="form.skus.length>=20" @click="addCreateSku"><Icon name="plus" :size="15"/>添加规格</button><label class="field-label">描述</label><textarea class="admin-input" rows="3" v-model="form.description" placeholder="选填"></textarea><label class="field-label">商品主图</label><ProductImageField v-model="form.imageUrl" :merchant-id="store.merchantId" :demo="preview" :disabled="saving||!owned" @busy="createImageUploading=$event" @invalid="createImageInvalid=$event"/><div class="form-buttons"><button type="button" class="outline-button" @click="modal=''">取消</button><button type="submit" class="teal-button" :disabled="preview||saving||createImageUploading||createImageInvalid||!owned">保存商品</button></div></form>
      <form class="merchant-modal narrow" v-else-if="modal==='addSku'" @submit.prevent="addSku"><div class="merchant-modal-header"><h2>新增规格</h2><button type="button" @click="modal=''" aria-label="关闭"><Icon name="x" :size="18"/></button></div><label class="field-label">规格名称</label><input class="admin-input" maxlength="100" v-model="skuForm.specKey" required placeholder="例如：500ml"/><label class="field-label">售价（元）</label><input class="admin-input" v-model="skuForm.price" inputmode="decimal" required placeholder="0.00"/><div class="form-buttons"><button type="button" class="outline-button" @click="modal=''">取消</button><button type="submit" class="teal-button" :disabled="preview||saving">保存规格</button></div></form><form class="merchant-modal narrow" v-else-if="modal==='price'" @submit.prevent="savePrice"><div class="merchant-modal-header"><div><h2>修改售价</h2></div><button type="button" @click="modal=''" aria-label="关闭"><Icon name="x" :size="20"/></button></div><div class="field-muted">{{selected?.title}} · {{activePriceSku?.specKey}}</div><label class="field-label">售价（元）</label><input class="admin-input" v-model="newPrice" inputmode="decimal" required/><div class="form-buttons"><button type="button" class="outline-button" @click="modal=''">取消</button><button type="submit" class="teal-button" :disabled="preview||saving">保存售价</button></div></form>
    </div>
  </div>`
};

return {default:__default};
})();

const M_pages_ProductDetail_js = (()=>{
const ConsumerShell = M_components_ConsumerShell_js.default;
const ProductImage = M_components_ProductImage_js.default;
const {api} = M_services_api_js;
const {store,go,money,preview,notify,skuOf} = M_services_store_js;
const {pathId} = M_services_page_utils_js;





const {ref,computed,onMounted,watch}=Vue;
const __default = {
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

return {default:__default};
})();

const M_pages_Shop_js = (()=>{
const ConsumerShell = M_components_ConsumerShell_js.default;
const ProductImage = M_components_ProductImage_js.default;
const {api,query} = M_services_api_js;
const {store,go,money,skuOf,preview} = M_services_store_js;




const {ref,computed,onMounted,onUnmounted,watch}=Vue;
const __default = {
 name:'Shop',components:{ConsumerShell,ProductImage},setup(){
  const merchant=ref(null),products=ref([]),error=ref(''),loading=ref(false),page=ref(1),hasNext=ref(false);
  const id=computed(()=>decodeURIComponent(store.route.slice('/shops/'.length).split('/')[0]||''));
  let loadVersion=0;
  async function load(){
    const stamp=++loadVersion,current=id.value,currentPage=page.value;
    const valid=()=>stamp===loadVersion&&current===id.value&&currentPage===page.value;
    error.value='';loading.value=true;merchant.value=null;products.value=[];hasNext.value=false;
    try{
      if(preview){
        merchant.value=store.merchants.find(m=>m.merchantId===current)||null;
        const all=store.products.filter(p=>p.merchantId===current&&p.status==='PUBLISHED');
        products.value=all.slice((currentPage-1)*12,currentPage*12);hasNext.value=all.length>currentPage*12;
      }else{
        const [m,p]=await Promise.all([
          api('/merchants/public/'+encodeURIComponent(current)),
          api('/products/page'+query({merchantId:current,page:currentPage,size:12}))
        ]);
        if(!valid())return;
        merchant.value=m;products.value=p?.items||[];hasNext.value=!!p?.hasNext;
      }
    }catch(e){if(valid())error.value=e.message;}
    finally{if(valid())loading.value=false;}
  }
  onMounted(load);onUnmounted(()=>++loadVersion);
  watch(id,()=>{if(page.value!==1)page.value=1;else load();});watch(page,load);
  return {merchant,products,error,loading,page,hasNext,go,money,skuOf};
 },
 template:`<ConsumerShell active="home"><div class="mobile-page-top"><button @click="go('/')" aria-label="返回"><Icon name="arrowLeft"/></button><b>商户</b><span></span></div><div v-if="error" class="inline-error">{{error}}</div><template v-if="merchant"><section class="shop-hero"><span class="merchant-logo"><Icon name="store" :size="28"/></span><div><h1>{{merchant.name}}</h1><p>{{merchant.storeName}} · {{merchant.location}}</p></div></section><div class="section-heading"><h2>在售商品</h2></div><div class="shop-product-grid"><button v-for="p in products" :key="p.productId" class="shop-product-card" @click="go('/product/'+encodeURIComponent(p.productId))"><ProductImage :src="p.imageUrl" :alt="p.title"/><strong>{{p.title}}</strong><span>{{money(skuOf(p).priceCent)}}</span></button></div><div v-if="!products.length&&!loading" class="mobile-empty">暂无在售商品</div><div class="shop-pagination"><button :disabled="page===1||loading" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!hasNext||loading" @click="page++">下一页</button></div></template><div v-else-if="loading" class="mobile-empty">正在加载商户…</div></ConsumerShell>`
};

return {default:__default};
})();

const M_pages_Cart_js = (()=>{
const ConsumerShell = M_components_ConsumerShell_js.default;
const ProductImage = M_components_ProductImage_js.default;
const {api,idempotency} = M_services_api_js;
const {store,go,money,preview,notify} = M_services_store_js;
const {DEMO_CART} = M_services_pages_demo_js;
const {pathId,positiveInt} = M_services_page_utils_js;






const {ref,computed,onMounted}=Vue;
const __default = {
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

return {default:__default};
})();

const M_pages_Orders_js = (()=>{
const ConsumerShell = M_components_ConsumerShell_js.default;
const ProductImage = M_components_ProductImage_js.default;
const {api,query} = M_services_api_js;
const {store,go,money,preview,notify} = M_services_store_js;
const {DEMO_ORDERS} = M_services_pages_demo_js;
const {label,dateTime,pathId} = M_services_page_utils_js;






const {ref,computed,onMounted,watch}=Vue;
const __default = {
 name:'Orders',components:{ConsumerShell,ProductImage},setup(){
   const orders=ref([]),detail=ref(null),token=ref(null),error=ref(''),busy=ref(false),tab=ref('ALL'),page=ref(1),pageInfo=ref({total:0,hasNext:false}),refundOpen=ref(false),reason=ref('');
   const id=computed(()=>store.route.startsWith('/orders/')?decodeURIComponent(store.route.slice('/orders/'.length)):null);
   const filtered=computed(()=>orders.value.filter(o=>tab.value==='ALL'||o.status===tab.value));
   const merchantName=(id,record)=>record?.merchantName||store.merchants.find(m=>m.merchantId===id)?.name||'校内商户';
   async function load(){error.value='';token.value=null;refundOpen.value=false;if(preview){orders.value=DEMO_ORDERS.map(x=>({...x}));pageInfo.value={total:orders.value.length,hasNext:false};detail.value=id.value?orders.value.find(o=>o.orderId===id.value)||null:null;return;}
     try{if(id.value){detail.value=await api('/orders/'+pathId(id.value));}else{detail.value=null;const result=await api('/orders/page'+query({page:page.value,size:10,state:tab.value==='ALL'?'':tab.value}));orders.value=result.items||[];pageInfo.value=result;}}catch(e){error.value=e.message;}
   }
   onMounted(load);watch(id,load);watch([page,tab],()=>{if(!id.value)load();});
   async function action(endpoint,method='POST',body){if(preview||busy.value||!detail.value)return;busy.value=true;try{const result=await api('/orders/'+pathId(detail.value.orderId)+endpoint,{method,body});if(endpoint==='/pickup-token'){token.value=result;}else{notify('操作成功');await load();}}catch(e){notify(e.message);}finally{busy.value=false;}}
   async function submitRefund(){if(!reason.value.trim()){notify('请输入退款原因');return;}await action('/refunds','POST',{reason:reason.value.trim()});refundOpen.value=false;reason.value='';}
   function statusClass(s){return ['PAID','COMPLETED'].includes(s)?'ok':['CANCELED','REFUNDED'].includes(s)?'muted':'warn';}
   const allowToken=computed(()=>detail.value?.status==='PAID'&&detail.value?.pickup?.status==='READY'&&!['REQUESTED','DISPUTED','APPROVED'].includes(detail.value?.afterSale?.status));
   return {store,orders,detail,filtered,token,error,busy,tab,page,pageInfo,refundOpen,reason,id,preview,go,money,label,dateTime,merchantName,action,submitRefund,statusClass,allowToken,load};
 },
 template:`<ConsumerShell active="orders"><div class="mobile-page-top"><button @click="go(id?'/orders':'/')" aria-label="返回"><Icon name="arrowLeft"/></button><b>{{id?'订单详情':'我的订单'}}</b><button @click="load" aria-label="刷新"><Icon name="refresh"/></button></div><div v-if="error" class="inline-error">{{error}}</div>
 <template v-if="!id"><div class="order-tabs"><button v-for="t in [['ALL','全部'],['PENDING_PAYMENT','待付款'],['PAID','待自提'],['COMPLETED','已完成']]" :class="{active:tab===t[0]}" :key="t[0]" @click="page=1;tab=t[0]">{{t[1]}}</button></div><div v-if="!filtered.length&&!error" class="mobile-empty"><Icon name="order" :size="34"/><strong>暂无订单</strong></div><button class="consumer-order-card" v-for="o in filtered" :key="o.orderId" @click="go('/orders/'+o.orderId)"><div class="order-card-head"><span><Icon name="store" :size="17"/>{{merchantName(o.merchantId,o)}}</span><b :class="statusClass(o.status)">{{label(o.status)}}</b></div><div class="order-goods"><div class="order-item-placeholder"><ProductImage :src="o.items?.[0]?.imageUrl" :alt="o.items?.[0]?.title||'商品'"/></div><div><strong>{{o.items?.[0]?.title||'校园订单'}}</strong><small>{{o.items?.length||0}} 种商品 · {{dateTime(o.createdAt)}}</small></div><b>{{money(o.totalCent)}}</b></div><div class="order-card-foot">#{{o.orderId}} <span>查看详情 <Icon name="chevronRight" :size="14"/></span></div></button><div class="sdd-pager" v-if="!preview&&pageInfo.total>0"><span>共 {{pageInfo.total}} 单</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext" @click="page++">下一页</button></div></template>
 <template v-else-if="detail"><section class="pickup-hero" :class="{complete:detail.status==='COMPLETED'}"><div class="pickup-status-icon"><Icon :name="detail.status==='COMPLETED'?'check':'clock'" :size="28"/></div><div><h1>{{detail.pickup?.status==='READY'?'待自提':label(detail.status)}}</h1><p>{{detail.status==='COMPLETED'?'感谢购买':detail.status==='PAID'?'校内门店自提':detail.status==='PENDING_PAYMENT'?'请在付款截止前完成模拟支付':'查看订单记录'}}</p></div></section>
 <section class="detail-card"><div class="order-card-head"><span><Icon name="store" :size="18"/>{{merchantName(detail.merchantId,detail)}}</span><Icon name="chevronRight" :size="17"/></div><div class="pickup-location"><Icon name="pin" :size="19"/><span>{{store.merchants.find(m=>m.merchantId===detail.merchantId)?.location||'校内自提门店'}}</span></div></section>
 <section class="detail-card token-card" v-if="detail.status==='PAID'"><h2>自提凭证</h2><div class="pickup-code" v-if="token"><Icon name="shield" :size="25"/><code>{{token.token}}</code><small>有效期至 {{dateTime(token.expiresAt)}}，再次签发旧凭证失效</small></div><div v-else class="pickup-code placeholder-code"><Icon name="scan" :size="30"/><span>{{detail.pickup?.status==='READY'?'可领取自提令牌':'等待商户备货完成'}}</span></div><button class="teal-button" :disabled="preview||busy||!allowToken" @click="action('/pickup-token')">{{token?'重新签发自提凭证':'领取自提凭证'}}</button></section>
 <section class="detail-card"><h2 class="card-title-inline">商品清单 <span>{{detail.items?.length||0}} 种</span></h2><div class="order-detail-line" v-for="i in detail.items" :key="i.skuId"><div class="order-item-placeholder"><ProductImage :src="i.imageUrl" :alt="i.title"/></div><div><strong>{{i.title}}</strong><small>{{i.specKey}} × {{i.quantity}}</small></div><b>{{money(Number(i.unitPriceCent)*Number(i.quantity))}}</b></div><div class="price-row"><span>实付 / 应付</span><b>{{money(detail.totalCent)}}</b></div></section>
 <section class="detail-card order-metadata"><div><span>订单编号</span><strong>{{detail.orderId}}</strong></div><div><span>下单时间</span><strong>{{dateTime(detail.createdAt)}}</strong></div><div v-if="detail.status==='PENDING_PAYMENT'"><span>付款截止</span><strong>{{dateTime(detail.deadline)}}</strong></div><div v-if="detail.afterSale"><span>售后状态</span><strong>{{label(detail.afterSale.status)}}</strong></div></section>
 <section v-if="!preview" class="order-actions"><button v-if="detail.status==='PENDING_PAYMENT'" class="teal-button" :disabled="busy" @click="action('/pay')">模拟支付</button><button v-if="detail.status==='PENDING_PAYMENT'" class="outline-button" :disabled="busy" @click="action('/cancel')">取消订单</button><button v-if="detail.status==='PAID'&&!detail.afterSale" class="outline-button" @click="refundOpen=!refundOpen">申请退款</button><button v-if="detail.status==='PAID'&&detail.afterSale?.status==='REJECTED'" class="outline-button" :disabled="busy" @click="action('/appeal')">申请平台介入</button></section><form v-if="refundOpen&&!preview" class="detail-card" @submit.prevent="submitRefund"><label class="field-label">退款原因</label><textarea class="admin-input" v-model="reason" maxlength="500" rows="3" required></textarea><button type="submit" class="teal-button" :disabled="busy">提交退款申请</button></form></template><div v-else-if="id&&!error" class="mobile-empty">加载订单中…</div></ConsumerShell>`
};

return {default:__default};
})();

const M_pages_Account_js = (()=>{
const ConsumerShell = M_components_ConsumerShell_js.default;
const AuthDialog = M_components_AuthDialog_js.default;
const {api,idempotency,query} = M_services_api_js;
const {store,go,preview,notify,loadSession} = M_services_store_js;
const {DEMO_APPLICATIONS} = M_services_pages_demo_js;
const {label} = M_services_page_utils_js;






const {ref,computed,onMounted,watch}=Vue;
const __default = {
 name:'Account',components:{ConsumerShell,AuthDialog},setup(){
   const page=ref(1),pageInfo=ref({total:0,hasNext:false});const login=ref(false),apps=ref([]),invitations=ref([]),error=ref(''),busy=ref(false),key=ref('');
   const form=ref({merchantName:'',category:'便利零售',contactName:'',contactPhone:'',storeName:'',location:''});
   const isApply=computed(()=>store.route==='/apply');const isInvite=computed(()=>store.route==='/invitations');
   async function load(){error.value='';if(preview){apps.value=DEMO_APPLICATIONS;invitations.value=[{id:'INV-01',merchantId:'preview-m1',status:'PENDING',expiresAt:'2026-10-30T12:00:00Z'}];return;}
     try{await loadSession();if(!store.user){apps.value=[];invitations.value=[];return;}const [a,i]=await Promise.all([api('/merchant-applications/mine/page'+query({page:page.value,size:10})),api('/invitations')]);apps.value=a.items||[];pageInfo.value=a;invitations.value=i||[];}catch(e){error.value=e.message;}
   }
   onMounted(load);watch(()=>store.route,load);watch(page,load);
   async function submit(){if(preview||busy.value)return; const f=form.value;if(!Object.values(f).every(x=>String(x).trim())){notify('请补全申请资料');return;}if(!key.value)key.value=idempotency();busy.value=true;try{await api('/merchant-applications',{method:'POST',body:{...f},key:key.value});key.value='';notify('申请已提交');await load();go('/account');}catch(e){notify(e.message);}finally{busy.value=false;}}
   async function accept(i){if(preview||busy.value)return;busy.value=true;try{await api('/invitations/'+encodeURIComponent(i.id)+'/accept',{method:'POST'});notify('邀请已接受');await load();}catch(e){notify(e.message);}finally{busy.value=false;}}
   return {store,go,preview,login,apps,page,pageInfo,invitations,error,busy,form,isApply,isInvite,submit,accept,label,load};
 },
 template:`<ConsumerShell active="account"><div class="mobile-page-top"><button @click="go('/account')" aria-label="返回"><Icon name="arrowLeft"/></button><b>{{isApply?'商户入驻':isInvite?'收到的邀请':'个人中心'}}</b><button v-if="!isApply&&!isInvite" @click="load" aria-label="刷新"><Icon name="refresh"/></button></div>
 <template v-if="!isApply&&!isInvite"><section class="account-profile"><div class="profile-avatar"><Icon name="user" :size="30"/></div><div><h1>{{store.user?.displayName||'校园同学'}}</h1><p>{{store.user?.username||'登录后查看订单与申请'}}</p></div><button v-if="!store.user&&!preview" class="outline-button" @click="login=true">登录 / 注册</button><span v-if="preview" class="demo-pill">设计预览</span></section><div class="account-quick"><button @click="go('/orders')"><Icon name="order"/><span>我的订单</span></button><button @click="go('/cart')"><Icon name="cart"/><span>购物车</span></button><button @click="go('/apply')"><Icon name="store"/><span>商户入驻</span></button><button @click="go('/invitations')"><Icon name="users"/><span>邀请</span></button></div><div class="account-section-head"><h2>入驻记录</h2><button @click="go('/apply')">去申请 <Icon name="chevronRight" :size="15"/></button></div><div v-if="error" class="inline-error">{{error}}</div><div class="account-application" v-for="a in apps" :key="a.applicationId"><div><strong>{{a.merchantName}}</strong><span>{{a.storeName}} · {{a.location}}</span></div><b class="status-tag" :class="a.status==='APPROVED'?'published':'draft'">{{label(a.status)}}</b><p v-if="a.rejectionReason">{{a.rejectionReason}}</p></div><div v-if="!apps.length&&!error" class="mobile-empty">暂无入驻记录</div><div class="sdd-pager" v-if="!preview&&pageInfo.total>0"><span>{{pageInfo.total}} 条</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext" @click="page++">下一页</button></div></template>
 <form v-else-if="isApply" class="account-form detail-card" @submit.prevent="submit"><label>经营名称<input v-model.trim="form.merchantName" required maxlength="100" placeholder="商户名称"/></label><label>经营品类<select v-model="form.category"><option>便利零售</option><option>水果生鲜</option><option>文具用品</option><option>饮品</option><option>其他</option></select></label><label>联系人<input v-model.trim="form.contactName" required maxlength="60"/></label><label>联系电话<input v-model.trim="form.contactPhone" required maxlength="30"/></label><label>首个门店名称<input v-model.trim="form.storeName" required maxlength="100"/></label><label>自提位置<input v-model.trim="form.location" required maxlength="200" placeholder="如：学一食堂一层"/></label><button class="teal-button" type="submit" :disabled="preview||busy||!store.user">{{!store.user&&!preview?'请先登录':'提交入驻申请'}}</button></form>
 <section v-else class="detail-card"><h2>待处理邀请</h2><div class="invitation-line" v-for="i in invitations" :key="i.id"><div><strong>{{i.merchantId}}</strong><small>{{label(i.status)}}</small></div><button class="outline-button" :disabled="preview||busy||i.status!=='PENDING'" @click="accept(i)">接受</button></div><div v-if="!invitations.length" class="mobile-empty">暂无邀请</div></section><AuthDialog v-if="login" @close="login=false" @success="load"/></ConsumerShell>`
};

return {default:__default};
})();

const M_pages_MerchantOps_js = (()=>{
const BackofficeShell = M_components_BackofficeShell_js.default;
const ProductImage = M_components_ProductImage_js.default;
const {api,query,idempotency} = M_services_api_js;
const {store,go,money,preview,notify,loadMerchant,hasPermission,isOwner} = M_services_store_js;
const {DEMO_STATS,DEMO_MERCHANT_ORDERS,DEMO_MEMBERS,DEMO_STOCK_MOVES,DEMO_AFTERSALES} = M_services_pages_demo_js;
const {label,dateTime,pathId,coverSku,positiveInt} = M_services_page_utils_js;






const {ref,computed,onMounted,onUnmounted,watch}=Vue;
const names={'/merchant':'经营概览','/merchant/inventory':'库存管理','/merchant/orders':'订单管理','/merchant/pickup':'自提核销','/merchant/aftersales':'售后处理','/merchant/team':'店员管理','/merchant/settings':'门店设置'};
const __default = {
 name:'MerchantOps',components:{BackofficeShell,ProductImage},setup(){
   const route=computed(()=>store.route);const title=computed(()=>names[route.value]||'经营概览');const filter=ref('');const q=ref('');
   const stats=ref(null),orders=ref([]),afterSales=ref([]),members=ref([]),moves=ref([]),stockRows=ref([]),error=ref(''),busy=ref(false),picked=ref(null),token=ref(''),decision=ref(''),reason=ref('');
   const page=ref(1),pageInfo=ref({total:0,hasNext:false}),amount=ref(1),sku=ref(''),inviteUser=ref(''),profile=ref({name:'',storeName:'',location:''});
   const replenishKey=ref(''),replenishFingerprint=ref('');
   const merchant=computed(()=>store.merchants.find(m=>m.merchantId===store.merchantId)||{});
   const skuRows=computed(()=>!preview&&route.value==='/merchant/inventory'?stockRows.value.map(s=>({product:{title:s.productTitle||s.skuId,imageUrl:s.imageUrl||''},sku:{skuId:s.skuId,specKey:s.specKey||'规格'},stock:s})):store.products.flatMap(p=>(p.skus||[]).map(s=>({product:p,sku:s,stock:store.stocks.find(x=>x.skuId===s.skuId)}))));
   const visibleOrders=computed(()=>!preview?orders.value:orders.value.filter(o=>(!filter.value||o.status===filter.value)&&(!q.value||o.orderId?.toLowerCase().includes(q.value.toLowerCase())||o.items?.some(i=>i.title?.includes(q.value)))));
   const selectedOrder=computed(()=>orders.value.find(o=>o.orderId===picked.value)||visibleOrders.value[0]||null);
   const canOwner=computed(()=>isOwner());
   const can=computed(()=>code=>hasPermission(code));
   const roles=ref([]);
   const routePermission={'/merchant':'order.read','/merchant/inventory':'stock.read', '/merchant/orders':'order.read',
      '/merchant/pickup':'pickup.verify','/merchant/aftersales':'aftersale.read','/merchant/team':'team.manage','/merchant/settings':'store.manage'};
   const restricted=computed(()=>!preview&&!hasPermission(routePermission[route.value]||'order.read'));
   const canAct=computed(()=>!preview&&!busy.value&&!!store.merchantId&&!restricted.value);
   let loadVersion=0;
   function clearPrivateViews(){stats.value=null;orders.value=[];afterSales.value=[];members.value=[];moves.value=[];stockRows.value=[];picked.value=null;decision.value='';pageInfo.value={total:0,hasNext:false};}
   async function load(){const stamp=++loadVersion;const section=route.value;error.value='';if(!store.merchantId)await loadMerchant();if(stamp!==loadVersion)return;const mid=store.merchantId;if(!mid){error.value=store.error||'尚未加入商户';return;}if(restricted.value)return;
     if(preview){pageInfo.value={total:DEMO_MERCHANT_ORDERS.length,hasNext:false};stats.value={...DEMO_STATS};orders.value=DEMO_MERCHANT_ORDERS.map(o=>({...o}));members.value=DEMO_MEMBERS;afterSales.value=DEMO_AFTERSALES;moves.value=DEMO_STOCK_MOVES;profile.value={name:merchant.value.name||'东湖便利',storeName:merchant.value.storeName||'学一食堂店',location:merchant.value.location||'东湖校区'};return;}
     const base='/merchants/'+pathId(mid);
     const actor=store.user?.userId;
     const current=()=>stamp===loadVersion&&route.value===section&&store.merchantId===mid&&store.user?.userId===actor;
     try{
       if(section==='/merchant'){const [s,o]=await Promise.all([hasPermission('dashboard.read')?api(base+'/statistics'):Promise.resolve(null),api(base+'/orders/page'+query({page:1,size:5}))]);if(!current())return;stats.value=s;orders.value=o.items||[];pageInfo.value=o;}
       if(section==='/merchant/orders'||section==='/merchant/pickup'){const result=await api(base+'/orders/page'+query({page:page.value,size:10,state:filter.value,q:q.value}));if(!current())return;orders.value=result.items||[];pageInfo.value=result;}
       if(section==='/merchant/aftersales'){const result=await api(base+'/aftersales/page'+query({page:page.value,size:10}));if(!current())return;afterSales.value=result.items||[];pageInfo.value=result;}
       if(section==='/merchant/inventory'){const [stockResult,movements]=await Promise.all([api(base+'/stocks/page'+query({page:page.value,size:10,q:q.value})),api(base+'/stock-movements/page'+query({page:1,size:8}))]);if(!current())return;stockRows.value=stockResult.items||[];moves.value=movements.items||[];pageInfo.value=stockResult;}
       if(section==='/merchant/team'){const [m,r]=await Promise.all([api(base+'/members'),api(base+'/rbac/roles')]);if(!current())return;members.value=m||[];roles.value=r||[];}
       if(section==='/merchant/settings'&&current())profile.value={name:merchant.value.name||'',storeName:merchant.value.storeName||'',location:merchant.value.location||''};
     }catch(e){if(current())error.value=e.message;}
   }
   onMounted(load);onUnmounted(()=>{++loadVersion;clearTimeout(searchDelay);});watch([route,()=>store.merchantId,()=>store.user?.userId],()=>{++loadVersion;clearPrivateViews();page.value=1;load();});watch(page,load);watch(filter,()=>{page.value=1;if(route.value==='/merchant/orders'||route.value==='/merchant/pickup')load();});
   let searchDelay;watch(q,()=>{if(!preview&&['/merchant/orders','/merchant/pickup','/merchant/inventory'].includes(route.value)){++loadVersion;page.value=1;clearTimeout(searchDelay);searchDelay=setTimeout(load,280);}});
   async function perform(url,body,method='POST',key){if(!canAct.value)return;busy.value=true;try{await api(url,{method,body,key});notify('操作成功');token.value='';await load();return true;}catch(e){notify(e.message);return false;}finally{busy.value=false;}}
   function midPath(){return '/merchants/'+pathId(store.merchantId);}
   async function prepare(o,ready){await perform(midPath()+'/orders/'+pathId(o.orderId)+(ready?'/ready':'/prepare'));}
   async function verify(o){if(!token.value.trim()){notify('请输入买家出示的自提令牌');return;}await perform(midPath()+'/orders/'+pathId(o.orderId)+'/verify',{token:token.value.trim()});}
   async function replenish(){if(!hasPermission('stock.replenish'))return;if(!positiveInt(amount.value,1000000)){notify('补货数量须为1~1000000');return;}if(!sku.value)return;const f=store.merchantId+':'+sku.value+':'+Number(amount.value);if(replenishFingerprint.value!==f){replenishFingerprint.value=f;replenishKey.value=idempotency();}if(await perform(midPath()+'/stocks/'+pathId(sku.value)+'/replenish',{quantity:Number(amount.value)},'POST',replenishKey.value)){replenishKey.value='';replenishFingerprint.value='';}}
   async function invite(){if(!canOwner.value||!inviteUser.value.trim())return;await perform(midPath()+'/invitations',{username:inviteUser.value.trim()});inviteUser.value='';}
   async function revoke(m){if(!canOwner.value||m.role==='OWNER')return;if(!window.confirm('确定撤销该成员的商户权限？'))return;await perform(midPath()+'/members/'+pathId(m.userId),undefined,'DELETE');}
   async function assignMember(m,code){
      if(!canOwner.value||!code||code===m.role||m.role==='OWNER')return;
      await perform(midPath()+'/rbac/members/'+pathId(m.userId)+'/role',{roleCode:code},'PUT');
    }
   async function saveProfile(){if(!canOwner.value)return;const v=profile.value;if(!v.name.trim()||!v.storeName.trim()||!v.location.trim()){notify('请完善门店资料');return;}await perform(midPath()+'/profile',v,'PUT');await loadMerchant();}
   async function decisionAction(s,approved){
     if(!hasPermission('aftersale.review')||!s)return;
     const comment=reason.value.trim();
     if(!comment){notify('请填写退款审核说明');return;}
     if(await perform(midPath()+'/orders/'+pathId(s.orderId)+'/refund-decision',{approved,reason:comment}))reason.value='';
   }
   const topOrders=computed(()=>orders.value.slice(0,5));const merchantName=computed(()=>merchant.value.name||'校内商户');
   return {store,go,preview,route,title,filter,q,page,pageInfo,stats,orders,afterSales,members,moves,stockRows,error,busy,picked,selectedOrder,visibleOrders,token,decision,reason,amount,sku,skuRows,inviteUser,profile,merchantName,merchant,topOrders,canOwner,can,roles,assignMember,restricted,canAct,money,label,dateTime,coverSku,load,prepare,verify,replenish,invite,revoke,saveProfile,decisionAction};
 },
 template:`<BackofficeShell role="merchant" :title="title"><template #actions><button class="outline-button small" @click="load"><Icon name="refresh" :size="16"/>刷新</button></template><div v-if="error" class="inline-error">{{error}}</div>
 <div v-if="restricted" class="ops-card access-denied"><Icon name="shield" :size="32"/><h2>无权限访问</h2></div>
 <template v-else-if="route==='/merchant'"><div class="ops-kpis" v-if="stats"><div><span>订单总数</span><strong>{{stats.totalOrders||0}}</strong></div><div><span>待处理</span><strong>{{stats.pendingCount||0}}</strong></div><div><span>已完成</span><strong>{{stats.completedCount||0}}</strong></div><div><span>完成金额</span><strong>{{money(stats.completedAmountCent)}}</strong></div></div><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>最近订单</h2><button @click="go('/merchant/orders')">查看全部 <Icon name="chevronRight" :size="15"/></button></div><div class="ops-list-line" v-for="o in topOrders" :key="o.orderId"><span class="mini-icon"><Icon name="order" :size="19"/></span><div><strong>{{o.items?.[0]?.title||'校园订单'}}</strong><small>{{o.orderId}} · {{dateTime(o.createdAt)}}</small></div><b>{{money(o.totalCent)}}</b><span class="status-tag" :class="o.status==='COMPLETED'?'published':'draft'">{{label(o.status)}}</span></div><div v-if="!topOrders.length" class="admin-empty">暂无订单</div></section><section class="ops-card"><div class="ops-card-header"><h2>快捷操作</h2></div><div class="ops-quick"><button v-if="can('product.read')" @click="go('/merchant/products')"><Icon name="package"/>商品管理</button><button v-if="can('stock.read')" @click="go('/merchant/inventory')"><Icon name="box"/>库存管理</button><button v-if="can('pickup.verify')" @click="go('/merchant/pickup')"><Icon name="scan"/>核销</button><button v-if="can('knowledge.read')" @click="go('/merchant/knowledge')"><Icon name="book"/>知识库</button></div></section></div></template>
 <template v-else-if="route==='/merchant/inventory'"><div class="ops-grid inventory-grid"><section class="ops-card"><div class="ops-card-header"><h2>库存清单</h2><span>{{preview?skuRows.length:pageInfo.total}} SKU</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="q" placeholder="商品 / SKU"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商品 / 规格</th><th>实物</th><th>预占</th><th>可售</th><th>操作</th></tr></thead><tbody><tr v-for="row in (preview?skuRows.filter(r=>!q||r.product.title.includes(q)||r.sku.specKey.includes(q)):skuRows)" :key="row.sku.skuId" :class="{active:sku===row.sku.skuId}"><td><div class="table-product-cell"><ProductImage :src="row.product.imageUrl" :alt="row.product.title"/><div><strong>{{row.product.title}}</strong><span>{{row.sku.specKey}}</span></div></div></td><td>{{row.stock?.onHand??'—'}}</td><td>{{row.stock?.reserved??'—'}}</td><td :class="{'red-text':Number(row.stock?.available||0)<10}">{{row.stock?.available??'—'}}</td><td><button v-if="can('stock.replenish')" class="row-link" @click="sku=row.sku.skuId">补货</button></td></tr></tbody></table></div></section><section class="ops-card ops-sideform"><template v-if="can('stock.replenish')"><h2>库存补货</h2><form @submit.prevent="replenish"><label class="field-label">SKU</label><select class="admin-input" v-model="sku" required><option disabled value="">选择规格</option><option v-for="row in skuRows" :key="row.sku.skuId" :value="row.sku.skuId">{{row.product.title}} · {{row.sku.specKey}}</option></select><label class="field-label">补货数量</label><input type="number" class="admin-input" v-model.number="amount" min="1" max="1000000" required/><button class="teal-button" type="submit" :disabled="!canAct">确认补货</button></form></template><div class="ops-card-header compact"><h3>库存流水</h3></div><div class="ops-list-line" v-for="m in moves.slice(0,8)" :key="m.id"><span class="mini-icon"><Icon name="box" :size="16"/></span><div><strong>{{label(m.type)}}</strong><small>{{dateTime(m.createdAt)}}</small></div><b>+{{m.quantity}}</b></div></section></div></template>
 <template v-else-if="route==='/merchant/orders'||route==='/merchant/pickup'"><div class="ops-card"><div class="ops-card-header"><h2>{{route==='/merchant/pickup'?'交付核销':'订单列表'}}</h2><div class="filter-pills"><button :class="{active:filter===''}" @click="filter=''">全部</button><button :class="{active:filter==='PAID'}" @click="filter='PAID'">已支付</button><button :class="{active:filter==='COMPLETED'}" @click="filter='COMPLETED'">已完成</button></div></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="q" placeholder="搜索订单号 / 商品"/></label><div class="ops-grid orders-split"><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>订单</th><th>商品</th><th>金额</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="o in visibleOrders" :key="o.orderId" :class="{active:selectedOrder?.orderId===o.orderId}" @click="picked=o.orderId"><td><strong>#{{o.orderId}}</strong><small>{{dateTime(o.createdAt)}}</small></td><td>{{o.items?.[0]?.title||'—'}}</td><td>{{money(o.totalCent)}}</td><td><span class="status-tag" :class="o.status==='COMPLETED'?'published':'draft'">{{label(o.status)}}</span></td><td><Icon name="chevronRight" :size="16"/></td></tr></tbody></table><div v-if="!visibleOrders.length" class="admin-empty">暂无订单</div></div><aside class="order-inspector" v-if="selectedOrder"><h2>订单详情</h2><div class="inspector-row"><span>订单编号</span><strong>{{selectedOrder.orderId}}</strong></div><div class="inspector-row"><span>订单状态</span><strong>{{label(selectedOrder.status)}}</strong></div><div class="inspector-row"><span>自提进度</span><strong>{{label(selectedOrder.pickup?.status)}}</strong></div><div class="inspector-row"><span>金额</span><b class="red-text">{{money(selectedOrder.totalCent)}}</b></div><div class="order-detail-line" v-for="i in selectedOrder.items" :key="i.skuId"><span class="mini-icon"><Icon name="package"/></span><div><strong>{{i.title}}</strong><small>{{i.specKey}} × {{i.quantity}}</small></div></div><div class="form-buttons"><button v-if="can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='WAIT_PREP'" class="outline-button" :disabled="!canAct" @click="prepare(selectedOrder,false)">开始备货</button><button v-if="can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='PREPARING'" class="teal-button" :disabled="!canAct" @click="prepare(selectedOrder,true)">备货完成</button></div><form v-if="can('pickup.verify')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='READY'" class="verify-form" @submit.prevent="verify(selectedOrder)"><label class="field-label">买家自提令牌</label><textarea class="admin-input" v-model="token" rows="3" required placeholder="输入买家自提令牌"></textarea><button type="submit" class="teal-button" :disabled="!canAct">核销自提</button></form></aside></div></div></template>
 <template v-else-if="route==='/merchant/aftersales'"><section class="ops-card"><div class="ops-card-header"><h2>售后申请</h2><span>{{afterSales.length}} 条</span></div><div class="ops-list-line" v-for="s in afterSales" :key="s.id"><span class="mini-icon"><Icon name="shield"/></span><div><strong>{{s.orderId}}</strong><small>{{s.reason}}</small></div><span class="status-tag">{{label(s.status)}}</span><button v-if="can('aftersale.review')" class="outline-button small" @click="decision=s.orderId;reason=''">审核</button></div><div v-if="!afterSales.length" class="admin-empty">暂无售后</div><form class="review-inline" v-if="decision&&can('aftersale.review')" @submit.prevent="decisionAction(afterSales.find(s=>s.orderId===decision),true)"><h3>售后审核 · {{decision}}</h3><textarea class="admin-input" rows="3" v-model="reason" maxlength="500" required placeholder="审核说明（必填）"></textarea><div class="form-buttons"><button type="button" class="outline-button" :disabled="!canAct||!reason.trim()" @click="decisionAction(afterSales.find(s=>s.orderId===decision),false)">驳回</button><button type="submit" class="teal-button" :disabled="!canAct||!reason.trim()">同意退款</button></div></form></section></template>
 <template v-else-if="route==='/merchant/team'"><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>成员</h2><span>{{members.length}} 人</span></div><div class="ops-list-line" v-for="m in members" :key="m.userId"><span class="mini-icon"><Icon name="user"/></span><div><strong>{{m.userId}}</strong><small>{{roles.find(r=>r.code===m.role)?.name||m.role}} · {{label(m.status)}}</small></div><select v-if="m.role!=='OWNER'&&m.status==='ACTIVE'" class="admin-input compact-select" :value="m.role" :disabled="!canAct" @change="assignMember(m,$event.target.value)"><option v-for="r in roles.filter(r=>r.code!=='OWNER')" :value="r.code" :key="r.code">{{r.name}}</option></select><button v-if="m.role!=='OWNER'" class="outline-button small" :disabled="!canAct||!canOwner" @click="revoke(m)">撤销</button></div></section><section class="ops-card ops-sideform"><h2>邀请店员</h2><form @submit.prevent="invite"><label class="field-label">已注册用户名</label><input class="admin-input" v-model="inviteUser" required maxlength="32" placeholder="用户名"/><button type="submit" class="teal-button" :disabled="!canAct||!canOwner">发送邀请</button></form><button class="outline-button small" @click="go('/merchant/roles')">管理角色和权限</button></section></div></template>
 <template v-else-if="route==='/merchant/settings'"><section class="ops-card ops-settings"><h2>门店资料</h2><form @submit.prevent="saveProfile"><label>经营名称<input class="admin-input" v-model="profile.name" required maxlength="100"/></label><label>门店名称<input class="admin-input" v-model="profile.storeName" required maxlength="100"/></label><label>自提位置<input class="admin-input" v-model="profile.location" required maxlength="200"/></label><button class="teal-button" :disabled="!canAct||!canOwner" type="submit">保存设置</button></form></section></template>
 <div v-if="!preview&&['/merchant/orders','/merchant/pickup','/merchant/aftersales','/merchant/inventory'].includes(route)&&pageInfo.total>0" class="sdd-pager"><span>共 {{pageInfo.total}} 条</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext" @click="page++">下一页</button></div></BackofficeShell>`
};

return {default:__default};
})();

const M_pages_Knowledge_js = (()=>{
const BackofficeShell = M_components_BackofficeShell_js.default;
const {api,query} = M_services_api_js;
const {store,preview,notify,hasPermission} = M_services_store_js;
const {DEMO_BASES,DEMO_DOCS} = M_services_pages_demo_js;
const {label,dateTime,pathId} = M_services_page_utils_js;





const {ref,computed,onMounted,onUnmounted,watch}=Vue;
const __default = {
 name:'Knowledge',components:{BackofficeShell},setup(){
  const role=computed(()=>store.route.startsWith('/admin')?'admin':'merchant');const bases=ref([]),docs=ref([]),active=ref(''),selected=ref(null),text=ref('');
  const error=ref(''),busy=ref(false),newBase=ref(false),uploading=ref(false),baseName=ref(''),visibility=ref('PUBLIC'),title=ref(''),file=ref(null);
  const docPage=ref(1),docInfo=ref({total:0,hasNext:false});const versionRoot=ref(null);const current=computed(()=>bases.value.find(b=>b.id===active.value));
  let baseEpoch=0,docEpoch=0,readEpoch=0;
  const canRead=computed(()=>preview||(role.value==='admin'?store.workspace?.platformAdmin===true:hasPermission('knowledge.read')));
  const canManage=computed(()=>preview||(role.value==='admin'?store.workspace?.platformAdmin===true:hasPermission('knowledge.manage')));
  const context=(targetRole,targetMid)=>targetRole===role.value&&targetMid===store.merchantId;
  async function load(){
    const stamp=++baseEpoch, currentRole=role.value, mid=store.merchantId;
    ++docEpoch;++readEpoch;
    error.value='';bases.value=[];docs.value=[];selected.value=null;text.value='';
    // 平台知识库可直接访问 URL，不能根据 /admin 路径推断管理员身份。
    if(currentRole==='admin'&&!preview&&!store.workspace?.platformAdmin){
      try{
        const [user,workspace]=await Promise.all([api('/auth/me'),api('/workspace')]);
        if(stamp!==baseEpoch||!context(currentRole,mid))return;
        store.user=user;store.workspace=workspace;
      }catch(e){if(stamp===baseEpoch)error.value=e.message;return;}
    }
    if(!canRead.value){active.value='';return;}
    try{
      const result=preview?DEMO_BASES:await api('/knowledge/bases');
      if(stamp!==baseEpoch||!context(currentRole,mid))return;
      // Java 返回当前登录主体有权管理的全集，商户页面只呈现正在经营的商户。
      bases.value=(result||[]).filter(b=>currentRole==='admin'||b.merchantId===mid);
      if(!bases.value.some(b=>b.id===active.value))active.value=bases.value[0]?.id||'';
      docPage.value=1;
      await loadDocs();
    }catch(e){if(stamp===baseEpoch&&context(currentRole,mid))error.value=e.message;}
  }
  async function loadDocs(){
    const stamp=++docEpoch,id=active.value,page=docPage.value,currentRole=role.value,mid=store.merchantId;
    ++readEpoch;selected.value=null;text.value='';docs.value=[];
    if(!id){docInfo.value={total:0,hasNext:false};return;}
    const valid=()=>stamp===docEpoch&&active.value===id&&docPage.value===page&&context(currentRole,mid);
    try{
      const result=preview
        ? {items:DEMO_DOCS.filter(d=>d.baseId===id),total:DEMO_DOCS.filter(d=>d.baseId===id).length,hasNext:false}
        : await api('/knowledge/bases/'+pathId(id)+'/documents/page'+query({page,size:15}));
      if(!valid())return;
      docs.value=result.items||[];docInfo.value=result;
    }catch(e){if(valid())error.value=e.message;}
  }
  onMounted(load);onUnmounted(()=>{++baseEpoch;++docEpoch;++readEpoch;});
  watch([role,()=>store.merchantId,canRead,canManage],load);watch(docPage,loadDocs);
  async function read(d){
    const stamp=++readEpoch,id=active.value,mid=store.merchantId,currentRole=role.value;
    selected.value=d;text.value='';
    if(preview){text.value=d.content||'演示文档内容';return;}
    try{
      const result=await api('/knowledge/documents/'+pathId(d.id));
      if(stamp===readEpoch&&active.value===id&&selected.value?.id===d.id&&context(currentRole,mid)){
        text.value=result.content||'';selected.value=result;
      }
    }catch(e){if(stamp===readEpoch)notify(e.message);}
  }
  async function create(){if(preview||busy.value||!canManage.value||!baseName.value.trim())return;busy.value=true;try{await api('/knowledge/bases',{method:'POST',body:{merchantId:role.value==='admin'?null:store.merchantId,name:baseName.value.trim(),visibility:visibility.value}});newBase.value=false;baseName.value='';await load();notify('已创建知识库');}catch(e){notify(e.message);}finally{busy.value=false;}}
  function chooseFile(e){const selectedFile=e.target.files?.[0];file.value=null;if(!selectedFile)return;if(selectedFile.size>2*1024*1024){notify('文件不能超过2MB');e.target.value='';return;}if(!/\.(txt|md|pdf)$/i.test(selectedFile.name)){notify('仅支持 TXT、Markdown、文本 PDF');e.target.value='';return;}file.value=selectedFile;title.value=title.value||selectedFile.name;}
  async function toBase64(f){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(f);});}
  async function upload(){if(preview||busy.value||!canManage.value||!active.value||!file.value)return;busy.value=true;try{await api('/knowledge/bases/'+pathId(active.value)+'/documents',{method:'POST',body:{rootId:versionRoot.value,title:title.value.trim()||file.value.name,filename:file.value.name,contentType:file.value.type||(file.value.name.toLowerCase().endsWith('.pdf')?'application/pdf':'text/plain'),base64:await toBase64(file.value)}});uploading.value=false;file.value=null;title.value='';versionRoot.value=null;await loadDocs();notify('文档已上传');}catch(e){notify(e.message);}finally{busy.value=false;}}
  function newVersion(d){versionRoot.value=d.rootId;title.value=d.title;file.value=null;uploading.value=true;}
  function newDocument(){versionRoot.value=null;file.value=null;title.value='';uploading.value=!uploading.value;}
  async function action(d,operation){if(preview||busy.value||!canManage.value)return;busy.value=true;try{await api('/knowledge/documents/'+pathId(d.id)+'/'+operation,{method:'POST'});await loadDocs();notify('操作成功');}catch(e){notify(e.message);}finally{busy.value=false;}}
  return {role,canRead,canManage,bases,docs,active,selected,text,error,busy,newBase,uploading,baseName,visibility,title,file,current,preview,label,dateTime,read,load,loadDocs,docPage,docInfo,create,chooseFile,upload,action,newVersion,newDocument,versionRoot};
 },
 template:`<BackofficeShell :role="role" title="知识库"><template #actions><div v-if="canManage" class="head-actions"><button class="outline-button small" @click="newBase=!newBase" :disabled="!canManage"><Icon name="plus" :size="16"/>新建知识库</button><button class="teal-button" @click="newDocument" :disabled="!canManage||!active"><Icon name="plus" :size="17"/>上传文档</button></div></template><div v-if="error" class="inline-error">{{error}}</div><div v-if="canManage&&(newBase||uploading)" class="ops-grid kb-forms"><form v-if="newBase" class="ops-card ops-sideform" @submit.prevent="create"><h2>新建知识库</h2><label class="field-label">名称</label><input class="admin-input" v-model="baseName" maxlength="100" required/><label class="field-label">可见范围</label><select class="admin-input" v-model="visibility"><option value="PUBLIC">公开</option><option :value="role==='admin'?'PLATFORM_INTERNAL':'MERCHANT_INTERNAL'">内部</option></select><button class="teal-button" type="submit" :disabled="busy||preview">创建</button></form><form v-if="uploading" class="ops-card ops-sideform" @submit.prevent="upload"><h2>{{versionRoot?'上传新版本':'上传文档'}}</h2><label class="field-label">文档标题</label><input class="admin-input" v-model="title" maxlength="120" required/><label class="field-label">TXT / MD / 文本 PDF · 2MB 内</label><input class="admin-input" type="file" accept=".txt,.md,.pdf" @change="chooseFile" required/><button class="teal-button" type="submit" :disabled="busy||preview||!file">上传并索引</button></form></div>
 <div v-if="!canRead" class="ops-card access-denied">当前账号没有知识库查看权限。</div><div v-else class="knowledge-layout"><section class="ops-card kb-list"><div class="ops-card-header"><h2>知识库</h2><span>{{bases.length}}</span></div><button v-for="b in bases" :key="b.id" class="kb-base" :class="{active:active===b.id}" @click="active=b.id;docPage=1;loadDocs()"><span class="mini-icon"><Icon name="book"/></span><div><strong>{{b.name}}</strong><small>{{label(b.visibility)}}</small></div><Icon name="chevronRight" :size="16"/></button><div v-if="!bases.length" class="admin-empty">暂无知识库</div></section><section class="ops-card kb-docs"><div class="ops-card-header"><h2>{{current?.name||'文档'}}</h2><span>{{docs.length}} 项</span></div><div class="kb-doc" v-for="d in docs" :key="d.id" :class="{active:selected?.id===d.id}"><button @click="read(d)"><span class="mini-icon"><Icon name="clipboard"/></span><span><strong>{{d.title}}</strong><small>v{{d.version}} · {{dateTime(d.createdAt)}}</small></span></button><span class="status-tag" :class="d.status==='PUBLISHED'?'published':'draft'">{{label(d.status)}}</span><span class="kb-doc-actions" v-if="canManage"><button :disabled="busy||preview" @click="newVersion(d)" title="上传新版本" aria-label="上传新版本"><Icon name="plus" :size="15"/></button><button :disabled="busy||preview" @click="action(d,'index')" title="重建索引" aria-label="重建索引"><Icon name="refresh" :size="15"/></button><button :disabled="busy||preview||d.indexStatus!=='READY'||d.status==='PUBLISHED'" @click="action(d,'publish')" title="发布" aria-label="发布文档"><Icon name="check" :size="15"/></button><button :disabled="busy||preview||d.status!=='PUBLISHED'" @click="action(d,'withdraw')" title="撤回" aria-label="撤回文档"><Icon name="x" :size="15"/></button></span></div><div v-if="!docs.length" class="admin-empty">暂无文档</div><div class="sdd-pager" v-if="!preview&&docInfo.total>0"><span>{{docInfo.total}} 项</span><button :disabled="docPage<=1" @click="docPage--">上一页</button><span>{{docPage}}</span><button :disabled="!docInfo.hasNext" @click="docPage++">下一页</button></div></section><section class="ops-card kb-preview"><div class="ops-card-header"><h2>文档预览</h2><button v-if="selected" @click="selected=null;text=''" aria-label="关闭"><Icon name="x" :size="18"/></button></div><template v-if="selected"><div class="kb-title"><Icon name="book" :size="22"/><strong>{{selected.title}}</strong></div><div class="inspector-row"><span>版本</span><strong>v{{selected.version}}</strong></div><div class="inspector-row"><span>索引</span><strong>{{label(selected.indexStatus)}}</strong></div><div class="inspector-row"><span>状态</span><strong>{{label(selected.status)}}</strong></div><p v-if="selected.error" class="inline-error">{{selected.error}}</p><pre class="document-preview">{{text||'该版本暂无可显示的正文'}}</pre></template><div v-else class="admin-empty">选择文档查看</div></section></div></BackofficeShell>`
};

return {default:__default};
})();

const M_pages_Platform_js = (()=>{
const BackofficeShell = M_components_BackofficeShell_js.default;
const ProductImage = M_components_ProductImage_js.default;
const {api,query,idempotency} = M_services_api_js;
const {store,go,preview,notify,money,loadSession} = M_services_store_js;
const {DEMO_STATS,DEMO_APPLICATIONS,DEMO_MERCHANT_ORDERS,DEMO_AFTERSALES} = M_services_pages_demo_js;
const {DEMO_MERCHANTS,DEMO_PRODUCTS,DEMO_CATEGORIES} = M_services_demo_js;
const {label,dateTime,pathId} = M_services_page_utils_js;







const {ref,computed,onMounted,onUnmounted,watch}=Vue;
const titles={'/admin':'平台总览','/admin/applications':'商户审核','/admin/merchants':'商户监管','/admin/products':'商品监管','/admin/orders':'订单监管','/admin/disputes':'争议处理','/admin/categories':'分类管理'};
const __default = {
 name:'Platform',components:{BackofficeShell,ProductImage},setup(){
  const route=computed(()=>store.route),title=computed(()=>titles[route.value]||'平台总览');
  const stats=ref(null),applications=ref([]),merchants=ref([]),products=ref([]),orders=ref([]),aftersales=ref([]),categories=ref([]);
  const selectedId=ref(''),search=ref(''),state=ref(''),page=ref(1),pageInfo=ref({total:0,hasNext:false}),reason=ref(''),category=ref({code:'',name:'',active:true}),busy=ref(false),error=ref(''),allowed=ref(preview);
  const pickedApplication=computed(()=>applications.value.find(a=>a.applicationId===selectedId.value)||applications.value[0]||null);
  const filtered=computed(()=>{const source=route.value==='/admin/applications'?applications.value:route.value==='/admin/merchants'?merchants.value:route.value==='/admin/products'?products.value:route.value==='/admin/orders'?orders.value:route.value==='/admin/disputes'?aftersales.value:categories.value;if(!preview&&['/admin/applications','/admin/merchants','/admin/products','/admin/orders'].includes(route.value))return source;const q=search.value.trim().toLowerCase();return source.filter(row=>(!q||(route.value==='/admin/products'&&!preview)||Object.values(row).some(v=>typeof v==='string'&&v.toLowerCase().includes(q)))&&(!state.value||preview||['/admin/merchants','/admin/products'].includes(route.value)||row.status===state.value));});
  let loadVersion=0;
  function clearPrivateViews(){stats.value=null;applications.value=[];merchants.value=[];products.value=[];orders.value=[];aftersales.value=[];selectedId.value='';pageInfo.value={total:0,hasNext:false};}
  async function load(){const stamp=++loadVersion;const current=route.value;error.value='';if(preview){allowed.value=true;stats.value={...DEMO_STATS};applications.value=DEMO_APPLICATIONS;merchants.value=DEMO_MERCHANTS;products.value=DEMO_PRODUCTS;orders.value=DEMO_MERCHANT_ORDERS;aftersales.value=DEMO_AFTERSALES;categories.value=DEMO_CATEGORIES;return;}
    try{await loadSession();if(stamp!==loadVersion)return;const actor=store.user?.userId;const valid=()=>stamp===loadVersion&&route.value===current&&store.user?.userId===actor;const work=await api('/workspace');if(!valid())return;store.workspace=work;allowed.value=!!work?.platformAdmin;if(!allowed.value)return;
      if(current==='/admin'){const [s,m,o]=await Promise.all([api('/admin/statistics'),api('/admin/merchants/page'+query({page:1,size:6})),api('/admin/orders/page'+query({page:1,size:6}))]);if(!valid())return;stats.value=s;merchants.value=m.items||[];orders.value=o.items||[];}
      if(current==='/admin/applications'){const result=await api('/admin/merchant-applications/page'+query({page:page.value,size:12,state:state.value,q:search.value}));if(!valid())return;applications.value=result.items||[];pageInfo.value=result;}
      if(current==='/admin/merchants'){const result=await api('/admin/merchants/page'+query({page:page.value,size:12,q:search.value}));if(!valid())return;merchants.value=result.items||[];pageInfo.value=result;}
      if(current==='/admin/products'){const result=await api('/admin/products/page'+query({page:page.value,size:12,q:search.value}));if(!valid())return;products.value=result.items||[];pageInfo.value=result;}
      if(current==='/admin/orders'){const result=await api('/admin/orders/page'+query({page:page.value,size:12,state:state.value,q:search.value}));if(!valid())return;orders.value=result.items||[];pageInfo.value=result;}
      if(current==='/admin/disputes'){const result=await api('/admin/aftersales/page'+query({page:page.value,size:12,state:state.value}));if(!valid())return;aftersales.value=result.items||[];pageInfo.value=result;}
      if(current==='/admin/categories'){const result=await api('/categories');if(!valid())return;categories.value=result||[];}
    }catch(e){if(stamp===loadVersion&&route.value===current)error.value=e.message;}
  }
  onMounted(load);onUnmounted(()=>{++loadVersion;clearTimeout(searchDelay);});
  watch(()=>store.user?.userId,()=>{++loadVersion;allowed.value=preview;clearPrivateViews();if(!preview&&route.value.startsWith('/admin'))load();});
  watch(route,()=>{page.value=1;search.value='';state.value='';selectedId.value='';load();});
  watch(page,load);
  watch(state,()=>{page.value=1;if(route.value!=='/admin')load();});
  let searchDelay;watch(search,()=>{page.value=1;if(!preview&&['/admin/products','/admin/merchants','/admin/applications','/admin/orders'].includes(route.value)){clearTimeout(searchDelay);searchDelay=setTimeout(load,280);}});
  async function perform(path,body){if(preview||busy.value||!allowed.value)return;busy.value=true;try{await api(path,{method:'POST',body});notify('操作成功');reason.value='';await load();}catch(e){notify(e.message);}finally{busy.value=false;}}
  function review(approved){const a=pickedApplication.value;if(!a)return;if(!approved&&!reason.value.trim()){notify('请输入拒绝理由');return;}perform('/admin/merchant-applications/'+pathId(a.applicationId)+'/review',{approved,reason:reason.value});}
  function stateMerchant(m){perform('/admin/merchants/'+pathId(m.merchantId)+'/state',{active:m.status!=='ACTIVE',reason:reason.value||'平台管理操作'});}
  function forceProduct(p){perform('/admin/products/'+pathId(p.productId)+'/unpublish');}
  function decideRefund(a,approved){const comment=reason.value.trim();if(!a||!comment){notify('请填写退款审核说明');return;}perform('/admin/orders/'+pathId(a.orderId)+'/refund-decision',{approved,reason:comment});}
  function saveCategory(){if(!category.value.code.trim()||!category.value.name.trim()){notify('请填写分类信息');return;}perform('/admin/categories',{...category.value});}
  function selectApplication(a){selectedId.value=a.applicationId;reason.value='';}
  const merchantName=(id,row)=>row?.merchantName||merchants.value.find(m=>m.merchantId===id)?.name||id||'—';
  return {store,route,title,stats,applications,merchants,products,orders,aftersales,categories,selectedId,search,state,page,pageInfo,reason,category,busy,error,allowed,pickedApplication,filtered,preview,go,money,label,dateTime,merchantName,load,review,stateMerchant,forceProduct,decideRefund,saveCategory,selectApplication};
 },
 template:`<BackofficeShell role="admin" :title="title"><template #actions><button class="outline-button small" @click="load"><Icon name="refresh" :size="16"/>刷新</button></template><div v-if="error" class="inline-error">{{error}}</div><div v-if="!allowed&&!preview" class="ops-card access-denied"><Icon name="shield" :size="38"/><h2>无权限访问</h2></div>
 <template v-else-if="route==='/admin'"><div class="ops-kpis" v-if="stats"><div><span>全部订单</span><strong>{{stats.totalOrders||0}}</strong></div><div><span>待付款</span><strong>{{stats.pendingCount||0}}</strong></div><div><span>已完成</span><strong>{{stats.completedCount||0}}</strong></div><div><span>模拟交易金额</span><strong>{{money(stats.completedAmountCent)}}</strong></div></div><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>近期订单</h2><button @click="go('/admin/orders')">全部 <Icon name="chevronRight" :size="16"/></button></div><div class="ops-list-line" v-for="o in orders.slice(0,6)" :key="o.orderId"><span class="mini-icon"><Icon name="order"/></span><div><strong>{{o.orderId}}</strong><small>{{dateTime(o.createdAt)}}</small></div><b>{{money(o.totalCent)}}</b><span class="status-tag">{{label(o.status)}}</span></div><div v-if="!orders.length" class="admin-empty">暂无订单</div></section><section class="ops-card"><div class="ops-card-header"><h2>运营入口</h2></div><div class="ops-quick"><button @click="go('/admin/applications')"><Icon name="store"/>商户审核</button><button @click="go('/admin/merchants')"><Icon name="users"/>商户监管</button><button @click="go('/admin/disputes')"><Icon name="shield"/>争议处理</button><button @click="go('/admin/knowledge')"><Icon name="book"/>知识库</button></div></section></div></template>
 <template v-else-if="route==='/admin/applications'"><div class="ops-grid admin-review-grid"><section class="ops-card"><div class="ops-card-header"><h2>入驻申请</h2><span>{{preview?applications.length:pageInfo.total}} 条</span></div><div class="ops-toolbar"><label class="ops-search"><Icon name="search" :size="16"/><input v-model="search" placeholder="商户 / 申请人"/></label><select class="admin-input compact-select" v-model="state"><option value="">全部状态</option><option value="SUBMITTED">待审核</option><option value="APPROVED">已通过</option><option value="REJECTED">已拒绝</option></select></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商户</th><th>申请人</th><th>门店</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="a in filtered" :key="a.applicationId" :class="{active:pickedApplication?.applicationId===a.applicationId}" @click="selectApplication(a)"><td><strong>{{a.merchantName}}</strong><small>{{a.category}}</small></td><td>{{a.contactName}}</td><td>{{a.storeName}}</td><td><span class="status-tag" :class="a.status==='APPROVED'?'published':'draft'">{{label(a.status)}}</span></td><td><Icon name="chevronRight" :size="16"/></td></tr></tbody></table></div><div v-if="!filtered.length" class="admin-empty">无符合条件的申请</div></section><aside class="ops-card ops-sideform" v-if="pickedApplication"><h2>{{pickedApplication.merchantName}}</h2><span class="status-tag">{{label(pickedApplication.status)}}</span><div class="inspector-row"><span>申请编号</span><strong>{{pickedApplication.applicationId}}</strong></div><div class="inspector-row"><span>联系人</span><strong>{{pickedApplication.contactName}}</strong></div><div class="inspector-row"><span>联系电话</span><strong>{{pickedApplication.contactPhone}}</strong></div><div class="inspector-row"><span>门店</span><strong>{{pickedApplication.storeName}}</strong></div><div class="inspector-row"><span>位置</span><strong>{{pickedApplication.location}}</strong></div><div v-if="pickedApplication.rejectionReason" class="inline-error">{{pickedApplication.rejectionReason}}</div><template v-if="pickedApplication.status==='SUBMITTED'"><label class="field-label">审核意见</label><textarea class="admin-input" v-model="reason" rows="3" maxlength="500" placeholder="拒绝时必须填写原因"></textarea><div class="form-buttons"><button class="outline-button" :disabled="preview||busy||!reason.trim()" @click="review(false)">驳回</button><button class="teal-button" :disabled="preview||busy" @click="review(true)">通过审核</button></div></template></aside></div></template>
 <template v-else-if="route==='/admin/merchants'"><section class="ops-card"><div class="ops-card-header"><h2>商户列表</h2><span>{{preview?merchants.length:pageInfo.total}} 家</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="搜索经营名称"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商户</th><th>品类</th><th>首个门店</th><th>自提位置</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="m in filtered" :key="m.merchantId"><td><strong>{{m.name}}</strong><small>{{m.merchantId}}</small></td><td>{{m.category}}</td><td>{{m.storeName}}</td><td>{{m.location}}</td><td><span class="status-tag" :class="m.status==='ACTIVE'?'published':'draft'">{{label(m.status)}}</span></td><td><button class="row-link" :disabled="preview||busy" @click="stateMerchant(m)">{{m.status==='ACTIVE'?'停用':'恢复'}}</button></td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/products'"><section class="ops-card"><div class="ops-card-header"><h2>商品监管</h2><span>{{preview?products.length:pageInfo.total}} 件</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="搜索商品 / 商户"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>商品</th><th>商户</th><th>分类</th><th>售价</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="p in filtered" :key="p.productId"><td><div class="table-product-cell"><ProductImage :src="p.imageUrl" :alt="p.title"/><div><strong>{{p.title}}</strong><span>{{p.productId}}</span></div></div></td><td>{{merchantName(p.merchantId,p)}}</td><td>{{p.categoryCode}}</td><td>{{money(p.skus?.[0]?.priceCent)}}</td><td><span class="status-tag">{{label(p.status)}}</span></td><td><button class="row-link" :disabled="preview||busy||p.status!=='PUBLISHED'" @click="forceProduct(p)">强制下架</button></td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/orders'"><section class="ops-card"><div class="ops-card-header"><h2>订单监管</h2><span>{{preview?orders.length:pageInfo.total}} 笔</span></div><label class="ops-search"><Icon name="search" :size="17"/><input v-model="search" placeholder="订单号"/></label><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>订单</th><th>商户</th><th>实付金额</th><th>状态</th><th>创建时间</th></tr></thead><tbody><tr v-for="o in filtered" :key="o.orderId"><td><strong>{{o.orderId}}</strong><small>{{o.items?.[0]?.title||'—'}}</small></td><td>{{merchantName(o.merchantId,o)}}</td><td>{{money(o.totalCent)}}</td><td><span class="status-tag">{{label(o.status)}}</span></td><td>{{dateTime(o.createdAt)}}</td></tr></tbody></table></div></section></template>
 <template v-else-if="route==='/admin/disputes'"><section class="ops-card"><div class="ops-card-header"><h2>售后争议</h2><span>{{aftersales.length}} 条</span></div><div class="ops-list-line dispute-line" v-for="a in aftersales" :key="a.id"><span class="mini-icon"><Icon name="shield"/></span><div><strong>{{a.orderId}}</strong><small>{{a.reason}}</small></div><span class="status-tag">{{label(a.status)}}</span><button class="outline-button small" @click="selectedId=a.id;reason=''">查看处理</button></div><div v-if="!aftersales.length" class="admin-empty">暂无争议</div><div class="review-inline" v-if="selectedId&&aftersales.find(a=>a.id===selectedId)"><h3>裁决 · {{aftersales.find(a=>a.id===selectedId).orderId}}</h3><label class="field-label">裁决说明</label><textarea class="admin-input" v-model="reason" rows="3" maxlength="500" placeholder="审核说明（必填）"></textarea><div class="form-buttons"><button class="outline-button" :disabled="preview||busy||!reason.trim()" @click="decideRefund(aftersales.find(a=>a.id===selectedId),false)">驳回</button><button class="teal-button" :disabled="preview||busy||!reason.trim()" @click="decideRefund(aftersales.find(a=>a.id===selectedId),true)">批准退款</button></div></div></section></template>
 <template v-else-if="route==='/admin/categories'"><div class="ops-grid"><section class="ops-card"><div class="ops-card-header"><h2>类目</h2><span>{{categories.length}} 个</span></div><div class="ops-list-line" v-for="c in categories" :key="c.code"><span class="mini-icon"><Icon name="grid"/></span><div><strong>{{c.name}}</strong><small>{{c.code}}</small></div><span class="status-tag" :class="c.active?'published':'draft'">{{c.active?'启用':'停用'}}</span><button class="row-link" @click="category={code:c.code,name:c.name,active:!c.active}" :disabled="preview">{{c.active?'停用':'恢复'}}</button></div></section><form class="ops-card ops-sideform" @submit.prevent="saveCategory"><h2>编辑分类</h2><label class="field-label">编码</label><input class="admin-input" v-model.trim="category.code" required maxlength="40"/><label class="field-label">名称</label><input class="admin-input" v-model.trim="category.name" required maxlength="60"/><label class="field-label">状态</label><select class="admin-input" v-model="category.active"><option :value="true">启用</option><option :value="false">停用</option></select><button type="submit" class="teal-button" :disabled="preview||busy">{{preview?'设计预览':'保存分类'}}</button></form></div></template>
 </template><div v-if="!preview&&route!=='/admin'&&route!=='/admin/categories'&&pageInfo.total>0" class="sdd-pager"><span>共 {{pageInfo.total}} 条</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}}</span><button :disabled="!pageInfo.hasNext" @click="page++">下一页</button></div></BackofficeShell>`
};

return {default:__default};
})();

const M_pages_RoleManager_js = (()=>{
const BackofficeShell = M_components_BackofficeShell_js.default;
const {api} = M_services_api_js;
const {store,preview,hasPermission,notify,loadMerchant} = M_services_store_js;
const {pathId} = M_services_page_utils_js;
const {DEMO_RBAC_ROLES,DEMO_RBAC_PERMISSIONS,DEMO_MEMBERS} = M_services_pages_demo_js;





const {ref,computed,onMounted,onUnmounted,watch}=Vue;

/** 商户级 RBAC 管理，服务端返回权限白名单。切换商户后不允许旧请求回写。 */
const __default = {
  name:'RoleManager',components:{BackofficeShell},
  setup(){
    const roles=ref([]),permissions=ref([]),selected=ref(''),name=ref(''),grants=ref([]);
    const error=ref(''),busy=ref(false),loading=ref(false),count=ref(0);
    const canManage=computed(()=>hasPermission('role.manage'));
    const current=computed(()=>roles.value.find(r=>r.code===selected.value)||null);
    const assigned=computed(()=>count.value);
    let epoch=0;
    const prefix=()=>'/merchants/'+pathId(store.merchantId)+'/rbac';
    function reset(){selected.value='';name.value='';grants.value=[];roles.value=[];permissions.value=[];count.value=0;}
    function choose(role){selected.value=role.code;name.value=role.name;grants.value=[...(role.permissions||[])];}
    function create(){selected.value='';name.value='';grants.value=['product.read','order.read'];}
    function checked(code){return grants.value.includes(code);}
    function toggle(code,enabled){
      const dependency={'product.write':'product.read','stock.replenish':'stock.read','order.prepare':'order.read',
        'pickup.verify':'order.read','aftersale.review':'aftersale.read','knowledge.manage':'knowledge.read','dashboard.read':'order.read'};
      let values=new Set(grants.value);
      if(enabled){values.add(code);if(dependency[code])values.add(dependency[code]);}
      else {values.delete(code);for(const [action,read] of Object.entries(dependency))if(read===code)values.delete(action);}
      grants.value=[...values];
    }
    async function load(){
      const stamp=++epoch,mid=store.merchantId,actor=store.user?.userId;
      reset();error.value='';
      if(preview){roles.value=DEMO_RBAC_ROLES.map(r=>({...r,permissions:[...r.permissions]}));permissions.value=DEMO_RBAC_PERMISSIONS;count.value=DEMO_MEMBERS.length;choose(roles.value[0]);return;}
      loading.value=true;
      try{
        if(!mid)await loadMerchant();
        const id=store.merchantId,uid=store.user?.userId;
        if(stamp!==epoch||(!mid?false:mid!==id)||!hasPermission('role.manage'))return;
        const [rs,ps,ms]=await Promise.all([api(prefix()+'/roles'),api(prefix()+'/permissions'),api('/merchants/'+pathId(id)+'/members')]);
        if(stamp!==epoch||store.merchantId!==id||store.user?.userId!==uid||(!mid?false:actor!==uid))return;
        roles.value=rs||[];permissions.value=ps||[];count.value=(ms||[]).filter(m=>m.status==='ACTIVE').length;
        if(roles.value.length)choose(roles.value[0]);
      }catch(e){if(stamp===epoch)error.value=e.message;}
      finally{if(stamp===epoch)loading.value=false;}
    }
    async function save(){
      if(preview||busy.value||!canManage.value||current.value?.builtin)return;
      if(!name.value.trim()||grants.value.length===0){notify('请输入角色名称并选择至少一项权限');return;}
      const id=store.merchantId,uid=store.user?.userId,stamp=epoch;
      busy.value=true;
      try{
        const code=selected.value;
        const result=await api(prefix()+'/roles'+(code?'/'+pathId(code):''),{
          method:code?'PUT':'POST',body:{name:name.value.trim(),permissions:grants.value}
        });
        if(stamp!==epoch||id!==store.merchantId||uid!==store.user?.userId)return;
        notify(code?'角色已更新':'角色已创建');await load();
        if(id===store.merchantId){const found=roles.value.find(r=>r.code===result.code);if(found)choose(found);}
      }catch(e){if(stamp===epoch)notify(e.message);}finally{busy.value=false;}
    }
    async function remove(){
      if(preview||busy.value||!canManage.value||!selected.value||current.value?.builtin)return;
      if(!window.confirm('确定删除角色「'+current.value?.name+'」？'))return;
      const id=store.merchantId,uid=store.user?.userId,stamp=epoch;
      busy.value=true;
      try{await api(prefix()+'/roles/'+pathId(selected.value),{method:'DELETE'});
        if(stamp!==epoch||id!==store.merchantId||uid!==store.user?.userId)return;
        notify('角色已删除');await load();
      }catch(e){if(stamp===epoch)notify(e.message);}finally{busy.value=false;}
    }
    onMounted(load);onUnmounted(()=>++epoch);
    watch([()=>store.merchantId,()=>store.user?.userId,canManage],load);
    return {store,roles,permissions,selected,name,grants,error,busy,loading,canManage,current,assigned,choose,create,checked,toggle,save,remove,preview};
  },
  template:`<BackofficeShell role="merchant" title="角色权限">
    <template #actions><button v-if="canManage" class="teal-button" @click="create" :disabled="preview||busy"><Icon name="plus" :size="16"/>新增自定义角色</button></template>
    <div v-if="error" class="inline-error">{{error}}</div>
    <div v-if="!canManage" class="ops-card access-denied"><Icon name="shield" :size="32"/><h2>无权管理角色</h2></div>
    <div v-else class="ops-grid rbac-layout">
      <section class="ops-card rbac-roles"><div class="ops-card-header"><h2>商户角色</h2><span>{{roles.length}} 个 · {{assigned}} 名成员</span></div>
        <button v-for="r in roles" :key="r.code" class="rbac-role" :class="{active:selected===r.code}" @click="choose(r)">
          <span class="mini-icon"><Icon :name="r.builtin?'shield':'users'" :size="18"/></span>
          <span><strong>{{r.name}}</strong><small>{{r.builtin?'内置角色':r.permissions.length+' 项权限'}}</small></span>
          <Icon name="chevronRight" :size="16"/>
        </button>
        <div v-if="!roles.length&&!loading" class="admin-empty">暂无角色</div>
      </section>
      <form class="ops-card rbac-editor" @submit.prevent="save"><div class="ops-card-header"><h2>{{selected?'角色权限':'创建新角色'}}</h2><span v-if="current?.builtin" class="status-tag">系统内置</span></div>
        <label class="field-label">角色名称</label><input class="admin-input" v-model.trim="name" maxlength="40" required :disabled="preview||!!current?.builtin||busy" placeholder="例如：商品管理员"/>
        <h3 class="field-heading">权限配置 <span class="rbac-grant-count">已选 {{grants.length}} 项</span></h3>
        <div class="rbac-permissions"><label v-for="p in permissions" :key="p.code" :data-permission="p.code" class="rbac-permission" :class="{protected:!p.grantable}">
            <input type="checkbox" :checked="checked(p.code)" :disabled="preview||!!current?.builtin||!p.grantable||busy" @change="toggle(p.code,$event.target.checked)"/>
            <span><strong>{{p.label}}</strong></span><Icon v-if="!p.grantable" name="lock" :size="15" title="仅经营者"/>
          </label></div>
        <div class="form-buttons" v-if="!current?.builtin"><button type="button" v-if="selected" class="outline-button" :disabled="preview||busy" @click="remove">删除角色</button><button type="submit" class="teal-button" :disabled="preview||busy||!grants.length||!name.trim()">{{busy?'保存中':'保存角色'}}</button></div>
        
      </form>
    </div>
  </BackofficeShell>`
};

return {default:__default};
})();

M_components_ProductImage_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { openBlock: _openBlock, createElementBlock: _createElementBlock } = _Vue

    return (_openBlock(), _createElementBlock("img", {
      src: url,
      alt: alt,
      loading: loading,
      onError: handleError
    }, null, 40, ["src", "alt", "loading", "onError"]))
  }
};
M_components_ProductImageField_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, normalizeClass: _normalizeClass } = _Vue

    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_Icon = _resolveComponent("Icon")

    return (_openBlock(), _createElementBlock("div", { class: "product-image-field" }, [_createElementVNode("div", { class: "product-image-preview" }, [_createVNode(_component_ProductImage, {
      src: displayed,
      alt: "商品主图预览",
      loading: "eager"
    }, null, 8, ["src"]), busy
      ? (_openBlock(), _createElementBlock("span", {
          key: 0,
          class: "product-image-busy"
        }, "上传中…"))
      : _createCommentVNode("", true)]), _createElementVNode("div", { class: "product-image-controls" }, [
      _createElementVNode("label", { class: _normalizeClass(["image-upload-button", {disabled:disabled||busy}]) }, [_createVNode(_component_Icon, {
        name: "upload",
        size: 15
      }, null, 8, ["size"]), _createTextVNode(_toDisplayString(modelValue||displayed?'更换主图':'上传主图') + " ", 1), _createElementVNode("input", {
        type: "file",
        accept: "image/png,image/jpeg,image/gif",
        "aria-label": "选择商品主图",
        disabled: disabled||busy,
        onChange: choose
      }, null, 40, ["disabled", "onChange"])], 2),
      (modelValue||displayed||error)
        ? (_openBlock(), _createElementBlock("button", {
            key: 0,
            class: "image-remove-button",
            type: "button",
            disabled: disabled||busy,
            onClick: clear
          }, "移除", 8, ["disabled", "onClick"]))
        : _createCommentVNode("", true),
      _createElementVNode("small", null, "JPG / PNG / GIF · ≤ 2MB"),
      error
        ? (_openBlock(), _createElementBlock("span", {
            key: 1,
            class: "image-field-error",
            role: "alert"
          }, _toDisplayString(error), 1))
        : notice
          ? (_openBlock(), _createElementBlock("span", {
              key: 2,
              class: "image-field-notice",
              role: "status"
            }, _toDisplayString(notice), 1))
          : _createCommentVNode("", true)
    ])]))
  }
};
M_components_AuthDialog_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, vModelText: _vModelText, withDirectives: _withDirectives, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, withModifiers: _withModifiers } = _Vue

    const _component_Icon = _resolveComponent("Icon")

    return (_openBlock(), _createElementBlock("div", {
      class: "ui-overlay",
      onClick: _withModifiers($event => ($emit('close')), ["self"])
    }, [_createElementVNode("form", {
      class: "login-dialog",
      onSubmit: _withModifiers(submit, ["prevent"]),
      "aria-label": "账号登录"
    }, [
      _createElementVNode("div", { class: "login-dialog-heading" }, [_createElementVNode("span", { class: "auth-logo" }, [_createVNode(_component_Icon, {
        name: "sparkles",
        size: 22
      }, null, 8, ["size"])]), _createElementVNode("button", {
        type: "button",
        onClick: $event => ($emit('close')),
        "aria-label": "关闭登录窗"
      }, [_createVNode(_component_Icon, {
        name: "x",
        size: 20
      }, null, 8, ["size"])], 8, ["onClick"])]),
      _createElementVNode("h2", null, _toDisplayString(mode==='login'?'欢迎回来':'创建账号'), 1),
      _createElementVNode("label", { for: "login-name" }, "账号"),
      _withDirectives(_createElementVNode("input", {
        id: "login-name",
        "onUpdate:modelValue": $event => ((username) = $event),
        autocomplete: "username",
        required: "",
        maxlength: "40",
        placeholder: "用户名"
      }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, username]]),
      _createElementVNode("label", { for: "login-password" }, "密码"),
      _withDirectives(_createElementVNode("input", {
        id: "login-password",
        "onUpdate:modelValue": $event => ((password) = $event),
        type: "password",
        autocomplete: mode==='login'?'current-password':'new-password',
        required: "",
        placeholder: "输入密码"
      }, null, 8, ["onUpdate:modelValue", "autocomplete"]), [[_vModelText, password]]),
      (mode==='register')
        ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [_createElementVNode("label", { for: "login-display" }, "昵称"), _withDirectives(_createElementVNode("input", {
            id: "login-display",
            "onUpdate:modelValue": $event => ((displayName) = $event),
            maxlength: "40",
            placeholder: "昵称（选填）"
          }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, displayName]])], 64))
        : _createCommentVNode("", true),
      error
        ? (_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "login-error"
          }, _toDisplayString(error), 1))
        : _createCommentVNode("", true),
      _createElementVNode("button", {
        type: "submit",
        class: "primary-wide login-submit",
        disabled: busy
      }, _toDisplayString(busy?'请稍候…':mode==='login'?'登录':'注册'), 9, ["disabled"]),
      _createElementVNode("button", {
        type: "button",
        class: "login-switch",
        onClick: $event => {mode=mode==='login'?'register':'login';error=''}
      }, _toDisplayString(mode==='login'?'没有账号？注册':'已有账号？登录'), 9, ["onClick"])
    ], 40, ["onSubmit"])], 8, ["onClick"]))
  }
};
M_components_ConsumerShell_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, renderSlot: _renderSlot, normalizeClass: _normalizeClass, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_AuthDialog = _resolveComponent("AuthDialog")

    return (_openBlock(), _createElementBlock("div", { class: "consumer-shell" }, [_createElementVNode("div", { class: "consumer-width" }, [_createElementVNode("header", { class: "consumer-header" }, [_createElementVNode("div", { class: "campus-location" }, [_createElementVNode("div", { class: "brand-pin" }, [_createElementVNode("span")]), _createElementVNode("div", null, [_createElementVNode("div", { class: "location-name" }, "青柠校园"), _createElementVNode("div", { class: "location-sub" }, "校园好物 · 到店自提")])]), _createElementVNode("div", { class: "header-trailing" }, [(store.preview)
      ? (_openBlock(), _createElementBlock("span", {
          key: 0,
          class: "demo-pill",
          title: "仅用于视觉预览"
        }, "设计预览"))
      : (!store.user)
        ? (_openBlock(), _createElementBlock("button", {
            key: 1,
            class: "header-login",
            onClick: $event => (loginOpen=true)
          }, "登录", 8, ["onClick"]))
        : (_openBlock(), _createElementBlock("button", {
            key: 2,
            class: "account-pill",
            onClick: logout,
            title: "退出登录"
          }, [_createTextVNode(_toDisplayString(store.user.displayName?.slice(0,2)||'我') + " ", 1), _createVNode(_component_Icon, {
            name: "logout",
            size: 12
          }, null, 8, ["size"])], 8, ["onClick"]))])]), _createElementVNode("main", { class: "consumer-main" }, [_renderSlot($slots, "default")])]), _createElementVNode("nav", {
      class: "mobile-tabbar",
      "aria-label": "消费者导航"
    }, [_createElementVNode("div", { class: "mobile-tabbar-inner" }, [
      _createElementVNode("button", {
        class: _normalizeClass({selected:active==='home'}),
        onClick: $event => (go('/')),
        "aria-label": "首页"
      }, [_createVNode(_component_Icon, {
        name: "home",
        size: 23
      }, null, 8, ["size"]), _createElementVNode("span", null, "首页")], 10, ["onClick"]),
      _createElementVNode("button", {
        class: _normalizeClass({selected:active==='ai'}),
        onClick: $event => (go('/ai')),
        "aria-label": "AI导购"
      }, [_createElementVNode("span", { class: "tiny-orb" }, [_createVNode(_component_Icon, {
        name: "sparkles",
        size: 20
      }, null, 8, ["size"])]), _createElementVNode("span", null, "导购")], 10, ["onClick"]),
      _createElementVNode("button", {
        class: _normalizeClass({selected:active==='cart'}),
        onClick: $event => (go('/cart'))
      }, [_createVNode(_component_Icon, {
        name: "cart",
        size: 23
      }, null, 8, ["size"]), _createElementVNode("span", null, "购物车")], 10, ["onClick"]),
      _createElementVNode("button", {
        class: _normalizeClass({selected:active==='orders'}),
        onClick: $event => (go('/orders'))
      }, [_createVNode(_component_Icon, {
        name: "order",
        size: 23
      }, null, 8, ["size"]), _createElementVNode("span", null, "订单")], 10, ["onClick"]),
      _createElementVNode("button", {
        class: _normalizeClass({selected:active==='account'}),
        onClick: $event => (go('/account'))
      }, [_createVNode(_component_Icon, {
        name: "user",
        size: 23
      }, null, 8, ["size"]), _createElementVNode("span", null, "我的")], 10, ["onClick"])
    ])]), loginOpen
      ? (_openBlock(), _createBlock(_component_AuthDialog, {
          key: 0,
          onClose: $event => (loginOpen=false),
          onSuccess: loadPublic
        }, null, 8, ["onClose", "onSuccess"]))
      : _createCommentVNode("", true)]))
  }
};
M_components_BackofficeShell_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, resolveComponent: _resolveComponent, createVNode: _createVNode, createCommentVNode: _createCommentVNode, normalizeClass: _normalizeClass, renderSlot: _renderSlot, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_AuthDialog = _resolveComponent("AuthDialog")

    return (_openBlock(), _createElementBlock("div", { class: "merchant-shell" }, [_createElementVNode("aside", { class: "merchant-sidebar" }, [_createElementVNode("button", {
      class: "merchant-brand",
      onClick: $event => (go('/'))
    }, [_createElementVNode("span", { class: "brand-pin" }, [_createElementVNode("span")]), _createElementVNode("span", { class: "brand-word" }, [_createTextVNode("青柠校园 "), _createElementVNode("span", { class: "brand-suffix" }, "/ " + _toDisplayString(role==='admin'?'平台端':'商户端'), 1)])], 8, ["onClick"]), _createElementVNode("nav", { class: "merchant-nav" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList((role==='admin'?adminNav:visibleMerchantNav), ([ico,label,path]) => {
      return (_openBlock(), _createElementBlock("button", {
        key: path,
        class: _normalizeClass({active:store.route===path}),
        onClick: $event => (go(path))
      }, [_createVNode(_component_Icon, {
        name: ico,
        size: 19
      }, null, 8, ["name", "size"]), _createElementVNode("span", null, _toDisplayString(label), 1), (store.route===path)
        ? (_openBlock(), _createElementBlock("span", {
            key: 0,
            class: "nav-left-bar"
          }))
        : _createCommentVNode("", true)], 10, ["onClick"]))
    }), 128))]), _createElementVNode("div", { class: "merchant-sidebar-bottom" }, [_createElementVNode("button", {
      class: "sidebar-back",
      onClick: $event => (go('/'))
    }, [_createVNode(_component_Icon, {
      name: "arrowLeft",
      size: 16
    }, null, 8, ["size"]), _createTextVNode(" 返回购物端")], 8, ["onClick"])])]), _createElementVNode("div", { class: "merchant-content-shell" }, [_createElementVNode("header", { class: "merchant-topbar" }, [_createElementVNode("div", { class: "topbar-crumb" }, [_createTextVNode(_toDisplayString(role==='admin'?'平台运营':'店铺运营') + " ", 1), _createVNode(_component_Icon, {
      name: "chevronRight",
      size: 14
    }, null, 8, ["size"]), _createElementVNode("strong", null, _toDisplayString(title), 1)]), _createElementVNode("div", { class: "merchant-topbar-tools" }, [preview
      ? (_openBlock(), _createElementBlock("span", {
          key: 0,
          class: "admin-preview-tag"
        }, "设计预览"))
      : _createCommentVNode("", true), (role==='merchant')
      ? (_openBlock(), _createElementBlock("label", {
          key: 1,
          class: "topbar-merchant-select"
        }, [_createVNode(_component_Icon, {
          name: "store",
          size: 16
        }, null, 8, ["size"]), _createElementVNode("select", {
          value: store.merchantId,
          onChange: switchShop,
          disabled: preview||store.loading
        }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(store.merchants, (m) => {
          return (_openBlock(), _createElementBlock("option", {
            key: m.merchantId,
            value: m.merchantId
          }, _toDisplayString(m.name), 9, ["value"]))
        }), 128))], 40, ["value", "onChange", "disabled"])]))
      : _createCommentVNode("", true), _createElementVNode("button", {
      class: "topbar-avatar",
      onClick: $event => (loginOpen=true)
    }, [_createVNode(_component_Icon, {
      name: "user",
      size: 18
    }, null, 8, ["size"])], 8, ["onClick"])])]), _createElementVNode("nav", {
      ref: "mobileNav",
      class: "merchant-mobile-nav",
      "aria-label": "工作台导航"
    }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList((role==='admin'?adminNav:visibleMerchantNav), ([ico,label,path]) => {
      return (_openBlock(), _createElementBlock("button", {
        key: path,
        class: _normalizeClass({active:store.route===path}),
        onClick: $event => (go(path))
      }, [_createVNode(_component_Icon, {
        name: ico,
        size: 16
      }, null, 8, ["name", "size"]), _createTextVNode(_toDisplayString(label), 1)], 10, ["onClick"]))
    }), 128))], 512), _createElementVNode("main", { class: "merchant-main" }, [_createElementVNode("div", { class: "merchant-page-heading" }, [_createElementVNode("div", null, [_createElementVNode("h1", null, _toDisplayString(title), 1)]), _renderSlot($slots, "actions")]), (store.error)
      ? (_openBlock(), _createElementBlock("div", {
          key: 0,
          class: "inline-error merchant-error"
        }, _toDisplayString(store.error), 1))
      : _createCommentVNode("", true), _renderSlot($slots, "default")])]), loginOpen
      ? (_openBlock(), _createBlock(_component_AuthDialog, {
          key: 0,
          onClose: $event => (loginOpen=false),
          onSuccess: $event => (role==='merchant'?loadMerchant():null)
        }, null, 8, ["onClose", "onSuccess"]))
      : _createCommentVNode("", true)]))
  }
};
M_pages_Home_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, vModelText: _vModelText, withKeys: _withKeys, createElementVNode: _createElementVNode, withDirectives: _withDirectives, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, toDisplayString: _toDisplayString, normalizeClass: _normalizeClass, createTextVNode: _createTextVNode, createCommentVNode: _createCommentVNode, createBlock: _createBlock, withModifiers: _withModifiers, withCtx: _withCtx } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_ConsumerShell = _resolveComponent("ConsumerShell")

    return (_openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
      default: _withCtx(() => [
        _createElementVNode("section", { class: "search-section" }, [_createElementVNode("div", { class: "big-search" }, [_createVNode(_component_Icon, {
          name: "search",
          size: 22
        }, null, 8, ["size"]), _withDirectives(_createElementVNode("input", {
          "onUpdate:modelValue": $event => ((search) = $event),
          placeholder: "搜索商品、商户名称、规格",
          "aria-label": "搜索校园商品",
          onKeydown: _withKeys($event => {page=1;loadSearch()}, ["enter"])
        }, null, 40, ["onUpdate:modelValue", "onKeydown"]), [[_vModelText, search]]), _createElementVNode("button", { onClick: $event => {page=1;loadSearch()} }, "搜索", 8, ["onClick"])]), _createElementVNode("div", { class: "popular-tags" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(keywords, (k) => {
          return (_openBlock(), _createElementBlock("button", {
            key: k,
            onClick: $event => (applyKeyword(k)),
            class: _normalizeClass({active:search===k})
          }, _toDisplayString(k), 11, ["onClick"]))
        }), 128))])]),
        _createElementVNode("button", {
          class: "hero-shopping",
          onClick: $event => (go('/ai')),
          "aria-label": "进入 AI 导购"
        }, [
          _createElementVNode("div", { class: "hero-lines" }, [_createElementVNode("div", { class: "hero-title" }, [_createElementVNode("span", null, "AI"), _createTextVNode(" 导购")]), _createElementVNode("h1", null, "你的校园购物小助手"), _createElementVNode("span", { class: "hero-cta" }, [_createTextVNode("开始探索 "), _createVNode(_component_Icon, {
            name: "arrowUpRight",
            size: 17
          }, null, 8, ["size"])])]),
          _createElementVNode("div", { class: "hero-robot-wrap" }, [_createElementVNode("img", {
            src: "./images/robot.webp",
            alt: "AI 导购机器人"
          })]),
          _createElementVNode("span", { class: "hero-star hstar-one" }, "✦"),
          _createElementVNode("span", { class: "hero-star hstar-two" }, "✧")
        ], 8, ["onClick"]),
        _createElementVNode("section", {
          class: "category-section",
          "aria-label": "商品分类"
        }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(categories, (c) => {
          return (_openBlock(), _createElementBlock("button", {
            key: c.code,
            class: _normalizeClass(["category-item", {categoryActive:category===c.code}]),
            onClick: $event => (setCategory(c.code))
          }, [_createElementVNode("span", { class: "category-picture" }, [_createElementVNode("img", {
            src: staticCategoryArt[c.code]||'./images/category-snacks.webp',
            alt: c.name
          }, null, 8, ["src", "alt"])]), _createElementVNode("strong", null, _toDisplayString(c.name), 1)], 10, ["onClick"]))
        }), 128))]),
        _createElementVNode("section", { class: "merchant-section" }, [_createElementVNode("div", { class: "section-head" }, [_createElementVNode("div", { class: "section-title" }, [_createElementVNode("span", { class: "head-accent mint" }, [_createVNode(_component_Icon, {
          name: "store",
          size: 21
        }, null, 8, ["size"])]), _createElementVNode("h2", null, "附近商家")]), _createElementVNode("span", { class: "tiny-note" }, "校内自提")]), _createElementVNode("div", { class: "merchant-cards" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(shops, (m, idx) => {
          return (_openBlock(), _createElementBlock("button", {
            class: _normalizeClass(["merchant-card", {active:merchant===m.merchantId}]),
            key: m.merchantId,
            onClick: $event => {merchant=m.merchantId;page=1;loadSearch()}
          }, [
            _createElementVNode("span", { class: _normalizeClass(["merchant-logo", 'store-'+idx]) }, [(m.image)
              ? (_openBlock(), _createElementBlock("img", {
                  key: 0,
                  src: m.image,
                  alt: m.name
                }, null, 8, ["src", "alt"]))
              : (_openBlock(), _createBlock(_component_Icon, {
                  key: 1,
                  name: "store",
                  size: 21
                }, null, 8, ["size"]))], 2),
            _createElementVNode("strong", null, _toDisplayString(m.name), 1),
            _createElementVNode("small", null, _toDisplayString(m.storeName||m.location||'校内门店'), 1),
            _createElementVNode("span", { class: "merchant-chip" }, [_createElementVNode("span", { class: "merchant-chip-dot" }), _createTextVNode(" 可自提")])
          ], 10, ["onClick"]))
        }), 128))]), merchant
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "merchant-filter-bar"
            }, [_createTextVNode("当前：" + _toDisplayString(shopName(merchant)), 1), _createElementVNode("button", { onClick: $event => {merchant='';page=1;loadSearch()} }, [_createTextVNode("清除筛选 "), _createVNode(_component_Icon, {
              name: "x",
              size: 13
            }, null, 8, ["size"])], 8, ["onClick"])]))
          : _createCommentVNode("", true)]),
        _createElementVNode("section", { class: "reco-section" }, [
          _createElementVNode("div", { class: "section-head reco-heading" }, [_createElementVNode("div", { class: "section-title" }, [_createElementVNode("span", { class: "flame-icon" }, "✦"), _createElementVNode("h2", null, "为你推荐")]), _createElementVNode("div", { class: "sort-tabs" }, [_createElementVNode("button", {
            class: _normalizeClass({active:sort==='popular'}),
            onClick: $event => {sort='popular';page=1;loadSearch()}
          }, "最新", 10, ["onClick"]), _createElementVNode("button", {
            class: _normalizeClass({active:sort==='stock'}),
            onClick: $event => {sort='stock';page=1;loadSearch()}
          }, "全局库存", 10, ["onClick"]), _createElementVNode("button", {
            class: _normalizeClass({active:sort==='price'}),
            onClick: $event => {sort='price';page=1;loadSearch()}
          }, "全局价格", 10, ["onClick"])])]),
          (store.loading)
            ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "inline-loading"
              }, [_createElementVNode("div", { class: "mini-spinner" }), _createTextVNode("正在加载")]))
            : _createCommentVNode("", true),
          (store.error)
            ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "inline-error"
              }, [_createVNode(_component_Icon, {
                name: "alert",
                size: 18
              }, null, 8, ["size"]), _createTextVNode(_toDisplayString(store.error) + " ", 1), (!preview)
                ? (_openBlock(), _createElementBlock("a", {
                    key: 0,
                    href: "/?demo=1#/"
                  }, "查看设计预览"))
                : _createCommentVNode("", true)]))
            : _createCommentVNode("", true),
          (!store.loading&&!shown.length&&!store.error)
            ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "no-results"
              }, [_createVNode(_component_Icon, {
                name: "search",
                size: 22
              }, null, 8, ["size"]), _createTextVNode("暂无相关商品"), _createElementVNode("button", { onClick: $event => {search='';category='';merchant='';page=1;loadSearch()} }, "查看全部", 8, ["onClick"])]))
            : _createCommentVNode("", true),
          _createElementVNode("div", { class: "home-product-grid" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(shown, (p) => {
            return (_openBlock(), _createElementBlock("article", {
              class: "home-product",
              key: p.productId,
              onClick: $event => (showDetail(p))
            }, [_createElementVNode("div", { class: "home-product-photo" }, [_createVNode(_component_ProductImage, {
              src: p.imageUrl,
              alt: p.title
            }, null, 8, ["src", "alt"]), (p.tag)
              ? (_openBlock(), _createElementBlock("span", {
                  key: 0,
                  class: "corner-tag"
                }, _toDisplayString(p.tag), 1))
              : _createCommentVNode("", true), _createElementVNode("span", { class: "floating-pickup" }, "可自提")]), _createElementVNode("div", { class: "home-product-info" }, [_createElementVNode("strong", null, _toDisplayString(p.title), 1), _createElementVNode("div", { class: "product-minor" }, [_createElementVNode("span", null, _toDisplayString(skuOf(p).specKey), 1), _createElementVNode("span", null, "库存 " + _toDisplayString(available(p)>0?'充足':'售罄'), 1)]), _createElementVNode("div", { class: "product-price-row" }, [_createElementVNode("span", { class: "price-main" }, _toDisplayString(money(priceSku(p).priceCent)), 1), _createElementVNode("button", {
              onClick: _withModifiers($event => (showDetail(p)), ["stop"]),
              "aria-label": '查看'+p.title
            }, [_createVNode(_component_Icon, {
              name: "plus",
              size: 20
            }, null, 8, ["size"])], 8, ["onClick", "aria-label"])])])], 8, ["onClick"]))
          }), 128))]),
          (!preview && pageInfo.total>0)
            ? (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "sdd-pager"
              }, [
                _createElementVNode("span", null, "共 " + _toDisplayString(pageInfo.total) + " 件", 1),
                _createElementVNode("button", {
                  disabled: page<=1||store.loading,
                  onClick: $event => {page--;loadSearch()}
                }, "上一页", 8, ["disabled", "onClick"]),
                _createElementVNode("span", null, _toDisplayString(page), 1),
                _createElementVNode("button", {
                  disabled: !pageInfo.hasNext||store.loading,
                  onClick: $event => {page++;loadSearch()}
                }, "下一页", 8, ["disabled", "onClick"])
              ]))
            : _createCommentVNode("", true)
        ]),
        selected
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "ui-overlay",
              onClick: _withModifiers($event => (selected=null), ["self"])
            }, [_createElementVNode("div", {
              class: "product-sheet",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": selected.title
            }, [
              _createElementVNode("button", {
                class: "sheet-close",
                onClick: $event => (selected=null),
                "aria-label": "关闭"
              }, [_createVNode(_component_Icon, {
                name: "x",
                size: 19
              }, null, 8, ["size"])], 8, ["onClick"]),
              _createElementVNode("div", { class: "sheet-product-line" }, [_createVNode(_component_ProductImage, {
                src: selected.imageUrl,
                alt: selected.title
              }, null, 8, ["src", "alt"]), _createElementVNode("div", null, [
                _createElementVNode("span", { class: "mini-category" }, _toDisplayString(productCategory(selected)), 1),
                _createElementVNode("h3", null, _toDisplayString(selected.title), 1),
                _createElementVNode("div", { class: "sheet-price" }, _toDisplayString(money(chosen.priceCent)), 1),
                _createElementVNode("span", { class: "sheet-muted" }, _toDisplayString(currentShop(selected).name||'校内商户'), 1)
              ])]),
              _createElementVNode("button", {
                class: "more-product-detail",
                onClick: $event => {go('/product/'+selected.productId);selected=null}
              }, [_createTextVNode("查看商品详情 "), _createVNode(_component_Icon, {
                name: "chevronRight",
                size: 15
              }, null, 8, ["size"])], 8, ["onClick"]),
              _createElementVNode("label", { class: "sheet-field-label" }, "选择规格"),
              _createElementVNode("div", { class: "sku-picker" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(selected.skus, (sku) => {
                return (_openBlock(), _createElementBlock("button", {
                  key: sku.skuId,
                  class: _normalizeClass({active:chosenSku===sku.skuId}),
                  disabled: sku.status!=='ACTIVE'||sku.available===0,
                  onClick: $event => (chosenSku=sku.skuId)
                }, _toDisplayString(sku.specKey), 11, ["disabled", "onClick"]))
              }), 128))]),
              _createElementVNode("div", { class: "quantity-picker" }, [_createElementVNode("span", null, "购买数量"), _createElementVNode("div", null, [_createElementVNode("button", {
                onClick: $event => (count=Math.max(1,count-1)),
                "aria-label": "减少数量"
              }, [_createVNode(_component_Icon, {
                name: "minus",
                size: 17
              }, null, 8, ["size"])], 8, ["onClick"]), _createElementVNode("b", null, _toDisplayString(count), 1), _createElementVNode("button", {
                onClick: $event => (count=Math.min(99,Number(chosen.available||0),count+1)),
                "aria-label": "增加数量",
                disabled: count>=Number(chosen.available||0)
              }, [_createVNode(_component_Icon, {
                name: "plus",
                size: 17
              }, null, 8, ["size"])], 8, ["onClick", "disabled"])])]),
              _createElementVNode("button", {
                class: "primary-wide",
                disabled: !chosen.skuId || !chosen.available || saving || preview,
                onClick: addCart
              }, _toDisplayString(saving?'加入中…':'加入购物车'), 9, ["disabled", "onClick"])
            ], 8, ["aria-label"])], 8, ["onClick"]))
          : _createCommentVNode("", true)
      ]),
      _: 1
    }))
  }
};
M_pages_Guide_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { createElementVNode: _createElementVNode, createTextVNode: _createTextVNode, resolveComponent: _resolveComponent, createVNode: _createVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, toDisplayString: _toDisplayString, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_ConsumerShell = _resolveComponent("ConsumerShell")

    return (_openBlock(), _createBlock(_component_ConsumerShell, { active: "ai" }, {
      default: _withCtx(() => [
        _createElementVNode("section", { class: "ai-hero" }, [
          _createElementVNode("div", { class: "ai-hero-text" }, [_createElementVNode("h1", null, [_createElementVNode("span", null, "AI"), _createTextVNode(" 导购助手")]), _createElementVNode("p", null, "想买什么？问我就好。")]),
          _createElementVNode("img", {
            src: "./images/robot.webp",
            alt: "AI 导购机器人",
            class: "ai-hero-robot"
          }),
          _createElementVNode("span", { class: "orb-decoration orb-one" }, "✦"),
          _createElementVNode("span", { class: "orb-decoration orb-two" }, "✧")
        ]),
        (!preview)
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "ai-history-head"
            }, [_createElementVNode("button", { onClick: $event => {historyOpen=!historyOpen;historyOpen&&loadHistory()} }, [_createVNode(_component_Icon, {
              name: "clock",
              size: 15
            }, null, 8, ["size"]), _createTextVNode(" 历史会话 "), _createVNode(_component_Icon, {
              name: "chevronDown",
              size: 14
            }, null, 8, ["size"])], 8, ["onClick"])]))
          : _createCommentVNode("", true),
        historyOpen
          ? (_openBlock(), _createElementBlock("div", {
              key: 1,
              class: "ai-history-list"
            }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(conversations, (c) => {
              return (_openBlock(), _createElementBlock("button", {
                key: c.id,
                onClick: $event => (openConversation(c)),
                disabled: thinking||openingConversation
              }, [_createVNode(_component_Icon, {
                name: "order",
                size: 16
              }, null, 8, ["size"]), _createTextVNode(" " + _toDisplayString(c.title||'对话') + " ", 1), _createVNode(_component_Icon, {
                name: "chevronRight",
                size: 14
              }, null, 8, ["size"])], 8, ["onClick", "disabled"]))
            }), 128)), (!conversations.length)
              ? (_openBlock(), _createElementBlock("span", { key: 0 }, "暂无历史记录"))
              : _createCommentVNode("", true)]))
          : _createCommentVNode("", true),
        _createElementVNode("div", {
          class: "quick-prompts",
          "aria-label": "快捷提问"
        }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(prompts, (p) => {
          return (_openBlock(), _createElementBlock("button", {
            key: p.label,
            onClick: $event => (ask(p.query)),
            disabled: thinking||openingConversation
          }, [_createVNode(_component_Icon, {
            name: p.icon,
            size: 15
          }, null, 8, ["name", "size"]), _createTextVNode(_toDisplayString(p.label), 1)], 8, ["onClick", "disabled"]))
        }), 128))]),
        _createElementVNode("section", {
          class: "chat-thread",
          "aria-label": "AI对话"
        }, [
          (!messages.length)
            ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "chat-welcome"
              }, [_createElementVNode("span", { class: "chat-welcome-icon" }, [_createVNode(_component_Icon, {
                name: "sparkles",
                size: 22
              }, null, 8, ["size"])]), _createElementVNode("h2", null, "你好，同学。"), _createElementVNode("p", null, "告诉我预算或想买的东西。")]))
            : _createCommentVNode("", true),
          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(messages, (message, index) => {
            return (_openBlock(), _createElementBlock("div", {
              class: _normalizeClass(["chat-row", message.role==='user'?'is-user':'is-assistant']),
              key: index
            }, [(message.role!=='user')
              ? (_openBlock(), _createElementBlock("span", {
                  key: 0,
                  class: "chat-avatar"
                }, [_createElementVNode("img", {
                  src: "./images/robot.webp",
                  alt: "AI"
                })]))
              : _createCommentVNode("", true), _createElementVNode("div", { class: "chat-body" }, [
              _createElementVNode("div", { class: "chat-bubble" }, _toDisplayString(message.content), 1),
              (message.warning)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "message-warning"
                  }, _toDisplayString(message.warning), 1))
                : _createCommentVNode("", true),
              (message.citations?.length)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "citation-chips"
                  }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(message.citations, (c) => {
                    return (_openBlock(), _createElementBlock("span", { key: c }, [_createVNode(_component_Icon, {
                      name: "book",
                      size: 12
                    }, null, 8, ["size"]), _createTextVNode(_toDisplayString(c), 1)]))
                  }), 128))]))
                : _createCommentVNode("", true),
              _createElementVNode("span", { class: "chat-timestamp" }, [_createTextVNode(_toDisplayString(message.time||'刚刚') + " ", 1), (message.demo)
                ? (_openBlock(), _createElementBlock("span", { key: 0 }, "· 示例回答"))
                : _createCommentVNode("", true)])
            ])], 2))
          }), 128)),
          thinking
            ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "chat-row is-assistant"
              }, [_createElementVNode("span", { class: "chat-avatar" }, [_createElementVNode("img", {
                src: "./images/robot.webp",
                alt: "AI"
              })]), _createElementVNode("div", { class: "typing-bubble" }, [_createElementVNode("i"), _createElementVNode("i"), _createElementVNode("i")])]))
            : _createCommentVNode("", true),
          error
            ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "inline-error"
              }, [_createVNode(_component_Icon, {
                name: "alert",
                size: 17
              }, null, 8, ["size"]), _createTextVNode(_toDisplayString(error), 1)]))
            : _createCommentVNode("", true)
        ]),
        showProposal
          ? (_openBlock(), _createElementBlock("section", {
              key: 2,
              class: "recommendation-panel"
            }, [_createElementVNode("div", { class: "recommendation-header" }, [_createElementVNode("div", null, [_createElementVNode("h2", null, [_createTextVNode("为你选了 "), _createElementVNode("em", null, _toDisplayString(items.length), 1), _createTextVNode(" 件好物")])])]), _createElementVNode("div", { class: "rec-cards" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(items, (item, index) => {
              return (_openBlock(), _createElementBlock("article", {
                class: "rec-item",
                key: item.skuId
              }, [_createElementVNode("button", {
                class: _normalizeClass(["rec-check", {checked:selectedIds.includes(item.skuId)}]),
                onClick: $event => (toggle(item.skuId)),
                "aria-label": '选择'+item.title
              }, [_createVNode(_component_Icon, {
                name: "check",
                size: 13
              }, null, 8, ["size"])], 10, ["onClick", "aria-label"]), _createElementVNode("div", { class: "rec-photo" }, [_createVNode(_component_ProductImage, {
                src: item.imageUrl||item.product?.imageUrl,
                alt: item.title
              }, null, 8, ["src", "alt"])]), _createElementVNode("div", { class: "rec-card-content" }, [
                _createElementVNode("div", { class: "rec-item-tag" }, _toDisplayString(index===0?'HOT PICK':index===1?'DAILY':'GOOD VALUE'), 1),
                _createElementVNode("strong", null, _toDisplayString(item.title), 1),
                _createElementVNode("small", null, _toDisplayString(item.specKey), 1),
                _createElementVNode("div", { class: "rec-price" }, [_createElementVNode("span", null, _toDisplayString(money(item.priceCent)), 1), _createElementVNode("span", { class: "pick-mini" }, [_createVNode(_component_Icon, {
                  name: "plus",
                  size: 15
                }, null, 8, ["size"])])])
              ])]))
            }), 128))]), _createElementVNode("div", { class: "proposal-footer" }, [_createElementVNode("div", { class: "proposal-total" }, [_createElementVNode("span", null, "已选 " + _toDisplayString(selectedIds.length) + " 件", 1), _createElementVNode("strong", null, _toDisplayString(money(total)), 1)]), _createElementVNode("div", { class: "proposal-actions" }, [(!preview&&proposal?.status==='PENDING')
              ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  class: "ghost-decline",
                  onClick: reject
                }, "放弃", 8, ["onClick"]))
              : _createCommentVNode("", true), _createElementVNode("button", {
              class: "confirm-button",
              onClick: confirm,
              disabled: preview||thinking||!selectedIds.length||(!preview&&proposal?.status!=='PENDING')
            }, [_createVNode(_component_Icon, {
              name: "check",
              size: 17
            }, null, 8, ["size"]), _createTextVNode(_toDisplayString(proposal?.status==='CONFIRMED'?'已确认':'确认加购'), 1)], 8, ["onClick", "disabled"])])])]))
          : _createCommentVNode("", true),
        _createElementVNode("div", {
          class: "chat-composer-placeholder",
          "aria-hidden": "true"
        }),
        _createElementVNode("form", {
          class: "chat-composer",
          onSubmit: _withModifiers($event => (ask()), ["prevent"])
        }, [_withDirectives(_createElementVNode("input", {
          "onUpdate:modelValue": $event => ((input) = $event),
          disabled: thinking||openingConversation,
          "aria-label": "输入问题",
          maxlength: "500",
          placeholder: "问问 AI，帮你找好物…"
        }, null, 8, ["onUpdate:modelValue", "disabled"]), [[_vModelText, input]]), _createElementVNode("button", {
          type: "submit",
          disabled: thinking||openingConversation||!input.trim(),
          "aria-label": "发送问题"
        }, [_createVNode(_component_Icon, {
          name: "send",
          size: 20
        }, null, 8, ["size"])], 8, ["disabled"])], 40, ["onSubmit"])
      ]),
      _: 1
    }))
  }
};
M_pages_Merchant_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { createElementVNode: _createElementVNode, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, resolveComponent: _resolveComponent, createVNode: _createVNode, toDisplayString: _toDisplayString, createCommentVNode: _createCommentVNode, normalizeClass: _normalizeClass, normalizeStyle: _normalizeStyle, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_ProductImageField = _resolveComponent("ProductImageField")
    const _component_AuthDialog = _resolveComponent("AuthDialog")

    return (_openBlock(), _createElementBlock("div", { class: "merchant-shell" }, [
      _createElementVNode("aside", { class: "merchant-sidebar" }, [_createElementVNode("button", {
        class: "merchant-brand",
        onClick: $event => (go('/'))
      }, [_createElementVNode("span", { class: "brand-pin" }, [_createElementVNode("span")]), _createElementVNode("span", { class: "brand-word" }, [_createTextVNode("青柠校园"), _createElementVNode("span", { class: "brand-suffix" }, " / 商户端")])], 8, ["onClick"]), _createElementVNode("nav", { class: "merchant-nav" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(visibleMenu, ([icon,label,path]) => {
        return (_openBlock(), _createElementBlock("button", {
          key: path,
          class: _normalizeClass({active:store.route===path}),
          onClick: $event => (go(path))
        }, [_createVNode(_component_Icon, {
          name: icon,
          size: 19
        }, null, 8, ["name", "size"]), _createElementVNode("span", null, _toDisplayString(label), 1), (store.route===path)
          ? (_openBlock(), _createElementBlock("span", {
              key: 0,
              class: "nav-left-bar"
            }))
          : _createCommentVNode("", true)], 10, ["onClick"]))
      }), 128))]), _createElementVNode("div", { class: "merchant-sidebar-bottom" }, [_createElementVNode("button", {
        class: "sidebar-back",
        onClick: $event => (go('/'))
      }, [_createVNode(_component_Icon, {
        name: "arrowLeft",
        size: 16
      }, null, 8, ["size"]), _createTextVNode(" 返回购物端")], 8, ["onClick"])])]),
      _createElementVNode("div", { class: "merchant-content-shell" }, [_createElementVNode("header", { class: "merchant-topbar" }, [_createElementVNode("div", { class: "topbar-crumb" }, [
        _createTextVNode("运营中心 "),
        _createVNode(_component_Icon, {
          name: "chevronRight",
          size: 14
        }, null, 8, ["size"]),
        _createTextVNode(),
        _createElementVNode("strong", null, "商品管理")
      ]), _createElementVNode("div", { class: "merchant-topbar-tools" }, [
        preview
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "admin-preview-tag"
            }, [_createVNode(_component_Icon, {
              name: "circleHelp",
              size: 14
            }, null, 8, ["size"]), _createTextVNode("演示数据")]))
          : _createCommentVNode("", true),
        _createElementVNode("div", { class: "topbar-merchant-select" }, [_createVNode(_component_Icon, {
          name: "store",
          size: 16
        }, null, 8, ["size"]), _createElementVNode("select", {
          value: store.merchantId,
          onChange: switchMerchant,
          disabled: preview
        }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(store.merchants, (m) => {
          return (_openBlock(), _createElementBlock("option", {
            value: m.merchantId,
            key: m.merchantId
          }, _toDisplayString(m.name) + " · " + _toDisplayString(m.storeName), 9, ["value"]))
        }), 128))], 40, ["value", "onChange", "disabled"]), _createVNode(_component_Icon, {
          name: "chevronDown",
          size: 13
        }, null, 8, ["size"])]),
        _createElementVNode("span", { class: "admin-avatar" }, _toDisplayString(store.user?.displayName?.slice(0,1)||'店'), 1),
        _createElementVNode("span", { class: "admin-user" }, _toDisplayString(store.user?.displayName||'店铺账号'), 1)
      ])]), _createElementVNode("nav", {
        ref: "mobileNav",
        class: "merchant-mobile-nav",
        "aria-label": "工作台导航"
      }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(visibleMenu, ([icon,label,path]) => {
        return (_openBlock(), _createElementBlock("button", {
          key: path,
          class: _normalizeClass({active:store.route===path}),
          onClick: $event => (go(path))
        }, [_createVNode(_component_Icon, {
          name: icon,
          size: 16
        }, null, 8, ["name", "size"]), _createTextVNode(_toDisplayString(label), 1)], 10, ["onClick"]))
      }), 128))], 512), _createElementVNode("main", { class: "merchant-main" }, [_createElementVNode("div", { class: "merchant-page-heading" }, [_createElementVNode("div", null, [_createElementVNode("h1", null, "商品管理")]), _createElementVNode("div", { class: "head-actions" }, [_createElementVNode("button", {
        class: "outline-button small",
        onClick: loadMerchant,
        disabled: store.loading
      }, [_createVNode(_component_Icon, {
        name: "refresh",
        size: 16
      }, null, 8, ["size"]), _createTextVNode("刷新")], 8, ["onClick", "disabled"]), _createElementVNode("button", {
        class: "teal-button",
        onClick: openCreate,
        disabled: !owned
      }, [_createVNode(_component_Icon, {
        name: "plus",
        size: 18
      }, null, 8, ["size"]), _createTextVNode("新增商品")], 8, ["onClick", "disabled"])])]), (store.error)
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "inline-error merchant-error"
          }, [_createVNode(_component_Icon, {
            name: "alert",
            size: 18
          }, null, 8, ["size"]), _createTextVNode(_toDisplayString(store.error), 1), (!preview)
            ? (_openBlock(), _createElementBlock("button", {
                key: 0,
                class: "merchant-login-action",
                onClick: $event => (loginOpen=true)
              }, "登录账号", 8, ["onClick"]))
            : _createCommentVNode("", true)]))
        : _createCommentVNode("", true), (!canRead)
        ? (_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "ops-card access-denied"
          }, "当前角色没有商品查看权限，请联系商户经营者授权。"))
        : (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [_createElementVNode("section", {
            class: "inventory-summary",
            "aria-label": "商品概况"
          }, [
            _createElementVNode("div", { class: "summary-piece" }, [_createElementVNode("span", { class: "summary-icon blue" }, [_createVNode(_component_Icon, {
              name: "package",
              size: 20
            }, null, 8, ["size"])]), _createElementVNode("div", null, [_createElementVNode("span", null, _toDisplayString(preview?'全部商品':'筛选商品'), 1), _createElementVNode("strong", null, _toDisplayString(preview?count.all:store.merchantPage.total), 1)])]),
            _createElementVNode("div", { class: "summary-piece" }, [_createElementVNode("span", { class: "summary-icon green" }, [_createVNode(_component_Icon, {
              name: "check",
              size: 20
            }, null, 8, ["size"])]), _createElementVNode("div", null, [_createElementVNode("span", null, "本页在售"), _createElementVNode("strong", null, _toDisplayString(count.published), 1)])]),
            _createElementVNode("div", { class: "summary-piece" }, [_createElementVNode("span", { class: "summary-icon orange" }, [_createVNode(_component_Icon, {
              name: "box",
              size: 20
            }, null, 8, ["size"])]), _createElementVNode("div", null, [_createElementVNode("span", null, "本页未上架"), _createElementVNode("strong", null, _toDisplayString(count.unpublished), 1)])]),
            _createElementVNode("div", { class: "summary-piece" }, [_createElementVNode("span", { class: "summary-icon red" }, [_createVNode(_component_Icon, {
              name: "alert",
              size: 20
            }, null, 8, ["size"])]), _createElementVNode("div", null, [_createElementVNode("span", null, "本页低库存"), _createElementVNode("strong", null, _toDisplayString(count.low), 1)])]),
            _createElementVNode("div", { class: "summary-stockbar" }, [_createElementVNode("span", null, "本页上架率"), _createElementVNode("div", { class: "summary-stockbar-track" }, [_createElementVNode("span", { style: _normalizeStyle({width:(count.all?count.published/count.all*100:0)+'%'}) }, null, 4)]), _createElementVNode("strong", null, _toDisplayString(count.all?Math.round(count.published/count.all*100):0) + "%", 1)])
          ]), _createElementVNode("section", { class: "product-workspace" }, [_createElementVNode("div", { class: "product-list-panel" }, [
            _createElementVNode("div", { class: "product-tabs" }, [
              _createElementVNode("button", {
                class: _normalizeClass({active:status===''}),
                onClick: $event => (status='')
              }, [_createTextVNode("全部 "), (preview||status==='')
                ? (_openBlock(), _createElementBlock("b", { key: 0 }, _toDisplayString(preview?count.all:store.merchantPage.total), 1))
                : _createCommentVNode("", true)], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({active:status==='PUBLISHED'}),
                onClick: $event => (status='PUBLISHED')
              }, [_createTextVNode("在售 "), (preview||status==='PUBLISHED')
                ? (_openBlock(), _createElementBlock("b", { key: 0 }, _toDisplayString(preview?count.published:store.merchantPage.total), 1))
                : _createCommentVNode("", true)], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({active:status==='UNPUBLISHED'}),
                onClick: $event => (status='UNPUBLISHED')
              }, "已下架", 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({active:status==='low'}),
                onClick: $event => (status='low')
              }, [_createTextVNode("本页低库存 "), _createElementVNode("b", null, _toDisplayString(count.low), 1)], 10, ["onClick"])
            ]),
            _createElementVNode("div", { class: "product-toolbar" }, [
              _createElementVNode("label", { class: "table-search" }, [_createVNode(_component_Icon, {
                name: "search",
                size: 17
              }, null, 8, ["size"]), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((search) = $event),
                placeholder: "商品名称 / SKU / 规格",
                "aria-label": "搜索商品"
              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, search]])]),
              _createElementVNode("label", { class: "table-select" }, [_withDirectives(_createElementVNode("select", {
                "onUpdate:modelValue": $event => ((category) = $event),
                "aria-label": "分类筛选"
              }, [_createElementVNode("option", { value: "" }, "全部分类"), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(store.categories, (c) => {
                return (_openBlock(), _createElementBlock("option", { value: c.code }, _toDisplayString(c.name), 9, ["value"]))
              }), 256))], 8, ["onUpdate:modelValue"]), [[_vModelSelect, category]]), _createVNode(_component_Icon, {
                name: "chevronDown",
                size: 14
              }, null, 8, ["size"])]),
              _createElementVNode("label", { class: "table-select" }, [_withDirectives(_createElementVNode("select", {
                "onUpdate:modelValue": $event => ((sort) = $event),
                "aria-label": "全局排序"
              }, [_createElementVNode("option", { value: "NEWEST" }, "最新上架"), _createElementVNode("option", { value: "PRICE_ASC" }, "全局价格升序"), _createElementVNode("option", { value: "STOCK_DESC" }, "全局可售库存")], 8, ["onUpdate:modelValue"]), [[_vModelSelect, sort]])]),
              _createElementVNode("button", {
                class: "filter-reset",
                onClick: $event => {search='';category='';status='';sort='NEWEST'}
              }, "重置", 8, ["onClick"]),
              _createElementVNode("span", { class: "toolbar-count" }, _toDisplayString(preview?filtered.length:store.merchantPage.total) + " 件", 1)
            ]),
            _createElementVNode("div", { class: "product-table-scroll" }, [_createElementVNode("table", { class: "product-table" }, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
              _createElementVNode("th", null, "商品"),
              _createElementVNode("th", null, "SKU / 规格"),
              _createElementVNode("th", null, "分类"),
              _createElementVNode("th", { class: "t-right" }, "售价"),
              _createElementVNode("th", { class: "t-right" }, "可售"),
              _createElementVNode("th", null, "状态"),
              _createElementVNode("th", { class: "t-right" }, "操作")
            ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(pageRows, (p) => {
              return (_openBlock(), _createElementBlock("tr", {
                key: p.productId,
                class: _normalizeClass({'row-selected':selected?.productId===p.productId}),
                onClick: $event => (choose(p))
              }, [
                _createElementVNode("td", null, [_createElementVNode("div", { class: "table-product-cell" }, [_createVNode(_component_ProductImage, {
                  src: p.imageUrl,
                  alt: p.title
                }, null, 8, ["src", "alt"]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(p.title), 1), _createElementVNode("span", null, _toDisplayString(p.description||'—'), 1)])])]),
                _createElementVNode("td", null, [_createElementVNode("div", { class: "sku-column" }, [_createElementVNode("span", null, _toDisplayString(skuOf(p).specKey||'—'), 1), _createElementVNode("small", null, _toDisplayString(skuOf(p).skuId?.startsWith('preview')?'SKU-'+p.productId.slice(-2):skuOf(p).skuId?.slice(-8)||'—'), 1)])]),
                _createElementVNode("td", null, [_createElementVNode("span", { class: "category-label" }, _toDisplayString(tableCategory(p)), 1)]),
                _createElementVNode("td", { class: "t-right table-price" }, _toDisplayString(money(priceSku(p).priceCent)), 1),
                _createElementVNode("td", { class: _normalizeClass(["t-right", {'red-text':available(p)<20}]) }, _toDisplayString(available(p)), 3),
                _createElementVNode("td", null, [_createElementVNode("span", { class: _normalizeClass(["status-tag", p.status==='PUBLISHED'?'published':p.status==='DRAFT'?'draft':'unpublished']) }, [_createElementVNode("i"), _createTextVNode(_toDisplayString(p.status==='PUBLISHED'?'在售':p.status==='DRAFT'?'草稿':'已下架'), 1)], 2)]),
                _createElementVNode("td", { class: "t-right" }, [_createElementVNode("button", {
                  class: "row-link",
                  onClick: _withModifiers($event => (choose(p)), ["stop"])
                }, [_createTextVNode("查看 "), _createVNode(_component_Icon, {
                  name: "chevronRight",
                  size: 14
                }, null, 8, ["size"])], 8, ["onClick"])])
              ], 10, ["onClick"]))
            }), 128))])]), (!pageRows.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-empty"
                }, [_createVNode(_component_Icon, {
                  name: "search",
                  size: 23
                }, null, 8, ["size"]), _createElementVNode("span", null, "没有符合条件的商品")]))
              : _createCommentVNode("", true)]),
            _createElementVNode("div", { class: "table-footer" }, [_createElementVNode("span", null, "共 " + _toDisplayString(preview?filtered.length:store.merchantPage.total) + " 条", 1), _createElementVNode("div", null, [_createElementVNode("button", {
              disabled: page<=1,
              onClick: $event => (page--),
              "aria-label": "上一页"
            }, [_createVNode(_component_Icon, {
              name: "arrowLeft",
              size: 16
            }, null, 8, ["size"])], 8, ["disabled", "onClick"]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(totalPages, (n) => {
              return (_openBlock(), _createElementBlock("button", {
                key: n,
                class: _normalizeClass({active:page===n}),
                onClick: $event => (page=n)
              }, _toDisplayString(n), 11, ["onClick"]))
            }), 128)), _createElementVNode("button", {
              disabled: page>=totalPages,
              onClick: $event => (page++),
              "aria-label": "下一页"
            }, [_createVNode(_component_Icon, {
              name: "chevronRight",
              size: 16
            }, null, 8, ["size"])], 8, ["disabled", "onClick"])])])
          ]), selected
            ? (_openBlock(), _createElementBlock("aside", {
                key: 0,
                class: "product-inspector"
              }, [
                _createElementVNode("div", { class: "inspector-head" }, [_createElementVNode("span", { class: "inspector-title" }, "商品详情"), _createElementVNode("span", { class: "inspector-id" }, _toDisplayString(selected.productId?.slice(-9)), 1)]),
                _createElementVNode("div", { class: "inspector-product" }, [_createVNode(_component_ProductImage, {
                  src: selected.imageUrl,
                  alt: selected.title
                }, null, 8, ["src", "alt"]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(selected.title), 1), _createElementVNode("span", null, _toDisplayString(tableCategory(selected)) + " · " + _toDisplayString(selected.skus.length) + " 个规格", 1), _createElementVNode("span", { class: _normalizeClass(["status-tag compact", selected.status==='PUBLISHED'?'published':'unpublished']) }, [_createElementVNode("i"), _createTextVNode(_toDisplayString(selected.status==='PUBLISHED'?'在售':'未上架'), 1)], 2)])]),
                _createElementVNode("div", { class: "inspector-tabs" }, [_createElementVNode("button", {
                  class: _normalizeClass({active:drawerTab==='stock'}),
                  onClick: $event => (drawerTab='stock')
                }, "库存", 10, ["onClick"]), _createElementVNode("button", {
                  class: _normalizeClass({active:drawerTab==='info'}),
                  onClick: $event => (drawerTab='info')
                }, "基本信息", 10, ["onClick"]), _createElementVNode("button", {
                  class: _normalizeClass({active:drawerTab==='sku'}),
                  onClick: $event => (drawerTab='sku')
                }, "规格售价", 10, ["onClick"])]),
                (drawerTab==='stock')
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "inspector-body"
                    }, [
                      _createElementVNode("label", { class: "field-label" }, "选择规格"),
                      _withDirectives(_createElementVNode("select", {
                        "onUpdate:modelValue": $event => ((selectedSkuId) = $event),
                        class: "inspector-select"
                      }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(selected.skus, (s) => {
                        return (_openBlock(), _createElementBlock("option", {
                          key: s.skuId,
                          value: s.skuId
                        }, _toDisplayString(s.specKey), 9, ["value"]))
                      }), 128))], 8, ["onUpdate:modelValue"]), [[_vModelSelect, selectedSkuId]]),
                      _createElementVNode("div", { class: "stock-metrics" }, [_createElementVNode("div", null, [_createElementVNode("small", null, "实物库存"), _createElementVNode("strong", null, _toDisplayString(stock?.onHand??'—'), 1)]), _createElementVNode("div", null, [_createElementVNode("small", null, "已预占"), _createElementVNode("strong", null, _toDisplayString(stock?.reserved??'—'), 1)]), _createElementVNode("div", null, [_createElementVNode("small", null, "可售库存"), _createElementVNode("strong", { class: "mint-text" }, _toDisplayString(stock?.available??selectedSku?.available??'—'), 1)])]),
                      _createElementVNode("div", { class: "stock-progress" }, [_createElementVNode("div", { class: "stock-progress-top" }, [_createElementVNode("span", null, "可售占比"), _createElementVNode("strong", null, _toDisplayString(Math.round(inventoryPercent)) + "%", 1)]), _createElementVNode("div", { class: "track" }, [_createElementVNode("span", { style: _normalizeStyle({width:inventoryPercent+'%'}) }, null, 4)])]),
                      (stock && stock.available<20)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: "stock-warning"
                          }, [_createVNode(_component_Icon, {
                            name: "alert",
                            size: 17
                          }, null, 8, ["size"]), _createTextVNode("库存偏低，建议及时补货")]))
                        : _createCommentVNode("", true),
                      _createElementVNode("div", { class: "inspector-divider" }),
                      _createElementVNode("h3", { class: "field-heading" }, "库存补货"),
                      _createElementVNode("label", {
                        class: "field-label",
                        for: "restock-n"
                      }, "增加数量"),
                      _createElementVNode("div", { class: "number-input" }, [_createElementVNode("button", {
                        onClick: $event => (adjustment=Math.max(1,Number(adjustment)-1)),
                        "aria-label": "减少补货数量"
                      }, [_createVNode(_component_Icon, {
                        name: "minus",
                        size: 17
                      }, null, 8, ["size"])], 8, ["onClick"]), _withDirectives(_createElementVNode("input", {
                        id: "restock-n",
                        "onUpdate:modelValue": $event => ((adjustment) = $event),
                        type: "number",
                        min: "1",
                        max: "1000000"
                      }, null, 8, ["onUpdate:modelValue"]), [[
                        _vModelText,
                        adjustment,
                        void 0,
                        { number: true }
                      ]]), _createElementVNode("button", {
                        onClick: $event => (adjustment=Math.min(1000000,Number(adjustment)+1)),
                        "aria-label": "增加补货数量"
                      }, [_createVNode(_component_Icon, {
                        name: "plus",
                        size: 17
                      }, null, 8, ["size"])], 8, ["onClick"])]),
                      _createElementVNode("button", {
                        class: "teal-button inspector-submit",
                        onClick: replenish,
                        disabled: preview||saving||!canReplenish||!selectedSku?.skuId
                      }, "确认补货", 8, ["onClick", "disabled"])
                    ]))
                  : (drawerTab==='info')
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "inspector-body"
                      }, [
                        _createElementVNode("label", { class: "field-label" }, "商品名称"),
                        _withDirectives(_createElementVNode("input", {
                          class: "admin-input",
                          "onUpdate:modelValue": $event => ((info.title) = $event),
                          disabled: !owned
                        }, null, 8, ["onUpdate:modelValue", "disabled"]), [[_vModelText, info.title]]),
                        _createElementVNode("label", { class: "field-label" }, "商品分类"),
                        _withDirectives(_createElementVNode("select", {
                          class: "admin-input",
                          "onUpdate:modelValue": $event => ((info.categoryCode) = $event),
                          disabled: !owned
                        }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(store.categories, (c) => {
                          return (_openBlock(), _createElementBlock("option", {
                            key: c.code,
                            value: c.code
                          }, _toDisplayString(c.name), 9, ["value"]))
                        }), 128))], 8, ["onUpdate:modelValue", "disabled"]), [[_vModelSelect, info.categoryCode]]),
                        _createElementVNode("label", { class: "field-label" }, "商品描述"),
                        _withDirectives(_createElementVNode("textarea", {
                          class: "admin-input",
                          rows: "4",
                          "onUpdate:modelValue": $event => ((info.description) = $event),
                          disabled: !owned
                        }, null, 8, ["onUpdate:modelValue", "disabled"]), [[_vModelText, info.description]]),
                        _createElementVNode("label", { class: "field-label" }, "商品主图"),
                        (_openBlock(), _createBlock(_component_ProductImageField, {
                          key: 'edit-'+selected.productId,
                          modelValue: info.imageUrl,
                          "onUpdate:modelValue": $event => ((info.imageUrl) = $event),
                          "merchant-id": store.merchantId,
                          demo: preview,
                          disabled: !owned||saving,
                          onBusy: $event => (editImageUploading=$event),
                          onInvalid: $event => (editImageInvalid=$event)
                        }, null, 8, ["modelValue", "onUpdate:modelValue", "merchant-id", "demo", "disabled", "onBusy", "onInvalid"])),
                        _createElementVNode("button", {
                          class: "teal-button inspector-submit",
                          onClick: saveInfo,
                          disabled: preview||saving||editImageUploading||editImageInvalid||!owned
                        }, "保存修改", 8, ["onClick", "disabled"]),
                        _createElementVNode("button", {
                          class: "inspector-link",
                          onClick: $event => (publish(selected)),
                          disabled: preview||saving||!owned
                        }, [_createTextVNode(_toDisplayString(selected.status==='PUBLISHED'?'下架商品':'上架商品') + " ", 1), _createVNode(_component_Icon, {
                          name: "chevronRight",
                          size: 16
                        }, null, 8, ["size"])], 8, ["onClick", "disabled"])
                      ]))
                    : (_openBlock(), _createElementBlock("div", {
                        key: 2,
                        class: "inspector-body"
                      }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(selected.skus, (sku) => {
                        return (_openBlock(), _createElementBlock("div", {
                          class: "sku-item",
                          key: sku.skuId
                        }, [_createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(sku.specKey), 1), _createElementVNode("small", null, _toDisplayString(sku.skuId), 1)]), _createElementVNode("strong", null, _toDisplayString(money(sku.priceCent)), 1), _createElementVNode("button", {
                          disabled: !owned||preview,
                          onClick: $event => (openPrice(sku)),
                          title: "修改售价"
                        }, [_createVNode(_component_Icon, {
                          name: "edit",
                          size: 17
                        }, null, 8, ["size"])], 8, ["disabled", "onClick"])]))
                      }), 128)), _createElementVNode("button", {
                        class: "outline-button small",
                        disabled: !owned||preview||selected.skus.length>=20,
                        onClick: openAddSku
                      }, [_createVNode(_component_Icon, {
                        name: "plus",
                        size: 16
                      }, null, 8, ["size"]), _createTextVNode("新增规格")], 8, ["disabled", "onClick"])]))
              ]))
            : (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "product-inspector empty-inspector"
              }, [_createVNode(_component_Icon, {
                name: "package",
                size: 28
              }, null, 8, ["size"]), _createTextVNode("选择商品以查看详情")]))])], 64))])]),
      loginOpen
        ? (_openBlock(), _createBlock(_component_AuthDialog, {
            key: 0,
            onClose: $event => (loginOpen=false),
            onSuccess: loadMerchant
          }, null, 8, ["onClose", "onSuccess"]))
        : _createCommentVNode("", true),
      modal
        ? (_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "ui-overlay",
            onClick: _withModifiers($event => (modal=''), ["self"])
          }, [(modal==='create')
            ? (_openBlock(), _createElementBlock("form", {
                key: 0,
                class: "merchant-modal",
                onSubmit: _withModifiers(create, ["prevent"])
              }, [
                _createElementVNode("div", { class: "merchant-modal-header" }, [_createElementVNode("div", null, [_createElementVNode("h2", null, "新增商品")]), _createElementVNode("button", {
                  type: "button",
                  onClick: $event => (modal=''),
                  "aria-label": "关闭"
                }, [_createVNode(_component_Icon, {
                  name: "x",
                  size: 20
                }, null, 8, ["size"])], 8, ["onClick"])]),
                _createElementVNode("label", { class: "field-label" }, "商品名称"),
                _withDirectives(_createElementVNode("input", {
                  class: "admin-input",
                  maxlength: "100",
                  "onUpdate:modelValue": $event => ((form.title) = $event),
                  placeholder: "商品名称",
                  required: ""
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, form.title]]),
                _createElementVNode("label", { class: "field-label" }, "分类"),
                _withDirectives(_createElementVNode("select", {
                  "onUpdate:modelValue": $event => ((form.categoryCode) = $event),
                  class: "admin-input"
                }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(store.categories.filter(c=>c.active), (c) => {
                  return (_openBlock(), _createElementBlock("option", { value: c.code }, _toDisplayString(c.name), 9, ["value"]))
                }), 256))], 8, ["onUpdate:modelValue"]), [[_vModelSelect, form.categoryCode]]),
                _createElementVNode("label", { class: "field-label" }, "规格 / 售价（元）"),
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(form.skus, (item, index) => {
                  return (_openBlock(), _createElementBlock("div", {
                    key: index,
                    class: "sku-create-row"
                  }, [_withDirectives(_createElementVNode("input", {
                    class: "admin-input",
                    maxlength: "100",
                    "onUpdate:modelValue": $event => ((item.specKey) = $event),
                    required: "",
                    placeholder: "例如 250ml"
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, item.specKey]]), _withDirectives(_createElementVNode("input", {
                    class: "admin-input",
                    "onUpdate:modelValue": $event => ((item.price) = $event),
                    inputmode: "decimal",
                    placeholder: "0.00",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, item.price]]), _createElementVNode("button", {
                    type: "button",
                    class: "outline-button small",
                    disabled: form.skus.length===1,
                    onClick: $event => (removeCreateSku(index)),
                    "aria-label": '移除规格'+(index+1)
                  }, [_createVNode(_component_Icon, {
                    name: "x",
                    size: 15
                  }, null, 8, ["size"])], 8, ["disabled", "onClick", "aria-label"])]))
                }), 128)),
                _createElementVNode("button", {
                  type: "button",
                  class: "outline-button small",
                  disabled: form.skus.length>=20,
                  onClick: addCreateSku
                }, [_createVNode(_component_Icon, {
                  name: "plus",
                  size: 15
                }, null, 8, ["size"]), _createTextVNode("添加规格")], 8, ["disabled", "onClick"]),
                _createElementVNode("label", { class: "field-label" }, "描述"),
                _withDirectives(_createElementVNode("textarea", {
                  class: "admin-input",
                  rows: "3",
                  "onUpdate:modelValue": $event => ((form.description) = $event),
                  placeholder: "选填"
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, form.description]]),
                _createElementVNode("label", { class: "field-label" }, "商品主图"),
                _createVNode(_component_ProductImageField, {
                  modelValue: form.imageUrl,
                  "onUpdate:modelValue": $event => ((form.imageUrl) = $event),
                  "merchant-id": store.merchantId,
                  demo: preview,
                  disabled: saving||!owned,
                  onBusy: $event => (createImageUploading=$event),
                  onInvalid: $event => (createImageInvalid=$event)
                }, null, 8, ["modelValue", "onUpdate:modelValue", "merchant-id", "demo", "disabled", "onBusy", "onInvalid"]),
                _createElementVNode("div", { class: "form-buttons" }, [_createElementVNode("button", {
                  type: "button",
                  class: "outline-button",
                  onClick: $event => (modal='')
                }, "取消", 8, ["onClick"]), _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: preview||saving||createImageUploading||createImageInvalid||!owned
                }, "保存商品", 8, ["disabled"])])
              ], 40, ["onSubmit"]))
            : (modal==='addSku')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 1,
                  class: "merchant-modal narrow",
                  onSubmit: _withModifiers(addSku, ["prevent"])
                }, [
                  _createElementVNode("div", { class: "merchant-modal-header" }, [_createElementVNode("h2", null, "新增规格"), _createElementVNode("button", {
                    type: "button",
                    onClick: $event => (modal=''),
                    "aria-label": "关闭"
                  }, [_createVNode(_component_Icon, {
                    name: "x",
                    size: 18
                  }, null, 8, ["size"])], 8, ["onClick"])]),
                  _createElementVNode("label", { class: "field-label" }, "规格名称"),
                  _withDirectives(_createElementVNode("input", {
                    class: "admin-input",
                    maxlength: "100",
                    "onUpdate:modelValue": $event => ((skuForm.specKey) = $event),
                    required: "",
                    placeholder: "例如：500ml"
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, skuForm.specKey]]),
                  _createElementVNode("label", { class: "field-label" }, "售价（元）"),
                  _withDirectives(_createElementVNode("input", {
                    class: "admin-input",
                    "onUpdate:modelValue": $event => ((skuForm.price) = $event),
                    inputmode: "decimal",
                    required: "",
                    placeholder: "0.00"
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, skuForm.price]]),
                  _createElementVNode("div", { class: "form-buttons" }, [_createElementVNode("button", {
                    type: "button",
                    class: "outline-button",
                    onClick: $event => (modal='')
                  }, "取消", 8, ["onClick"]), _createElementVNode("button", {
                    type: "submit",
                    class: "teal-button",
                    disabled: preview||saving
                  }, "保存规格", 8, ["disabled"])])
                ], 40, ["onSubmit"]))
              : (modal==='price')
                ? (_openBlock(), _createElementBlock("form", {
                    key: 2,
                    class: "merchant-modal narrow",
                    onSubmit: _withModifiers(savePrice, ["prevent"])
                  }, [
                    _createElementVNode("div", { class: "merchant-modal-header" }, [_createElementVNode("div", null, [_createElementVNode("h2", null, "修改售价")]), _createElementVNode("button", {
                      type: "button",
                      onClick: $event => (modal=''),
                      "aria-label": "关闭"
                    }, [_createVNode(_component_Icon, {
                      name: "x",
                      size: 20
                    }, null, 8, ["size"])], 8, ["onClick"])]),
                    _createElementVNode("div", { class: "field-muted" }, _toDisplayString(selected?.title) + " · " + _toDisplayString(activePriceSku?.specKey), 1),
                    _createElementVNode("label", { class: "field-label" }, "售价（元）"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": $event => ((newPrice) = $event),
                      inputmode: "decimal",
                      required: ""
                    }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, newPrice]]),
                    _createElementVNode("div", { class: "form-buttons" }, [_createElementVNode("button", {
                      type: "button",
                      class: "outline-button",
                      onClick: $event => (modal='')
                    }, "取消", 8, ["onClick"]), _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: preview||saving
                    }, "保存售价", 8, ["disabled"])])
                  ], 40, ["onSubmit"]))
                : _createCommentVNode("", true)], 8, ["onClick"]))
        : _createCommentVNode("", true)
    ]))
  }
};
M_pages_ProductDetail_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, withCtx: _withCtx, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_ConsumerShell = _resolveComponent("ConsumerShell")

    return (_openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
      default: _withCtx(() => [_createElementVNode("div", { class: "mobile-page-top" }, [_createElementVNode("button", {
        onClick: $event => (go('/')),
        "aria-label": "返回首页"
      }, [_createVNode(_component_Icon, { name: "arrowLeft" })], 8, ["onClick"]), _createElementVNode("b", null, "商品详情"), _createElementVNode("button", {
        onClick: $event => (go('/cart')),
        "aria-label": "购物车"
      }, [_createVNode(_component_Icon, { name: "cart" })], 8, ["onClick"])]), error
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "inline-error"
          }, _toDisplayString(error), 1))
        : product
          ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
              _createElementVNode("div", { class: "detail-art" }, [_createVNode(_component_ProductImage, {
                src: product.imageUrl,
                alt: product.title,
                loading: "eager"
              }, null, 8, ["src", "alt"]), (product.status==='PUBLISHED')
                ? (_openBlock(), _createElementBlock("span", {
                    key: 0,
                    class: "corner-tag"
                  }, "校内自提"))
                : _createCommentVNode("", true)]),
              _createElementVNode("div", { class: "detail-info" }, [_createElementVNode("div", { class: "detail-price" }, [_createTextVNode(_toDisplayString(money(sku.priceCent)) + " ", 1), _createElementVNode("small", null, "含税售价")]), _createElementVNode("h1", null, _toDisplayString(product.title), 1), (product.description)
                ? (_openBlock(), _createElementBlock("p", {
                    key: 0,
                    class: "muted-short"
                  }, _toDisplayString(product.description), 1))
                : _createCommentVNode("", true)]),
              _createElementVNode("div", { class: "detail-card" }, [_createElementVNode("button", {
                class: "detail-merchant",
                onClick: $event => (go('/shops/'+product.merchantId))
              }, [_createElementVNode("span", { class: "merchant-logo" }, [_createVNode(_component_Icon, { name: "store" })]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(merchant.name||'校园商户'), 1), _createElementVNode("span", null, _toDisplayString(merchant.storeName||merchant.location||'校内自提门店'), 1)]), _createVNode(_component_Icon, { name: "chevronRight" })], 8, ["onClick"])]),
              _createElementVNode("div", { class: "detail-card" }, [_createElementVNode("div", { class: "detail-subtitle" }, "选择规格"), _createElementVNode("div", { class: "sku-picker" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(product.skus, (s) => {
                return (_openBlock(), _createElementBlock("button", {
                  key: s.skuId,
                  class: _normalizeClass({active:sku.skuId===s.skuId}),
                  disabled: s.status!=='ACTIVE'||!s.available,
                  onClick: $event => {chosen=s.skuId;count=1}
                }, _toDisplayString(s.specKey), 11, ["disabled", "onClick"]))
              }), 128))]), _createElementVNode("div", { class: "quantity-picker" }, [_createElementVNode("span", null, [_createTextVNode("数量 "), _createElementVNode("small", null, "可售 " + _toDisplayString(sku.available||0), 1)]), _createElementVNode("div", null, [_createElementVNode("button", {
                "aria-label": "减少",
                onClick: $event => (count=Math.max(1,count-1))
              }, [_createVNode(_component_Icon, {
                name: "minus",
                size: 16
              }, null, 8, ["size"])], 8, ["onClick"]), _createElementVNode("b", null, _toDisplayString(count), 1), _createElementVNode("button", {
                "aria-label": "增加",
                disabled: count>=Math.min(99,Number(sku.available||0)),
                onClick: $event => (count++)
              }, [_createVNode(_component_Icon, {
                name: "plus",
                size: 16
              }, null, 8, ["size"])], 8, ["disabled", "onClick"])])])]),
              _createElementVNode("div", { class: "detail-fixed" }, [_createElementVNode("button", {
                class: "outline-button",
                onClick: $event => (go('/cart'))
              }, [_createVNode(_component_Icon, {
                name: "cart",
                size: 18
              }, null, 8, ["size"]), _createTextVNode("购物车")], 8, ["onClick"]), _createElementVNode("button", {
                class: "teal-button",
                disabled: preview||busy||!sku.available||product.status!=='PUBLISHED',
                onClick: add
              }, _toDisplayString(busy?'加入中…':'加入购物车'), 9, ["disabled", "onClick"])])
            ], 64))
          : (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "mobile-empty"
            }, "正在加载商品…"))]),
      _: 1
    }))
  }
};
M_pages_Shop_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, withCtx: _withCtx, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_ConsumerShell = _resolveComponent("ConsumerShell")

    return (_openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
      default: _withCtx(() => [_createElementVNode("div", { class: "mobile-page-top" }, [_createElementVNode("button", {
        onClick: $event => (go('/')),
        "aria-label": "返回"
      }, [_createVNode(_component_Icon, { name: "arrowLeft" })], 8, ["onClick"]), _createElementVNode("b", null, "商户"), _createElementVNode("span")]), error
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "inline-error"
          }, _toDisplayString(error), 1))
        : _createCommentVNode("", true), merchant
        ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
            _createElementVNode("section", { class: "shop-hero" }, [_createElementVNode("span", { class: "merchant-logo" }, [_createVNode(_component_Icon, {
              name: "store",
              size: 28
            }, null, 8, ["size"])]), _createElementVNode("div", null, [_createElementVNode("h1", null, _toDisplayString(merchant.name), 1), _createElementVNode("p", null, _toDisplayString(merchant.storeName) + " · " + _toDisplayString(merchant.location), 1)])]),
            _createElementVNode("div", { class: "section-heading" }, [_createElementVNode("h2", null, "在售商品")]),
            _createElementVNode("div", { class: "shop-product-grid" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(products, (p) => {
              return (_openBlock(), _createElementBlock("button", {
                key: p.productId,
                class: "shop-product-card",
                onClick: $event => (go('/product/'+encodeURIComponent(p.productId)))
              }, [_createVNode(_component_ProductImage, {
                src: p.imageUrl,
                alt: p.title
              }, null, 8, ["src", "alt"]), _createElementVNode("strong", null, _toDisplayString(p.title), 1), _createElementVNode("span", null, _toDisplayString(money(skuOf(p).priceCent)), 1)], 8, ["onClick"]))
            }), 128))]),
            (!products.length&&!loading)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "mobile-empty"
                }, "暂无在售商品"))
              : _createCommentVNode("", true),
            _createElementVNode("div", { class: "shop-pagination" }, [_createElementVNode("button", {
              disabled: page===1||loading,
              onClick: $event => (page--)
            }, "上一页", 8, ["disabled", "onClick"]), _createElementVNode("span", null, _toDisplayString(page), 1), _createElementVNode("button", {
              disabled: !hasNext||loading,
              onClick: $event => (page++)
            }, "下一页", 8, ["disabled", "onClick"])])
          ], 64))
        : loading
          ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "mobile-empty"
            }, "正在加载商户…"))
          : _createCommentVNode("", true)]),
      _: 1
    }))
  }
};
M_pages_Cart_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, createTextVNode: _createTextVNode, withCtx: _withCtx, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_ConsumerShell = _resolveComponent("ConsumerShell")

    return (_openBlock(), _createBlock(_component_ConsumerShell, { active: "cart" }, {
      default: _withCtx(() => [
        _createElementVNode("div", { class: "mobile-page-top" }, [_createElementVNode("button", {
          onClick: $event => (go('/')),
          "aria-label": "返回"
        }, [_createVNode(_component_Icon, { name: "arrowLeft" })], 8, ["onClick"]), _createElementVNode("b", null, "购物车"), _createElementVNode("button", {
          onClick: load,
          "aria-label": "刷新"
        }, [_createVNode(_component_Icon, { name: "refresh" })], 8, ["onClick"])]),
        error
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "inline-error"
            }, _toDisplayString(error), 1))
          : _createCommentVNode("", true),
        (!items.length&&!error)
          ? (_openBlock(), _createElementBlock("div", {
              key: 1,
              class: "mobile-empty"
            }, [_createVNode(_component_Icon, {
              name: "cart",
              size: 36
            }, null, 8, ["size"]), _createElementVNode("strong", null, "购物车空空的"), _createElementVNode("button", {
              class: "teal-button",
              onClick: $event => (go('/'))
            }, "去逛逛", 8, ["onClick"])]))
          : _createCommentVNode("", true),
        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(groups, (g) => {
          return (_openBlock(), _createElementBlock("section", {
            key: g.id,
            class: _normalizeClass(["cart-store", {selected:merchantId===g.id}])
          }, [_createElementVNode("button", {
            class: "cart-store-head",
            onClick: $event => (merchantId=g.id)
          }, [
            _createElementVNode("span", { class: _normalizeClass(["radio-circle", {active:merchantId===g.id}]) }, [_createVNode(_component_Icon, {
              name: "check",
              size: 12
            }, null, 8, ["size"])], 2),
            _createVNode(_component_Icon, { name: "store" }),
            _createElementVNode("strong", null, _toDisplayString(merchantName(g.id)), 1),
            _createElementVNode("span", { class: "cart-store-total" }, _toDisplayString(money(g.total)), 1)
          ], 8, ["onClick"]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(g.rows, (i) => {
            return (_openBlock(), _createElementBlock("div", {
              class: "cart-line",
              key: i.skuId
            }, [_createVNode(_component_ProductImage, {
              src: i.imageUrl,
              alt: i.title
            }, null, 8, ["src", "alt"]), _createElementVNode("div", { class: "cart-line-info" }, [_createElementVNode("strong", null, _toDisplayString(i.title), 1), _createElementVNode("small", null, [_createTextVNode(_toDisplayString(i.specKey) + " ", 1), (!i.sellable||i.available<i.quantity)
              ? (_openBlock(), _createElementBlock("span", {
                  key: 0,
                  class: "red-text"
                }, "库存不足/失效"))
              : _createCommentVNode("", true)]), _createElementVNode("div", { class: "cart-line-bottom" }, [_createElementVNode("b", null, _toDisplayString(money(i.priceCent)), 1), _createElementVNode("div", { class: "mini-qty" }, [_createElementVNode("button", {
              disabled: busy||preview,
              "aria-label": '减少'+i.title,
              onClick: $event => (quantity(i,-1))
            }, [_createVNode(_component_Icon, {
              name: "minus",
              size: 15
            }, null, 8, ["size"])], 8, ["disabled", "aria-label", "onClick"]), _createElementVNode("span", null, _toDisplayString(i.quantity), 1), _createElementVNode("button", {
              disabled: busy||preview||i.quantity>=99||i.quantity>=i.available,
              "aria-label": '增加'+i.title,
              onClick: $event => (quantity(i,1))
            }, [_createVNode(_component_Icon, {
              name: "plus",
              size: 15
            }, null, 8, ["size"])], 8, ["disabled", "aria-label", "onClick"])])])])]))
          }), 128))], 2))
        }), 128)),
        (groups.length>1)
          ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "mobile-hint"
            }, "一次结算一家商户，请选择要下单的店铺。"))
          : _createCommentVNode("", true),
        (items.length)
          ? (_openBlock(), _createElementBlock("div", {
              key: 3,
              class: "mobile-summary"
            }, [_createElementVNode("div", null, [_createTextVNode("商品金额 "), _createElementVNode("strong", null, _toDisplayString(money(total)), 1)]), _createElementVNode("div", null, [_createTextVNode("自提方式 "), _createElementVNode("strong", null, "校内门店自提")]), _createElementVNode("div", { class: "mobile-summary-total" }, [_createTextVNode("应付 "), _createElementVNode("b", null, _toDisplayString(money(total)), 1)])]))
          : _createCommentVNode("", true),
        (items.length)
          ? (_openBlock(), _createElementBlock("div", {
              key: 4,
              class: "mobile-checkout-bar"
            }, [_createElementVNode("div", null, [_createElementVNode("small", null, "本单合计"), _createElementVNode("b", null, _toDisplayString(money(total)), 1)]), _createElementVNode("button", {
              class: "teal-button",
              disabled: preview||busy||!selected.length,
              onClick: checkout
            }, _toDisplayString(busy?'提交中':'提交订单'), 9, ["disabled", "onClick"])]))
          : _createCommentVNode("", true)
      ]),
      _: 1
    }))
  }
};
M_pages_Orders_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, createTextVNode: _createTextVNode, vModelText: _vModelText, withDirectives: _withDirectives, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_ConsumerShell = _resolveComponent("ConsumerShell")

    return (_openBlock(), _createBlock(_component_ConsumerShell, { active: "orders" }, {
      default: _withCtx(() => [_createElementVNode("div", { class: "mobile-page-top" }, [_createElementVNode("button", {
        onClick: $event => (go(id?'/orders':'/')),
        "aria-label": "返回"
      }, [_createVNode(_component_Icon, { name: "arrowLeft" })], 8, ["onClick"]), _createElementVNode("b", null, _toDisplayString(id?'订单详情':'我的订单'), 1), _createElementVNode("button", {
        onClick: load,
        "aria-label": "刷新"
      }, [_createVNode(_component_Icon, { name: "refresh" })], 8, ["onClick"])]), error
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "inline-error"
          }, _toDisplayString(error), 1))
        : _createCommentVNode("", true), (!id)
        ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
            _createElementVNode("div", { class: "order-tabs" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList([['ALL','全部'],['PENDING_PAYMENT','待付款'],['PAID','待自提'],['COMPLETED','已完成']], (t) => {
              return (_openBlock(), _createElementBlock("button", {
                class: _normalizeClass({active:tab===t[0]}),
                key: t[0],
                onClick: $event => {page=1;tab=t[0]}
              }, _toDisplayString(t[1]), 11, ["onClick"]))
            }), 128))]),
            (!filtered.length&&!error)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "mobile-empty"
                }, [_createVNode(_component_Icon, {
                  name: "order",
                  size: 34
                }, null, 8, ["size"]), _createElementVNode("strong", null, "暂无订单")]))
              : _createCommentVNode("", true),
            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(filtered, (o) => {
              return (_openBlock(), _createElementBlock("button", {
                class: "consumer-order-card",
                key: o.orderId,
                onClick: $event => (go('/orders/'+o.orderId))
              }, [_createElementVNode("div", { class: "order-card-head" }, [_createElementVNode("span", null, [_createVNode(_component_Icon, {
                name: "store",
                size: 17
              }, null, 8, ["size"]), _createTextVNode(_toDisplayString(merchantName(o.merchantId,o)), 1)]), _createElementVNode("b", { class: _normalizeClass(statusClass(o.status)) }, _toDisplayString(label(o.status)), 3)]), _createElementVNode("div", { class: "order-goods" }, [_createElementVNode("div", { class: "order-item-placeholder" }, [_createVNode(_component_ProductImage, {
                src: o.items?.[0]?.imageUrl,
                alt: o.items?.[0]?.title||'商品'
              }, null, 8, ["src", "alt"])]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(o.items?.[0]?.title||'校园订单'), 1), _createElementVNode("small", null, _toDisplayString(o.items?.length||0) + " 种商品 · " + _toDisplayString(dateTime(o.createdAt)), 1)]), _createElementVNode("b", null, _toDisplayString(money(o.totalCent)), 1)]), _createElementVNode("div", { class: "order-card-foot" }, [_createTextVNode("#" + _toDisplayString(o.orderId) + " ", 1), _createElementVNode("span", null, [_createTextVNode("查看详情 "), _createVNode(_component_Icon, {
                name: "chevronRight",
                size: 14
              }, null, 8, ["size"])])])], 8, ["onClick"]))
            }), 128)),
            (!preview&&pageInfo.total>0)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "sdd-pager"
                }, [
                  _createElementVNode("span", null, "共 " + _toDisplayString(pageInfo.total) + " 单", 1),
                  _createElementVNode("button", {
                    disabled: page<=1,
                    onClick: $event => (page--)
                  }, "上一页", 8, ["disabled", "onClick"]),
                  _createElementVNode("span", null, _toDisplayString(page), 1),
                  _createElementVNode("button", {
                    disabled: !pageInfo.hasNext,
                    onClick: $event => (page++)
                  }, "下一页", 8, ["disabled", "onClick"])
                ]))
              : _createCommentVNode("", true)
          ], 64))
        : detail
          ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
              _createElementVNode("section", { class: _normalizeClass(["pickup-hero", {complete:detail.status==='COMPLETED'}]) }, [_createElementVNode("div", { class: "pickup-status-icon" }, [_createVNode(_component_Icon, {
                name: detail.status==='COMPLETED'?'check':'clock',
                size: 28
              }, null, 8, ["name", "size"])]), _createElementVNode("div", null, [_createElementVNode("h1", null, _toDisplayString(detail.pickup?.status==='READY'?'待自提':label(detail.status)), 1), _createElementVNode("p", null, _toDisplayString(detail.status==='COMPLETED'?'感谢购买':detail.status==='PAID'?'校内门店自提':detail.status==='PENDING_PAYMENT'?'请在付款截止前完成模拟支付':'查看订单记录'), 1)])], 2),
              _createElementVNode("section", { class: "detail-card" }, [_createElementVNode("div", { class: "order-card-head" }, [_createElementVNode("span", null, [_createVNode(_component_Icon, {
                name: "store",
                size: 18
              }, null, 8, ["size"]), _createTextVNode(_toDisplayString(merchantName(detail.merchantId,detail)), 1)]), _createVNode(_component_Icon, {
                name: "chevronRight",
                size: 17
              }, null, 8, ["size"])]), _createElementVNode("div", { class: "pickup-location" }, [_createVNode(_component_Icon, {
                name: "pin",
                size: 19
              }, null, 8, ["size"]), _createElementVNode("span", null, _toDisplayString(store.merchants.find(m=>m.merchantId===detail.merchantId)?.location||'校内自提门店'), 1)])]),
              (detail.status==='PAID')
                ? (_openBlock(), _createElementBlock("section", {
                    key: 0,
                    class: "detail-card token-card"
                  }, [_createElementVNode("h2", null, "自提凭证"), token
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "pickup-code"
                      }, [_createVNode(_component_Icon, {
                        name: "shield",
                        size: 25
                      }, null, 8, ["size"]), _createElementVNode("code", null, _toDisplayString(token.token), 1), _createElementVNode("small", null, "有效期至 " + _toDisplayString(dateTime(token.expiresAt)) + "，再次签发旧凭证失效", 1)]))
                    : (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "pickup-code placeholder-code"
                      }, [_createVNode(_component_Icon, {
                        name: "scan",
                        size: 30
                      }, null, 8, ["size"]), _createElementVNode("span", null, _toDisplayString(detail.pickup?.status==='READY'?'可领取自提令牌':'等待商户备货完成'), 1)])), _createElementVNode("button", {
                    class: "teal-button",
                    disabled: preview||busy||!allowToken,
                    onClick: $event => (action('/pickup-token'))
                  }, _toDisplayString(token?'重新签发自提凭证':'领取自提凭证'), 9, ["disabled", "onClick"])]))
                : _createCommentVNode("", true),
              _createElementVNode("section", { class: "detail-card" }, [_createElementVNode("h2", { class: "card-title-inline" }, [_createTextVNode("商品清单 "), _createElementVNode("span", null, _toDisplayString(detail.items?.length||0) + " 种", 1)]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(detail.items, (i) => {
                return (_openBlock(), _createElementBlock("div", {
                  class: "order-detail-line",
                  key: i.skuId
                }, [_createElementVNode("div", { class: "order-item-placeholder" }, [_createVNode(_component_ProductImage, {
                  src: i.imageUrl,
                  alt: i.title
                }, null, 8, ["src", "alt"])]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(i.title), 1), _createElementVNode("small", null, _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity), 1)]), _createElementVNode("b", null, _toDisplayString(money(Number(i.unitPriceCent)*Number(i.quantity))), 1)]))
              }), 128)), _createElementVNode("div", { class: "price-row" }, [_createElementVNode("span", null, "实付 / 应付"), _createElementVNode("b", null, _toDisplayString(money(detail.totalCent)), 1)])]),
              _createElementVNode("section", { class: "detail-card order-metadata" }, [
                _createElementVNode("div", null, [_createElementVNode("span", null, "订单编号"), _createElementVNode("strong", null, _toDisplayString(detail.orderId), 1)]),
                _createElementVNode("div", null, [_createElementVNode("span", null, "下单时间"), _createElementVNode("strong", null, _toDisplayString(dateTime(detail.createdAt)), 1)]),
                (detail.status==='PENDING_PAYMENT')
                  ? (_openBlock(), _createElementBlock("div", { key: 0 }, [_createElementVNode("span", null, "付款截止"), _createElementVNode("strong", null, _toDisplayString(dateTime(detail.deadline)), 1)]))
                  : _createCommentVNode("", true),
                (detail.afterSale)
                  ? (_openBlock(), _createElementBlock("div", { key: 1 }, [_createElementVNode("span", null, "售后状态"), _createElementVNode("strong", null, _toDisplayString(label(detail.afterSale.status)), 1)]))
                  : _createCommentVNode("", true)
              ]),
              (!preview)
                ? (_openBlock(), _createElementBlock("section", {
                    key: 1,
                    class: "order-actions"
                  }, [
                    (detail.status==='PENDING_PAYMENT')
                      ? (_openBlock(), _createElementBlock("button", {
                          key: 0,
                          class: "teal-button",
                          disabled: busy,
                          onClick: $event => (action('/pay'))
                        }, "模拟支付", 8, ["disabled", "onClick"]))
                      : _createCommentVNode("", true),
                    (detail.status==='PENDING_PAYMENT')
                      ? (_openBlock(), _createElementBlock("button", {
                          key: 1,
                          class: "outline-button",
                          disabled: busy,
                          onClick: $event => (action('/cancel'))
                        }, "取消订单", 8, ["disabled", "onClick"]))
                      : _createCommentVNode("", true),
                    (detail.status==='PAID'&&!detail.afterSale)
                      ? (_openBlock(), _createElementBlock("button", {
                          key: 2,
                          class: "outline-button",
                          onClick: $event => (refundOpen=!refundOpen)
                        }, "申请退款", 8, ["onClick"]))
                      : _createCommentVNode("", true),
                    (detail.status==='PAID'&&detail.afterSale?.status==='REJECTED')
                      ? (_openBlock(), _createElementBlock("button", {
                          key: 3,
                          class: "outline-button",
                          disabled: busy,
                          onClick: $event => (action('/appeal'))
                        }, "申请平台介入", 8, ["disabled", "onClick"]))
                      : _createCommentVNode("", true)
                  ]))
                : _createCommentVNode("", true),
              (refundOpen&&!preview)
                ? (_openBlock(), _createElementBlock("form", {
                    key: 2,
                    class: "detail-card",
                    onSubmit: _withModifiers(submitRefund, ["prevent"])
                  }, [_createElementVNode("label", { class: "field-label" }, "退款原因"), _withDirectives(_createElementVNode("textarea", {
                    class: "admin-input",
                    "onUpdate:modelValue": $event => ((reason) = $event),
                    maxlength: "500",
                    rows: "3",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, reason]]), _createElementVNode("button", {
                    type: "submit",
                    class: "teal-button",
                    disabled: busy
                  }, "提交退款申请", 8, ["disabled"])], 40, ["onSubmit"]))
                : _createCommentVNode("", true)
            ], 64))
          : (id&&!error)
            ? (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "mobile-empty"
              }, "加载订单中…"))
            : _createCommentVNode("", true)]),
      _: 1
    }))
  }
};
M_pages_Account_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, createBlock: _createBlock, withCtx: _withCtx } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_AuthDialog = _resolveComponent("AuthDialog")
    const _component_ConsumerShell = _resolveComponent("ConsumerShell")

    return (_openBlock(), _createBlock(_component_ConsumerShell, { active: "account" }, {
      default: _withCtx(() => [_createElementVNode("div", { class: "mobile-page-top" }, [_createElementVNode("button", {
        onClick: $event => (go('/account')),
        "aria-label": "返回"
      }, [_createVNode(_component_Icon, { name: "arrowLeft" })], 8, ["onClick"]), _createElementVNode("b", null, _toDisplayString(isApply?'商户入驻':isInvite?'收到的邀请':'个人中心'), 1), (!isApply&&!isInvite)
        ? (_openBlock(), _createElementBlock("button", {
            key: 0,
            onClick: load,
            "aria-label": "刷新"
          }, [_createVNode(_component_Icon, { name: "refresh" })], 8, ["onClick"]))
        : _createCommentVNode("", true)]), (!isApply&&!isInvite)
        ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
            _createElementVNode("section", { class: "account-profile" }, [
              _createElementVNode("div", { class: "profile-avatar" }, [_createVNode(_component_Icon, {
                name: "user",
                size: 30
              }, null, 8, ["size"])]),
              _createElementVNode("div", null, [_createElementVNode("h1", null, _toDisplayString(store.user?.displayName||'校园同学'), 1), _createElementVNode("p", null, _toDisplayString(store.user?.username||'登录后查看订单与申请'), 1)]),
              (!store.user&&!preview)
                ? (_openBlock(), _createElementBlock("button", {
                    key: 0,
                    class: "outline-button",
                    onClick: $event => (login=true)
                  }, "登录 / 注册", 8, ["onClick"]))
                : _createCommentVNode("", true),
              preview
                ? (_openBlock(), _createElementBlock("span", {
                    key: 1,
                    class: "demo-pill"
                  }, "设计预览"))
                : _createCommentVNode("", true)
            ]),
            _createElementVNode("div", { class: "account-quick" }, [
              _createElementVNode("button", { onClick: $event => (go('/orders')) }, [_createVNode(_component_Icon, { name: "order" }), _createElementVNode("span", null, "我的订单")], 8, ["onClick"]),
              _createElementVNode("button", { onClick: $event => (go('/cart')) }, [_createVNode(_component_Icon, { name: "cart" }), _createElementVNode("span", null, "购物车")], 8, ["onClick"]),
              _createElementVNode("button", { onClick: $event => (go('/apply')) }, [_createVNode(_component_Icon, { name: "store" }), _createElementVNode("span", null, "商户入驻")], 8, ["onClick"]),
              _createElementVNode("button", { onClick: $event => (go('/invitations')) }, [_createVNode(_component_Icon, { name: "users" }), _createElementVNode("span", null, "邀请")], 8, ["onClick"])
            ]),
            _createElementVNode("div", { class: "account-section-head" }, [_createElementVNode("h2", null, "入驻记录"), _createElementVNode("button", { onClick: $event => (go('/apply')) }, [_createTextVNode("去申请 "), _createVNode(_component_Icon, {
              name: "chevronRight",
              size: 15
            }, null, 8, ["size"])], 8, ["onClick"])]),
            error
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "inline-error"
                }, _toDisplayString(error), 1))
              : _createCommentVNode("", true),
            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(apps, (a) => {
              return (_openBlock(), _createElementBlock("div", {
                class: "account-application",
                key: a.applicationId
              }, [_createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(a.merchantName), 1), _createElementVNode("span", null, _toDisplayString(a.storeName) + " · " + _toDisplayString(a.location), 1)]), _createElementVNode("b", { class: _normalizeClass(["status-tag", a.status==='APPROVED'?'published':'draft']) }, _toDisplayString(label(a.status)), 3), (a.rejectionReason)
                ? (_openBlock(), _createElementBlock("p", { key: 0 }, _toDisplayString(a.rejectionReason), 1))
                : _createCommentVNode("", true)]))
            }), 128)),
            (!apps.length&&!error)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "mobile-empty"
                }, "暂无入驻记录"))
              : _createCommentVNode("", true),
            (!preview&&pageInfo.total>0)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 2,
                  class: "sdd-pager"
                }, [
                  _createElementVNode("span", null, _toDisplayString(pageInfo.total) + " 条", 1),
                  _createElementVNode("button", {
                    disabled: page<=1,
                    onClick: $event => (page--)
                  }, "上一页", 8, ["disabled", "onClick"]),
                  _createElementVNode("span", null, _toDisplayString(page), 1),
                  _createElementVNode("button", {
                    disabled: !pageInfo.hasNext,
                    onClick: $event => (page++)
                  }, "下一页", 8, ["disabled", "onClick"])
                ]))
              : _createCommentVNode("", true)
          ], 64))
        : isApply
          ? (_openBlock(), _createElementBlock("form", {
              key: 1,
              class: "account-form detail-card",
              onSubmit: _withModifiers(submit, ["prevent"])
            }, [
              _createElementVNode("label", null, [_createTextVNode("经营名称"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((form.merchantName) = $event),
                required: "",
                maxlength: "100",
                placeholder: "商户名称"
              }, null, 8, ["onUpdate:modelValue"]), [[
                _vModelText,
                form.merchantName,
                void 0,
                { trim: true }
              ]])]),
              _createElementVNode("label", null, [_createTextVNode("经营品类"), _withDirectives(_createElementVNode("select", { "onUpdate:modelValue": $event => ((form.category) = $event) }, [
                _createElementVNode("option", null, "便利零售"),
                _createElementVNode("option", null, "水果生鲜"),
                _createElementVNode("option", null, "文具用品"),
                _createElementVNode("option", null, "饮品"),
                _createElementVNode("option", null, "其他")
              ], 8, ["onUpdate:modelValue"]), [[_vModelSelect, form.category]])]),
              _createElementVNode("label", null, [_createTextVNode("联系人"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((form.contactName) = $event),
                required: "",
                maxlength: "60"
              }, null, 8, ["onUpdate:modelValue"]), [[
                _vModelText,
                form.contactName,
                void 0,
                { trim: true }
              ]])]),
              _createElementVNode("label", null, [_createTextVNode("联系电话"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((form.contactPhone) = $event),
                required: "",
                maxlength: "30"
              }, null, 8, ["onUpdate:modelValue"]), [[
                _vModelText,
                form.contactPhone,
                void 0,
                { trim: true }
              ]])]),
              _createElementVNode("label", null, [_createTextVNode("首个门店名称"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((form.storeName) = $event),
                required: "",
                maxlength: "100"
              }, null, 8, ["onUpdate:modelValue"]), [[
                _vModelText,
                form.storeName,
                void 0,
                { trim: true }
              ]])]),
              _createElementVNode("label", null, [_createTextVNode("自提位置"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((form.location) = $event),
                required: "",
                maxlength: "200",
                placeholder: "如：学一食堂一层"
              }, null, 8, ["onUpdate:modelValue"]), [[
                _vModelText,
                form.location,
                void 0,
                { trim: true }
              ]])]),
              _createElementVNode("button", {
                class: "teal-button",
                type: "submit",
                disabled: preview||busy||!store.user
              }, _toDisplayString(!store.user&&!preview?'请先登录':'提交入驻申请'), 9, ["disabled"])
            ], 40, ["onSubmit"]))
          : (_openBlock(), _createElementBlock("section", {
              key: 2,
              class: "detail-card"
            }, [_createElementVNode("h2", null, "待处理邀请"), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(invitations, (i) => {
              return (_openBlock(), _createElementBlock("div", {
                class: "invitation-line",
                key: i.id
              }, [_createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(i.merchantId), 1), _createElementVNode("small", null, _toDisplayString(label(i.status)), 1)]), _createElementVNode("button", {
                class: "outline-button",
                disabled: preview||busy||i.status!=='PENDING',
                onClick: $event => (accept(i))
              }, "接受", 8, ["disabled", "onClick"])]))
            }), 128)), (!invitations.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "mobile-empty"
                }, "暂无邀请"))
              : _createCommentVNode("", true)])), login
        ? (_openBlock(), _createBlock(_component_AuthDialog, {
            key: 3,
            onClose: $event => (login=false),
            onSuccess: load
          }, null, 8, ["onClose", "onSuccess"]))
        : _createCommentVNode("", true)]),
      _: 1
    }))
  }
};
M_pages_MerchantOps_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_BackofficeShell = _resolveComponent("BackofficeShell")

    return (_openBlock(), _createBlock(_component_BackofficeShell, {
      role: "merchant",
      title: title
    }, {
      actions: _withCtx(() => [_createElementVNode("button", {
        class: "outline-button small",
        onClick: load
      }, [_createVNode(_component_Icon, {
        name: "refresh",
        size: 16
      }, null, 8, ["size"]), _createTextVNode("刷新")], 8, ["onClick"])]),
      default: _withCtx(() => [error
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "inline-error"
          }, _toDisplayString(error), 1))
        : _createCommentVNode("", true), restricted
        ? (_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "ops-card access-denied"
          }, [_createVNode(_component_Icon, {
            name: "shield",
            size: 32
          }, null, 8, ["size"]), _createElementVNode("h2", null, "无权限访问")]))
        : (route==='/merchant')
          ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [stats
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "ops-kpis"
                }, [
                  _createElementVNode("div", null, [_createElementVNode("span", null, "订单总数"), _createElementVNode("strong", null, _toDisplayString(stats.totalOrders||0), 1)]),
                  _createElementVNode("div", null, [_createElementVNode("span", null, "待处理"), _createElementVNode("strong", null, _toDisplayString(stats.pendingCount||0), 1)]),
                  _createElementVNode("div", null, [_createElementVNode("span", null, "已完成"), _createElementVNode("strong", null, _toDisplayString(stats.completedCount||0), 1)]),
                  _createElementVNode("div", null, [_createElementVNode("span", null, "完成金额"), _createElementVNode("strong", null, _toDisplayString(money(stats.completedAmountCent)), 1)])
                ]))
              : _createCommentVNode("", true), _createElementVNode("div", { class: "ops-grid" }, [_createElementVNode("section", { class: "ops-card" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "最近订单"), _createElementVNode("button", { onClick: $event => (go('/merchant/orders')) }, [_createTextVNode("查看全部 "), _createVNode(_component_Icon, {
              name: "chevronRight",
              size: 15
            }, null, 8, ["size"])], 8, ["onClick"])]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(topOrders, (o) => {
              return (_openBlock(), _createElementBlock("div", {
                class: "ops-list-line",
                key: o.orderId
              }, [
                _createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, {
                  name: "order",
                  size: 19
                }, null, 8, ["size"])]),
                _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(o.items?.[0]?.title||'校园订单'), 1), _createElementVNode("small", null, _toDisplayString(o.orderId) + " · " + _toDisplayString(dateTime(o.createdAt)), 1)]),
                _createElementVNode("b", null, _toDisplayString(money(o.totalCent)), 1),
                _createElementVNode("span", { class: _normalizeClass(["status-tag", o.status==='COMPLETED'?'published':'draft']) }, _toDisplayString(label(o.status)), 3)
              ]))
            }), 128)), (!topOrders.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-empty"
                }, "暂无订单"))
              : _createCommentVNode("", true)]), _createElementVNode("section", { class: "ops-card" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "快捷操作")]), _createElementVNode("div", { class: "ops-quick" }, [
              (can('product.read'))
                ? (_openBlock(), _createElementBlock("button", {
                    key: 0,
                    onClick: $event => (go('/merchant/products'))
                  }, [_createVNode(_component_Icon, { name: "package" }), _createTextVNode("商品管理")], 8, ["onClick"]))
                : _createCommentVNode("", true),
              (can('stock.read'))
                ? (_openBlock(), _createElementBlock("button", {
                    key: 1,
                    onClick: $event => (go('/merchant/inventory'))
                  }, [_createVNode(_component_Icon, { name: "box" }), _createTextVNode("库存管理")], 8, ["onClick"]))
                : _createCommentVNode("", true),
              (can('pickup.verify'))
                ? (_openBlock(), _createElementBlock("button", {
                    key: 2,
                    onClick: $event => (go('/merchant/pickup'))
                  }, [_createVNode(_component_Icon, { name: "scan" }), _createTextVNode("核销")], 8, ["onClick"]))
                : _createCommentVNode("", true),
              (can('knowledge.read'))
                ? (_openBlock(), _createElementBlock("button", {
                    key: 3,
                    onClick: $event => (go('/merchant/knowledge'))
                  }, [_createVNode(_component_Icon, { name: "book" }), _createTextVNode("知识库")], 8, ["onClick"]))
                : _createCommentVNode("", true)
            ])])])], 64))
          : (route==='/merchant/inventory')
            ? (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "ops-grid inventory-grid"
              }, [_createElementVNode("section", { class: "ops-card" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "库存清单"), _createElementVNode("span", null, _toDisplayString(preview?skuRows.length:pageInfo.total) + " SKU", 1)]), _createElementVNode("label", { class: "ops-search" }, [_createVNode(_component_Icon, {
                name: "search",
                size: 17
              }, null, 8, ["size"]), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((q) = $event),
                placeholder: "商品 / SKU"
              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, q]])]), _createElementVNode("div", { class: "ops-table-wrap" }, [_createElementVNode("table", { class: "ops-table" }, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
                _createElementVNode("th", null, "商品 / 规格"),
                _createElementVNode("th", null, "实物"),
                _createElementVNode("th", null, "预占"),
                _createElementVNode("th", null, "可售"),
                _createElementVNode("th", null, "操作")
              ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList((preview?skuRows.filter(r=>!q||r.product.title.includes(q)||r.sku.specKey.includes(q)):skuRows), (row) => {
                return (_openBlock(), _createElementBlock("tr", {
                  key: row.sku.skuId,
                  class: _normalizeClass({active:sku===row.sku.skuId})
                }, [
                  _createElementVNode("td", null, [_createElementVNode("div", { class: "table-product-cell" }, [_createVNode(_component_ProductImage, {
                    src: row.product.imageUrl,
                    alt: row.product.title
                  }, null, 8, ["src", "alt"]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(row.product.title), 1), _createElementVNode("span", null, _toDisplayString(row.sku.specKey), 1)])])]),
                  _createElementVNode("td", null, _toDisplayString(row.stock?.onHand??'—'), 1),
                  _createElementVNode("td", null, _toDisplayString(row.stock?.reserved??'—'), 1),
                  _createElementVNode("td", { class: _normalizeClass({'red-text':Number(row.stock?.available||0)<10}) }, _toDisplayString(row.stock?.available??'—'), 3),
                  _createElementVNode("td", null, [(can('stock.replenish'))
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "row-link",
                        onClick: $event => (sku=row.sku.skuId)
                      }, "补货", 8, ["onClick"]))
                    : _createCommentVNode("", true)])
                ], 2))
              }), 128))])])])]), _createElementVNode("section", { class: "ops-card ops-sideform" }, [(can('stock.replenish'))
                ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [_createElementVNode("h2", null, "库存补货"), _createElementVNode("form", { onSubmit: _withModifiers(replenish, ["prevent"]) }, [
                    _createElementVNode("label", { class: "field-label" }, "SKU"),
                    _withDirectives(_createElementVNode("select", {
                      class: "admin-input",
                      "onUpdate:modelValue": $event => ((sku) = $event),
                      required: ""
                    }, [_createElementVNode("option", {
                      disabled: "",
                      value: ""
                    }, "选择规格"), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(skuRows, (row) => {
                      return (_openBlock(), _createElementBlock("option", {
                        key: row.sku.skuId,
                        value: row.sku.skuId
                      }, _toDisplayString(row.product.title) + " · " + _toDisplayString(row.sku.specKey), 9, ["value"]))
                    }), 128))], 8, ["onUpdate:modelValue"]), [[_vModelSelect, sku]]),
                    _createElementVNode("label", { class: "field-label" }, "补货数量"),
                    _withDirectives(_createElementVNode("input", {
                      type: "number",
                      class: "admin-input",
                      "onUpdate:modelValue": $event => ((amount) = $event),
                      min: "1",
                      max: "1000000",
                      required: ""
                    }, null, 8, ["onUpdate:modelValue"]), [[
                      _vModelText,
                      amount,
                      void 0,
                      { number: true }
                    ]]),
                    _createElementVNode("button", {
                      class: "teal-button",
                      type: "submit",
                      disabled: !canAct
                    }, "确认补货", 8, ["disabled"])
                  ], 40, ["onSubmit"])], 64))
                : _createCommentVNode("", true), _createElementVNode("div", { class: "ops-card-header compact" }, [_createElementVNode("h3", null, "库存流水")]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(moves.slice(0,8), (m) => {
                return (_openBlock(), _createElementBlock("div", {
                  class: "ops-list-line",
                  key: m.id
                }, [_createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, {
                  name: "box",
                  size: 16
                }, null, 8, ["size"])]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(label(m.type)), 1), _createElementVNode("small", null, _toDisplayString(dateTime(m.createdAt)), 1)]), _createElementVNode("b", null, "+" + _toDisplayString(m.quantity), 1)]))
              }), 128))])]))
            : (route==='/merchant/orders'||route==='/merchant/pickup')
              ? (_openBlock(), _createElementBlock("div", {
                  key: 4,
                  class: "ops-card"
                }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, _toDisplayString(route==='/merchant/pickup'?'交付核销':'订单列表'), 1), _createElementVNode("div", { class: "filter-pills" }, [_createElementVNode("button", {
                  class: _normalizeClass({active:filter===''}),
                  onClick: $event => (filter='')
                }, "全部", 10, ["onClick"]), _createElementVNode("button", {
                  class: _normalizeClass({active:filter==='PAID'}),
                  onClick: $event => (filter='PAID')
                }, "已支付", 10, ["onClick"]), _createElementVNode("button", {
                  class: _normalizeClass({active:filter==='COMPLETED'}),
                  onClick: $event => (filter='COMPLETED')
                }, "已完成", 10, ["onClick"])])]), _createElementVNode("label", { class: "ops-search" }, [_createVNode(_component_Icon, {
                  name: "search",
                  size: 17
                }, null, 8, ["size"]), _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": $event => ((q) = $event),
                  placeholder: "搜索订单号 / 商品"
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, q]])]), _createElementVNode("div", { class: "ops-grid orders-split" }, [_createElementVNode("div", { class: "ops-table-wrap" }, [_createElementVNode("table", { class: "ops-table" }, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
                  _createElementVNode("th", null, "订单"),
                  _createElementVNode("th", null, "商品"),
                  _createElementVNode("th", null, "金额"),
                  _createElementVNode("th", null, "状态"),
                  _createElementVNode("th")
                ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(visibleOrders, (o) => {
                  return (_openBlock(), _createElementBlock("tr", {
                    key: o.orderId,
                    class: _normalizeClass({active:selectedOrder?.orderId===o.orderId}),
                    onClick: $event => (picked=o.orderId)
                  }, [
                    _createElementVNode("td", null, [_createElementVNode("strong", null, "#" + _toDisplayString(o.orderId), 1), _createElementVNode("small", null, _toDisplayString(dateTime(o.createdAt)), 1)]),
                    _createElementVNode("td", null, _toDisplayString(o.items?.[0]?.title||'—'), 1),
                    _createElementVNode("td", null, _toDisplayString(money(o.totalCent)), 1),
                    _createElementVNode("td", null, [_createElementVNode("span", { class: _normalizeClass(["status-tag", o.status==='COMPLETED'?'published':'draft']) }, _toDisplayString(label(o.status)), 3)]),
                    _createElementVNode("td", null, [_createVNode(_component_Icon, {
                      name: "chevronRight",
                      size: 16
                    }, null, 8, ["size"])])
                  ], 10, ["onClick"]))
                }), 128))])]), (!visibleOrders.length)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "admin-empty"
                    }, "暂无订单"))
                  : _createCommentVNode("", true)]), selectedOrder
                  ? (_openBlock(), _createElementBlock("aside", {
                      key: 0,
                      class: "order-inspector"
                    }, [
                      _createElementVNode("h2", null, "订单详情"),
                      _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "订单编号"), _createElementVNode("strong", null, _toDisplayString(selectedOrder.orderId), 1)]),
                      _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "订单状态"), _createElementVNode("strong", null, _toDisplayString(label(selectedOrder.status)), 1)]),
                      _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "自提进度"), _createElementVNode("strong", null, _toDisplayString(label(selectedOrder.pickup?.status)), 1)]),
                      _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "金额"), _createElementVNode("b", { class: "red-text" }, _toDisplayString(money(selectedOrder.totalCent)), 1)]),
                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(selectedOrder.items, (i) => {
                        return (_openBlock(), _createElementBlock("div", {
                          class: "order-detail-line",
                          key: i.skuId
                        }, [_createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, { name: "package" })]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(i.title), 1), _createElementVNode("small", null, _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity), 1)])]))
                      }), 128)),
                      _createElementVNode("div", { class: "form-buttons" }, [(can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='WAIT_PREP')
                        ? (_openBlock(), _createElementBlock("button", {
                            key: 0,
                            class: "outline-button",
                            disabled: !canAct,
                            onClick: $event => (prepare(selectedOrder,false))
                          }, "开始备货", 8, ["disabled", "onClick"]))
                        : _createCommentVNode("", true), (can('order.prepare')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='PREPARING')
                        ? (_openBlock(), _createElementBlock("button", {
                            key: 1,
                            class: "teal-button",
                            disabled: !canAct,
                            onClick: $event => (prepare(selectedOrder,true))
                          }, "备货完成", 8, ["disabled", "onClick"]))
                        : _createCommentVNode("", true)]),
                      (can('pickup.verify')&&selectedOrder.status==='PAID'&&selectedOrder.pickup?.status==='READY')
                        ? (_openBlock(), _createElementBlock("form", {
                            key: 0,
                            class: "verify-form",
                            onSubmit: _withModifiers($event => (verify(selectedOrder)), ["prevent"])
                          }, [_createElementVNode("label", { class: "field-label" }, "买家自提令牌"), _withDirectives(_createElementVNode("textarea", {
                            class: "admin-input",
                            "onUpdate:modelValue": $event => ((token) = $event),
                            rows: "3",
                            required: "",
                            placeholder: "输入买家自提令牌"
                          }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, token]]), _createElementVNode("button", {
                            type: "submit",
                            class: "teal-button",
                            disabled: !canAct
                          }, "核销自提", 8, ["disabled"])], 40, ["onSubmit"]))
                        : _createCommentVNode("", true)
                    ]))
                  : _createCommentVNode("", true)])]))
              : (route==='/merchant/aftersales')
                ? (_openBlock(), _createElementBlock("section", {
                    key: 5,
                    class: "ops-card"
                  }, [
                    _createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "售后申请"), _createElementVNode("span", null, _toDisplayString(afterSales.length) + " 条", 1)]),
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(afterSales, (s) => {
                      return (_openBlock(), _createElementBlock("div", {
                        class: "ops-list-line",
                        key: s.id
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, { name: "shield" })]),
                        _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(s.orderId), 1), _createElementVNode("small", null, _toDisplayString(s.reason), 1)]),
                        _createElementVNode("span", { class: "status-tag" }, _toDisplayString(label(s.status)), 1),
                        (can('aftersale.review'))
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 0,
                              class: "outline-button small",
                              onClick: $event => {decision=s.orderId;reason=''}
                            }, "审核", 8, ["onClick"]))
                          : _createCommentVNode("", true)
                      ]))
                    }), 128)),
                    (!afterSales.length)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "admin-empty"
                        }, "暂无售后"))
                      : _createCommentVNode("", true),
                    (decision&&can('aftersale.review'))
                      ? (_openBlock(), _createElementBlock("form", {
                          key: 1,
                          class: "review-inline",
                          onSubmit: _withModifiers($event => (decisionAction(afterSales.find(s=>s.orderId===decision),true)), ["prevent"])
                        }, [_createElementVNode("h3", null, "售后审核 · " + _toDisplayString(decision), 1), _withDirectives(_createElementVNode("textarea", {
                          class: "admin-input",
                          rows: "3",
                          "onUpdate:modelValue": $event => ((reason) = $event),
                          maxlength: "500",
                          required: "",
                          placeholder: "审核说明（必填）"
                        }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, reason]]), _createElementVNode("div", { class: "form-buttons" }, [_createElementVNode("button", {
                          type: "button",
                          class: "outline-button",
                          disabled: !canAct||!reason.trim(),
                          onClick: $event => (decisionAction(afterSales.find(s=>s.orderId===decision),false))
                        }, "驳回", 8, ["disabled", "onClick"]), _createElementVNode("button", {
                          type: "submit",
                          class: "teal-button",
                          disabled: !canAct||!reason.trim()
                        }, "同意退款", 8, ["disabled"])])], 40, ["onSubmit"]))
                      : _createCommentVNode("", true)
                  ]))
                : (route==='/merchant/team')
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 6,
                      class: "ops-grid"
                    }, [_createElementVNode("section", { class: "ops-card" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "成员"), _createElementVNode("span", null, _toDisplayString(members.length) + " 人", 1)]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(members, (m) => {
                      return (_openBlock(), _createElementBlock("div", {
                        class: "ops-list-line",
                        key: m.userId
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, { name: "user" })]),
                        _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(m.userId), 1), _createElementVNode("small", null, _toDisplayString(roles.find(r=>r.code===m.role)?.name||m.role) + " · " + _toDisplayString(label(m.status)), 1)]),
                        (m.role!=='OWNER'&&m.status==='ACTIVE')
                          ? (_openBlock(), _createElementBlock("select", {
                              key: 0,
                              class: "admin-input compact-select",
                              value: m.role,
                              disabled: !canAct,
                              onChange: $event => (assignMember(m,$event.target.value))
                            }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roles.filter(r=>r.code!=='OWNER'), (r) => {
                              return (_openBlock(), _createElementBlock("option", {
                                value: r.code,
                                key: r.code
                              }, _toDisplayString(r.name), 9, ["value"]))
                            }), 128))], 40, ["value", "disabled", "onChange"]))
                          : _createCommentVNode("", true),
                        (m.role!=='OWNER')
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 1,
                              class: "outline-button small",
                              disabled: !canAct||!canOwner,
                              onClick: $event => (revoke(m))
                            }, "撤销", 8, ["disabled", "onClick"]))
                          : _createCommentVNode("", true)
                      ]))
                    }), 128))]), _createElementVNode("section", { class: "ops-card ops-sideform" }, [_createElementVNode("h2", null, "邀请店员"), _createElementVNode("form", { onSubmit: _withModifiers(invite, ["prevent"]) }, [_createElementVNode("label", { class: "field-label" }, "已注册用户名"), _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": $event => ((inviteUser) = $event),
                      required: "",
                      maxlength: "32",
                      placeholder: "用户名"
                    }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, inviteUser]]), _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: !canAct||!canOwner
                    }, "发送邀请", 8, ["disabled"])], 40, ["onSubmit"]), _createElementVNode("button", {
                      class: "outline-button small",
                      onClick: $event => (go('/merchant/roles'))
                    }, "管理角色和权限", 8, ["onClick"])])]))
                  : (route==='/merchant/settings')
                    ? (_openBlock(), _createElementBlock("section", {
                        key: 7,
                        class: "ops-card ops-settings"
                      }, [_createElementVNode("h2", null, "门店资料"), _createElementVNode("form", { onSubmit: _withModifiers(saveProfile, ["prevent"]) }, [
                        _createElementVNode("label", null, [_createTextVNode("经营名称"), _withDirectives(_createElementVNode("input", {
                          class: "admin-input",
                          "onUpdate:modelValue": $event => ((profile.name) = $event),
                          required: "",
                          maxlength: "100"
                        }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, profile.name]])]),
                        _createElementVNode("label", null, [_createTextVNode("门店名称"), _withDirectives(_createElementVNode("input", {
                          class: "admin-input",
                          "onUpdate:modelValue": $event => ((profile.storeName) = $event),
                          required: "",
                          maxlength: "100"
                        }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, profile.storeName]])]),
                        _createElementVNode("label", null, [_createTextVNode("自提位置"), _withDirectives(_createElementVNode("input", {
                          class: "admin-input",
                          "onUpdate:modelValue": $event => ((profile.location) = $event),
                          required: "",
                          maxlength: "200"
                        }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, profile.location]])]),
                        _createElementVNode("button", {
                          class: "teal-button",
                          disabled: !canAct||!canOwner,
                          type: "submit"
                        }, "保存设置", 8, ["disabled"])
                      ], 40, ["onSubmit"])]))
                    : _createCommentVNode("", true), (!preview&&['/merchant/orders','/merchant/pickup','/merchant/aftersales','/merchant/inventory'].includes(route)&&pageInfo.total>0)
        ? (_openBlock(), _createElementBlock("div", {
            key: 8,
            class: "sdd-pager"
          }, [
            _createElementVNode("span", null, "共 " + _toDisplayString(pageInfo.total) + " 条", 1),
            _createElementVNode("button", {
              disabled: page<=1,
              onClick: $event => (page--)
            }, "上一页", 8, ["disabled", "onClick"]),
            _createElementVNode("span", null, _toDisplayString(page), 1),
            _createElementVNode("button", {
              disabled: !pageInfo.hasNext,
              onClick: $event => (page++)
            }, "下一页", 8, ["disabled", "onClick"])
          ]))
        : _createCommentVNode("", true)]),
      _: 1
    }, 8, ["title"]))
  }
};
M_pages_Knowledge_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, withCtx: _withCtx, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_BackofficeShell = _resolveComponent("BackofficeShell")

    return (_openBlock(), _createBlock(_component_BackofficeShell, {
      role: role,
      title: "知识库"
    }, {
      actions: _withCtx(() => [canManage
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "head-actions"
          }, [_createElementVNode("button", {
            class: "outline-button small",
            onClick: $event => (newBase=!newBase),
            disabled: !canManage
          }, [_createVNode(_component_Icon, {
            name: "plus",
            size: 16
          }, null, 8, ["size"]), _createTextVNode("新建知识库")], 8, ["onClick", "disabled"]), _createElementVNode("button", {
            class: "teal-button",
            onClick: newDocument,
            disabled: !canManage||!active
          }, [_createVNode(_component_Icon, {
            name: "plus",
            size: 17
          }, null, 8, ["size"]), _createTextVNode("上传文档")], 8, ["onClick", "disabled"])]))
        : _createCommentVNode("", true)]),
      default: _withCtx(() => [error
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "inline-error"
          }, _toDisplayString(error), 1))
        : _createCommentVNode("", true), (canManage&&(newBase||uploading))
        ? (_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "ops-grid kb-forms"
          }, [newBase
            ? (_openBlock(), _createElementBlock("form", {
                key: 0,
                class: "ops-card ops-sideform",
                onSubmit: _withModifiers(create, ["prevent"])
              }, [
                _createElementVNode("h2", null, "新建知识库"),
                _createElementVNode("label", { class: "field-label" }, "名称"),
                _withDirectives(_createElementVNode("input", {
                  class: "admin-input",
                  "onUpdate:modelValue": $event => ((baseName) = $event),
                  maxlength: "100",
                  required: ""
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, baseName]]),
                _createElementVNode("label", { class: "field-label" }, "可见范围"),
                _withDirectives(_createElementVNode("select", {
                  class: "admin-input",
                  "onUpdate:modelValue": $event => ((visibility) = $event)
                }, [_createElementVNode("option", { value: "PUBLIC" }, "公开"), _createElementVNode("option", { value: role==='admin'?'PLATFORM_INTERNAL':'MERCHANT_INTERNAL' }, "内部", 8, ["value"])], 8, ["onUpdate:modelValue"]), [[_vModelSelect, visibility]]),
                _createElementVNode("button", {
                  class: "teal-button",
                  type: "submit",
                  disabled: busy||preview
                }, "创建", 8, ["disabled"])
              ], 40, ["onSubmit"]))
            : _createCommentVNode("", true), uploading
            ? (_openBlock(), _createElementBlock("form", {
                key: 1,
                class: "ops-card ops-sideform",
                onSubmit: _withModifiers(upload, ["prevent"])
              }, [
                _createElementVNode("h2", null, _toDisplayString(versionRoot?'上传新版本':'上传文档'), 1),
                _createElementVNode("label", { class: "field-label" }, "文档标题"),
                _withDirectives(_createElementVNode("input", {
                  class: "admin-input",
                  "onUpdate:modelValue": $event => ((title) = $event),
                  maxlength: "120",
                  required: ""
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, title]]),
                _createElementVNode("label", { class: "field-label" }, "TXT / MD / 文本 PDF · 2MB 内"),
                _createElementVNode("input", {
                  class: "admin-input",
                  type: "file",
                  accept: ".txt,.md,.pdf",
                  onChange: chooseFile,
                  required: ""
                }, null, 40, ["onChange"]),
                _createElementVNode("button", {
                  class: "teal-button",
                  type: "submit",
                  disabled: busy||preview||!file
                }, "上传并索引", 8, ["disabled"])
              ], 40, ["onSubmit"]))
            : _createCommentVNode("", true)]))
        : _createCommentVNode("", true), (!canRead)
        ? (_openBlock(), _createElementBlock("div", {
            key: 2,
            class: "ops-card access-denied"
          }, "当前账号没有知识库查看权限。"))
        : (_openBlock(), _createElementBlock("div", {
            key: 3,
            class: "knowledge-layout"
          }, [_createElementVNode("section", { class: "ops-card kb-list" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "知识库"), _createElementVNode("span", null, _toDisplayString(bases.length), 1)]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(bases, (b) => {
            return (_openBlock(), _createElementBlock("button", {
              key: b.id,
              class: _normalizeClass(["kb-base", {active:active===b.id}]),
              onClick: $event => {active=b.id;docPage=1;loadDocs()}
            }, [_createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, { name: "book" })]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(b.name), 1), _createElementVNode("small", null, _toDisplayString(label(b.visibility)), 1)]), _createVNode(_component_Icon, {
              name: "chevronRight",
              size: 16
            }, null, 8, ["size"])], 10, ["onClick"]))
          }), 128)), (!bases.length)
            ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "admin-empty"
              }, "暂无知识库"))
            : _createCommentVNode("", true)]), _createElementVNode("section", { class: "ops-card kb-docs" }, [
            _createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, _toDisplayString(current?.name||'文档'), 1), _createElementVNode("span", null, _toDisplayString(docs.length) + " 项", 1)]),
            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(docs, (d) => {
              return (_openBlock(), _createElementBlock("div", {
                class: _normalizeClass(["kb-doc", {active:selected?.id===d.id}]),
                key: d.id
              }, [_createElementVNode("button", { onClick: $event => (read(d)) }, [_createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, { name: "clipboard" })]), _createElementVNode("span", null, [_createElementVNode("strong", null, _toDisplayString(d.title), 1), _createElementVNode("small", null, "v" + _toDisplayString(d.version) + " · " + _toDisplayString(dateTime(d.createdAt)), 1)])], 8, ["onClick"]), _createElementVNode("span", { class: _normalizeClass(["status-tag", d.status==='PUBLISHED'?'published':'draft']) }, _toDisplayString(label(d.status)), 3), canManage
                ? (_openBlock(), _createElementBlock("span", {
                    key: 0,
                    class: "kb-doc-actions"
                  }, [
                    _createElementVNode("button", {
                      disabled: busy||preview,
                      onClick: $event => (newVersion(d)),
                      title: "上传新版本",
                      "aria-label": "上传新版本"
                    }, [_createVNode(_component_Icon, {
                      name: "plus",
                      size: 15
                    }, null, 8, ["size"])], 8, ["disabled", "onClick"]),
                    _createElementVNode("button", {
                      disabled: busy||preview,
                      onClick: $event => (action(d,'index')),
                      title: "重建索引",
                      "aria-label": "重建索引"
                    }, [_createVNode(_component_Icon, {
                      name: "refresh",
                      size: 15
                    }, null, 8, ["size"])], 8, ["disabled", "onClick"]),
                    _createElementVNode("button", {
                      disabled: busy||preview||d.indexStatus!=='READY'||d.status==='PUBLISHED',
                      onClick: $event => (action(d,'publish')),
                      title: "发布",
                      "aria-label": "发布文档"
                    }, [_createVNode(_component_Icon, {
                      name: "check",
                      size: 15
                    }, null, 8, ["size"])], 8, ["disabled", "onClick"]),
                    _createElementVNode("button", {
                      disabled: busy||preview||d.status!=='PUBLISHED',
                      onClick: $event => (action(d,'withdraw')),
                      title: "撤回",
                      "aria-label": "撤回文档"
                    }, [_createVNode(_component_Icon, {
                      name: "x",
                      size: 15
                    }, null, 8, ["size"])], 8, ["disabled", "onClick"])
                  ]))
                : _createCommentVNode("", true)], 2))
            }), 128)),
            (!docs.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-empty"
                }, "暂无文档"))
              : _createCommentVNode("", true),
            (!preview&&docInfo.total>0)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "sdd-pager"
                }, [
                  _createElementVNode("span", null, _toDisplayString(docInfo.total) + " 项", 1),
                  _createElementVNode("button", {
                    disabled: docPage<=1,
                    onClick: $event => (docPage--)
                  }, "上一页", 8, ["disabled", "onClick"]),
                  _createElementVNode("span", null, _toDisplayString(docPage), 1),
                  _createElementVNode("button", {
                    disabled: !docInfo.hasNext,
                    onClick: $event => (docPage++)
                  }, "下一页", 8, ["disabled", "onClick"])
                ]))
              : _createCommentVNode("", true)
          ]), _createElementVNode("section", { class: "ops-card kb-preview" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "文档预览"), selected
            ? (_openBlock(), _createElementBlock("button", {
                key: 0,
                onClick: $event => {selected=null;text=''},
                "aria-label": "关闭"
              }, [_createVNode(_component_Icon, {
                name: "x",
                size: 18
              }, null, 8, ["size"])], 8, ["onClick"]))
            : _createCommentVNode("", true)]), selected
            ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                _createElementVNode("div", { class: "kb-title" }, [_createVNode(_component_Icon, {
                  name: "book",
                  size: 22
                }, null, 8, ["size"]), _createElementVNode("strong", null, _toDisplayString(selected.title), 1)]),
                _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "版本"), _createElementVNode("strong", null, "v" + _toDisplayString(selected.version), 1)]),
                _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "索引"), _createElementVNode("strong", null, _toDisplayString(label(selected.indexStatus)), 1)]),
                _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "状态"), _createElementVNode("strong", null, _toDisplayString(label(selected.status)), 1)]),
                (selected.error)
                  ? (_openBlock(), _createElementBlock("p", {
                      key: 0,
                      class: "inline-error"
                    }, _toDisplayString(selected.error), 1))
                  : _createCommentVNode("", true),
                _createElementVNode("pre", { class: "document-preview" }, _toDisplayString(text||'该版本暂无可显示的正文'), 1)
              ], 64))
            : (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "admin-empty"
              }, "选择文档查看"))])]))]),
      _: 1
    }, 8, ["role"]))
  }
};
M_pages_Platform_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, normalizeClass: _normalizeClass, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_ProductImage = _resolveComponent("ProductImage")
    const _component_BackofficeShell = _resolveComponent("BackofficeShell")

    return (_openBlock(), _createBlock(_component_BackofficeShell, {
      role: "admin",
      title: title
    }, {
      actions: _withCtx(() => [_createElementVNode("button", {
        class: "outline-button small",
        onClick: load
      }, [_createVNode(_component_Icon, {
        name: "refresh",
        size: 16
      }, null, 8, ["size"]), _createTextVNode("刷新")], 8, ["onClick"])]),
      default: _withCtx(() => [error
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "inline-error"
          }, _toDisplayString(error), 1))
        : _createCommentVNode("", true), (!allowed&&!preview)
        ? (_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "ops-card access-denied"
          }, [_createVNode(_component_Icon, {
            name: "shield",
            size: 38
          }, null, 8, ["size"]), _createElementVNode("h2", null, "无权限访问")]))
        : (route==='/admin')
          ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [stats
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "ops-kpis"
                }, [
                  _createElementVNode("div", null, [_createElementVNode("span", null, "全部订单"), _createElementVNode("strong", null, _toDisplayString(stats.totalOrders||0), 1)]),
                  _createElementVNode("div", null, [_createElementVNode("span", null, "待付款"), _createElementVNode("strong", null, _toDisplayString(stats.pendingCount||0), 1)]),
                  _createElementVNode("div", null, [_createElementVNode("span", null, "已完成"), _createElementVNode("strong", null, _toDisplayString(stats.completedCount||0), 1)]),
                  _createElementVNode("div", null, [_createElementVNode("span", null, "模拟交易金额"), _createElementVNode("strong", null, _toDisplayString(money(stats.completedAmountCent)), 1)])
                ]))
              : _createCommentVNode("", true), _createElementVNode("div", { class: "ops-grid" }, [_createElementVNode("section", { class: "ops-card" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "近期订单"), _createElementVNode("button", { onClick: $event => (go('/admin/orders')) }, [_createTextVNode("全部 "), _createVNode(_component_Icon, {
              name: "chevronRight",
              size: 16
            }, null, 8, ["size"])], 8, ["onClick"])]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(orders.slice(0,6), (o) => {
              return (_openBlock(), _createElementBlock("div", {
                class: "ops-list-line",
                key: o.orderId
              }, [
                _createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, { name: "order" })]),
                _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(o.orderId), 1), _createElementVNode("small", null, _toDisplayString(dateTime(o.createdAt)), 1)]),
                _createElementVNode("b", null, _toDisplayString(money(o.totalCent)), 1),
                _createElementVNode("span", { class: "status-tag" }, _toDisplayString(label(o.status)), 1)
              ]))
            }), 128)), (!orders.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-empty"
                }, "暂无订单"))
              : _createCommentVNode("", true)]), _createElementVNode("section", { class: "ops-card" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "运营入口")]), _createElementVNode("div", { class: "ops-quick" }, [
              _createElementVNode("button", { onClick: $event => (go('/admin/applications')) }, [_createVNode(_component_Icon, { name: "store" }), _createTextVNode("商户审核")], 8, ["onClick"]),
              _createElementVNode("button", { onClick: $event => (go('/admin/merchants')) }, [_createVNode(_component_Icon, { name: "users" }), _createTextVNode("商户监管")], 8, ["onClick"]),
              _createElementVNode("button", { onClick: $event => (go('/admin/disputes')) }, [_createVNode(_component_Icon, { name: "shield" }), _createTextVNode("争议处理")], 8, ["onClick"]),
              _createElementVNode("button", { onClick: $event => (go('/admin/knowledge')) }, [_createVNode(_component_Icon, { name: "book" }), _createTextVNode("知识库")], 8, ["onClick"])
            ])])])], 64))
          : (route==='/admin/applications')
            ? (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "ops-grid admin-review-grid"
              }, [_createElementVNode("section", { class: "ops-card" }, [
                _createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "入驻申请"), _createElementVNode("span", null, _toDisplayString(preview?applications.length:pageInfo.total) + " 条", 1)]),
                _createElementVNode("div", { class: "ops-toolbar" }, [_createElementVNode("label", { class: "ops-search" }, [_createVNode(_component_Icon, {
                  name: "search",
                  size: 16
                }, null, 8, ["size"]), _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": $event => ((search) = $event),
                  placeholder: "商户 / 申请人"
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, search]])]), _withDirectives(_createElementVNode("select", {
                  class: "admin-input compact-select",
                  "onUpdate:modelValue": $event => ((state) = $event)
                }, [
                  _createElementVNode("option", { value: "" }, "全部状态"),
                  _createElementVNode("option", { value: "SUBMITTED" }, "待审核"),
                  _createElementVNode("option", { value: "APPROVED" }, "已通过"),
                  _createElementVNode("option", { value: "REJECTED" }, "已拒绝")
                ], 8, ["onUpdate:modelValue"]), [[_vModelSelect, state]])]),
                _createElementVNode("div", { class: "ops-table-wrap" }, [_createElementVNode("table", { class: "ops-table" }, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
                  _createElementVNode("th", null, "商户"),
                  _createElementVNode("th", null, "申请人"),
                  _createElementVNode("th", null, "门店"),
                  _createElementVNode("th", null, "状态"),
                  _createElementVNode("th")
                ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(filtered, (a) => {
                  return (_openBlock(), _createElementBlock("tr", {
                    key: a.applicationId,
                    class: _normalizeClass({active:pickedApplication?.applicationId===a.applicationId}),
                    onClick: $event => (selectApplication(a))
                  }, [
                    _createElementVNode("td", null, [_createElementVNode("strong", null, _toDisplayString(a.merchantName), 1), _createElementVNode("small", null, _toDisplayString(a.category), 1)]),
                    _createElementVNode("td", null, _toDisplayString(a.contactName), 1),
                    _createElementVNode("td", null, _toDisplayString(a.storeName), 1),
                    _createElementVNode("td", null, [_createElementVNode("span", { class: _normalizeClass(["status-tag", a.status==='APPROVED'?'published':'draft']) }, _toDisplayString(label(a.status)), 3)]),
                    _createElementVNode("td", null, [_createVNode(_component_Icon, {
                      name: "chevronRight",
                      size: 16
                    }, null, 8, ["size"])])
                  ], 10, ["onClick"]))
                }), 128))])])]),
                (!filtered.length)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "admin-empty"
                    }, "无符合条件的申请"))
                  : _createCommentVNode("", true)
              ]), pickedApplication
                ? (_openBlock(), _createElementBlock("aside", {
                    key: 0,
                    class: "ops-card ops-sideform"
                  }, [
                    _createElementVNode("h2", null, _toDisplayString(pickedApplication.merchantName), 1),
                    _createElementVNode("span", { class: "status-tag" }, _toDisplayString(label(pickedApplication.status)), 1),
                    _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "申请编号"), _createElementVNode("strong", null, _toDisplayString(pickedApplication.applicationId), 1)]),
                    _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "联系人"), _createElementVNode("strong", null, _toDisplayString(pickedApplication.contactName), 1)]),
                    _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "联系电话"), _createElementVNode("strong", null, _toDisplayString(pickedApplication.contactPhone), 1)]),
                    _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "门店"), _createElementVNode("strong", null, _toDisplayString(pickedApplication.storeName), 1)]),
                    _createElementVNode("div", { class: "inspector-row" }, [_createElementVNode("span", null, "位置"), _createElementVNode("strong", null, _toDisplayString(pickedApplication.location), 1)]),
                    (pickedApplication.rejectionReason)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "inline-error"
                        }, _toDisplayString(pickedApplication.rejectionReason), 1))
                      : _createCommentVNode("", true),
                    (pickedApplication.status==='SUBMITTED')
                      ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [_createElementVNode("label", { class: "field-label" }, "审核意见"), _withDirectives(_createElementVNode("textarea", {
                          class: "admin-input",
                          "onUpdate:modelValue": $event => ((reason) = $event),
                          rows: "3",
                          maxlength: "500",
                          placeholder: "拒绝时必须填写原因"
                        }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, reason]]), _createElementVNode("div", { class: "form-buttons" }, [_createElementVNode("button", {
                          class: "outline-button",
                          disabled: preview||busy||!reason.trim(),
                          onClick: $event => (review(false))
                        }, "驳回", 8, ["disabled", "onClick"]), _createElementVNode("button", {
                          class: "teal-button",
                          disabled: preview||busy,
                          onClick: $event => (review(true))
                        }, "通过审核", 8, ["disabled", "onClick"])])], 64))
                      : _createCommentVNode("", true)
                  ]))
                : _createCommentVNode("", true)]))
            : (route==='/admin/merchants')
              ? (_openBlock(), _createElementBlock("section", {
                  key: 4,
                  class: "ops-card"
                }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "商户列表"), _createElementVNode("span", null, _toDisplayString(preview?merchants.length:pageInfo.total) + " 家", 1)]), _createElementVNode("label", { class: "ops-search" }, [_createVNode(_component_Icon, {
                  name: "search",
                  size: 17
                }, null, 8, ["size"]), _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": $event => ((search) = $event),
                  placeholder: "搜索经营名称"
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, search]])]), _createElementVNode("div", { class: "ops-table-wrap" }, [_createElementVNode("table", { class: "ops-table" }, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
                  _createElementVNode("th", null, "商户"),
                  _createElementVNode("th", null, "品类"),
                  _createElementVNode("th", null, "首个门店"),
                  _createElementVNode("th", null, "自提位置"),
                  _createElementVNode("th", null, "状态"),
                  _createElementVNode("th", null, "操作")
                ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(filtered, (m) => {
                  return (_openBlock(), _createElementBlock("tr", { key: m.merchantId }, [
                    _createElementVNode("td", null, [_createElementVNode("strong", null, _toDisplayString(m.name), 1), _createElementVNode("small", null, _toDisplayString(m.merchantId), 1)]),
                    _createElementVNode("td", null, _toDisplayString(m.category), 1),
                    _createElementVNode("td", null, _toDisplayString(m.storeName), 1),
                    _createElementVNode("td", null, _toDisplayString(m.location), 1),
                    _createElementVNode("td", null, [_createElementVNode("span", { class: _normalizeClass(["status-tag", m.status==='ACTIVE'?'published':'draft']) }, _toDisplayString(label(m.status)), 3)]),
                    _createElementVNode("td", null, [_createElementVNode("button", {
                      class: "row-link",
                      disabled: preview||busy,
                      onClick: $event => (stateMerchant(m))
                    }, _toDisplayString(m.status==='ACTIVE'?'停用':'恢复'), 9, ["disabled", "onClick"])])
                  ]))
                }), 128))])])])]))
              : (route==='/admin/products')
                ? (_openBlock(), _createElementBlock("section", {
                    key: 5,
                    class: "ops-card"
                  }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "商品监管"), _createElementVNode("span", null, _toDisplayString(preview?products.length:pageInfo.total) + " 件", 1)]), _createElementVNode("label", { class: "ops-search" }, [_createVNode(_component_Icon, {
                    name: "search",
                    size: 17
                  }, null, 8, ["size"]), _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": $event => ((search) = $event),
                    placeholder: "搜索商品 / 商户"
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, search]])]), _createElementVNode("div", { class: "ops-table-wrap" }, [_createElementVNode("table", { class: "ops-table" }, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
                    _createElementVNode("th", null, "商品"),
                    _createElementVNode("th", null, "商户"),
                    _createElementVNode("th", null, "分类"),
                    _createElementVNode("th", null, "售价"),
                    _createElementVNode("th", null, "状态"),
                    _createElementVNode("th", null, "操作")
                  ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(filtered, (p) => {
                    return (_openBlock(), _createElementBlock("tr", { key: p.productId }, [
                      _createElementVNode("td", null, [_createElementVNode("div", { class: "table-product-cell" }, [_createVNode(_component_ProductImage, {
                        src: p.imageUrl,
                        alt: p.title
                      }, null, 8, ["src", "alt"]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(p.title), 1), _createElementVNode("span", null, _toDisplayString(p.productId), 1)])])]),
                      _createElementVNode("td", null, _toDisplayString(merchantName(p.merchantId,p)), 1),
                      _createElementVNode("td", null, _toDisplayString(p.categoryCode), 1),
                      _createElementVNode("td", null, _toDisplayString(money(p.skus?.[0]?.priceCent)), 1),
                      _createElementVNode("td", null, [_createElementVNode("span", { class: "status-tag" }, _toDisplayString(label(p.status)), 1)]),
                      _createElementVNode("td", null, [_createElementVNode("button", {
                        class: "row-link",
                        disabled: preview||busy||p.status!=='PUBLISHED',
                        onClick: $event => (forceProduct(p))
                      }, "强制下架", 8, ["disabled", "onClick"])])
                    ]))
                  }), 128))])])])]))
                : (route==='/admin/orders')
                  ? (_openBlock(), _createElementBlock("section", {
                      key: 6,
                      class: "ops-card"
                    }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "订单监管"), _createElementVNode("span", null, _toDisplayString(preview?orders.length:pageInfo.total) + " 笔", 1)]), _createElementVNode("label", { class: "ops-search" }, [_createVNode(_component_Icon, {
                      name: "search",
                      size: 17
                    }, null, 8, ["size"]), _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((search) = $event),
                      placeholder: "订单号"
                    }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, search]])]), _createElementVNode("div", { class: "ops-table-wrap" }, [_createElementVNode("table", { class: "ops-table" }, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
                      _createElementVNode("th", null, "订单"),
                      _createElementVNode("th", null, "商户"),
                      _createElementVNode("th", null, "实付金额"),
                      _createElementVNode("th", null, "状态"),
                      _createElementVNode("th", null, "创建时间")
                    ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(filtered, (o) => {
                      return (_openBlock(), _createElementBlock("tr", { key: o.orderId }, [
                        _createElementVNode("td", null, [_createElementVNode("strong", null, _toDisplayString(o.orderId), 1), _createElementVNode("small", null, _toDisplayString(o.items?.[0]?.title||'—'), 1)]),
                        _createElementVNode("td", null, _toDisplayString(merchantName(o.merchantId,o)), 1),
                        _createElementVNode("td", null, _toDisplayString(money(o.totalCent)), 1),
                        _createElementVNode("td", null, [_createElementVNode("span", { class: "status-tag" }, _toDisplayString(label(o.status)), 1)]),
                        _createElementVNode("td", null, _toDisplayString(dateTime(o.createdAt)), 1)
                      ]))
                    }), 128))])])])]))
                  : (route==='/admin/disputes')
                    ? (_openBlock(), _createElementBlock("section", {
                        key: 7,
                        class: "ops-card"
                      }, [
                        _createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "售后争议"), _createElementVNode("span", null, _toDisplayString(aftersales.length) + " 条", 1)]),
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(aftersales, (a) => {
                          return (_openBlock(), _createElementBlock("div", {
                            class: "ops-list-line dispute-line",
                            key: a.id
                          }, [
                            _createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, { name: "shield" })]),
                            _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(a.orderId), 1), _createElementVNode("small", null, _toDisplayString(a.reason), 1)]),
                            _createElementVNode("span", { class: "status-tag" }, _toDisplayString(label(a.status)), 1),
                            _createElementVNode("button", {
                              class: "outline-button small",
                              onClick: $event => {selectedId=a.id;reason=''}
                            }, "查看处理", 8, ["onClick"])
                          ]))
                        }), 128)),
                        (!aftersales.length)
                          ? (_openBlock(), _createElementBlock("div", {
                              key: 0,
                              class: "admin-empty"
                            }, "暂无争议"))
                          : _createCommentVNode("", true),
                        (selectedId&&aftersales.find(a=>a.id===selectedId))
                          ? (_openBlock(), _createElementBlock("div", {
                              key: 1,
                              class: "review-inline"
                            }, [
                              _createElementVNode("h3", null, "裁决 · " + _toDisplayString(aftersales.find(a=>a.id===selectedId).orderId), 1),
                              _createElementVNode("label", { class: "field-label" }, "裁决说明"),
                              _withDirectives(_createElementVNode("textarea", {
                                class: "admin-input",
                                "onUpdate:modelValue": $event => ((reason) = $event),
                                rows: "3",
                                maxlength: "500",
                                placeholder: "审核说明（必填）"
                              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, reason]]),
                              _createElementVNode("div", { class: "form-buttons" }, [_createElementVNode("button", {
                                class: "outline-button",
                                disabled: preview||busy||!reason.trim(),
                                onClick: $event => (decideRefund(aftersales.find(a=>a.id===selectedId),false))
                              }, "驳回", 8, ["disabled", "onClick"]), _createElementVNode("button", {
                                class: "teal-button",
                                disabled: preview||busy||!reason.trim(),
                                onClick: $event => (decideRefund(aftersales.find(a=>a.id===selectedId),true))
                              }, "批准退款", 8, ["disabled", "onClick"])])
                            ]))
                          : _createCommentVNode("", true)
                      ]))
                    : (route==='/admin/categories')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 8,
                          class: "ops-grid"
                        }, [_createElementVNode("section", { class: "ops-card" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "类目"), _createElementVNode("span", null, _toDisplayString(categories.length) + " 个", 1)]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(categories, (c) => {
                          return (_openBlock(), _createElementBlock("div", {
                            class: "ops-list-line",
                            key: c.code
                          }, [
                            _createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, { name: "grid" })]),
                            _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(c.name), 1), _createElementVNode("small", null, _toDisplayString(c.code), 1)]),
                            _createElementVNode("span", { class: _normalizeClass(["status-tag", c.active?'published':'draft']) }, _toDisplayString(c.active?'启用':'停用'), 3),
                            _createElementVNode("button", {
                              class: "row-link",
                              onClick: $event => (category={code:c.code,name:c.name,active:!c.active}),
                              disabled: preview
                            }, _toDisplayString(c.active?'停用':'恢复'), 9, ["onClick", "disabled"])
                          ]))
                        }), 128))]), _createElementVNode("form", {
                          class: "ops-card ops-sideform",
                          onSubmit: _withModifiers(saveCategory, ["prevent"])
                        }, [
                          _createElementVNode("h2", null, "编辑分类"),
                          _createElementVNode("label", { class: "field-label" }, "编码"),
                          _withDirectives(_createElementVNode("input", {
                            class: "admin-input",
                            "onUpdate:modelValue": $event => ((category.code) = $event),
                            required: "",
                            maxlength: "40"
                          }, null, 8, ["onUpdate:modelValue"]), [[
                            _vModelText,
                            category.code,
                            void 0,
                            { trim: true }
                          ]]),
                          _createElementVNode("label", { class: "field-label" }, "名称"),
                          _withDirectives(_createElementVNode("input", {
                            class: "admin-input",
                            "onUpdate:modelValue": $event => ((category.name) = $event),
                            required: "",
                            maxlength: "60"
                          }, null, 8, ["onUpdate:modelValue"]), [[
                            _vModelText,
                            category.name,
                            void 0,
                            { trim: true }
                          ]]),
                          _createElementVNode("label", { class: "field-label" }, "状态"),
                          _withDirectives(_createElementVNode("select", {
                            class: "admin-input",
                            "onUpdate:modelValue": $event => ((category.active) = $event)
                          }, [_createElementVNode("option", { value: true }, "启用", 8, ["value"]), _createElementVNode("option", { value: false }, "停用", 8, ["value"])], 8, ["onUpdate:modelValue"]), [[_vModelSelect, category.active]]),
                          _createElementVNode("button", {
                            type: "submit",
                            class: "teal-button",
                            disabled: preview||busy
                          }, _toDisplayString(preview?'设计预览':'保存分类'), 9, ["disabled"])
                        ], 40, ["onSubmit"])]))
                      : _createCommentVNode("", true), (!preview&&route!=='/admin'&&route!=='/admin/categories'&&pageInfo.total>0)
        ? (_openBlock(), _createElementBlock("div", {
            key: 9,
            class: "sdd-pager"
          }, [
            _createElementVNode("span", null, "共 " + _toDisplayString(pageInfo.total) + " 条", 1),
            _createElementVNode("button", {
              disabled: page<=1,
              onClick: $event => (page--)
            }, "上一页", 8, ["disabled", "onClick"]),
            _createElementVNode("span", null, _toDisplayString(page), 1),
            _createElementVNode("button", {
              disabled: !pageInfo.hasNext,
              onClick: $event => (page++)
            }, "下一页", 8, ["disabled", "onClick"])
          ]))
        : _createCommentVNode("", true)]),
      _: 1
    }, 8, ["title"]))
  }
};
M_pages_RoleManager_js.default.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, createElementVNode: _createElementVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, createBlock: _createBlock, withModifiers: _withModifiers, withCtx: _withCtx } = _Vue

    const _component_Icon = _resolveComponent("Icon")
    const _component_BackofficeShell = _resolveComponent("BackofficeShell")

    return (_openBlock(), _createBlock(_component_BackofficeShell, {
      role: "merchant",
      title: "角色权限"
    }, {
      actions: _withCtx(() => [canManage
        ? (_openBlock(), _createElementBlock("button", {
            key: 0,
            class: "teal-button",
            onClick: create,
            disabled: preview||busy
          }, [_createVNode(_component_Icon, {
            name: "plus",
            size: 16
          }, null, 8, ["size"]), _createTextVNode("新增自定义角色")], 8, ["onClick", "disabled"]))
        : _createCommentVNode("", true)]),
      default: _withCtx(() => [error
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "inline-error"
          }, _toDisplayString(error), 1))
        : _createCommentVNode("", true), (!canManage)
        ? (_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "ops-card access-denied"
          }, [_createVNode(_component_Icon, {
            name: "shield",
            size: 32
          }, null, 8, ["size"]), _createElementVNode("h2", null, "无权管理角色")]))
        : (_openBlock(), _createElementBlock("div", {
            key: 2,
            class: "ops-grid rbac-layout"
          }, [_createElementVNode("section", { class: "ops-card rbac-roles" }, [_createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, "商户角色"), _createElementVNode("span", null, _toDisplayString(roles.length) + " 个 · " + _toDisplayString(assigned) + " 名成员", 1)]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(roles, (r) => {
            return (_openBlock(), _createElementBlock("button", {
              key: r.code,
              class: _normalizeClass(["rbac-role", {active:selected===r.code}]),
              onClick: $event => (choose(r))
            }, [_createElementVNode("span", { class: "mini-icon" }, [_createVNode(_component_Icon, {
              name: r.builtin?'shield':'users',
              size: 18
            }, null, 8, ["name", "size"])]), _createElementVNode("span", null, [_createElementVNode("strong", null, _toDisplayString(r.name), 1), _createElementVNode("small", null, _toDisplayString(r.builtin?'内置角色':r.permissions.length+' 项权限'), 1)]), _createVNode(_component_Icon, {
              name: "chevronRight",
              size: 16
            }, null, 8, ["size"])], 10, ["onClick"]))
          }), 128)), (!roles.length&&!loading)
            ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "admin-empty"
              }, "暂无角色"))
            : _createCommentVNode("", true)]), _createElementVNode("form", {
            class: "ops-card rbac-editor",
            onSubmit: _withModifiers(save, ["prevent"])
          }, [
            _createElementVNode("div", { class: "ops-card-header" }, [_createElementVNode("h2", null, _toDisplayString(selected?'角色权限':'创建新角色'), 1), (current?.builtin)
              ? (_openBlock(), _createElementBlock("span", {
                  key: 0,
                  class: "status-tag"
                }, "系统内置"))
              : _createCommentVNode("", true)]),
            _createElementVNode("label", { class: "field-label" }, "角色名称"),
            _withDirectives(_createElementVNode("input", {
              class: "admin-input",
              "onUpdate:modelValue": $event => ((name) = $event),
              maxlength: "40",
              required: "",
              disabled: preview||!!current?.builtin||busy,
              placeholder: "例如：商品管理员"
            }, null, 8, ["onUpdate:modelValue", "disabled"]), [[
              _vModelText,
              name,
              void 0,
              { trim: true }
            ]]),
            _createElementVNode("h3", { class: "field-heading" }, [_createTextVNode("权限配置 "), _createElementVNode("span", { class: "rbac-grant-count" }, "已选 " + _toDisplayString(grants.length) + " 项", 1)]),
            _createElementVNode("div", { class: "rbac-permissions" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(permissions, (p) => {
              return (_openBlock(), _createElementBlock("label", {
                key: p.code,
                "data-permission": p.code,
                class: _normalizeClass(["rbac-permission", {protected:!p.grantable}])
              }, [_createElementVNode("input", {
                type: "checkbox",
                checked: checked(p.code),
                disabled: preview||!!current?.builtin||!p.grantable||busy,
                onChange: $event => (toggle(p.code,$event.target.checked))
              }, null, 40, ["checked", "disabled", "onChange"]), _createElementVNode("span", null, [_createElementVNode("strong", null, _toDisplayString(p.label), 1)]), (!p.grantable)
                ? (_openBlock(), _createBlock(_component_Icon, {
                    key: 0,
                    name: "lock",
                    size: 15,
                    title: "仅经营者"
                  }, null, 8, ["size"]))
                : _createCommentVNode("", true)], 10, ["data-permission"]))
            }), 128))]),
            (!current?.builtin)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "form-buttons"
                }, [selected
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      type: "button",
                      class: "outline-button",
                      disabled: preview||busy,
                      onClick: remove
                    }, "删除角色", 8, ["disabled", "onClick"]))
                  : _createCommentVNode("", true), _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: preview||busy||!grants.length||!name.trim()
                }, _toDisplayString(busy?'保存中':'保存角色'), 9, ["disabled"])]))
              : _createCommentVNode("", true)
          ], 40, ["onSubmit"])]))]),
      _: 1
    }))
  }
};
const M_main_js = (()=>{
const Icon = M_components_Icon_js.default;
const Home = M_pages_Home_js.default;
const Guide = M_pages_Guide_js.default;
const Merchant = M_pages_Merchant_js.default;
const ProductDetail = M_pages_ProductDetail_js.default;
const Shop = M_pages_Shop_js.default;
const Cart = M_pages_Cart_js.default;
const Orders = M_pages_Orders_js.default;
const Account = M_pages_Account_js.default;
const MerchantOps = M_pages_MerchantOps_js.default;
const Knowledge = M_pages_Knowledge_js.default;
const Platform = M_pages_Platform_js.default;
const RoleManager = M_pages_RoleManager_js.default;
const {store,setRoute,loadPublic,loadMerchant,loadSession,preview} = M_services_store_js;














const {createApp,onMounted,onUnmounted,watch,computed}=Vue;
const App={
  name:'CampusApp',
  components:{Home,Guide,Merchant,ProductDetail,Shop,Cart,Orders,Account,MerchantOps,Knowledge,Platform,RoleManager},
  setup(){
    const current=computed(()=>{
      const r=store.route;
      if(r==='/merchant/products')return 'Merchant';
      if(r==='/merchant/roles')return 'RoleManager';
      if(r==='/merchant/knowledge'||r==='/admin/knowledge')return 'Knowledge';
      if(r.startsWith('/merchant'))return 'MerchantOps';
      if(r.startsWith('/admin'))return 'Platform';
      if(r.startsWith('/product/'))return 'ProductDetail';
      if(r.startsWith('/shops/'))return 'Shop';
      if(r==='/cart')return 'Cart';
      if(r==='/orders'||r.startsWith('/orders/'))return 'Orders';
      if(['/account','/apply','/invitations'].includes(r))return 'Account';
      if(r==='/ai')return 'Guide';
      return 'Home';
    });
    async function refresh(){
      if(store.route.startsWith('/merchant'))await loadMerchant();
      else if(!store.route.startsWith('/admin'))await loadPublic();
    }
    onMounted(()=>{window.addEventListener('hashchange',setRoute);refresh();if(!preview&&!store.route.startsWith('/merchant'))loadSession();});
    onUnmounted(()=>window.removeEventListener('hashchange',setRoute));
    watch(()=>store.route,refresh);
    return {store,current};
  },
  template:`<div class="application" :class="{'admin-mode':current==='Merchant'||current==='MerchantOps'||current==='Platform'||current==='Knowledge'||current==='RoleManager'}"><component :is="current" :key="store.route"/><div v-if="store.toast" class="toast" role="status">{{store.toast}}</div></div>`
};
App.render=function render(_ctx, _cache) {
  with (_ctx) {
    const { resolveDynamicComponent: _resolveDynamicComponent, openBlock: _openBlock, createBlock: _createBlock, toDisplayString: _toDisplayString, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, normalizeClass: _normalizeClass } = _Vue

    return (_openBlock(), _createElementBlock("div", { class: _normalizeClass(["application", {'admin-mode':current==='Merchant'||current==='MerchantOps'||current==='Platform'||current==='Knowledge'||current==='RoleManager'}]) }, [(_openBlock(), _createBlock(_resolveDynamicComponent(current), { key: store.route })), (store.toast)
      ? (_openBlock(), _createElementBlock("div", {
          key: 0,
          class: "toast",
          role: "status"
        }, _toDisplayString(store.toast), 1))
      : _createCommentVNode("", true)], 2))
  }
};
const app=createApp(App);
app.component('Icon',Icon);
app.mount('#app');

return {};
})();
