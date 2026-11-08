export const merchantNav = [
  ['home', '工作台', '/merchant'],
  ['package', '商品管理', '/merchant/products'],
  ['box', '库存管理', '/merchant/inventory'],
  ['order', '订单管理', '/merchant/orders'],
  ['scan', '自提核销', '/merchant/pickup'],
  ['clipboard', '售后处理', '/merchant/aftersales'],
  ['users', '店员管理', '/merchant/team'],
  ['shield', '角色权限', '/merchant/roles'],
  ['book', '知识库', '/merchant/knowledge'],
  ['search', 'RAG 调试', '/merchant/knowledge/debug'],
  ['settings', '门店设置', '/merchant/settings'],
];

export const adminNav = [
  ['home', '平台总览', '/admin'],
  ['store', '商户审核', '/admin/applications'],
  ['users', '商户监管', '/admin/merchants'],
  ['package', '商品监管', '/admin/products'],
  ['order', '订单监管', '/admin/orders'],
  ['shield', '争议处理', '/admin/disputes'],
  ['book', '知识库', '/admin/knowledge'],
  ['search', 'RAG 调试', '/admin/knowledge/debug'],
  ['grid', '分类管理', '/admin/categories'],
];

export const merchantPermissions = Object.freeze({
  '/merchant': 'order.read',
  '/merchant/products': 'product.read',
  '/merchant/inventory': 'stock.read',
  '/merchant/orders': 'order.read',
  '/merchant/pickup': 'pickup.verify',
  '/merchant/aftersales': 'aftersale.read',
  '/merchant/team': 'team.manage',
  '/merchant/roles': 'role.manage',
  '/merchant/knowledge': 'knowledge.read',
  '/merchant/knowledge/debug': 'knowledge.read',
  '/merchant/settings': 'store.manage',
});

export const backofficeRoutes = Object.freeze([
  ...merchantNav.map(([, , path]) => path),
  ...adminNav.map(([, , path]) => path),
]);

export const backofficeTitles = Object.freeze({
  '/merchant': '工作台',
  '/merchant/products': '商品管理',
  '/merchant/inventory': '库存管理',
  '/merchant/orders': '订单管理',
  '/merchant/pickup': '自提核销',
  '/merchant/aftersales': '售后处理',
  '/merchant/team': '店员管理',
  '/merchant/roles': '角色权限',
  '/merchant/knowledge': '知识库',
  '/merchant/knowledge/debug': 'RAG 检索调试',
  '/merchant/settings': '门店设置',
  '/admin': '平台总览',
  '/admin/applications': '商户审核',
  '/admin/merchants': '商户监管',
  '/admin/products': '商品监管',
  '/admin/orders': '订单监管',
  '/admin/disputes': '争议处理',
  '/admin/knowledge': '知识库',
  '/admin/knowledge/debug': 'RAG 检索调试',
  '/admin/categories': '分类管理',
});
