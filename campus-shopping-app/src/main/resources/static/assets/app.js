/* 校园集市：三个角色工作台共用同源 API；浏览器不保存口令或授权声明。 */
'use strict';
(() => {
  const {createApp, reactive, computed, onMounted, nextTick} = Vue;
  const PREFIX='/api/v1';
  const e=encodeURIComponent;
  const stateNames={ACTIVE:'正常',SUSPENDED:'暂停经营',SUBMITTED:'待审核',APPROVED:'已通过',REJECTED:'已驳回',PENDING:'待确认',ACCEPTED:'已接受',REVOKED:'已撤销',EXPIRED:'已过期',DRAFT:'草稿',PUBLISHED:'已上架',UNPUBLISHED:'已下架',WITHDRAWN:'已撤回',PENDING_PAYMENT:'待付款',PAID:'已付款',CANCELLED:'已取消',COMPLETED:'已完成',REFUNDED:'已退款',WAIT_PREP:'待备货',PREPARING:'备货中',READY:'已就绪',CONSUMED:'已交付',REQUESTED:'退款待审',DISPUTED:'平台处理中',CONFIRMED:'已确认',CANCELED:'已取消',FAILED:'失败',REPLENISH:'补货',RESERVE:'预占',RELEASE:'释放',CONSUME:'出库',OWNER:'经营者',CLERK:'店员'};
  const menus={consumer:[['home','⌂','发现好物'],['chat','✳','智能导购'],['cart','▣','购物车'],['orders','▤','我的订单'],['apply','◇','入驻与邀请']],merchant:[['overview','◫','经营概览'],['products','▣','商品与规格'],['stock','▥','库存管理'],['merchantOrders','▤','订单与自提'],['merchantRefunds','↩','售后处理'],['staff','♧','员工权限'],['merchantProfile','◇','商户资料'],['knowledge','▧','知识资料']],admin:[['overview','◫','运营概览'],['adminApplications','◇','入驻审核'],['adminMerchants','▦','商户管理'],['adminProducts','▣','商品监管'],['adminCategories','▣','商品类目'],['adminOrders','▤','平台订单'],['adminRefunds','⚑','售后与争议'],['knowledge','▧','平台知识']]};
  const orderStates=[{value:'',label:'全部订单'},{value:'PENDING_PAYMENT',label:'待付款'},{value:'PAID',label:'待自提'},{value:'COMPLETED',label:'已完成'},{value:'CANCELED',label:'已取消'},{value:'REFUNDED',label:'已退款'}];
  createApp({
    render: window.CampusRender,
    setup() {
      const s=reactive({role:'consumer',page:'home',user:null,workspace:{platformAdmin:false,memberships:[],merchants:[]},merchantId:'',publicMerchants:[],categories:[],query:'',filterMerchant:'',category:'',products:[],pageNo:1,cart:[],orders:[],listPage:1,filterState:'',applications:[],invitations:[],application:{merchantName:'',category:'',contactName:'',contactPhone:'',storeName:'',location:''},managedProducts:[],stocks:[],movements:[],members:[],allMerchants:[],afterSales:[],statistics:{},categoryForm:{code:'',name:''},merchantProfile:{name:'',storeName:'',location:''},bases:[],baseId:'',documents:[],conversations:[],conversationId:'',messages:[],aiMode:'尚未调用',chatBusy:false,chatError:'',proposals:[],proposalSelection:{},question:'',busy:0,loading:false,toasts:[],modal:'',authMode:'login',auth:{username:'',password:'',confirmPassword:'',displayName:''},selectedProduct:null,selectedSku:'',buyQuantity:1,productForm:{title:'',description:'',categoryCode:'',imageUrl:'',skus:[{specKey:'默认规格',price:''}]},editingProduct:null,focusProduct:null,focusSku:null,skuForm:{specKey:'',price:''},focusStock:null,replenishQuantity:1,inviteUsername:'',focusOrder:null,pickupToken:null,verifyToken:'',reasonPrompt:'',reason:'',baseForm:{name:'',visibility:'PUBLIC'},documentForm:{rootId:'',title:'',text:''},documentFile:null,documentText:''});
      let csrf=null,csrfPromise=null,afterLogin='home',reasonAction=null,loadCounter=0,productCounter=0,documentCounter=0;
      const requests=new Map();
      const hasMerchant=computed(()=>s.workspace.merchants.length>0);
      const currentMerchant=computed(()=>s.workspace.merchants.find(m=>m.merchantId===s.merchantId));
      const isOwner=computed(()=>s.workspace.memberships.some(m=>m.merchantId===s.merchantId&&m.role==='OWNER'&&m.status==='ACTIVE'));
      const navigation=computed(()=>menus[s.role].filter(n=>s.role!=='merchant'||isOwner.value||!['staff','knowledge','products','merchantProfile'].includes(n[0])).map(([id,icon,label])=>({id,icon,label})));
      const pageTitle=computed(()=>menus[s.role].find(n=>n[0]===s.page)?.[2]||'校园集市');
      const cartGroups=computed(()=>{const groups=new Map();for(const item of s.cart){if(!groups.has(item.merchantId))groups.set(item.merchantId,{merchantId:item.merchantId,items:[],total:0});const g=groups.get(item.merchantId);g.items.push(item);g.total+=item.priceCent*item.quantity;}return [...groups.values()];});
      const currentBase=computed(()=>s.bases.find(b=>b.id===s.baseId));
      const statCards=computed(()=>[{label:'订单总数',value:s.statistics.totalOrders||0,note:'当前可见范围'},{label:'待付款',value:s.statistics.pendingCount||0,note:'超时自动释放预占'},{label:'待自提',value:s.statistics.paidCount||0,note:'已完成模拟付款'},{label:'已完成模拟成交',value:money(s.statistics.completedAmountCent||0),note:`完成 ${s.statistics.completedCount||0} 单 · 退款 ${s.statistics.refundedCount||0} 单`}]);
      const modalTitle=computed(()=>({auth:s.authMode==='login'?'欢迎回来':'创建你的校园账号',product:'商品详情',productEdit:s.editingProduct?'编辑商品':'发布一个新商品',price:'修改售价',sku:'新增销售规格',replenish:'库存补货',movements:'库存变更记录',invite:'邀请店员',order:'订单详情',verify:'核销自提',reason:'确认操作',base:'新建知识库',document:'添加知识文档',documentView:'知识文档原文'}[s.modal]||''));
      const money=(cent)=>'¥'+((Number(cent)||0)/100).toFixed(2);
      const time=(value)=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—';
      const shortId=(id)=>id?String(id).slice(-8):'—';
      const statusName=(value)=>stateNames[value]||value||'—';
      const statusClass=(value)=>['APPROVED','PUBLISHED','ACTIVE','ACCEPTED','COMPLETED','CONFIRMED'].includes(value)?'good':['REJECTED','FAILED','DISPUTED','SUSPENDED'].includes(value)?'bad':['SUBMITTED','PENDING','PENDING_PAYMENT','REQUESTED','PREPARING'].includes(value)?'pending':'neutral';
      const categoryIcon=(code)=>({food:'☕',fruit:'🍎',stationery:'✎',daily:'☀',digital:'⌨'}[code]||'✳');
      const categoryName=(code)=>s.categories.find(c=>c.code===code)?.name||'校园好物';
      function findMerchant(id){return [...s.workspace.merchants,...s.publicMerchants,...s.allMerchants].find(m=>m.merchantId===id);}
      const merchantName=(id)=>findMerchant(id)?.name||('商户 '+shortId(id));
      const merchantLocation=(id)=>{const m=findMerchant(id);return m?[m.storeName,m.location].filter(Boolean).join(' · '):'请联系商户确认自提地点';};
      const availableTotal=(p)=>(p?.skus||[]).filter(x=>x.status==='ACTIVE').reduce((n,x)=>n+(x.available||0),0);
      const minPrice=(p)=>Math.min(...(p.skus||[]).filter(x=>x.status==='ACTIVE').map(x=>x.priceCent));
      const visibilityName=(v)=>({PUBLIC:'公开',MERCHANT_INTERNAL:'本商户内部',PLATFORM_INTERNAL:'平台内部'}[v]||v);
      const skuTitle=(id)=>{for(const p of s.managedProducts){const i=p.skus.find(i=>i.skuId===id);if(i)return p.title+' / '+i.specKey;}return '规格 '+shortId(id);};
      function toast(text,type='success'){const id=crypto.randomUUID();s.toasts=[...s.toasts.slice(-1),{text,type,id}];setTimeout(()=>{s.toasts=s.toasts.filter(t=>t.id!==id);},5500);}
      function apiError(message,code,status){return Object.assign(new Error(message),{code,status});}
      async function getCsrf(){if(csrfPromise)return csrfPromise;csrfPromise=(async()=>{const r=await fetch(PREFIX+'/auth/csrf',{credentials:'same-origin',cache:'no-store'});const j=await r.json();if(!r.ok||j.code!=='0000')throw apiError('无法取得安全令牌，请刷新后重试',j.code,r.status);csrf=j.data;return csrf;})();try{return await csrfPromise;}finally{csrfPromise=null;}}
      async function api(path,{method='GET',body,key,quietAuth=false,timeout=25000,retryCsrf=true}={}){
        const headers={Accept:'application/json'};
        if(method!=='GET'){const token=csrf||await getCsrf();headers[token.headerName]=token.token;}
        if(body!==undefined)headers['Content-Type']='application/json';
        if(key)headers['Idempotency-Key']=key;
        const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),timeout);let r;
        try{r=await fetch(PREFIX+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store',signal:ac.signal});}catch(err){throw apiError(err.name==='AbortError'?'请求超时，结果可能已提交，请刷新或使用原请求重试':'无法连接服务，请检查网络后重试','NETWORK',0);}finally{clearTimeout(timer);}
        let j;try{j=await r.json();}catch(err){throw apiError('服务未返回有效JSON，请查看服务日志','RESPONSE',r.status);}
        if(r.status===403&&j.code==='A0005'&&retryCsrf){csrf=null;await getCsrf();return api(path,{method,body,key,quietAuth,timeout,retryCsrf:false});}
        if(!r.ok||j.code!=='0000'){
          if((r.status===401||j.code==='A0004')&&!quietAuth){clearSession();openAuth('login');}
          throw apiError(j.info||({401:'请先登录',403:'当前操作无权限',429:'操作过于频繁，请稍后再试'}[r.status])||'操作失败，请稍后重试',j.code,r.status);
        }
        return j.data;
      }
      function query(values){const p=new URLSearchParams();for(const [k,v]of Object.entries(values))if(v!==''&&v!==null&&v!==undefined)p.set(k,v);return '?'+p;}
      async function work(fn){s.busy++;try{return await fn();}catch(err){toast(err.message||'操作失败','error');return undefined;}finally{s.busy--;}}
      // 请求不确定时保留同一个幂等键，避免网络重试创建第二笔订单或再次补货。
      function keyFor(scope,body){const fingerprint=JSON.stringify(body);const old=requests.get(scope);if(old?.fingerprint===fingerprint)return old.key;const key=crypto.randomUUID();requests.set(scope,{fingerprint,key});return key;}
function clearSession(){loadCounter++;productCounter++;documentCounter++;s.user=null;s.workspace={platformAdmin:false,memberships:[],merchants:[]};s.merchantId='';s.cart=[];s.orders=[];s.applications=[];s.invitations=[];s.members=[];s.bases=[];s.documents=[];s.messages=[];s.proposals=[];s.conversations=[];s.conversationId='';s.managedProducts=[];s.stocks=[];s.movements=[];s.allMerchants=[];s.afterSales=[];s.statistics={};s.proposalSelection={};s.focusOrder=null;s.documentText='';s.chatBusy=false;s.chatError='';s.loading=false;s.role='consumer';s.page='home';csrf=null;requests.clear();}
      function openAuth(mode='login'){s.authMode=mode;s.auth.password='';s.auth.confirmPassword='';s.modal='auth';}
      function closeModal(){if(s.busy)return;s.modal='';s.pickupToken=null;s.verifyToken='';s.auth.password='';s.auth.confirmPassword='';reasonAction=null;}
async function refreshWorkspace(){const userId=s.user?.userId;if(!userId)return;const workspace=await api('/workspace');if(s.user?.userId!==userId)return;s.workspace=workspace;if(!workspace.merchants.some(m=>m.merchantId===s.merchantId))s.merchantId=workspace.merchants[0]?.merchantId||'';if(s.role==='merchant'&&!hasMerchant.value||s.role==='admin'&&!workspace.platformAdmin){s.role='consumer';s.page='home';}await loadCart();}
      async function refreshAccess(){await work(refreshWorkspace);}
      async function loadCart(){const userId=s.user?.userId;if(!userId)return;const cart=await api('/cart');if(s.user?.userId===userId)s.cart=cart;}
      async function submitAuth(){await work(async()=>{if(s.authMode==='register'){
          if(s.auth.password!==s.auth.confirmPassword)throw new Error('两次输入的密码不一致');
          await api('/auth/register',{method:'POST',body:{username:s.auth.username,password:s.auth.password,displayName:s.auth.displayName}});
          s.authMode='login';s.auth.password='';s.auth.confirmPassword='';toast('注册成功，请使用新账号登录');return;
        }
        s.user=await api('/auth/login',{method:'POST',body:{username:s.auth.username,password:s.auth.password},quietAuth:true});
        csrf=null;await getCsrf();s.auth.password='';s.auth.confirmPassword='';s.modal='';await refreshWorkspace();await navigate(afterLogin);afterLogin='home';toast('登录成功');
      });}
      async function logout(){await work(async()=>{await api('/auth/logout',{method:'POST'});clearSession();s.modal='';await getCsrf();await loadPublic();toast('已退出登录');});}
      async function loadPublic(){const [cats,shops]=await Promise.all([api('/categories'),api('/merchants/public?page=1&size=100')]);s.categories=cats;s.publicMerchants=shops;await loadProducts();}
      async function loadProducts(){const n=++productCounter;const products=await api('/products'+query({q:s.query,merchantId:s.filterMerchant,category:s.category,page:s.pageNo,size:12}));if(n===productCounter&&s.page==='home')s.products=products;}
      async function navigate(page){if(page!=='home'&&!s.user){afterLogin=page;openAuth('login');return;}if(menus.consumer.some(n=>n[0]===page))s.role='consumer';s.page=page;s.listPage=1;s.filterState='';s.modal='';s.pickupToken=null;await reload();window.scrollTo({top:0,behavior:'smooth'});}
      async function switchRole(role){if(role==='merchant'&&!hasMerchant.value||role==='admin'&&!s.workspace.platformAdmin)return;s.role=role;s.page=role==='consumer'?'home':'overview';s.listPage=1;s.filterState='';await reload();}
// 只有最后一次页面加载可以写回，慢请求不得覆盖已经切换的角色或商户。
      async function reload(){
        const n=++loadCounter,page=s.page,role=s.role,merchant=s.merchantId,actorId=s.user?.userId;
        const list=s.listPage,filter=s.filterState;s.loading=true;
        try{
          let patch={};
          switch(page){
            case 'home':{const [categories,publicMerchants,products]=await Promise.all([api('/categories'),api('/merchants/public?page=1&size=100'),api('/products'+query({q:s.query,merchantId:s.filterMerchant,category:s.category,page:s.pageNo,size:12}))]);patch={categories,publicMerchants,products};break;}
            case 'cart':patch={cart:await api('/cart')};break;
            case 'orders':patch={orders:await api('/orders'+query({state:filter,page:list,size:20}))};break;
            case 'merchantOrders':patch={orders:await api(`/merchants/${e(merchant)}/orders`+query({state:filter,page:list,size:20}))};break;
            case 'adminOrders':patch={orders:await api('/admin/orders'+query({state:filter,page:list,size:20}))};break;
            case 'apply':{const [applications,invitations]=await Promise.all([api('/merchant-applications/mine?page=1&size=100'),api('/invitations')]);patch={applications,invitations};break;}
            case 'overview':patch={statistics:role==='admin'||isOwner.value?await api(role==='admin'?'/admin/statistics':`/merchants/${e(merchant)}/statistics`):{}};break;
            case 'products':{const [managedProducts,categories]=await Promise.all([api(`/merchants/${e(merchant)}/products?page=1&size=100`),api('/categories')]);patch={managedProducts,categories};break;}
            case 'stock':{const [stocks,managedProducts]=await Promise.all([api(`/merchants/${e(merchant)}/stocks?page=1&size=100`),api(`/merchants/${e(merchant)}/products?page=1&size=100`)]);patch={stocks,managedProducts};break;}
            case 'staff':patch={members:await api(`/merchants/${e(merchant)}/members`)};break;
            case 'adminApplications':patch={applications:await api('/admin/merchant-applications'+query({state:filter,page:list,size:20}))};break;
            case 'adminMerchants':patch={allMerchants:await api('/admin/merchants'+query({page:list,size:100}))};break;
            case 'adminCategories':patch={categories:await api('/categories')};break;
            case 'adminProducts':{const [managedProducts,allMerchants]=await Promise.all([api('/admin/products'+query({page:list,size:20})),api('/admin/merchants?page=1&size=100')]);patch={managedProducts,allMerchants};break;}
            case 'merchantProfile':{await refreshWorkspace();const m=s.workspace.merchants.find(x=>x.merchantId===merchant);if(m)patch={merchantProfile:{name:m.name,storeName:m.storeName,location:m.location}};break;}
            case 'merchantRefunds':patch={afterSales:await api(`/merchants/${e(merchant)}/aftersales`+query({page:list,size:100}))};break;
            case 'adminRefunds':patch={afterSales:await api('/admin/aftersales'+query({page:list,size:100}))};break;
            case 'knowledge':{const list=await api('/knowledge/bases');const bases=list.filter(i=>role==='admin'?!i.merchantId:i.merchantId===merchant);const baseId=bases.some(i=>i.id===s.baseId)?s.baseId:bases[0]?.id||'';const documents=baseId?await api(`/knowledge/bases/${e(baseId)}/documents`):[];patch={bases,baseId,documents};break;}
            case 'chat':{const conversations=await api('/ai/conversations');patch={conversations};if(s.conversationId)await fetchConversation(s.conversationId);break;}
          }
          if(n===loadCounter&&s.page===page&&s.role===role&&s.user?.userId===actorId)Object.assign(s,patch);
        }catch(err){if(n===loadCounter)toast(err.message,'error');}finally{if(n===loadCounter)s.loading=false;}
      }
      async function searchProducts(){s.pageNo=1;await work(loadProducts);}
      async function selectCategory(code){s.category=code;await searchProducts();}
      async function homePage(delta){s.pageNo=Math.max(1,s.pageNo+delta);await work(loadProducts);}
      async function listPage(delta){s.listPage=Math.max(1,s.listPage+delta);await reload();}
      async function filterOrders(state){s.filterState=state;s.listPage=1;await reload();}
      async function openProduct(product){await work(async()=>{s.selectedProduct=await api('/products/'+e(product.productId));s.selectedSku=s.selectedProduct.skus.find(x=>x.status==='ACTIVE'&&x.available>0)?.skuId||s.selectedProduct.skus[0]?.skuId||'';s.buyQuantity=1;s.modal='product';});}
      function validQty(value,max=99){const q=Number(value);if(!Number.isInteger(q)||q<1||q>max)throw new Error('数量必须是1至'+max+'之间的整数');return q;}
      function priceCent(value){const v=String(value).trim();if(!/^\d{1,7}(\.\d{1,2})?$/.test(v))throw new Error('价格必须为大于零、最多两位小数的金额');const [w,f='']=v.split('.');const n=Number(w)*100+Number(f.padEnd(2,'0'));if(n<=0||n>100000000)throw new Error('价格超出允许范围');return n;}
      async function addProductToCart(){if(!s.user){afterLogin='home';openAuth();return;}await work(async()=>{const q=validQty(s.buyQuantity);await loadCart();const old=s.cart.find(x=>x.skuId===s.selectedSku);await api('/cart',{method:'PUT',body:{skuId:s.selectedSku,quantity:validQty(q+(old?.quantity||0))}});await loadCart();s.modal='';toast('已加入购物车');});}
      async function updateCart(item,value){await work(async()=>{await api('/cart',{method:'PUT',body:{skuId:item.skuId,quantity:validQty(value)}});await loadCart();});}
      async function removeCart(item){await work(async()=>{await api('/cart/'+e(item.skuId),{method:'DELETE'});await loadCart();});}
      async function checkout(group){await work(async()=>{const body={merchantId:group.merchantId,items:group.items.map(i=>({skuId:i.skuId,quantity:i.quantity,expectedPriceCent:i.priceCent,expectedVersion:i.quoteVersion})).sort((a,b)=>a.skuId.localeCompare(b.skuId))};const scope='checkout:'+group.merchantId;const order=await api('/orders',{method:'POST',body,key:keyFor(scope,body)});requests.delete(scope);await loadCart();s.focusOrder=order;s.pickupToken=null;s.modal='order';toast('下单成功，请在付款截止前完成模拟付款');});}
      async function showOrder(order){await showOrderById(order.orderId);}
      async function showOrderById(id){await work(async()=>{s.focusOrder=await api('/orders/'+e(id));s.pickupToken=null;s.modal='order';});}
      async function refreshOrder(id){const o=await api('/orders/'+e(id));if(s.focusOrder?.orderId===id)s.focusOrder=o;s.orders=s.orders.map(x=>x.orderId===id?o:x);return o;}
      async function pay(order){await work(async()=>{await api(`/orders/${e(order.orderId)}/pay`,{method:'POST'});await refreshOrder(order.orderId);toast('模拟付款成功，请等待商户备货');});}
      async function cancelOrder(order){if(!window.confirm('确认取消这笔待付款订单？已预占的库存会释放。'))return;await work(async()=>{await api(`/orders/${e(order.orderId)}/cancel`,{method:'POST'});await refreshOrder(order.orderId);toast('订单已取消');});}
      async function prepare(order,ready){await work(async()=>{await api(`/merchants/${e(s.merchantId)}/orders/${e(order.orderId)}/${ready?'ready':'prepare'}`,{method:'POST'});await refreshOrder(order.orderId);toast(ready?'已通知可自提':'已开始备货');});}
      function openVerify(order){s.focusOrder=order;s.verifyToken='';s.modal='verify';}
      async function verifyPickup(){await work(async()=>{const id=s.focusOrder.orderId;await api(`/merchants/${e(s.merchantId)}/orders/${e(id)}/verify`,{method:'POST',body:{token:s.verifyToken.trim()}});s.verifyToken='';s.modal='';await refreshOrder(id);toast('核销成功，订单与库存已同步完成');});}
      async function pickupToken(order){await work(async()=>{s.pickupToken=await api(`/orders/${e(order.orderId)}/pickup-token`,{method:'POST'});});}
      async function copyToken(){await work(async()=>{await navigator.clipboard.writeText(s.pickupToken.token);toast('令牌已复制，请勿发给无关人员');});}
      function askReason(prompt,action){s.reasonPrompt=prompt;s.reason='';reasonAction=action;s.modal='reason';}
      async function submitReason(){await work(async()=>{if(!s.reason.trim())throw new Error('请填写原因');const fn=reasonAction;await fn(s.reason.trim());s.modal='';reasonAction=null;await reload();toast('操作成功');});}
      function requestRefund(order){askReason('申请已支付未提货订单的全额模拟退款，审核期间不可核销。',async reason=>{await api(`/orders/${e(order.orderId)}/refunds`,{method:'POST',body:{reason}});await refreshOrder(order.orderId);});}
      async function appeal(order){await work(async()=>{await api(`/orders/${e(order.orderId)}/appeal`,{method:'POST'});await refreshOrder(order.orderId);toast('已申请平台介入');});}
      function decideRefund(item,approved){askReason(approved?'确认全额模拟退款？库存预占和自提任务将同时撤销。':'请说明驳回退款的原因。',async reason=>{const prefix=s.role==='admin'?'/admin':`/merchants/${e(s.merchantId)}`;await api(`${prefix}/orders/${e(item.orderId)}/refund-decision`,{method:'POST',body:{approved,reason}});});}
      async function submitApplication(){await work(async()=>{const body={...s.application};await api('/merchant-applications',{method:'POST',body,key:keyFor('admission',body)});requests.delete('admission');await reload();toast('申请已提交，请等待平台审核');});}
      async function acceptInvite(i){await work(async()=>{await api(`/invitations/${e(i.id)}/accept`,{method:'POST'});await refreshWorkspace();await reload();toast('已接受店员邀请');});}
      function openProductEditor(product=null){s.editingProduct=product;s.productForm=product?{title:product.title,description:product.description||'',categoryCode:product.categoryCode,imageUrl:product.imageUrl||'',skus:[]}:{title:'',description:'',categoryCode:s.categories.find(c=>c.active)?.code||'',imageUrl:'',skus:[{specKey:'默认规格',price:''}]};s.modal='productEdit';}
      async function saveProduct(){await work(async()=>{const p=s.productForm;const body={title:p.title,description:p.description,categoryCode:p.categoryCode,imageUrl:p.imageUrl};const base=`/merchants/${e(s.merchantId)}/products`;if(s.editingProduct){body.expectedVersion=s.editingProduct.version;await api(`${base}/${e(s.editingProduct.productId)}`,{method:'PUT',body});}else{body.skus=p.skus.map(x=>({specKey:x.specKey,priceCent:priceCent(x.price)}));await api(base,{method:'POST',body});}s.modal='';await reload();toast('商品已保存');});}
      async function asBase64(file){if(!file||file.size>2*1024*1024)throw new Error('请选择不超过2MB的文件');const buffer=await file.arrayBuffer();let str='';const bytes=new Uint8Array(buffer);for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);}
      async function uploadProductImage(event){const file=event.target.files?.[0];if(!file)return;await work(async()=>{const data=await api(`/merchants/${e(s.merchantId)}/images`,{method:'POST',body:{filename:file.name,contentType:file.type,base64:await asBase64(file)}});s.productForm.imageUrl=data.url;toast('图片已上传');});}
      function openPrice(product,sku){s.focusProduct=product;s.focusSku=sku;s.skuForm={specKey:sku.specKey,price:(sku.priceCent/100).toFixed(2)};s.modal='price';}
      function openSku(product){s.focusProduct=product;s.focusSku=null;s.skuForm={specKey:'',price:''};s.modal='sku';}
      async function saveSku(){await work(async()=>{const base=`/merchants/${e(s.merchantId)}/products/${e(s.focusProduct.productId)}/skus`;const value=priceCent(s.skuForm.price);if(s.modal==='price')await api(`${base}/${e(s.focusSku.skuId)}/price`,{method:'PUT',body:{priceCent:value,expectedVersion:s.focusProduct.version}});else await api(base,{method:'POST',body:{specKey:s.skuForm.specKey,priceCent:value}});s.modal='';await reload();toast('规格已保存');});}
      async function publish(product,published=product.status!=='PUBLISHED'){await work(async()=>{await api(`/merchants/${e(s.merchantId)}/products/${e(product.productId)}/publish`,{method:'POST',body:{published}});await reload();toast(published?'商品已上架':'商品已下架');});}
      function openReplenish(stock){s.focusStock=stock;s.replenishQuantity=1;s.modal='replenish';}
      async function replenish(){await work(async()=>{const body={quantity:validQty(s.replenishQuantity,1000000)};const scope='replenish:'+s.focusStock.skuId;await api(`/merchants/${e(s.merchantId)}/stocks/${e(s.focusStock.skuId)}/replenish`,{method:'POST',body,key:keyFor(scope,body)});requests.delete(scope);s.modal='';await reload();toast('补货成功');});}
      async function loadMovements(){await work(async()=>{s.movements=await api(`/merchants/${e(s.merchantId)}/stock-movements?page=1&size=100`);s.modal='movements';});}
      function openInvite(){s.inviteUsername='';s.modal='invite';}
      async function invite(){await work(async()=>{await api(`/merchants/${e(s.merchantId)}/invitations`,{method:'POST',body:{username:s.inviteUsername}});s.modal='';toast('已发送邀请，对方接受后生效');});}
      async function revokeMember(member){if(!window.confirm('确认撤销该店员的商户权限？'))return;await work(async()=>{await api(`/merchants/${e(s.merchantId)}/members/${e(member.userId)}`,{method:'DELETE'});await reload();toast('成员权限已撤销');});}
      function reviewApplication(item,approved){askReason(approved?'确认审核通过并原子开通商户、门店和经营者权限？':'请填写入驻申请的驳回原因。',async reason=>{await api(`/admin/merchant-applications/${e(item.applicationId)}/review`,{method:'POST',body:{approved,reason}});});}
      function changeMerchantState(item){const active=item.status!=='ACTIVE';askReason(active?'确认恢复此商户经营资格？':'暂停后禁止新交易，但保留已有订单履约和退款。',async reason=>{await api(`/admin/merchants/${e(item.merchantId)}/state`,{method:'POST',body:{active,reason}});});}
      async function saveMerchantProfile(){await work(async()=>{await api(`/merchants/${e(s.merchantId)}/profile`,{method:'PUT',body:{...s.merchantProfile}});await refreshWorkspace();toast('商户与自提门店资料已更新');});}
      async function forceUnpublish(product){if(!window.confirm('确认平台强制下架此商品？操作会记录审计。'))return;await work(async()=>{await api(`/admin/products/${e(product.productId)}/unpublish`,{method:'POST'});await reload();toast('商品已下架，后续新交易将被阻止');});}
      async function saveCategory(){await work(async()=>{await api('/admin/categories',{method:'POST',body:{...s.categoryForm,active:true}});s.categoryForm={code:'',name:''};await reload();toast('类目已保存');});}
      async function toggleCategory(category){await work(async()=>{await api('/admin/categories',{method:'POST',body:{code:category.code,name:category.name,active:!category.active}});await reload();toast('类目状态已更新');});}
      function openBase(){s.baseForm={name:'',visibility:'PUBLIC'};s.modal='base';}
      async function createBase(){await work(async()=>{const base=await api('/knowledge/bases',{method:'POST',body:{name:s.baseForm.name,visibility:s.baseForm.visibility,merchantId:s.role==='merchant'?s.merchantId:null}});s.baseId=base.id;s.modal='';await reload();toast('知识库已创建');});}
      async function loadDocuments(){const id=s.baseId,n=++documentCounter;const docs=id?await api(`/knowledge/bases/${e(id)}/documents`):[];if(n===documentCounter&&id===s.baseId&&s.page==='knowledge')s.documents=docs;}
      async function selectBase(id){if(id)s.baseId=id;await work(loadDocuments);}
      function openDocument(doc=null){s.documentForm={rootId:doc?.rootId||'',title:doc?.title||'',text:''};s.documentFile=null;s.modal='document';}
      function selectDocumentFile(event){s.documentFile=event.target.files?.[0]||null;if(s.documentFile&&!s.documentForm.title)s.documentForm.title=s.documentFile.name.replace(/\.[^.]+$/,'');}
      async function uploadDocument(){await work(async()=>{let file=s.documentFile;if(!file){if(!s.documentForm.text.trim())throw new Error('请选择文件或填写正文');file=new File([s.documentForm.text],'document.md',{type:'text/markdown'});}const body={rootId:s.documentForm.rootId||null,title:s.documentForm.title,filename:file.name,contentType:file.type||'application/octet-stream',base64:await asBase64(file)};const doc=await api(`/knowledge/bases/${e(s.baseId)}/documents`,{method:'POST',body,timeout:100000});s.modal='';await loadDocuments();toast(doc.indexStatus==='READY'?'文档已建立索引，发布后生效':'文档已保存，但索引失败，请检查AI服务并重试',doc.indexStatus==='READY'?'success':'error');});}
      async function viewDocument(doc){await work(async()=>{const d=await api(`/knowledge/documents/${e(doc.id)}`);s.documentText=d.content||'';s.modal='documentView';});}
      async function indexDocument(doc){await work(async()=>{await api(`/knowledge/documents/${e(doc.id)}/index`,{method:'POST',timeout:100000});await loadDocuments();toast('索引操作已完成，请查看状态');});}
      async function publishDocument(doc){await work(async()=>{await api(`/knowledge/documents/${e(doc.id)}/publish`,{method:'POST'});await loadDocuments();toast('该文档版本已发布');});}
      async function withdrawDocument(doc){if(!window.confirm('撤回后不再用于新的问答，历史回答可能被遮蔽。确认撤回？'))return;await work(async()=>{await api(`/knowledge/documents/${e(doc.id)}/withdraw`,{method:'POST'});await loadDocuments();toast('文档已撤回');});}
      function newChat(){if(s.chatBusy)return;s.conversationId='';s.messages=[];s.proposals=[];s.question='';s.chatError='';s.aiMode='尚未调用';}
      function assignProposals(list){s.proposals=list;for(const p of list){if(!s.proposalSelection[p.id])s.proposalSelection[p.id]=p.items.map(i=>i.skuId);}}
      async function fetchConversation(id){const [messages,proposals]=await Promise.all([api(`/ai/conversations/${e(id)}/messages`),api(`/ai/conversations/${e(id)}/proposals`)]);if(s.page==='chat'&&s.conversationId===id){s.messages=messages;assignProposals(proposals);}}
      async function loadConversation(conv){if(s.chatBusy)return;await work(async()=>{s.conversationId=typeof conv==='string'?conv:conv.id;await fetchConversation(s.conversationId);s.chatError='';s.aiMode='历史对话';await scrollChat();});}
      async function scrollChat(){await nextTick();const el=document.querySelector('.chat-log');if(el)el.scrollTop=el.scrollHeight;}
      async function askSuggestion(question){s.question=question;await sendChat();}
      async function sendChat(){if(s.chatBusy||!s.question.trim())return;if(!s.user){afterLogin='chat';openAuth();return;}const actorId=s.user.userId;const question=s.question.trim();s.question='';s.chatBusy=true;s.chatError='';const id=crypto.randomUUID();s.messages.push({id,role:'user',content:question});await scrollChat();try{const answer=await api('/ai/chat',{method:'POST',body:{conversationId:s.conversationId||null,question},timeout:100000});if(s.user?.userId!==actorId)return;s.conversationId=answer.conversationId;s.aiMode=answer.mode;s.messages.push({id:crypto.randomUUID(),role:'assistant',content:answer.answer,warning:answer.warning,citations:answer.citations||[]});if(answer.proposal)assignProposals([...s.proposals,answer.proposal]);s.conversations=await api('/ai/conversations');}catch(err){if(s.user?.userId===actorId){s.chatError=err.message;s.messages=s.messages.filter(m=>m.id!==id);s.question=question;}}finally{if(s.user?.userId===actorId)s.chatBusy=false;await scrollChat();}}
      async function confirmProposal(p){await work(async()=>{const ids=s.proposalSelection[p.id]||[];if(!ids.length)throw new Error('请至少选择一个商品');const result=await api(`/ai/proposals/${e(p.id)}/confirm`,{method:'POST',body:{selectedSkuIds:ids}});s.proposals=s.proposals.map(x=>x.id===result.id?result:x);await loadCart();toast('已确认并加入购物车，没有自动下单或付款');});}
      async function rejectProposal(p){await work(async()=>{await api(`/ai/proposals/${e(p.id)}/reject`,{method:'POST'});p.status='REJECTED';toast('已放弃该建议');});}
      onMounted(async()=>{await work(async()=>{await getCsrf();try{s.user=await api('/auth/me',{quietAuth:true});}catch(err){if(err.status!==401&&err.code!=='A0004')toast(err.message,'error');}if(s.user)await refreshWorkspace();await reload();});document.addEventListener('keydown',ev=>{if(ev.key==='Escape')closeModal();});});
      return {s,navigation,hasMerchant,currentMerchant,isOwner,pageTitle,cartGroups,statCards,currentBase,modalTitle,orderStates,money,time,shortId,categoryIcon,categoryName,merchantName,merchantLocation,availableTotal,minPrice,statusName,statusClass,visibilityName,skuTitle,navigate,switchRole,reload,openAuth,logout,closeModal,submitAuth,searchProducts,selectCategory,homePage,listPage,filterOrders,openProduct,addProductToCart,updateCart,removeCart,checkout,showOrder,showOrderById,pay,cancelOrder,prepare,openVerify,verifyPickup,pickupToken,copyToken,requestRefund,appeal,decideRefund,submitApplication,refreshWorkspace,refreshAccess,acceptInvite,openProductEditor,saveProduct,uploadProductImage,openPrice,openSku,saveSku,publish,openReplenish,replenish,loadMovements,openInvite,invite,revokeMember,reviewApplication,changeMerchantState,saveMerchantProfile,forceUnpublish,saveCategory,toggleCategory,openBase,selectBase,createBase,openDocument,selectDocumentFile,uploadDocument,viewDocument,indexDocument,publishDocument,withdrawDocument,newChat,loadConversation,askSuggestion,sendChat,confirmProposal,rejectProposal,submitReason};
    }
  }).mount('#app');
})();
