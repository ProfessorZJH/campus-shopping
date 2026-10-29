/* 仅 ?demo=1 预览使用。所有写请求在演示模式禁用。 */
import {DEMO_PRODUCTS,DEMO_MERCHANTS} from './demo.js';
const t='2026-10-27T11:40:00Z';
const items=[{skuId:'preview-sku-1',title:'红烧牛肉面 · 经典桶',specKey:'109g',unitPriceCent:450,quantity:1},{skuId:'preview-sku-2',title:'纯牛奶 · 250ml',specKey:'250ml',unitPriceCent:280,quantity:2}];
export const DEMO_CART=[{merchantId:'preview-m1',skuId:'preview-sku-1',title:items[0].title,specKey:'109g',quantity:1,priceCent:450,quoteVersion:1,available:320,sellable:true},{merchantId:'preview-m1',skuId:'preview-sku-2',title:items[1].title,specKey:'250ml',quantity:2,priceCent:280,quoteVersion:1,available:18,sellable:true},{merchantId:'preview-m2',skuId:'preview-sku-3',title:'苹果 · 清甜脆爽',specKey:'单个',quantity:2,priceCent:190,quoteVersion:1,available:46,sellable:true}];
export const DEMO_ORDERS=[
 {orderId:'CS202610280001',buyerId:'preview-user',merchantId:'preview-m1',storeId:'preview-s1',status:'PAID',totalCent:1010,createdAt:t,deadline:'2026-10-29T11:40:00Z',items,pickup:{status:'READY',expiresAt:null}},
 {orderId:'CS202610270016',buyerId:'preview-user',merchantId:'preview-m2',storeId:'preview-s2',status:'COMPLETED',totalCent:570,createdAt:'2026-10-26T10:30:00Z',items:[{skuId:'preview-sku-3',title:'苹果 · 清甜脆爽',specKey:'单个',unitPriceCent:190,quantity:3}],pickup:{status:'COMPLETED'}},
 {orderId:'CS202610280003',buyerId:'preview-user',merchantId:'preview-m1',storeId:'preview-s1',status:'PENDING_PAYMENT',totalCent:450,createdAt:t,deadline:'2026-10-29T11:40:00Z',items:items.slice(0,1),pickup:null}
];
export const DEMO_APPLICATIONS=[
 {applicationId:'AP-1025',merchantName:'东湖便利',category:'便利零售',contactName:'店主 A',contactPhone:'13800000000',storeName:'学一食堂店',location:'东湖校区 · 学一食堂',status:'SUBMITTED',rejectionReason:''},
 {applicationId:'AP-1024',merchantName:'青果时间',category:'水果生鲜',contactName:'店主 B',contactPhone:'13900000000',storeName:'生活区店',location:'生活区 B 栋',status:'APPROVED',merchantId:'preview-m2'},
 {applicationId:'AP-1023',merchantName:'学伴文具',category:'文具用品',contactName:'店主 C',contactPhone:'13600000000',storeName:'图书馆店',location:'图书馆一层',status:'REJECTED',rejectionReason:'信息不完整'}
];
export const DEMO_MEMBERS=[{merchantId:'preview-m1',userId:'preview-user',role:'OWNER',status:'ACTIVE'},{merchantId:'preview-m1',userId:'preview-clerk',role:'CLERK',status:'ACTIVE'}];
export const DEMO_BASES=[{id:'KB-01',name:'门店服务指南',merchantId:'preview-m1',visibility:'PUBLIC'},{id:'KB-02',name:'内部运营指引',merchantId:'preview-m1',visibility:'MERCHANT_INTERNAL'}];
export const DEMO_DOCS=[{id:'D-11',baseId:'KB-01',rootId:'R-11',title:'门店营业信息',version:2,status:'PUBLISHED',indexStatus:'READY',content:'营业时间与自提注意事项',createdAt:t},{id:'D-12',baseId:'KB-01',rootId:'R-12',title:'商品分类说明',version:1,status:'DRAFT',indexStatus:'READY',content:'零食与饮品',createdAt:t}];
export const DEMO_STATS={totalOrders:168,pendingCount:12,paidCount:28,completedCount:128,refundedCount:3,completedAmountCent:286050};
export const DEMO_MERCHANT_ORDERS=DEMO_ORDERS.map((o,i)=>({...o,orderId:'M'+String(i+1).padStart(5,'0'),buyerId:'preview-buyer-'+i,merchantId:'preview-m1',status:['PAID','COMPLETED','PENDING_PAYMENT'][i],pickup:i===0?{status:'WAIT_PREP'}:o.pickup}));
export const DEMO_AFTERSALES=[{id:'AF-008',orderId:'M00002',merchantId:'preview-m1',status:'REQUESTED',reason:'商品临时不需要',createdAt:t},{id:'AF-007',orderId:'M00003',merchantId:'preview-m1',status:'DISPUTED',reason:'未提货申请退款',createdAt:t}];
export const DEMO_STOCK_MOVES=[{id:'MV-11',skuId:DEMO_PRODUCTS[0].skus[0].skuId,type:'REPLENISH',quantity:20,createdAt:t,bizKey:'DEMO-01'}];
// 只用于只读页面预览；权限码和角色默认值与 SDD-RBAC-05 一致。
const RBAC_LABELS=[['dashboard.read','经营统计'],['product.read','查看商品'],['product.write','管理商品及价格'],
 ['stock.read','查看库存与流水'],['stock.replenish','补货'],['order.read','查看订单'],
 ['order.prepare','备货'],['pickup.verify','自提核销'],['aftersale.read','查看售后'],
 ['aftersale.review','审核售后'],['knowledge.read','读取知识库'],['knowledge.manage','管理知识库'],
 ['team.manage','邀请和撤销成员'],['store.manage','修改门店资料'],['role.manage','角色与权限管理']];
export const DEMO_RBAC_PERMISSIONS=RBAC_LABELS.map(([code,label])=>({code,label,grantable:!['team.manage','store.manage','role.manage'].includes(code)}));
export const DEMO_RBAC_ROLES=[
 {code:'OWNER',name:'经营者',builtin:true,permissions:RBAC_LABELS.map(([code])=>code)},
 {code:'CLERK',name:'店员',builtin:true,permissions:['product.read','stock.read','stock.replenish','order.read','order.prepare','pickup.verify']},
 {code:'preview-operator',name:'商品运营',builtin:false,permissions:['product.read','product.write','stock.read']}
];
export const DEMO_PUBLIC_MERCHANTS=DEMO_MERCHANTS;
