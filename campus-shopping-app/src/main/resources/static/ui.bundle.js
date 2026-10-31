(function() {
  "use strict";
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
    logout: '<path d="M9 3H4v18h5M13 7l5 5-5 5M7 12h11"/>'
  };
  const Icon = {
    name: "UiIcon",
    props: {
      name: { type: String, required: true },
      size: { type: [Number, String], default: 20 },
      stroke: { type: Number, default: 1.85 }
    },
    setup(props) {
      return () => Vue.h("svg", {
        viewBox: "0 0 24 24",
        width: props.size,
        height: props.size,
        "aria-hidden": "true",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": props.stroke,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        innerHTML: paths[props.name] || paths.circleHelp
      });
    }
  };
  const DEMO_MERCHANTS = [
    {
      merchantId: "preview-m1",
      name: "东湖便利",
      storeName: "学一食堂店",
      location: "东湖校区 · 学一食堂一层",
      category: "便利零售",
      status: "ACTIVE",
      image: "./images/merch-convenience.webp"
    },
    {
      merchantId: "preview-m2",
      name: "青果时间",
      storeName: "生活区店",
      location: "生活区 B 栋",
      category: "水果生鲜",
      status: "ACTIVE",
      image: "./images/merch-fruit.webp"
    },
    {
      merchantId: "preview-m3",
      name: "学伴文具",
      storeName: "图书馆店",
      location: "图书馆一层",
      category: "文具用品",
      status: "ACTIVE",
      image: "./images/merch-supermarket.webp"
    }
  ];
  const DEMO_CATEGORIES = [
    { code: "food", name: "零食", active: true, image: "./images/category-snacks.webp" },
    { code: "drink", name: "饮料", active: true, image: "./images/category-drinks.webp" },
    { code: "fruit", name: "水果", active: true, image: "./images/category-fruit.webp" },
    { code: "stationery", name: "文具", active: true, image: "./images/category-stationery.webp" },
    { code: "daily", name: "日用", active: true, image: "./images/category-daily.webp" }
  ];
  const sku = (n, spec, price, available2) => ({
    skuId: "preview-sku-" + n,
    specKey: spec,
    priceCent: price,
    status: "ACTIVE",
    quoteVersion: 1,
    available: available2
  });
  const DEMO_PRODUCTS = [
    {
      productId: "preview-p1",
      merchantId: "preview-m1",
      title: "红烧牛肉面 · 经典桶",
      description: "经典浓香，随时享用。",
      categoryCode: "food",
      imageUrl: "./images/noodles.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(1, "109g", 450, 320)],
      tag: "热卖",
      sub: "109g"
    },
    {
      productId: "preview-p2",
      merchantId: "preview-m1",
      title: "纯牛奶 250ml",
      description: "原味纯牛奶",
      categoryCode: "drink",
      imageUrl: "./images/milk.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(2, "250ml", 280, 86)],
      tag: "精选",
      sub: "250ml"
    },
    {
      productId: "preview-p3",
      merchantId: "preview-m1",
      title: "经典原味薯片",
      description: "香脆轻食",
      categoryCode: "food",
      imageUrl: "./images/chips.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(3, "70g", 420, 168)],
      tag: "热卖",
      sub: "70g"
    },
    {
      productId: "preview-p4",
      merchantId: "preview-m2",
      title: "鲜脆青苹果",
      description: "新鲜水果",
      categoryCode: "fruit",
      imageUrl: "./images/category-fruit.webp",
      status: "PUBLISHED",
      version: 2,
      skus: [sku(4, "单个", 180, 76)],
      tag: "当季",
      sub: "约200g"
    },
    {
      productId: "preview-p5",
      merchantId: "preview-m3",
      title: "考试中性笔",
      description: "顺滑书写",
      categoryCode: "stationery",
      imageUrl: "./images/category-stationery.webp",
      status: "PUBLISHED",
      version: 2,
      skus: [sku(5, "0.5mm", 250, 123)],
      tag: "常备",
      sub: "单支"
    },
    {
      productId: "preview-p6",
      merchantId: "preview-m1",
      title: "牛奶 250ml · 整箱",
      description: "12盒装",
      categoryCode: "drink",
      imageUrl: "./images/milk.webp",
      status: "PUBLISHED",
      version: 3,
      skus: [sku(6, "12盒装", 3150, 12)],
      tag: "好价",
      sub: "12盒装"
    },
    {
      productId: "preview-p7",
      merchantId: "preview-m1",
      title: "经典桶面 · 香辣",
      description: "更浓郁的味道",
      categoryCode: "food",
      imageUrl: "./images/noodles.webp",
      status: "UNPUBLISHED",
      version: 3,
      skus: [sku(7, "109g", 450, 0)],
      sub: "109g"
    },
    {
      productId: "preview-p8",
      merchantId: "preview-m1",
      title: "洗护旅行装",
      description: "便携日用",
      categoryCode: "daily",
      imageUrl: "./images/category-daily.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(8, "100ml", 690, 16)],
      sub: "100ml"
    },
    {
      productId: "preview-p9",
      merchantId: "preview-m1",
      title: "红烧牛肉面 · 整箱",
      description: "整箱囤货",
      categoryCode: "food",
      imageUrl: "./images/noodles.webp",
      status: "PUBLISHED",
      version: 1,
      skus: [sku(9, "12桶装", 4950, 8)],
      sub: "12桶装"
    },
    {
      productId: "preview-p10",
      merchantId: "preview-m1",
      title: "青苹果 · 礼盒",
      description: "节日礼盒",
      categoryCode: "fruit",
      imageUrl: "./images/category-fruit.webp",
      status: "DRAFT",
      version: 1,
      skus: [sku(10, "8枚装", 2280, 0)],
      sub: "8枚装"
    }
  ];
  const DEMO_STOCKS = DEMO_PRODUCTS.filter((p) => p.merchantId === "preview-m1").flatMap(
    (p) => p.skus.map((s) => ({
      skuId: s.skuId,
      storeId: "preview-s1",
      onHand: s.available + 2,
      reserved: 2,
      available: s.available,
      version: 1
    }))
  );
  const DEMO_CHAT = [
    { role: "user", content: "我想买点夜宵，预算 30 元以内，吃得饱一点。" },
    { role: "assistant", content: "给你挑了 3 件方便自提的好物。", demo: true }
  ];
  const PREFIX = "/api/v1";
  let csrf = null;
  let csrfPromise = null;
  function fail(message, code, status) {
    return Object.assign(new Error(message), { code, status });
  }
  async function getCsrf() {
    if (csrfPromise) return csrfPromise;
    csrfPromise = (async () => {
      const r = await fetch(PREFIX + "/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      let j;
      try {
        j = await r.json();
      } catch {
        throw fail("安全令牌响应异常", "RESPONSE", r.status);
      }
      if (!r.ok || j.code !== "0000") throw fail("无法获取安全令牌", j.code, r.status);
      csrf = j.data;
      return csrf;
    })();
    try {
      return await csrfPromise;
    } finally {
      csrfPromise = null;
    }
  }
  async function api(path, { method = "GET", body, signal, key, retry = true } = {}) {
    const headers = { Accept: "application/json" };
    if (method !== "GET") {
      const token = csrf || await getCsrf();
      headers[token.headerName] = token.token;
    }
    if (body !== void 0) headers["Content-Type"] = "application/json";
    if (key) headers["Idempotency-Key"] = key;
    let r;
    try {
      r = await fetch(PREFIX + path, {
        method,
        headers,
        body: body === void 0 ? void 0 : JSON.stringify(body),
        signal,
        credentials: "same-origin",
        cache: "no-store"
      });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw fail("服务连接失败，请确认 Java 后端已启动", "NETWORK", 0);
    }
    let j;
    try {
      j = await r.json();
    } catch {
      throw fail("服务器响应格式异常", "RESPONSE", r.status);
    }
    if (r.status === 403 && j.code === "A0005" && retry) {
      csrf = null;
      await getCsrf();
      return api(path, { method, body, signal, key, retry: false });
    }
    if (!r.ok || j.code !== "0000") throw fail(j.info || "请求失败", j.code || "HTTP", r.status);
    return j.data;
  }
  const resetCsrf = () => {
    csrf = null;
    csrfPromise = null;
  };
  const query = (params) => "?" + new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== void 0 && v !== null && v !== "")
  ).toString();
  const idempotency = () => crypto.randomUUID();
  const { reactive } = Vue;
  const preview = window.__CAMPUS_TEST_DEMO__ === true || new URLSearchParams(location.search).get("demo") === "1";
  const store = reactive({
    preview,
    route: window.__CAMPUS_TEST_ROUTE__ || location.hash.replace(/^#/, "") || "/",
    products: [],
    merchants: [],
    categories: [],
    stocks: [],
    user: null,
    workspace: null,
    merchantId: "",
    loading: false,
    error: "",
    toast: "",
    cartCount: 0,
    messages: [],
    conversationId: "",
    proposal: null,
    photo: null,
    reloadId: 0,
    publicPage: { page: 1, size: 20, total: 0, hasNext: false },
    merchantPage: { page: 1, size: 12, total: 0, hasNext: false }
  });
  const money = (cent) => "¥" + (Number(cent || 0) / 100).toFixed(2).replace(/\.00$/, "");
  const skuOf = (p) => {
    var _a, _b;
    return ((_a = p == null ? void 0 : p.skus) == null ? void 0 : _a.find((s) => s.status === "ACTIVE")) || ((_b = p == null ? void 0 : p.skus) == null ? void 0 : _b[0]) || {};
  };
  const available = (p) => {
    var _a;
    return ((_a = p == null ? void 0 : p.skus) == null ? void 0 : _a.filter((s) => s.status === "ACTIVE").reduce((n, s) => n + Number(s.available || 0), 0)) || 0;
  };
  const shopName = (id) => {
    var _a;
    return ((_a = store.merchants.find((m) => m.merchantId === id)) == null ? void 0 : _a.name) || "校内商户";
  };
  let toastTimer;
  let merchantEpoch = 0, sessionEpoch = 0, publicEpoch = 0;
  const actorId = (user) => (user == null ? void 0 : user.userId) || (user == null ? void 0 : user.id) || (user == null ? void 0 : user.username) || "";
  function replaceSession(user) {
    ++sessionEpoch;
    ++merchantEpoch;
    ++publicEpoch;
    store.user = user;
    store.workspace = null;
    store.merchantId = "";
    store.products = [];
    store.stocks = [];
    store.merchants = [];
    store.conversationId = "";
    store.messages = [];
    store.proposal = null;
  }
  function switchMerchantContext(id) {
    if (id === store.merchantId) return;
    ++merchantEpoch;
    store.merchantId = id;
    store.products = [];
    store.stocks = [];
    store.merchantPage = { page: 1, size: 9, total: 0, hasNext: false };
    store.error = "";
  }
  function beginPublicSearch() {
    return ++publicEpoch;
  }
  function publicSearchCurrent(stamp) {
    return stamp === publicEpoch;
  }
  function notify(message) {
    store.toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => store.toast = "", 3200);
  }
  function go(path) {
    location.hash = path;
  }
  function setRoute() {
    const next = location.hash.replace(/^#/, "") || "/";
    if (next !== store.route) {
      ++publicEpoch;
      ++merchantEpoch;
      store.loading = false;
    }
    store.route = next;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  async function loadPublic() {
    const stamp = ++publicEpoch;
    store.error = "";
    store.loading = true;
    if (preview) {
      store.products = DEMO_PRODUCTS.filter((p) => p.status === "PUBLISHED");
      store.merchants = DEMO_MERCHANTS;
      store.categories = DEMO_CATEGORIES;
      store.publicPage = { page: 1, size: 20, total: store.products.length, hasNext: false };
      store.loading = false;
      return;
    }
    try {
      const [merchants, categories, products] = await Promise.all([
        api("/merchants/public/page" + query({ page: 1, size: 50 })),
        api("/categories"),
        api("/products/page" + query({ page: 1, size: 20 }))
      ]);
      if (!publicSearchCurrent(stamp)) return;
      store.merchants = (merchants == null ? void 0 : merchants.items) || [];
      store.categories = categories || [];
      store.products = (products == null ? void 0 : products.items) || [];
      store.publicPage = {
        page: (products == null ? void 0 : products.page) || 1,
        size: (products == null ? void 0 : products.size) || 20,
        total: (products == null ? void 0 : products.total) || 0,
        hasNext: !!(products == null ? void 0 : products.hasNext)
      };
    } catch (err) {
      if (publicSearchCurrent(stamp)) {
        store.error = err.message;
        store.products = [];
      }
    } finally {
      if (publicSearchCurrent(stamp)) store.loading = false;
    }
  }
  async function loadMerchant({
    page = 1,
    size = 9,
    q = "",
    category = "",
    status = "",
    sort = "NEWEST"
  } = {}) {
    var _a, _b, _c;
    const stamp = ++merchantEpoch, authStamp = sessionEpoch;
    const requested = store.merchantId, originalActor = actorId(store.user);
    let target = requested;
    const current = () => stamp === merchantEpoch && authStamp === sessionEpoch && store.route.startsWith("/merchant") && store.merchantId === requested && actorId(store.user) === originalActor;
    if (!["PUBLISHED", "DRAFT", "UNPUBLISHED"].includes(status)) status = "";
    store.error = "";
    store.loading = true;
    if (preview) {
      store.products = DEMO_PRODUCTS.filter((p) => p.merchantId === "preview-m1");
      store.stocks = DEMO_STOCKS;
      store.merchantPage = { page: 1, size: 12, total: store.products.length, hasNext: false };
      store.categories = DEMO_CATEGORIES;
      store.merchants = DEMO_MERCHANTS;
      store.merchantId = "preview-m1";
      store.workspace = {
        merchants: DEMO_MERCHANTS.slice(0, 1),
        memberships: [{ merchantId: "preview-m1", role: "OWNER", status: "ACTIVE" }]
      };
      store.user = { displayName: "演示店长" };
      store.loading = false;
      return;
    }
    try {
      const [user, workspace, categories] = await Promise.all([
        api("/auth/me"),
        api("/workspace"),
        api("/categories")
      ]);
      if (!current()) return;
      const options = (workspace == null ? void 0 : workspace.merchants) || [];
      const next = ((_a = options.find((m) => m.merchantId === requested)) == null ? void 0 : _a.merchantId) || ((_b = options[0]) == null ? void 0 : _b.merchantId) || "";
      store.user = user;
      store.workspace = workspace;
      store.categories = categories || [];
      store.merchants = options;
      store.merchantId = next;
      target = next;
      if (!next) {
        store.products = [];
        store.stocks = [];
        store.error = "当前账号没有商户权限";
        return;
      }
      const id = encodeURIComponent(next), permissions = ((_c = workspace == null ? void 0 : workspace.merchantPermissions) == null ? void 0 : _c[next]) || [];
      const [products, stocks] = await Promise.all([
        permissions.includes("product.read") ? api(`/merchants/${id}/products/page` + query({ page, size, q, category, status, sort })) : Promise.resolve({ items: [], page: 1, size, total: 0, hasNext: false }),
        permissions.includes("stock.read") ? api(`/merchants/${id}/stocks/page` + query({ page: 1, size: 100 })) : Promise.resolve({ items: [] })
      ]);
      if (stamp !== merchantEpoch || authStamp !== sessionEpoch || !store.route.startsWith("/merchant") || store.merchantId !== next || actorId(store.user) !== actorId(user))
        return;
      store.products = (products == null ? void 0 : products.items) || [];
      store.merchantPage = {
        page: (products == null ? void 0 : products.page) || 1,
        size: (products == null ? void 0 : products.size) || size,
        total: (products == null ? void 0 : products.total) || 0,
        hasNext: !!(products == null ? void 0 : products.hasNext)
      };
      store.stocks = (stocks == null ? void 0 : stocks.items) || [];
    } catch (err) {
      if (stamp === merchantEpoch && authStamp === sessionEpoch && store.route.startsWith("/merchant") && store.merchantId === target) {
        store.error = err.status === 401 ? "请先在现有站点登录商户账号" : err.message;
        store.products = [];
        store.stocks = [];
      }
    } finally {
      if (stamp === merchantEpoch && authStamp === sessionEpoch) store.loading = false;
    }
  }
  async function loadSession() {
    if (preview) return;
    const stamp = sessionEpoch, original = actorId(store.user);
    try {
      const user = await api("/auth/me");
      if (stamp === sessionEpoch && actorId(store.user) === original) store.user = user;
    } catch (err) {
      if (stamp === sessionEpoch && actorId(store.user) === original && (err.status === 401 || err.code === "A0004"))
        store.user = null;
    }
  }
  function hasPermission(code, merchantId = store.merchantId) {
    var _a, _b, _c;
    return preview || !!((_c = (_b = (_a = store.workspace) == null ? void 0 : _a.merchantPermissions) == null ? void 0 : _b[merchantId]) == null ? void 0 : _c.includes(code));
  }
  function isOwner() {
    var _a, _b;
    return preview || !!((_b = (_a = store.workspace) == null ? void 0 : _a.memberships) == null ? void 0 : _b.some(
      (m) => m.merchantId === store.merchantId && m.role === "OWNER" && m.status === "ACTIVE"
    ));
  }
  function previewGuard() {
    if (!preview) return false;
    notify("设计预览：不会修改服务器数据");
    return true;
  }
  const { ref: ref$g } = Vue;
  const AuthDialog = {
    name: "AuthDialog",
    emits: ["close", "success"],
    setup(props, { emit }) {
      const mode = ref$g("login");
      const username = ref$g("");
      const password = ref$g("");
      const displayName = ref$g("");
      const busy = ref$g(false);
      const error = ref$g("");
      async function submit() {
        if (busy.value) return;
        error.value = "";
        if (!username.value.trim() || !password.value) {
          error.value = "请填写账号和密码";
          return;
        }
        busy.value = true;
        try {
          if (mode.value === "register") {
            await api("/auth/register", {
              method: "POST",
              body: {
                username: username.value.trim(),
                password: password.value,
                displayName: displayName.value.trim() || username.value.trim()
              }
            });
            mode.value = "login";
            password.value = "";
            notify("注册成功，请登录");
          } else {
            const user = await api("/auth/login", {
              method: "POST",
              body: { username: username.value.trim(), password: password.value }
            });
            resetCsrf();
            replaceSession(user);
            password.value = "";
            emit("success", user);
            emit("close");
            notify("已登录");
          }
        } catch (err) {
          error.value = err.message;
        } finally {
          busy.value = false;
        }
      }
      return { mode, username, password, displayName, busy, error, submit };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, vModelText: _vModelText, withDirectives: _withDirectives, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, withModifiers: _withModifiers } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        return _openBlock(), _createElementBlock("div", {
          class: "ui-overlay",
          onClick: _withModifiers(($event) => _ctx.$emit("close"), ["self"])
        }, [
          _createElementVNode("form", {
            class: "login-dialog",
            onSubmit: _withModifiers(_ctx.submit, ["prevent"]),
            "aria-label": "账号登录"
          }, [
            _createElementVNode("div", { class: "login-dialog-heading" }, [
              _createElementVNode("span", { class: "auth-logo" }, [
                _createVNode(_component_Icon, {
                  name: "sparkles",
                  size: 22
                })
              ]),
              _createElementVNode("button", {
                type: "button",
                onClick: ($event) => _ctx.$emit("close"),
                "aria-label": "关闭登录窗"
              }, [
                _createVNode(_component_Icon, {
                  name: "x",
                  size: 20
                })
              ], 8, ["onClick"])
            ]),
            _createElementVNode(
              "h2",
              null,
              _toDisplayString(_ctx.mode === "login" ? "欢迎回来" : "创建账号"),
              1
              /* TEXT */
            ),
            _createElementVNode("label", { for: "login-name" }, "账号"),
            _withDirectives(_createElementVNode("input", {
              id: "login-name",
              "onUpdate:modelValue": ($event) => _ctx.username = $event,
              autocomplete: "username",
              required: "",
              maxlength: "32",
              placeholder: "用户名"
            }, null, 8, ["onUpdate:modelValue"]), [
              [_vModelText, _ctx.username]
            ]),
            _createElementVNode("label", { for: "login-password" }, "密码"),
            _withDirectives(_createElementVNode("input", {
              id: "login-password",
              "onUpdate:modelValue": ($event) => _ctx.password = $event,
              type: "password",
              autocomplete: _ctx.mode === "login" ? "current-password" : "new-password",
              required: "",
              placeholder: "输入密码"
            }, null, 8, ["onUpdate:modelValue", "autocomplete"]), [
              [_vModelText, _ctx.password]
            ]),
            _ctx.mode === "register" ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 0 },
              [
                _createElementVNode("label", { for: "login-display" }, "昵称"),
                _withDirectives(_createElementVNode("input", {
                  id: "login-display",
                  "onUpdate:modelValue": ($event) => _ctx.displayName = $event,
                  maxlength: "50",
                  placeholder: "昵称（选填）"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.displayName]
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : _createCommentVNode("v-if", true),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 1,
                class: "login-error"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            _createElementVNode("button", {
              type: "submit",
              class: "primary-wide login-submit",
              disabled: _ctx.busy
            }, _toDisplayString(_ctx.busy ? "请稍候…" : _ctx.mode === "login" ? "登录" : "注册"), 9, ["disabled"]),
            _createElementVNode("button", {
              type: "button",
              class: "login-switch",
              onClick: ($event) => {
                _ctx.mode = _ctx.mode === "login" ? "register" : "login";
                _ctx.error = "";
              }
            }, _toDisplayString(_ctx.mode === "login" ? "没有账号？注册" : "已有账号？登录"), 9, ["onClick"])
          ], 40, ["onSubmit"])
        ], 8, ["onClick"]);
      };
    })()
  };
  const { ref: ref$f } = Vue;
  const ConsumerShell = {
    name: "ConsumerShell",
    components: { AuthDialog },
    props: { active: { type: String, default: "home" } },
    setup() {
      const loginOpen = ref$f(false);
      async function logout() {
        try {
          await api("/auth/logout", { method: "POST" });
          resetCsrf();
          replaceSession(null);
          notify("已退出");
          go("/");
          loadPublic();
        } catch (err) {
          notify(err.message);
        }
      }
      return { go, store, preview, loginOpen, logout, loadPublic };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, renderSlot: _renderSlot, normalizeClass: _normalizeClass, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        var _a;
        const _component_Icon = _resolveComponent("Icon");
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        return _openBlock(), _createElementBlock("div", { class: "consumer-shell" }, [
          _createElementVNode("div", { class: "consumer-width" }, [
            _createElementVNode("header", { class: "consumer-header" }, [
              _createElementVNode("div", { class: "campus-location" }, [
                _createElementVNode("div", { class: "brand-pin" }, [
                  _createElementVNode("span")
                ]),
                _createElementVNode("div", null, [
                  _createElementVNode("div", { class: "location-name" }, "青柠校园"),
                  _createElementVNode("div", { class: "location-sub" }, "校园好物 · 到店自提")
                ])
              ]),
              _createElementVNode("div", { class: "header-trailing" }, [
                _ctx.store.preview ? (_openBlock(), _createElementBlock("span", {
                  key: 0,
                  class: "demo-pill",
                  title: "仅用于视觉预览"
                }, "设计预览")) : !_ctx.store.user ? (_openBlock(), _createElementBlock("button", {
                  key: 1,
                  class: "header-login",
                  onClick: ($event) => _ctx.loginOpen = true
                }, "登录", 8, ["onClick"])) : (_openBlock(), _createElementBlock("button", {
                  key: 2,
                  class: "account-pill",
                  onClick: _ctx.logout,
                  title: "退出登录"
                }, [
                  _createTextVNode(
                    _toDisplayString(((_a = _ctx.store.user.displayName) == null ? void 0 : _a.slice(0, 2)) || "我") + " ",
                    1
                    /* TEXT */
                  ),
                  _createVNode(_component_Icon, {
                    name: "logout",
                    size: 12
                  })
                ], 8, ["onClick"]))
              ])
            ]),
            _createElementVNode("main", { class: "consumer-main" }, [
              _renderSlot(_ctx.$slots, "default")
            ])
          ]),
          _createElementVNode("nav", {
            class: "mobile-tabbar",
            "aria-label": "消费者导航"
          }, [
            _createElementVNode("div", { class: "mobile-tabbar-inner" }, [
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "home" }),
                onClick: ($event) => _ctx.go("/"),
                "aria-label": "首页"
              }, [
                _createVNode(_component_Icon, {
                  name: "home",
                  size: 23
                }),
                _createElementVNode("span", null, "首页")
              ], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "ai" }),
                onClick: ($event) => _ctx.go("/ai"),
                "aria-label": "AI导购"
              }, [
                _createElementVNode("span", { class: "tiny-orb" }, [
                  _createVNode(_component_Icon, {
                    name: "sparkles",
                    size: 20
                  })
                ]),
                _createElementVNode("span", null, "导购")
              ], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "cart" }),
                onClick: ($event) => _ctx.go("/cart")
              }, [
                _createVNode(_component_Icon, {
                  name: "cart",
                  size: 23
                }),
                _createElementVNode("span", null, "购物车")
              ], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "orders" }),
                onClick: ($event) => _ctx.go("/orders")
              }, [
                _createVNode(_component_Icon, {
                  name: "order",
                  size: 23
                }),
                _createElementVNode("span", null, "订单")
              ], 10, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass({ selected: _ctx.active === "account" }),
                onClick: ($event) => _ctx.go("/account")
              }, [
                _createVNode(_component_Icon, {
                  name: "user",
                  size: 23
                }),
                _createElementVNode("span", null, "我的")
              ], 10, ["onClick"])
            ])
          ]),
          _ctx.loginOpen ? (_openBlock(), _createBlock(_component_AuthDialog, {
            key: 0,
            onClose: ($event) => _ctx.loginOpen = false,
            onSuccess: _ctx.loadPublic
          }, null, 8, ["onClose", "onSuccess"])) : _createCommentVNode("v-if", true)
        ]);
      };
    })()
  };
  const { computed: computed$f, ref: ref$e, watch: watch$d } = Vue;
  const ProductImage = {
    name: "ProductImage",
    props: {
      src: { type: String, default: "" },
      alt: { type: String, default: "商品图片" },
      loading: { type: String, default: "lazy" }
    },
    setup(props) {
      const broken = ref$e(false);
      watch$d(
        () => props.src,
        () => {
          broken.value = false;
        }
      );
      const url = computed$f(
        () => {
          var _a;
          return !broken.value && ((_a = props.src) == null ? void 0 : _a.trim()) ? props.src : "./images/product-placeholder.svg";
        }
      );
      function handleError() {
        if (!broken.value) broken.value = true;
      }
      return { url, handleError };
    },
    render: (() => {
      const { openBlock: _openBlock, createElementBlock: _createElementBlock } = Vue;
      return function render(_ctx, _cache) {
        return _openBlock(), _createElementBlock("img", {
          src: _ctx.url,
          alt: _ctx.alt,
          loading: _ctx.loading,
          onError: _ctx.handleError
        }, null, 40, ["src", "alt", "loading", "onError"]);
      };
    })()
  };
  const { ref: ref$d, computed: computed$e, onUnmounted: onUnmounted$a } = Vue;
  const staticCategoryArt = {
    food: "./images/category-snacks.webp",
    drink: "./images/category-drinks.webp",
    fruit: "./images/category-fruit.webp",
    stationery: "./images/category-stationery.webp",
    daily: "./images/category-daily.webp"
  };
  const Home = {
    name: "Home",
    components: { ConsumerShell, ProductImage },
    setup() {
      const keywords = ["泡面", "牛奶", "水果", "文具", "纸巾", "零食"];
      const search = ref$d("");
      const category = ref$d("");
      const merchant = ref$d("");
      const sort = ref$d("popular");
      const page = ref$d(1);
      const selected = ref$d(null);
      const chosenSku = ref$d("");
      const count = ref$d(1);
      const saving = ref$d(false);
      const categories = computed$e(() => store.categories.filter((c) => c.active).slice(0, 5));
      const shops = computed$e(() => store.merchants.filter((m) => m.status === "ACTIVE").slice(0, 3));
      const shown = computed$e(() => {
        let arr = store.products.filter((p) => p.status === "PUBLISHED");
        if (preview) {
          const q = search.value.trim().toLowerCase();
          if (q) arr = arr.filter((p) => (p.title + " " + p.description).toLowerCase().includes(q));
        }
        if (category.value) arr = arr.filter((p) => p.categoryCode === category.value);
        if (merchant.value) arr = arr.filter((p) => p.merchantId === merchant.value);
        if (preview && sort.value === "price")
          arr = [...arr].sort((a, b) => Number(skuOf(a).priceCent) - Number(skuOf(b).priceCent));
        if (preview && sort.value === "stock")
          arr = [...arr].sort((a, b) => available(b) - available(a));
        return arr;
      });
      const priceSku = (p) => [...(p == null ? void 0 : p.skus) || []].filter((s) => s.status === "ACTIVE").sort((a, b) => Number(a.priceCent) - Number(b.priceCent))[0] || skuOf(p);
      const pageInfo = computed$e(() => store.publicPage);
      const chosen = computed$e(
        () => {
          var _a, _b;
          return ((_b = (_a = selected.value) == null ? void 0 : _a.skus) == null ? void 0 : _b.find((s) => s.skuId === chosenSku.value)) || skuOf(selected.value);
        }
      );
      const productCategory = (p) => {
        var _a;
        return ((_a = store.categories.find((c) => c.code === p.categoryCode)) == null ? void 0 : _a.name) || "好物";
      };
      const currentShop = (p) => store.merchants.find((m) => m.merchantId === p.merchantId) || {};
      async function loadSearch() {
        if (preview) return;
        const stamp = beginPublicSearch();
        const params = {
          q: search.value,
          category: category.value,
          merchantId: merchant.value,
          page: page.value,
          size: 20,
          sort: sort.value === "price" ? "PRICE_ASC" : sort.value === "stock" ? "STOCK_DESC" : "NEWEST"
        };
        store.loading = true;
        store.error = "";
        try {
          const result = await api("/products/page" + query(params));
          if (!publicSearchCurrent(stamp)) return;
          store.products = result.items || [];
          store.publicPage = {
            page: result.page,
            size: result.size,
            total: result.total,
            hasNext: result.hasNext
          };
        } catch (err) {
          if (publicSearchCurrent(stamp)) store.error = err.message;
        } finally {
          if (publicSearchCurrent(stamp)) store.loading = false;
        }
      }
      onUnmounted$a(() => beginPublicSearch());
      function setCategory(c) {
        category.value = category.value === c ? "" : c;
        page.value = 1;
        loadSearch();
      }
      function applyKeyword(word) {
        search.value = word;
        page.value = 1;
        loadSearch();
      }
      function showDetail(p) {
        selected.value = p;
        chosenSku.value = skuOf(p).skuId || "";
        count.value = 1;
      }
      async function addCart() {
        var _a;
        if (!selected.value || saving.value || previewGuard()) return;
        if (!((_a = chosen.value) == null ? void 0 : _a.skuId)) {
          notify("请选择有效规格");
          return;
        }
        saving.value = true;
        try {
          const current = await api("/products/" + encodeURIComponent(selected.value.productId));
          const real = current.skus.find((s) => s.skuId === chosenSku.value);
          if (!real || real.status !== "ACTIVE" || Number(real.available) < count.value)
            throw new Error("库存不足或商品不可售");
          const cart = await api("/cart");
          const old = (cart || []).find((i) => i.skuId === real.skuId);
          const n = Number((old == null ? void 0 : old.quantity) || 0) + count.value;
          if (n > 99) throw new Error("单个规格最多购买99件");
          await api("/cart", { method: "PUT", body: { skuId: real.skuId, quantity: n } });
          selected.value = null;
          notify("已加入购物车");
        } catch (err) {
          notify(err.status === 401 ? "请先登录后再加购" : err.message);
        } finally {
          saving.value = false;
        }
      }
      return {
        store,
        go,
        money,
        skuOf,
        priceSku,
        available,
        shopName,
        preview,
        keywords,
        search,
        category,
        merchant,
        sort,
        page,
        pageInfo,
        categories,
        shops,
        shown,
        selected,
        chosen,
        chosenSku,
        count,
        saving,
        productCategory,
        currentShop,
        staticCategoryArt,
        loadSearch,
        setCategory,
        applyKeyword,
        showDetail,
        addCart
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, vModelText: _vModelText, withKeys: _withKeys, createElementVNode: _createElementVNode, withDirectives: _withDirectives, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, toDisplayString: _toDisplayString, normalizeClass: _normalizeClass, createTextVNode: _createTextVNode, createCommentVNode: _createCommentVNode, createBlock: _createBlock, withModifiers: _withModifiers, withCtx: _withCtx } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
          default: _withCtx(() => [
            _createElementVNode("section", { class: "search-section" }, [
              _createElementVNode("div", { class: "big-search" }, [
                _createVNode(_component_Icon, {
                  name: "search",
                  size: 22
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.search = $event,
                  placeholder: "搜索商品、商户名称、规格",
                  "aria-label": "搜索校园商品",
                  onKeydown: _withKeys(($event) => {
                    _ctx.page = 1;
                    _ctx.loadSearch();
                  }, ["enter"])
                }, null, 40, ["onUpdate:modelValue", "onKeydown"]), [
                  [_vModelText, _ctx.search]
                ]),
                _createElementVNode("button", {
                  onClick: ($event) => {
                    _ctx.page = 1;
                    _ctx.loadSearch();
                  }
                }, "搜索", 8, ["onClick"])
              ]),
              _createElementVNode("div", { class: "popular-tags" }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.keywords, (k) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: k,
                      onClick: ($event) => _ctx.applyKeyword(k),
                      class: _normalizeClass({ active: _ctx.search === k })
                    }, _toDisplayString(k), 11, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ]),
            _createElementVNode("button", {
              class: "hero-shopping",
              onClick: ($event) => _ctx.go("/ai"),
              "aria-label": "进入 AI 导购"
            }, [
              _createElementVNode("div", { class: "hero-lines" }, [
                _createElementVNode("div", { class: "hero-title" }, [
                  _createElementVNode("span", null, "AI"),
                  _createTextVNode(" 导购")
                ]),
                _createElementVNode("h1", null, "你的校园购物小助手"),
                _createElementVNode("span", { class: "hero-cta" }, [
                  _createTextVNode("开始探索 "),
                  _createVNode(_component_Icon, {
                    name: "arrowUpRight",
                    size: 17
                  })
                ])
              ]),
              _createElementVNode("div", { class: "hero-robot-wrap" }, [
                _createElementVNode("img", {
                  src: "./images/robot.webp",
                  alt: "AI 导购机器人"
                })
              ]),
              _createElementVNode("span", { class: "hero-star hstar-one" }, "✦"),
              _createElementVNode("span", { class: "hero-star hstar-two" }, "✧")
            ], 8, ["onClick"]),
            _createElementVNode("section", {
              class: "category-section",
              "aria-label": "商品分类"
            }, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.categories, (c) => {
                  return _openBlock(), _createElementBlock("button", {
                    key: c.code,
                    class: _normalizeClass(["category-item", { categoryActive: _ctx.category === c.code }]),
                    onClick: ($event) => _ctx.setCategory(c.code)
                  }, [
                    _createElementVNode("span", { class: "category-picture" }, [
                      _createElementVNode("img", {
                        src: _ctx.staticCategoryArt[c.code] || "./images/category-snacks.webp",
                        alt: c.name
                      }, null, 8, ["src", "alt"])
                    ]),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(c.name),
                      1
                      /* TEXT */
                    )
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            _createElementVNode("section", { class: "merchant-section" }, [
              _createElementVNode("div", { class: "section-head" }, [
                _createElementVNode("div", { class: "section-title" }, [
                  _createElementVNode("span", { class: "head-accent mint" }, [
                    _createVNode(_component_Icon, {
                      name: "store",
                      size: 21
                    })
                  ]),
                  _createElementVNode("h2", null, "附近商家")
                ]),
                _createElementVNode("span", { class: "tiny-note" }, "校内自提")
              ]),
              _createElementVNode("div", { class: "merchant-cards" }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.shops, (m, idx) => {
                    return _openBlock(), _createElementBlock("button", {
                      class: _normalizeClass(["merchant-card", { active: _ctx.merchant === m.merchantId }]),
                      key: m.merchantId,
                      onClick: ($event) => {
                        _ctx.merchant = m.merchantId;
                        _ctx.page = 1;
                        _ctx.loadSearch();
                      }
                    }, [
                      _createElementVNode(
                        "span",
                        {
                          class: _normalizeClass(["merchant-logo", "store-" + idx])
                        },
                        [
                          m.image ? (_openBlock(), _createElementBlock("img", {
                            key: 0,
                            src: m.image,
                            alt: m.name
                          }, null, 8, ["src", "alt"])) : (_openBlock(), _createBlock(_component_Icon, {
                            key: 1,
                            name: "store",
                            size: 21
                          }))
                        ],
                        2
                        /* CLASS */
                      ),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(m.name),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "small",
                        null,
                        _toDisplayString(m.storeName || m.location || "校内门店"),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode("span", { class: "merchant-chip" }, [
                        _createElementVNode("span", { class: "merchant-chip-dot" }),
                        _createTextVNode(" 可自提")
                      ])
                    ], 10, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              _ctx.merchant ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "merchant-filter-bar"
              }, [
                _createTextVNode(
                  "当前：" + _toDisplayString(_ctx.shopName(_ctx.merchant)),
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  onClick: ($event) => {
                    _ctx.merchant = "";
                    _ctx.page = 1;
                    _ctx.loadSearch();
                  }
                }, [
                  _createTextVNode("清除筛选 "),
                  _createVNode(_component_Icon, {
                    name: "x",
                    size: 13
                  })
                ], 8, ["onClick"])
              ])) : _createCommentVNode("v-if", true)
            ]),
            _createElementVNode("section", { class: "reco-section" }, [
              _createElementVNode("div", { class: "section-head reco-heading" }, [
                _createElementVNode("div", { class: "section-title" }, [
                  _createElementVNode("span", { class: "flame-icon" }, "✦"),
                  _createElementVNode("h2", null, "为你推荐")
                ]),
                _createElementVNode("div", { class: "sort-tabs" }, [
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.sort === "popular" }),
                    onClick: ($event) => {
                      _ctx.sort = "popular";
                      _ctx.page = 1;
                      _ctx.loadSearch();
                    }
                  }, "最新", 10, ["onClick"]),
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.sort === "stock" }),
                    onClick: ($event) => {
                      _ctx.sort = "stock";
                      _ctx.page = 1;
                      _ctx.loadSearch();
                    }
                  }, "全局库存", 10, ["onClick"]),
                  _createElementVNode("button", {
                    class: _normalizeClass({ active: _ctx.sort === "price" }),
                    onClick: ($event) => {
                      _ctx.sort = "price";
                      _ctx.page = 1;
                      _ctx.loadSearch();
                    }
                  }, "全局价格", 10, ["onClick"])
                ])
              ]),
              _ctx.store.loading ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "inline-loading"
              }, [
                _createElementVNode("div", { class: "mini-spinner" }),
                _createTextVNode("正在加载")
              ])) : _createCommentVNode("v-if", true),
              _ctx.store.error ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "inline-error"
              }, [
                _createVNode(_component_Icon, {
                  name: "alert",
                  size: 18
                }),
                _createTextVNode(
                  _toDisplayString(_ctx.store.error) + " ",
                  1
                  /* TEXT */
                ),
                !_ctx.preview ? (_openBlock(), _createElementBlock("a", {
                  key: 0,
                  href: "/?demo=1#/"
                }, "查看设计预览")) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true),
              !_ctx.store.loading && !_ctx.shown.length && !_ctx.store.error ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "no-results"
              }, [
                _createVNode(_component_Icon, {
                  name: "search",
                  size: 22
                }),
                _createTextVNode("暂无相关商品"),
                _createElementVNode("button", {
                  onClick: ($event) => {
                    _ctx.search = "";
                    _ctx.category = "";
                    _ctx.merchant = "";
                    _ctx.page = 1;
                    _ctx.loadSearch();
                  }
                }, "查看全部", 8, ["onClick"])
              ])) : _createCommentVNode("v-if", true),
              _createElementVNode("div", { class: "home-product-grid" }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.shown, (p) => {
                    return _openBlock(), _createElementBlock("article", {
                      class: "home-product",
                      key: p.productId,
                      onClick: ($event) => _ctx.showDetail(p)
                    }, [
                      _createElementVNode("div", { class: "home-product-photo" }, [
                        _createVNode(_component_ProductImage, {
                          src: p.imageUrl,
                          alt: p.title
                        }, null, 8, ["src", "alt"]),
                        p.tag ? (_openBlock(), _createElementBlock(
                          "span",
                          {
                            key: 0,
                            class: "corner-tag"
                          },
                          _toDisplayString(p.tag),
                          1
                          /* TEXT */
                        )) : _createCommentVNode("v-if", true),
                        _createElementVNode("span", { class: "floating-pickup" }, "可自提")
                      ]),
                      _createElementVNode("div", { class: "home-product-info" }, [
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(p.title),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode("div", { class: "product-minor" }, [
                          _createElementVNode(
                            "span",
                            null,
                            _toDisplayString(_ctx.skuOf(p).specKey),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            null,
                            "库存 " + _toDisplayString(_ctx.available(p) > 0 ? "充足" : "售罄"),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createElementVNode("div", { class: "product-price-row" }, [
                          _createElementVNode(
                            "span",
                            { class: "price-main" },
                            _toDisplayString(_ctx.money(_ctx.priceSku(p).priceCent)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("button", {
                            onClick: _withModifiers(($event) => _ctx.showDetail(p), ["stop"]),
                            "aria-label": "查看" + p.title
                          }, [
                            _createVNode(_component_Icon, {
                              name: "plus",
                              size: 20
                            })
                          ], 8, ["onClick", "aria-label"])
                        ])
                      ])
                    ], 8, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              !_ctx.preview && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "sdd-pager"
              }, [
                _createElementVNode(
                  "span",
                  null,
                  "共 " + _toDisplayString(_ctx.pageInfo.total) + " 件",
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: _ctx.page <= 1 || _ctx.store.loading,
                  onClick: ($event) => {
                    _ctx.page--;
                    _ctx.loadSearch();
                  }
                }, "上一页", 8, ["disabled", "onClick"]),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.page),
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: !_ctx.pageInfo.hasNext || _ctx.store.loading,
                  onClick: ($event) => {
                    _ctx.page++;
                    _ctx.loadSearch();
                  }
                }, "下一页", 8, ["disabled", "onClick"])
              ])) : _createCommentVNode("v-if", true)
            ]),
            _ctx.selected ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "ui-overlay",
              onClick: _withModifiers(($event) => _ctx.selected = null, ["self"])
            }, [
              _createElementVNode("div", {
                class: "product-sheet",
                role: "dialog",
                "aria-modal": "true",
                "aria-label": _ctx.selected.title
              }, [
                _createElementVNode("button", {
                  class: "sheet-close",
                  onClick: ($event) => _ctx.selected = null,
                  "aria-label": "关闭"
                }, [
                  _createVNode(_component_Icon, {
                    name: "x",
                    size: 19
                  })
                ], 8, ["onClick"]),
                _createElementVNode("div", { class: "sheet-product-line" }, [
                  _createVNode(_component_ProductImage, {
                    src: _ctx.selected.imageUrl,
                    alt: _ctx.selected.title
                  }, null, 8, ["src", "alt"]),
                  _createElementVNode("div", null, [
                    _createElementVNode(
                      "span",
                      { class: "mini-category" },
                      _toDisplayString(_ctx.productCategory(_ctx.selected)),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "h3",
                      null,
                      _toDisplayString(_ctx.selected.title),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "div",
                      { class: "sheet-price" },
                      _toDisplayString(_ctx.money(_ctx.chosen.priceCent)),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "span",
                      { class: "sheet-muted" },
                      _toDisplayString(_ctx.currentShop(_ctx.selected).name || "校内商户"),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                _createElementVNode("button", {
                  class: "more-product-detail",
                  onClick: ($event) => {
                    _ctx.go("/product/" + _ctx.selected.productId);
                    _ctx.selected = null;
                  }
                }, [
                  _createTextVNode("查看商品详情 "),
                  _createVNode(_component_Icon, {
                    name: "chevronRight",
                    size: 15
                  })
                ], 8, ["onClick"]),
                _createElementVNode("label", { class: "sheet-field-label" }, "选择规格"),
                _createElementVNode("div", { class: "sku-picker" }, [
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.selected.skus, (sku2) => {
                      return _openBlock(), _createElementBlock("button", {
                        key: sku2.skuId,
                        class: _normalizeClass({ active: _ctx.chosenSku === sku2.skuId }),
                        disabled: sku2.status !== "ACTIVE" || sku2.available === 0,
                        onClick: ($event) => _ctx.chosenSku = sku2.skuId
                      }, _toDisplayString(sku2.specKey), 11, ["disabled", "onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                _createElementVNode("div", { class: "quantity-picker" }, [
                  _createElementVNode("span", null, "购买数量"),
                  _createElementVNode("div", null, [
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.count = Math.max(1, _ctx.count - 1),
                      "aria-label": "减少数量"
                    }, [
                      _createVNode(_component_Icon, {
                        name: "minus",
                        size: 17
                      })
                    ], 8, ["onClick"]),
                    _createElementVNode(
                      "b",
                      null,
                      _toDisplayString(_ctx.count),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.count = Math.min(99, Number(_ctx.chosen.available || 0), _ctx.count + 1),
                      "aria-label": "增加数量",
                      disabled: _ctx.count >= Number(_ctx.chosen.available || 0)
                    }, [
                      _createVNode(_component_Icon, {
                        name: "plus",
                        size: 17
                      })
                    ], 8, ["onClick", "disabled"])
                  ])
                ]),
                _createElementVNode("button", {
                  class: "primary-wide",
                  disabled: !_ctx.chosen.skuId || !_ctx.chosen.available || _ctx.saving || _ctx.preview,
                  onClick: _ctx.addCart
                }, _toDisplayString(_ctx.saving ? "加入中…" : "加入购物车"), 9, ["disabled", "onClick"])
              ], 8, ["aria-label"])
            ], 8, ["onClick"])) : _createCommentVNode("v-if", true)
          ]),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$c, computed: computed$d, onMounted: onMounted$c, onUnmounted: onUnmounted$9, watch: watch$c } = Vue;
  const prompts = [
    { label: "30元内夜宵", icon: "clock", query: "30元以内，推荐几样适合复习时吃的夜宵" },
    { label: "高蛋白零食", icon: "sparkles", query: "想买点高蛋白的零食，有什么推荐？" },
    { label: "复习清单", icon: "book", query: "帮我列一个考试周的购物清单" },
    { label: "找点好喝的", icon: "cart", query: "推荐适合夏天喝的饮料" }
  ];
  const Guide = {
    name: "Guide",
    components: { ConsumerShell, ProductImage },
    setup() {
      const input = ref$c("");
      const thinking = ref$c(false);
      const selectedIds = ref$c([]);
      const messages = ref$c([]);
      const proposal = ref$c(null);
      const mode = ref$c("");
      const error = ref$c("");
      const historyOpen = ref$c(false);
      const conversations = ref$c([]);
      const historyPage = ref$c(1);
      const historyHasMore = ref$c(false);
      const loadingHistory = ref$c(false);
      const openingConversation = ref$c(false);
      let conversationEpoch = 0, historyEpoch = 0;
      const examples = computed$d(() => DEMO_PRODUCTS.slice(0, 3));
      const items2 = computed$d(
        () => {
          var _a;
          return preview ? examples.value.map((p) => ({
            skuId: skuOf(p).skuId,
            product: p,
            title: p.title,
            specKey: skuOf(p).specKey,
            priceCent: skuOf(p).priceCent,
            quantity: 1,
            merchantId: p.merchantId
          })) : (((_a = proposal.value) == null ? void 0 : _a.items) || []).map((i) => ({
            ...i,
            product: store.products.find((p) => p.skus.some((s) => s.skuId === i.skuId))
          }));
        }
      );
      const total = computed$d(
        () => items2.value.filter((i) => selectedIds.value.includes(i.skuId)).reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity || 1), 0)
      );
      const showProposal = computed$d(() => {
        var _a, _b;
        return preview || !!((_b = (_a = proposal.value) == null ? void 0 : _a.items) == null ? void 0 : _b.length);
      });
      const formatTime = () => (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
      watch$c(
        () => {
          var _a;
          return (_a = store.user) == null ? void 0 : _a.userId;
        },
        (now, was) => {
          if (preview || now === was) return;
          ++conversationEpoch;
          ++historyEpoch;
          store.conversationId = "";
          messages.value = [];
          conversations.value = [];
          historyPage.value = 1;
          historyHasMore.value = false;
          proposal.value = null;
          selectedIds.value = [];
          mode.value = "";
          error.value = "";
          input.value = "";
          thinking.value = false;
          openingConversation.value = false;
          loadingHistory.value = false;
          historyOpen.value = false;
          if (now) loadHistory();
        }
      );
      onMounted$c(() => {
        if (!preview) loadHistory();
        if (preview) {
          messages.value = DEMO_CHAT.map((m) => ({ ...m, time: "20:14" }));
          selectedIds.value = examples.value.map((p) => skuOf(p).skuId);
        }
      });
      async function ask(question = input.value) {
        var _a;
        const text = String(question || "").trim();
        if (!text || thinking.value || openingConversation.value) return;
        if (text.length > 500) {
          notify("问题不能超过500字");
          return;
        }
        const stamp = ++conversationEpoch;
        input.value = "";
        error.value = "";
        messages.value.push({ role: "user", content: text, time: formatTime() });
        if (preview) {
          messages.value.push({
            role: "assistant",
            content: "为你挑了几款商品，看看有没有喜欢的。",
            time: formatTime(),
            demo: true
          });
          notify("设计预览 · 未请求真实 AI");
          return;
        }
        thinking.value = true;
        try {
          const answer = await api("/ai/chat", {
            method: "POST",
            body: { question: text, conversationId: store.conversationId || null }
          });
          if (stamp !== conversationEpoch) return;
          store.conversationId = answer.conversationId || store.conversationId;
          mode.value = answer.mode || "";
          messages.value.push({
            role: "assistant",
            content: answer.answer || "暂时没有找到合适答案",
            warning: answer.warning,
            citations: (answer.citations || []).map((c) => c.title),
            time: formatTime()
          });
          proposal.value = answer.proposal || null;
          selectedIds.value = (((_a = proposal.value) == null ? void 0 : _a.items) || []).map((i) => i.skuId);
        } catch (err) {
          if (stamp === conversationEpoch) {
            error.value = err.status === 401 ? "请先登录账号再使用 AI 导购" : err.message;
            messages.value.pop();
            input.value = text;
          }
        } finally {
          if (stamp === conversationEpoch) thinking.value = false;
        }
      }
      async function loadHistory(reset = true) {
        if (preview) return;
        if (loadingHistory.value && !reset) return;
        const stamp = ++historyEpoch;
        const page = reset ? 1 : historyPage.value + 1;
        loadingHistory.value = true;
        try {
          const result = await api("/ai/conversations" + query({ page, size: 20 })) || [];
          if (stamp === historyEpoch) {
            conversations.value = reset ? result : [...new Map([...conversations.value, ...result].map((c) => [c.id, c])).values()];
            historyPage.value = page;
            historyHasMore.value = result.length === 20;
          }
        } catch {
          if (stamp === historyEpoch && reset) conversations.value = [];
        } finally {
          if (stamp === historyEpoch) loadingHistory.value = false;
        }
      }
      async function openConversation(c) {
        var _a;
        if (preview || thinking.value || !(c == null ? void 0 : c.id)) return;
        const stamp = ++conversationEpoch;
        openingConversation.value = true;
        try {
          const id = encodeURIComponent(c.id);
          const [history, proposals] = await Promise.all([
            api("/ai/conversations/" + id + "/messages"),
            api("/ai/conversations/" + id + "/proposals")
          ]);
          if (stamp !== conversationEpoch) return;
          store.conversationId = c.id;
          messages.value = (history || []).map((m) => ({
            role: m.role,
            content: m.content,
            time: "历史消息"
          }));
          proposal.value = (proposals || []).find((p) => p.status === "PENDING") || null;
          selectedIds.value = (((_a = proposal.value) == null ? void 0 : _a.items) || []).map((i) => i.skuId);
          historyOpen.value = false;
        } catch (e) {
          if (stamp === conversationEpoch) notify(e.message);
        } finally {
          if (stamp === conversationEpoch) openingConversation.value = false;
        }
      }
      onUnmounted$9(() => {
        ++conversationEpoch;
        ++historyEpoch;
      });
      function toggle(id) {
        if (selectedIds.value.includes(id))
          selectedIds.value = selectedIds.value.filter((x) => x !== id);
        else selectedIds.value = [...selectedIds.value, id];
      }
      async function confirm() {
        var _a, _b, _c;
        if (previewGuard() || !((_a = proposal.value) == null ? void 0 : _a.id) || thinking.value) return;
        const stamp = conversationEpoch, actor = (_b = store.user) == null ? void 0 : _b.userId;
        if (!selectedIds.value.length) {
          notify("至少选择一件商品");
          return;
        }
        thinking.value = true;
        try {
          const updated = await api(
            "/ai/proposals/" + encodeURIComponent(proposal.value.id) + "/confirm",
            { method: "POST", body: { selectedSkuIds: selectedIds.value } }
          );
          if (stamp === conversationEpoch && actor === ((_c = store.user) == null ? void 0 : _c.userId)) {
            proposal.value = updated;
            notify("已确认提案，购物车已更新");
          }
        } catch (err) {
          notify(err.message);
        } finally {
          thinking.value = false;
        }
      }
      async function reject() {
        var _a, _b, _c;
        if (previewGuard() || !((_a = proposal.value) == null ? void 0 : _a.id) || thinking.value) return;
        const stamp = conversationEpoch, actor = (_b = store.user) == null ? void 0 : _b.userId;
        thinking.value = true;
        try {
          await api("/ai/proposals/" + encodeURIComponent(proposal.value.id) + "/reject", {
            method: "POST"
          });
          if (stamp === conversationEpoch && actor === ((_c = store.user) == null ? void 0 : _c.userId)) {
            proposal.value = null;
            notify("已放弃提案");
          }
        } catch (err) {
          notify(err.message);
        } finally {
          thinking.value = false;
        }
      }
      return {
        store,
        go,
        money,
        skuOf,
        preview,
        prompts,
        messages,
        input,
        thinking,
        items: items2,
        selectedIds,
        total,
        showProposal,
        proposal,
        error,
        mode,
        ask,
        toggle,
        confirm,
        reject,
        historyOpen,
        conversations,
        historyHasMore,
        loadingHistory,
        openingConversation,
        loadHistory,
        openConversation
      };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, createTextVNode: _createTextVNode, resolveComponent: _resolveComponent, createVNode: _createVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, toDisplayString: _toDisplayString, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "ai" }, {
          default: _withCtx(() => {
            var _a, _b, _c;
            return [
              _createElementVNode("section", { class: "ai-hero" }, [
                _createElementVNode("div", { class: "ai-hero-text" }, [
                  _createElementVNode("h1", null, [
                    _createElementVNode("span", null, "AI"),
                    _createTextVNode(" 导购助手")
                  ]),
                  _createElementVNode("p", null, "想买什么？问我就好。")
                ]),
                _createElementVNode("img", {
                  src: "./images/robot.webp",
                  alt: "AI 导购机器人",
                  class: "ai-hero-robot"
                }),
                _createElementVNode("span", { class: "orb-decoration orb-one" }, "✦"),
                _createElementVNode("span", { class: "orb-decoration orb-two" }, "✧")
              ]),
              !_ctx.preview ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "ai-history-head"
              }, [
                _createElementVNode("button", {
                  onClick: ($event) => {
                    _ctx.historyOpen = !_ctx.historyOpen;
                    _ctx.historyOpen && _ctx.loadHistory();
                  }
                }, [
                  _createVNode(_component_Icon, {
                    name: "clock",
                    size: 15
                  }),
                  _createTextVNode(" 历史会话 "),
                  _createVNode(_component_Icon, {
                    name: "chevronDown",
                    size: 14
                  })
                ], 8, ["onClick"])
              ])) : _createCommentVNode("v-if", true),
              _ctx.historyOpen ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ai-history-list"
              }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.conversations, (c) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: c.id,
                      onClick: ($event) => _ctx.openConversation(c),
                      disabled: _ctx.thinking || _ctx.openingConversation
                    }, [
                      _createVNode(_component_Icon, {
                        name: "order",
                        size: 16
                      }),
                      _createTextVNode(
                        " " + _toDisplayString(c.title || "对话") + " ",
                        1
                        /* TEXT */
                      ),
                      _createVNode(_component_Icon, {
                        name: "chevronRight",
                        size: 14
                      })
                    ], 8, ["onClick", "disabled"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !_ctx.conversations.length ? (_openBlock(), _createElementBlock("span", { key: 0 }, "暂无历史记录")) : _createCommentVNode("v-if", true),
                _ctx.historyHasMore ? (_openBlock(), _createElementBlock("button", {
                  key: 1,
                  onClick: ($event) => _ctx.loadHistory(false),
                  disabled: _ctx.loadingHistory
                }, "加载更多会话", 8, ["onClick", "disabled"])) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true),
              _createElementVNode("div", {
                class: "quick-prompts",
                "aria-label": "快捷提问"
              }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.prompts, (p) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: p.label,
                      onClick: ($event) => _ctx.ask(p.query),
                      disabled: _ctx.thinking || _ctx.openingConversation
                    }, [
                      _createVNode(_component_Icon, {
                        name: p.icon,
                        size: 15
                      }, null, 8, ["name"]),
                      _createTextVNode(
                        _toDisplayString(p.label),
                        1
                        /* TEXT */
                      )
                    ], 8, ["onClick", "disabled"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              _createElementVNode("section", {
                class: "chat-thread",
                "aria-label": "AI对话"
              }, [
                !_ctx.messages.length ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "chat-welcome"
                }, [
                  _createElementVNode("span", { class: "chat-welcome-icon" }, [
                    _createVNode(_component_Icon, {
                      name: "sparkles",
                      size: 22
                    })
                  ]),
                  _createElementVNode("h2", null, "你好，同学。"),
                  _createElementVNode("p", null, "告诉我预算或想买的东西。")
                ])) : _createCommentVNode("v-if", true),
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.messages, (message, index) => {
                    var _a2;
                    return _openBlock(), _createElementBlock(
                      "div",
                      {
                        class: _normalizeClass(["chat-row", message.role === "user" ? "is-user" : "is-assistant"]),
                        key: index
                      },
                      [
                        message.role !== "user" ? (_openBlock(), _createElementBlock("span", {
                          key: 0,
                          class: "chat-avatar"
                        }, [
                          _createElementVNode("img", {
                            src: "./images/robot.webp",
                            alt: "AI"
                          })
                        ])) : _createCommentVNode("v-if", true),
                        _createElementVNode("div", { class: "chat-body" }, [
                          _createElementVNode(
                            "div",
                            { class: "chat-bubble" },
                            _toDisplayString(message.content),
                            1
                            /* TEXT */
                          ),
                          message.warning ? (_openBlock(), _createElementBlock(
                            "div",
                            {
                              key: 0,
                              class: "message-warning"
                            },
                            _toDisplayString(message.warning),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true),
                          ((_a2 = message.citations) == null ? void 0 : _a2.length) ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "citation-chips"
                          }, [
                            (_openBlock(true), _createElementBlock(
                              _Fragment,
                              null,
                              _renderList(message.citations, (c) => {
                                return _openBlock(), _createElementBlock("span", { key: c }, [
                                  _createVNode(_component_Icon, {
                                    name: "book",
                                    size: 12
                                  }),
                                  _createTextVNode(
                                    _toDisplayString(c),
                                    1
                                    /* TEXT */
                                  )
                                ]);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            ))
                          ])) : _createCommentVNode("v-if", true),
                          _createElementVNode("span", { class: "chat-timestamp" }, [
                            _createTextVNode(
                              _toDisplayString(message.time || "刚刚") + " ",
                              1
                              /* TEXT */
                            ),
                            message.demo ? (_openBlock(), _createElementBlock("span", { key: 0 }, "· 示例回答")) : _createCommentVNode("v-if", true)
                          ])
                        ])
                      ],
                      2
                      /* CLASS */
                    );
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                _ctx.thinking ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "chat-row is-assistant"
                }, [
                  _createElementVNode("span", { class: "chat-avatar" }, [
                    _createElementVNode("img", {
                      src: "./images/robot.webp",
                      alt: "AI"
                    })
                  ]),
                  _createElementVNode("div", { class: "typing-bubble" }, [
                    _createElementVNode("i"),
                    _createElementVNode("i"),
                    _createElementVNode("i")
                  ])
                ])) : _createCommentVNode("v-if", true),
                _ctx.error ? (_openBlock(), _createElementBlock("div", {
                  key: 2,
                  class: "inline-error"
                }, [
                  _createVNode(_component_Icon, {
                    name: "alert",
                    size: 17
                  }),
                  _createTextVNode(
                    _toDisplayString(_ctx.error),
                    1
                    /* TEXT */
                  )
                ])) : _createCommentVNode("v-if", true)
              ]),
              _ctx.showProposal ? (_openBlock(), _createElementBlock("section", {
                key: 2,
                class: "recommendation-panel"
              }, [
                _createElementVNode("div", { class: "recommendation-header" }, [
                  _createElementVNode("div", null, [
                    _createElementVNode("h2", null, [
                      _createTextVNode("为你选了 "),
                      _createElementVNode(
                        "em",
                        null,
                        _toDisplayString(_ctx.items.length),
                        1
                        /* TEXT */
                      ),
                      _createTextVNode(" 件好物")
                    ])
                  ])
                ]),
                _createElementVNode("div", { class: "rec-cards" }, [
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.items, (item, index) => {
                      var _a2;
                      return _openBlock(), _createElementBlock("article", {
                        class: "rec-item",
                        key: item.skuId
                      }, [
                        _createElementVNode("button", {
                          class: _normalizeClass(["rec-check", { checked: _ctx.selectedIds.includes(item.skuId) }]),
                          onClick: ($event) => _ctx.toggle(item.skuId),
                          "aria-label": "选择" + item.title
                        }, [
                          _createVNode(_component_Icon, {
                            name: "check",
                            size: 13
                          })
                        ], 10, ["onClick", "aria-label"]),
                        _createElementVNode("div", { class: "rec-photo" }, [
                          _createVNode(_component_ProductImage, {
                            src: item.imageUrl || ((_a2 = item.product) == null ? void 0 : _a2.imageUrl),
                            alt: item.title
                          }, null, 8, ["src", "alt"])
                        ]),
                        _createElementVNode("div", { class: "rec-card-content" }, [
                          _createElementVNode(
                            "div",
                            { class: "rec-item-tag" },
                            _toDisplayString(index === 0 ? "HOT PICK" : index === 1 ? "DAILY" : "GOOD VALUE"),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(item.title),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(item.specKey),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("div", { class: "rec-price" }, [
                            _createElementVNode(
                              "span",
                              null,
                              _toDisplayString(_ctx.money(item.priceCent)),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode("span", { class: "pick-mini" }, [
                              _createVNode(_component_Icon, {
                                name: "plus",
                                size: 15
                              })
                            ])
                          ])
                        ])
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                _createElementVNode("div", { class: "proposal-footer" }, [
                  _createElementVNode("div", { class: "proposal-total" }, [
                    _createElementVNode(
                      "span",
                      null,
                      "已选 " + _toDisplayString(_ctx.selectedIds.length) + " 件",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.money(_ctx.total)),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", { class: "proposal-actions" }, [
                    !_ctx.preview && ((_a = _ctx.proposal) == null ? void 0 : _a.status) === "PENDING" ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "ghost-decline",
                      onClick: _ctx.reject
                    }, "放弃", 8, ["onClick"])) : _createCommentVNode("v-if", true),
                    _createElementVNode("button", {
                      class: "confirm-button",
                      onClick: _ctx.confirm,
                      disabled: _ctx.preview || _ctx.thinking || !_ctx.selectedIds.length || !_ctx.preview && ((_b = _ctx.proposal) == null ? void 0 : _b.status) !== "PENDING"
                    }, [
                      _createVNode(_component_Icon, {
                        name: "check",
                        size: 17
                      }),
                      _createTextVNode(
                        _toDisplayString(((_c = _ctx.proposal) == null ? void 0 : _c.status) === "CONFIRMED" ? "已确认" : "确认加购"),
                        1
                        /* TEXT */
                      )
                    ], 8, ["onClick", "disabled"])
                  ])
                ])
              ])) : _createCommentVNode("v-if", true),
              _createElementVNode("div", {
                class: "chat-composer-placeholder",
                "aria-hidden": "true"
              }),
              _createElementVNode("form", {
                class: "chat-composer",
                onSubmit: _withModifiers(($event) => _ctx.ask(), ["prevent"])
              }, [
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.input = $event,
                  disabled: _ctx.thinking || _ctx.openingConversation,
                  "aria-label": "输入问题",
                  maxlength: "500",
                  placeholder: "问问 AI，帮你找好物…"
                }, null, 8, ["onUpdate:modelValue", "disabled"]), [
                  [_vModelText, _ctx.input]
                ]),
                _createElementVNode("button", {
                  type: "submit",
                  disabled: _ctx.thinking || _ctx.openingConversation || !_ctx.input.trim(),
                  "aria-label": "发送问题"
                }, [
                  _createVNode(_component_Icon, {
                    name: "send",
                    size: 20
                  })
                ], 8, ["disabled"])
              ], 40, ["onSubmit"])
            ];
          }),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$b, computed: computed$c, onBeforeUnmount, watch: watch$b } = Vue;
  const VALID_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/gif"]);
  const MAX_BYTES = 2e6;
  const ProductImageField = {
    name: "ProductImageField",
    components: { ProductImage },
    props: {
      modelValue: { type: String, default: "" },
      merchantId: { type: String, required: true },
      disabled: { type: Boolean, default: false },
      demo: { type: Boolean, default: false }
    },
    emits: ["update:modelValue", "busy", "invalid"],
    setup(props, { emit }) {
      const busy = ref$b(false), error = ref$b(""), notice = ref$b(""), localUrl = ref$b("");
      let alive = true;
      function release() {
        if (localUrl.value) {
          URL.revokeObjectURL(localUrl.value);
          localUrl.value = "";
        }
      }
      onBeforeUnmount(() => {
        alive = false;
        release();
        if (busy.value) emit("busy", false);
        if (error.value) emit("invalid", false);
      });
      watch$b(
        () => props.modelValue,
        () => {
          if (!busy.value) release();
        }
      );
      const displayed = computed$c(() => localUrl.value || props.modelValue || "");
      function clear() {
        if (props.disabled || busy.value) return;
        release();
        error.value = "";
        notice.value = "";
        emit("invalid", false);
        emit("update:modelValue", "");
      }
      async function choose(event) {
        var _a;
        const file = (_a = event.target.files) == null ? void 0 : _a[0];
        event.target.value = "";
        if (!file || props.disabled || busy.value) return;
        error.value = "";
        notice.value = "";
        emit("invalid", false);
        if (!VALID_TYPES.has(file.type)) {
          error.value = "请选择 JPG、PNG 或 GIF 图片";
          emit("invalid", true);
          return;
        }
        if (!file.size || file.size > MAX_BYTES) {
          error.value = "图片大小不能超过 2 MB";
          emit("invalid", true);
          return;
        }
        release();
        localUrl.value = URL.createObjectURL(file);
        if (props.demo) {
          notice.value = "仅本地预览，未上传";
          return;
        }
        busy.value = true;
        emit("busy", true);
        try {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("图片读取失败"));
            reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
            reader.readAsDataURL(file);
          });
          const result = await api("/merchants/" + encodeURIComponent(props.merchantId) + "/images", {
            method: "POST",
            body: { filename: file.name, contentType: file.type, base64 }
          });
          if (!/^\/media\/[a-f0-9-]+\.png$/.test((result == null ? void 0 : result.url) || ""))
            throw new Error("图片上传返回地址无效");
          if (!alive) return;
          emit("update:modelValue", result.url);
          notice.value = "上传成功，保存商品后生效";
          release();
        } catch (err) {
          if (alive) {
            error.value = err.message || "上传失败";
            emit("invalid", true);
            release();
          }
        } finally {
          if (alive) {
            busy.value = false;
            emit("busy", false);
          }
        }
      }
      return { choose, clear, displayed, busy, error, notice };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, normalizeClass: _normalizeClass } = Vue;
      return function render(_ctx, _cache) {
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_Icon = _resolveComponent("Icon");
        return _openBlock(), _createElementBlock("div", { class: "product-image-field" }, [
          _createElementVNode("div", { class: "product-image-preview" }, [
            _createVNode(_component_ProductImage, {
              src: _ctx.displayed,
              alt: "商品主图预览",
              loading: "eager"
            }, null, 8, ["src"]),
            _ctx.busy ? (_openBlock(), _createElementBlock("span", {
              key: 0,
              class: "product-image-busy"
            }, "上传中…")) : _createCommentVNode("v-if", true)
          ]),
          _createElementVNode("div", { class: "product-image-controls" }, [
            _createElementVNode(
              "label",
              {
                class: _normalizeClass(["image-upload-button", { disabled: _ctx.disabled || _ctx.busy }])
              },
              [
                _createVNode(_component_Icon, {
                  name: "upload",
                  size: 15
                }),
                _createTextVNode(
                  _toDisplayString(_ctx.modelValue || _ctx.displayed ? "更换主图" : "上传主图") + " ",
                  1
                  /* TEXT */
                ),
                _createElementVNode("input", {
                  type: "file",
                  accept: "image/png,image/jpeg,image/gif",
                  "aria-label": "选择商品主图",
                  disabled: _ctx.disabled || _ctx.busy,
                  onChange: _ctx.choose
                }, null, 40, ["disabled", "onChange"])
              ],
              2
              /* CLASS */
            ),
            _ctx.modelValue || _ctx.displayed || _ctx.error ? (_openBlock(), _createElementBlock("button", {
              key: 0,
              class: "image-remove-button",
              type: "button",
              disabled: _ctx.disabled || _ctx.busy,
              onClick: _ctx.clear
            }, "移除", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
            _createElementVNode("small", null, "JPG / PNG / GIF · ≤ 2MB"),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "span",
              {
                key: 1,
                class: "image-field-error",
                role: "alert"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _ctx.notice ? (_openBlock(), _createElementBlock(
              "span",
              {
                key: 2,
                class: "image-field-notice",
                role: "status"
              },
              _toDisplayString(_ctx.notice),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true)
          ])
        ]);
      };
    })()
  };
  const { ref: ref$a, computed: computed$b, watch: watch$a, nextTick: nextTick$1, onMounted: onMounted$b, onUnmounted: onUnmounted$8 } = Vue;
  const MENU = [
    ["home", "工作台", "/merchant"],
    ["package", "商品管理", "/merchant/products"],
    ["box", "库存管理", "/merchant/inventory"],
    ["order", "订单管理", "/merchant/orders"],
    ["scan", "自提核销", "/merchant/pickup"],
    ["clipboard", "售后处理", "/merchant/aftersales"],
    ["users", "店员管理", "/merchant/team"],
    ["shield", "角色权限", "/merchant/roles"],
    ["book", "知识库", "/merchant/knowledge"],
    ["settings", "门店设置", "/merchant/settings"]
  ];
  const Merchant = {
    name: "Merchant",
    components: { AuthDialog, ProductImage, ProductImageField },
    setup() {
      const search = ref$a("");
      const category = ref$a("");
      const status = ref$a("");
      const sort = ref$a("NEWEST");
      const page = ref$a(1);
      const selectedId = ref$a("");
      const selectedSkuId = ref$a("");
      const drawerTab = ref$a("stock");
      const loginOpen = ref$a(false);
      const adjustment = ref$a(1);
      const pendingReplenishKey = ref$a("");
      const pendingReplenishPayload = ref$a("");
      const saving = ref$a(false);
      const modal = ref$a("");
      const activePriceSku = ref$a(null);
      const newPrice = ref$a("");
      const form = ref$a({
        title: "",
        description: "",
        categoryCode: "food",
        imageUrl: "",
        skus: [{ specKey: "默认规格", price: "4.50" }]
      });
      const skuForm = ref$a({ specKey: "", price: "" });
      const info = ref$a({ title: "", description: "", categoryCode: "food", imageUrl: "" });
      const createImageUploading = ref$a(false), editImageUploading = ref$a(false);
      const createImageInvalid = ref$a(false), editImageInvalid = ref$a(false);
      const merchant = computed$b(
        () => store.merchants.find((m) => m.merchantId === store.merchantId) || store.merchants[0] || {}
      );
      const owned = computed$b(() => hasPermission("product.write"));
      const required = {
        "/merchant": "order.read",
        "/merchant/products": "product.read",
        "/merchant/inventory": "stock.read",
        "/merchant/orders": "order.read",
        "/merchant/pickup": "pickup.verify",
        "/merchant/aftersales": "aftersale.read",
        "/merchant/team": "team.manage",
        "/merchant/roles": "role.manage",
        "/merchant/knowledge": "knowledge.read",
        "/merchant/settings": "store.manage"
      };
      const visibleMenu = computed$b(() => MENU.filter(([, , path]) => hasPermission(required[path])));
      const mobileNav = ref$a(null);
      const alignMobileNav = () => {
        var _a;
        const nav = mobileNav.value;
        if (nav == null ? void 0 : nav.clientWidth)
          (_a = nav.querySelector("button.active")) == null ? void 0 : _a.scrollIntoView({ inline: "center", block: "nearest" });
      };
      watch$a(
        [() => store.route, () => visibleMenu.value.map((item) => item[2]).join("|")],
        async () => {
          await nextTick$1();
          alignMobileNav();
        },
        { immediate: true, flush: "post" }
      );
      onMounted$b(() => window.addEventListener("resize", alignMobileNav));
      onUnmounted$8(() => window.removeEventListener("resize", alignMobileNav));
      const canReplenish = computed$b(() => hasPermission("stock.replenish"));
      const canRead = computed$b(() => hasPermission("product.read"));
      const items2 = computed$b(() => store.products.filter((p) => p.merchantId === store.merchantId));
      const selected = computed$b(
        () => items2.value.find((p) => p.productId === selectedId.value) || items2.value[0] || null
      );
      const selectedSku = computed$b(
        () => {
          var _a, _b;
          return ((_b = (_a = selected.value) == null ? void 0 : _a.skus) == null ? void 0 : _b.find((s) => s.skuId === selectedSkuId.value)) || skuOf(selected.value);
        }
      );
      const stock = computed$b(
        () => store.stocks.find((s) => {
          var _a;
          return s.skuId === ((_a = selectedSku.value) == null ? void 0 : _a.skuId);
        }) || null
      );
      const priceSku = (p) => [...(p == null ? void 0 : p.skus) || []].filter((s) => s.status === "ACTIVE").sort((a, b) => Number(a.priceCent) - Number(b.priceCent))[0] || skuOf(p);
      const count = computed$b(() => ({
        all: items2.value.length,
        published: items2.value.filter((p) => p.status === "PUBLISHED").length,
        unpublished: items2.value.filter((p) => p.status !== "PUBLISHED").length,
        low: items2.value.filter((p) => p.status === "PUBLISHED" && available(p) < 20).length
      }));
      const filtered = computed$b(() => {
        if (!preview)
          return status.value === "low" ? items2.value.filter((p) => p.status === "PUBLISHED" && available(p) < 20) : items2.value;
        const q = search.value.trim().toLowerCase();
        return items2.value.filter(
          (p) => (!q || p.title.toLowerCase().includes(q) || p.skus.some(
            (s) => s.specKey.toLowerCase().includes(q) || s.skuId.toLowerCase().includes(q)
          )) && (!category.value || p.categoryCode === category.value) && (!status.value || (status.value === "low" ? p.status === "PUBLISHED" && available(p) < 20 : p.status === status.value))
        );
      });
      const totalPages = computed$b(
        () => Math.max(1, Math.ceil((preview ? filtered.value.length : store.merchantPage.total) / 9))
      );
      const pageRows = computed$b(
        () => preview ? filtered.value.slice((page.value - 1) * 9, page.value * 9) : filtered.value
      );
      const inventoryPercent = computed$b(
        () => {
          var _a, _b;
          return Math.min(
            100,
            Number(((_a = stock.value) == null ? void 0 : _a.available) || 0) / Math.max(1, Number(((_b = stock.value) == null ? void 0 : _b.onHand) || 0)) * 100
          );
        }
      );
      const tableCategory = (p) => {
        var _a;
        return ((_a = store.categories.find((c) => c.code === p.categoryCode)) == null ? void 0 : _a.name) || p.categoryCode;
      };
      const choose = (p) => {
        editImageInvalid.value = false;
        selectedId.value = p.productId;
        selectedSkuId.value = skuOf(p).skuId || "";
        drawerTab.value = "stock";
      };
      watch$a(
        selected,
        (p) => {
          if (p) {
            if (!p.skus.some((s) => s.skuId === selectedSkuId.value))
              selectedSkuId.value = skuOf(p).skuId || "";
            info.value = {
              title: p.title,
              description: p.description || "",
              categoryCode: p.categoryCode,
              imageUrl: p.imageUrl || ""
            };
          }
        },
        { immediate: true }
      );
      let searchDelay;
      function refreshPage() {
        if (preview) return;
        loadMerchant({
          page: page.value,
          size: 9,
          q: search.value,
          category: category.value,
          status: status.value === "low" ? "" : status.value,
          sort: sort.value
        });
      }
      watch$a([category, status, sort], () => {
        page.value = 1;
        refreshPage();
      });
      watch$a(search, () => {
        page.value = 1;
        clearTimeout(searchDelay);
        searchDelay = setTimeout(refreshPage, 280);
      });
      watch$a(page, refreshPage);
      function openCreate() {
        var _a;
        createImageUploading.value = false;
        createImageInvalid.value = false;
        form.value = {
          title: "",
          description: "",
          categoryCode: ((_a = store.categories.find((c) => c.active)) == null ? void 0 : _a.code) || "food",
          imageUrl: "",
          skus: [{ specKey: "默认规格", price: "" }]
        };
        modal.value = "create";
      }
      function openPrice(sku2) {
        activePriceSku.value = sku2;
        newPrice.value = (Number(sku2.priceCent) / 100).toFixed(2);
        modal.value = "price";
      }
      function yuanToCent(value) {
        const v = String(value).trim();
        if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) throw new Error("请输入正确金额（最多两位小数）");
        const [a, b = ""] = v.split(".");
        const cent = Number(a) * 100 + Number((b + "00").slice(0, 2));
        if (cent <= 0) throw new Error("价格必须大于零");
        return cent;
      }
      async function create() {
        if (previewGuard() || saving.value || createImageUploading.value) return;
        if (createImageInvalid.value) {
          notify("请重新选择图片，或移除失败的图片");
          return;
        }
        const f = form.value;
        if (!f.title.trim() || !f.skus.length || f.skus.length > 20) {
          notify("请填写商品名称及1至20个规格");
          return;
        }
        const keys = /* @__PURE__ */ new Set();
        let skus;
        try {
          skus = f.skus.map((item) => {
            const specKey = item.specKey.trim();
            if (!specKey || specKey.length > 100 || keys.has(specKey))
              throw new Error("规格不能为空且不能重复");
            keys.add(specKey);
            return { specKey, priceCent: yuanToCent(item.price) };
          });
        } catch (e) {
          notify(e.message);
          return;
        }
        saving.value = true;
        try {
          await api("/merchants/" + encodeURIComponent(store.merchantId) + "/products", {
            method: "POST",
            body: {
              title: f.title.trim(),
              description: f.description.trim(),
              categoryCode: f.categoryCode,
              imageUrl: f.imageUrl || "",
              skus
            }
          });
          modal.value = "";
          await loadMerchant();
          notify("商品已创建（草稿）");
        } catch (e) {
          notify(e.message);
        } finally {
          saving.value = false;
        }
      }
      function addCreateSku() {
        if (form.value.skus.length < 20) form.value.skus.push({ specKey: "", price: "" });
      }
      function removeCreateSku(index) {
        if (form.value.skus.length > 1) form.value.skus.splice(index, 1);
      }
      function openAddSku() {
        skuForm.value = { specKey: "", price: "" };
        modal.value = "addSku";
      }
      async function addSku() {
        if (previewGuard() || saving.value || !owned.value || !selected.value) return;
        const specKey = skuForm.value.specKey.trim();
        if (!specKey || specKey.length > 100 || selected.value.skus.some((s) => s.specKey === specKey)) {
          notify("规格不能为空且不能重复");
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
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(selected.value.productId) + "/skus",
            { method: "POST", body: { specKey, priceCent } }
          );
          modal.value = "";
          await loadMerchant();
          notify("规格已新增");
          drawerTab.value = "sku";
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
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(p.productId) + "/publish",
            { method: "POST", body: { published: p.status !== "PUBLISHED" } }
          );
          await loadMerchant();
          notify(p.status === "PUBLISHED" ? "已下架" : "已上架");
        } catch (err) {
          notify(err.message);
        } finally {
          saving.value = false;
        }
      }
      async function replenish() {
        var _a;
        if (previewGuard() || saving.value || !canReplenish.value || !((_a = selectedSku.value) == null ? void 0 : _a.skuId))
          return;
        const n = Number(adjustment.value);
        if (!Number.isInteger(n) || n < 1 || n > 1e6) {
          notify("补货数量必须为1~1000000");
          return;
        }
        const fingerprint = store.merchantId + ":" + selectedSku.value.skuId + ":" + n;
        if (fingerprint !== pendingReplenishPayload.value) {
          pendingReplenishKey.value = idempotency();
          pendingReplenishPayload.value = fingerprint;
        }
        saving.value = true;
        try {
          await api(
            "/merchants/" + encodeURIComponent(store.merchantId) + "/stocks/" + encodeURIComponent(selectedSku.value.skuId) + "/replenish",
            { method: "POST", body: { quantity: n }, key: pendingReplenishKey.value }
          );
          pendingReplenishKey.value = "";
          pendingReplenishPayload.value = "";
          adjustment.value = 1;
          await loadMerchant();
          notify("补货完成");
        } catch (err) {
          notify(err.message);
        } finally {
          saving.value = false;
        }
      }
      async function saveInfo() {
        if (previewGuard() || !owned.value || saving.value || editImageUploading.value || !selected.value)
          return;
        if (editImageInvalid.value) {
          notify("请重新选择图片，或移除失败的图片");
          return;
        }
        if (!info.value.title.trim()) {
          notify("商品名称不能为空");
          return;
        }
        saving.value = true;
        try {
          await api(
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(selected.value.productId),
            {
              method: "PUT",
              body: {
                title: info.value.title.trim(),
                description: info.value.description.trim(),
                categoryCode: info.value.categoryCode,
                imageUrl: info.value.imageUrl || "",
                expectedVersion: selected.value.version
              }
            }
          );
          await loadMerchant();
          notify("商品信息已更新");
        } catch (err) {
          notify(err.message);
        } finally {
          saving.value = false;
        }
      }
      async function savePrice() {
        if (previewGuard() || !owned.value || saving.value || !activePriceSku.value || !selected.value)
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
            "/merchants/" + encodeURIComponent(store.merchantId) + "/products/" + encodeURIComponent(selected.value.productId) + "/skus/" + encodeURIComponent(activePriceSku.value.skuId) + "/price",
            { method: "PUT", body: { priceCent: cent, expectedVersion: selected.value.version } }
          );
          modal.value = "";
          await loadMerchant();
          notify("售价已更新");
        } catch (err) {
          notify(err.message);
        } finally {
          saving.value = false;
        }
      }
      async function switchMerchant(e) {
        if (preview) {
          notify("设计预览：仅展示示例门店");
          return;
        }
        switchMerchantContext(e.target.value);
        selectedId.value = "";
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
        switchMerchant
      };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, resolveComponent: _resolveComponent, createVNode: _createVNode, toDisplayString: _toDisplayString, createCommentVNode: _createCommentVNode, normalizeClass: _normalizeClass, normalizeStyle: _normalizeStyle, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ProductImageField = _resolveComponent("ProductImageField");
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        return _openBlock(), _createElementBlock("div", { class: "merchant-shell" }, [
          _createElementVNode("aside", { class: "merchant-sidebar" }, [
            _createElementVNode("button", {
              class: "merchant-brand",
              onClick: ($event) => _ctx.go("/")
            }, [
              _createElementVNode("span", { class: "brand-pin" }, [
                _createElementVNode("span")
              ]),
              _createElementVNode("span", { class: "brand-word" }, [
                _createTextVNode("青柠校园"),
                _createElementVNode("span", { class: "brand-suffix" }, " / 商户端")
              ])
            ], 8, ["onClick"]),
            _createElementVNode("nav", { class: "merchant-nav" }, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.visibleMenu, ([icon, label2, path]) => {
                  return _openBlock(), _createElementBlock("button", {
                    key: path,
                    class: _normalizeClass({ active: _ctx.store.route === path }),
                    onClick: ($event) => _ctx.go(path)
                  }, [
                    _createVNode(_component_Icon, {
                      name: icon,
                      size: 19
                    }, null, 8, ["name"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(label2),
                      1
                      /* TEXT */
                    ),
                    _ctx.store.route === path ? (_openBlock(), _createElementBlock("span", {
                      key: 0,
                      class: "nav-left-bar"
                    })) : _createCommentVNode("v-if", true)
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            _createElementVNode("div", { class: "merchant-sidebar-bottom" }, [
              _createElementVNode("button", {
                class: "sidebar-back",
                onClick: ($event) => _ctx.go("/")
              }, [
                _createVNode(_component_Icon, {
                  name: "arrowLeft",
                  size: 16
                }),
                _createTextVNode(" 返回购物端")
              ], 8, ["onClick"])
            ])
          ]),
          _createElementVNode("div", { class: "merchant-content-shell" }, [
            _createElementVNode("header", { class: "merchant-topbar" }, [
              _createElementVNode("div", { class: "topbar-crumb" }, [
                _createTextVNode("运营中心 "),
                _createVNode(_component_Icon, {
                  name: "chevronRight",
                  size: 14
                }),
                _createTextVNode(),
                _createElementVNode("strong", null, "商品管理")
              ]),
              _createElementVNode("div", { class: "merchant-topbar-tools" }, [
                _ctx.preview ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-preview-tag"
                }, [
                  _createVNode(_component_Icon, {
                    name: "circleHelp",
                    size: 14
                  }),
                  _createTextVNode("演示数据")
                ])) : _createCommentVNode("v-if", true),
                _createElementVNode("div", { class: "topbar-merchant-select" }, [
                  _createVNode(_component_Icon, {
                    name: "store",
                    size: 16
                  }),
                  _createElementVNode("select", {
                    value: _ctx.store.merchantId,
                    onChange: _ctx.switchMerchant,
                    disabled: _ctx.preview
                  }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.store.merchants, (m) => {
                        return _openBlock(), _createElementBlock("option", {
                          value: m.merchantId,
                          key: m.merchantId
                        }, _toDisplayString(m.name) + " · " + _toDisplayString(m.storeName), 9, ["value"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ], 40, ["value", "onChange", "disabled"]),
                  _createVNode(_component_Icon, {
                    name: "chevronDown",
                    size: 13
                  })
                ]),
                _createElementVNode(
                  "span",
                  { class: "admin-avatar" },
                  _toDisplayString(((_b = (_a = _ctx.store.user) == null ? void 0 : _a.displayName) == null ? void 0 : _b.slice(0, 1)) || "店"),
                  1
                  /* TEXT */
                ),
                _createElementVNode(
                  "span",
                  { class: "admin-user" },
                  _toDisplayString(((_c = _ctx.store.user) == null ? void 0 : _c.displayName) || "店铺账号"),
                  1
                  /* TEXT */
                )
              ])
            ]),
            _createElementVNode(
              "nav",
              {
                ref: "mobileNav",
                class: "merchant-mobile-nav",
                "aria-label": "工作台导航"
              },
              [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.visibleMenu, ([icon, label2, path]) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: path,
                      class: _normalizeClass({ active: _ctx.store.route === path }),
                      onClick: ($event) => _ctx.go(path)
                    }, [
                      _createVNode(_component_Icon, {
                        name: icon,
                        size: 16
                      }, null, 8, ["name"]),
                      _createTextVNode(
                        _toDisplayString(label2),
                        1
                        /* TEXT */
                      )
                    ], 10, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ],
              512
              /* NEED_PATCH */
            ),
            _createElementVNode("main", { class: "merchant-main" }, [
              _createElementVNode("div", { class: "merchant-page-heading" }, [
                _createElementVNode("div", null, [
                  _createElementVNode("h1", null, "商品管理")
                ]),
                _createElementVNode("div", { class: "head-actions" }, [
                  _createElementVNode("button", {
                    class: "outline-button small",
                    onClick: _ctx.loadMerchant,
                    disabled: _ctx.store.loading
                  }, [
                    _createVNode(_component_Icon, {
                      name: "refresh",
                      size: 16
                    }),
                    _createTextVNode("刷新")
                  ], 8, ["onClick", "disabled"]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    onClick: _ctx.openCreate,
                    disabled: !_ctx.owned
                  }, [
                    _createVNode(_component_Icon, {
                      name: "plus",
                      size: 18
                    }),
                    _createTextVNode("新增商品")
                  ], 8, ["onClick", "disabled"])
                ])
              ]),
              _ctx.store.error ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "inline-error merchant-error"
              }, [
                _createVNode(_component_Icon, {
                  name: "alert",
                  size: 18
                }),
                _createTextVNode(
                  _toDisplayString(_ctx.store.error),
                  1
                  /* TEXT */
                ),
                !_ctx.preview ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  class: "merchant-login-action",
                  onClick: ($event) => _ctx.loginOpen = true
                }, "登录账号", 8, ["onClick"])) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true),
              !_ctx.canRead ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ops-card access-denied"
              }, "当前角色没有商品查看权限，请联系商户经营者授权。")) : (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 2 },
                [
                  _createElementVNode("section", {
                    class: "inventory-summary",
                    "aria-label": "商品概况"
                  }, [
                    _createElementVNode("div", { class: "summary-piece" }, [
                      _createElementVNode("span", { class: "summary-icon blue" }, [
                        _createVNode(_component_Icon, {
                          name: "package",
                          size: 20
                        })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "span",
                          null,
                          _toDisplayString(_ctx.preview ? "全部商品" : "筛选商品"),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.preview ? _ctx.count.all : _ctx.store.merchantPage.total),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    _createElementVNode("div", { class: "summary-piece" }, [
                      _createElementVNode("span", { class: "summary-icon green" }, [
                        _createVNode(_component_Icon, {
                          name: "check",
                          size: 20
                        })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode("span", null, "本页在售"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.count.published),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    _createElementVNode("div", { class: "summary-piece" }, [
                      _createElementVNode("span", { class: "summary-icon orange" }, [
                        _createVNode(_component_Icon, {
                          name: "box",
                          size: 20
                        })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode("span", null, "本页未上架"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.count.unpublished),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    _createElementVNode("div", { class: "summary-piece" }, [
                      _createElementVNode("span", { class: "summary-icon red" }, [
                        _createVNode(_component_Icon, {
                          name: "alert",
                          size: 20
                        })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode("span", null, "本页低库存"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.count.low),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    _createElementVNode("div", { class: "summary-stockbar" }, [
                      _createElementVNode("span", null, "本页上架率"),
                      _createElementVNode("div", { class: "summary-stockbar-track" }, [
                        _createElementVNode(
                          "span",
                          {
                            style: _normalizeStyle({ width: (_ctx.count.all ? _ctx.count.published / _ctx.count.all * 100 : 0) + "%" })
                          },
                          null,
                          4
                          /* STYLE */
                        )
                      ]),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.count.all ? Math.round(_ctx.count.published / _ctx.count.all * 100) : 0) + "%",
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  _createElementVNode("section", { class: "product-workspace" }, [
                    _createElementVNode("div", { class: "product-list-panel" }, [
                      _createElementVNode("div", { class: "product-tabs" }, [
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.status === "" }),
                          onClick: ($event) => _ctx.status = ""
                        }, [
                          _createTextVNode("全部 "),
                          _ctx.preview || _ctx.status === "" ? (_openBlock(), _createElementBlock(
                            "b",
                            { key: 0 },
                            _toDisplayString(_ctx.preview ? _ctx.count.all : _ctx.store.merchantPage.total),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true)
                        ], 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.status === "PUBLISHED" }),
                          onClick: ($event) => _ctx.status = "PUBLISHED"
                        }, [
                          _createTextVNode("在售 "),
                          _ctx.preview || _ctx.status === "PUBLISHED" ? (_openBlock(), _createElementBlock(
                            "b",
                            { key: 0 },
                            _toDisplayString(_ctx.preview ? _ctx.count.published : _ctx.store.merchantPage.total),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true)
                        ], 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.status === "UNPUBLISHED" }),
                          onClick: ($event) => _ctx.status = "UNPUBLISHED"
                        }, "已下架", 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.status === "low" }),
                          onClick: ($event) => _ctx.status = "low"
                        }, [
                          _createTextVNode("本页低库存 "),
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.count.low),
                            1
                            /* TEXT */
                          )
                        ], 10, ["onClick"])
                      ]),
                      _createElementVNode("div", { class: "product-toolbar" }, [
                        _createElementVNode("label", { class: "table-search" }, [
                          _createVNode(_component_Icon, {
                            name: "search",
                            size: 17
                          }),
                          _withDirectives(_createElementVNode("input", {
                            "onUpdate:modelValue": ($event) => _ctx.search = $event,
                            placeholder: "商品名称 / SKU / 规格",
                            "aria-label": "搜索商品"
                          }, null, 8, ["onUpdate:modelValue"]), [
                            [_vModelText, _ctx.search]
                          ])
                        ]),
                        _createElementVNode("label", { class: "table-select" }, [
                          _withDirectives(_createElementVNode("select", {
                            "onUpdate:modelValue": ($event) => _ctx.category = $event,
                            "aria-label": "分类筛选"
                          }, [
                            _createElementVNode("option", { value: "" }, "全部分类"),
                            (_openBlock(true), _createElementBlock(
                              _Fragment,
                              null,
                              _renderList(_ctx.store.categories, (c) => {
                                return _openBlock(), _createElementBlock("option", {
                                  value: c.code
                                }, _toDisplayString(c.name), 9, ["value"]);
                              }),
                              256
                              /* UNKEYED_FRAGMENT */
                            ))
                          ], 8, ["onUpdate:modelValue"]), [
                            [_vModelSelect, _ctx.category]
                          ]),
                          _createVNode(_component_Icon, {
                            name: "chevronDown",
                            size: 14
                          })
                        ]),
                        _createElementVNode("label", { class: "table-select" }, [
                          _withDirectives(_createElementVNode("select", {
                            "onUpdate:modelValue": ($event) => _ctx.sort = $event,
                            "aria-label": "全局排序"
                          }, [
                            _createElementVNode("option", { value: "NEWEST" }, "最新上架"),
                            _createElementVNode("option", { value: "PRICE_ASC" }, "全局价格升序"),
                            _createElementVNode("option", { value: "STOCK_DESC" }, "全局可售库存")
                          ], 8, ["onUpdate:modelValue"]), [
                            [_vModelSelect, _ctx.sort]
                          ])
                        ]),
                        _createElementVNode("button", {
                          class: "filter-reset",
                          onClick: ($event) => {
                            _ctx.search = "";
                            _ctx.category = "";
                            _ctx.status = "";
                            _ctx.sort = "NEWEST";
                          }
                        }, "重置", 8, ["onClick"]),
                        _createElementVNode(
                          "span",
                          { class: "toolbar-count" },
                          _toDisplayString(_ctx.preview ? _ctx.filtered.length : _ctx.store.merchantPage.total) + " 件",
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "product-table-scroll" }, [
                        _createElementVNode("table", { class: "product-table" }, [
                          _createElementVNode("thead", null, [
                            _createElementVNode("tr", null, [
                              _createElementVNode("th", null, "商品"),
                              _createElementVNode("th", null, "SKU / 规格"),
                              _createElementVNode("th", null, "分类"),
                              _createElementVNode("th", { class: "t-right" }, "售价"),
                              _createElementVNode("th", { class: "t-right" }, "可售"),
                              _createElementVNode("th", null, "状态"),
                              _createElementVNode("th", { class: "t-right" }, "操作")
                            ])
                          ]),
                          _createElementVNode("tbody", null, [
                            (_openBlock(true), _createElementBlock(
                              _Fragment,
                              null,
                              _renderList(_ctx.pageRows, (p) => {
                                var _a2, _b2, _c2;
                                return _openBlock(), _createElementBlock("tr", {
                                  key: p.productId,
                                  class: _normalizeClass({ "row-selected": ((_a2 = _ctx.selected) == null ? void 0 : _a2.productId) === p.productId }),
                                  onClick: ($event) => _ctx.choose(p)
                                }, [
                                  _createElementVNode("td", null, [
                                    _createElementVNode("div", { class: "table-product-cell" }, [
                                      _createVNode(_component_ProductImage, {
                                        src: p.imageUrl,
                                        alt: p.title
                                      }, null, 8, ["src", "alt"]),
                                      _createElementVNode("div", null, [
                                        _createElementVNode(
                                          "strong",
                                          null,
                                          _toDisplayString(p.title),
                                          1
                                          /* TEXT */
                                        ),
                                        _createElementVNode(
                                          "span",
                                          null,
                                          _toDisplayString(p.description || "—"),
                                          1
                                          /* TEXT */
                                        )
                                      ])
                                    ])
                                  ]),
                                  _createElementVNode("td", null, [
                                    _createElementVNode("div", { class: "sku-column" }, [
                                      _createElementVNode(
                                        "span",
                                        null,
                                        _toDisplayString(_ctx.skuOf(p).specKey || "—"),
                                        1
                                        /* TEXT */
                                      ),
                                      _createElementVNode(
                                        "small",
                                        null,
                                        _toDisplayString(((_b2 = _ctx.skuOf(p).skuId) == null ? void 0 : _b2.startsWith("preview")) ? "SKU-" + p.productId.slice(-2) : ((_c2 = _ctx.skuOf(p).skuId) == null ? void 0 : _c2.slice(-8)) || "—"),
                                        1
                                        /* TEXT */
                                      )
                                    ])
                                  ]),
                                  _createElementVNode("td", null, [
                                    _createElementVNode(
                                      "span",
                                      { class: "category-label" },
                                      _toDisplayString(_ctx.tableCategory(p)),
                                      1
                                      /* TEXT */
                                    )
                                  ]),
                                  _createElementVNode(
                                    "td",
                                    { class: "t-right table-price" },
                                    _toDisplayString(_ctx.money(_ctx.priceSku(p).priceCent)),
                                    1
                                    /* TEXT */
                                  ),
                                  _createElementVNode(
                                    "td",
                                    {
                                      class: _normalizeClass(["t-right", { "red-text": _ctx.available(p) < 20 }])
                                    },
                                    _toDisplayString(_ctx.available(p)),
                                    3
                                    /* TEXT, CLASS */
                                  ),
                                  _createElementVNode("td", null, [
                                    _createElementVNode(
                                      "span",
                                      {
                                        class: _normalizeClass(["status-tag", p.status === "PUBLISHED" ? "published" : p.status === "DRAFT" ? "draft" : "unpublished"])
                                      },
                                      [
                                        _createElementVNode("i"),
                                        _createTextVNode(
                                          _toDisplayString(p.status === "PUBLISHED" ? "在售" : p.status === "DRAFT" ? "草稿" : "已下架"),
                                          1
                                          /* TEXT */
                                        )
                                      ],
                                      2
                                      /* CLASS */
                                    )
                                  ]),
                                  _createElementVNode("td", { class: "t-right" }, [
                                    _createElementVNode("button", {
                                      class: "row-link",
                                      onClick: _withModifiers(($event) => _ctx.choose(p), ["stop"])
                                    }, [
                                      _createTextVNode("查看 "),
                                      _createVNode(_component_Icon, {
                                        name: "chevronRight",
                                        size: 14
                                      })
                                    ], 8, ["onClick"])
                                  ])
                                ], 10, ["onClick"]);
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            ))
                          ])
                        ]),
                        !_ctx.pageRows.length ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "admin-empty"
                        }, [
                          _createVNode(_component_Icon, {
                            name: "search",
                            size: 23
                          }),
                          _createElementVNode("span", null, "没有符合条件的商品")
                        ])) : _createCommentVNode("v-if", true)
                      ]),
                      _createElementVNode("div", { class: "table-footer" }, [
                        _createElementVNode(
                          "span",
                          null,
                          "共 " + _toDisplayString(_ctx.preview ? _ctx.filtered.length : _ctx.store.merchantPage.total) + " 条",
                          1
                          /* TEXT */
                        ),
                        _createElementVNode("div", null, [
                          _createElementVNode("button", {
                            disabled: _ctx.page <= 1,
                            onClick: ($event) => _ctx.page--,
                            "aria-label": "上一页"
                          }, [
                            _createVNode(_component_Icon, {
                              name: "arrowLeft",
                              size: 16
                            })
                          ], 8, ["disabled", "onClick"]),
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.totalPages, (n) => {
                              return _openBlock(), _createElementBlock("button", {
                                key: n,
                                class: _normalizeClass({ active: _ctx.page === n }),
                                onClick: ($event) => _ctx.page = n
                              }, _toDisplayString(n), 11, ["onClick"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          )),
                          _createElementVNode("button", {
                            disabled: _ctx.page >= _ctx.totalPages,
                            onClick: ($event) => _ctx.page++,
                            "aria-label": "下一页"
                          }, [
                            _createVNode(_component_Icon, {
                              name: "chevronRight",
                              size: 16
                            })
                          ], 8, ["disabled", "onClick"])
                        ])
                      ])
                    ]),
                    _ctx.selected ? (_openBlock(), _createElementBlock("aside", {
                      key: 0,
                      class: "product-inspector"
                    }, [
                      _createElementVNode("div", { class: "inspector-head" }, [
                        _createElementVNode("span", { class: "inspector-title" }, "商品详情"),
                        _createElementVNode(
                          "span",
                          { class: "inspector-id" },
                          _toDisplayString((_d = _ctx.selected.productId) == null ? void 0 : _d.slice(-9)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "inspector-product" }, [
                        _createVNode(_component_ProductImage, {
                          src: _ctx.selected.imageUrl,
                          alt: _ctx.selected.title
                        }, null, 8, ["src", "alt"]),
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(_ctx.selected.title),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            null,
                            _toDisplayString(_ctx.tableCategory(_ctx.selected)) + " · " + _toDisplayString(_ctx.selected.skus.length) + " 个规格",
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            {
                              class: _normalizeClass(["status-tag compact", _ctx.selected.status === "PUBLISHED" ? "published" : "unpublished"])
                            },
                            [
                              _createElementVNode("i"),
                              _createTextVNode(
                                _toDisplayString(_ctx.selected.status === "PUBLISHED" ? "在售" : "未上架"),
                                1
                                /* TEXT */
                              )
                            ],
                            2
                            /* CLASS */
                          )
                        ])
                      ]),
                      _createElementVNode("div", { class: "inspector-tabs" }, [
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.drawerTab === "stock" }),
                          onClick: ($event) => _ctx.drawerTab = "stock"
                        }, "库存", 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.drawerTab === "info" }),
                          onClick: ($event) => _ctx.drawerTab = "info"
                        }, "基本信息", 10, ["onClick"]),
                        _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.drawerTab === "sku" }),
                          onClick: ($event) => _ctx.drawerTab = "sku"
                        }, "规格售价", 10, ["onClick"])
                      ]),
                      _ctx.drawerTab === "stock" ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "inspector-body"
                      }, [
                        _createElementVNode("label", { class: "field-label" }, "选择规格"),
                        _withDirectives(_createElementVNode("select", {
                          "onUpdate:modelValue": ($event) => _ctx.selectedSkuId = $event,
                          class: "inspector-select"
                        }, [
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.selected.skus, (s) => {
                              return _openBlock(), _createElementBlock("option", {
                                key: s.skuId,
                                value: s.skuId
                              }, _toDisplayString(s.specKey), 9, ["value"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 8, ["onUpdate:modelValue"]), [
                          [_vModelSelect, _ctx.selectedSkuId]
                        ]),
                        _createElementVNode("div", { class: "stock-metrics" }, [
                          _createElementVNode("div", null, [
                            _createElementVNode("small", null, "实物库存"),
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(((_e = _ctx.stock) == null ? void 0 : _e.onHand) ?? "—"),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode("small", null, "已预占"),
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(((_f = _ctx.stock) == null ? void 0 : _f.reserved) ?? "—"),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode("small", null, "可售库存"),
                            _createElementVNode(
                              "strong",
                              { class: "mint-text" },
                              _toDisplayString(((_g = _ctx.stock) == null ? void 0 : _g.available) ?? ((_h = _ctx.selectedSku) == null ? void 0 : _h.available) ?? "—"),
                              1
                              /* TEXT */
                            )
                          ])
                        ]),
                        _createElementVNode("div", { class: "stock-progress" }, [
                          _createElementVNode("div", { class: "stock-progress-top" }, [
                            _createElementVNode("span", null, "可售占比"),
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(Math.round(_ctx.inventoryPercent)) + "%",
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode("div", { class: "track" }, [
                            _createElementVNode(
                              "span",
                              {
                                style: _normalizeStyle({ width: _ctx.inventoryPercent + "%" })
                              },
                              null,
                              4
                              /* STYLE */
                            )
                          ])
                        ]),
                        _ctx.stock && _ctx.stock.available < 20 ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "stock-warning"
                        }, [
                          _createVNode(_component_Icon, {
                            name: "alert",
                            size: 17
                          }),
                          _createTextVNode("库存偏低，建议及时补货")
                        ])) : _createCommentVNode("v-if", true),
                        _createElementVNode("div", { class: "inspector-divider" }),
                        _createElementVNode("h3", { class: "field-heading" }, "库存补货"),
                        _createElementVNode("label", {
                          class: "field-label",
                          for: "restock-n"
                        }, "增加数量"),
                        _createElementVNode("div", { class: "number-input" }, [
                          _createElementVNode("button", {
                            onClick: ($event) => _ctx.adjustment = Math.max(1, Number(_ctx.adjustment) - 1),
                            "aria-label": "减少补货数量"
                          }, [
                            _createVNode(_component_Icon, {
                              name: "minus",
                              size: 17
                            })
                          ], 8, ["onClick"]),
                          _withDirectives(_createElementVNode("input", {
                            id: "restock-n",
                            "onUpdate:modelValue": ($event) => _ctx.adjustment = $event,
                            type: "number",
                            min: "1",
                            max: "1000000"
                          }, null, 8, ["onUpdate:modelValue"]), [
                            [
                              _vModelText,
                              _ctx.adjustment,
                              void 0,
                              { number: true }
                            ]
                          ]),
                          _createElementVNode("button", {
                            onClick: ($event) => _ctx.adjustment = Math.min(1e6, Number(_ctx.adjustment) + 1),
                            "aria-label": "增加补货数量"
                          }, [
                            _createVNode(_component_Icon, {
                              name: "plus",
                              size: 17
                            })
                          ], 8, ["onClick"])
                        ]),
                        _createElementVNode("button", {
                          class: "teal-button inspector-submit",
                          onClick: _ctx.replenish,
                          disabled: _ctx.preview || _ctx.saving || !_ctx.canReplenish || !((_i = _ctx.selectedSku) == null ? void 0 : _i.skuId)
                        }, "确认补货", 8, ["onClick", "disabled"])
                      ])) : _ctx.drawerTab === "info" ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "inspector-body"
                      }, [
                        _createElementVNode("label", { class: "field-label" }, "商品名称"),
                        _withDirectives(_createElementVNode("input", {
                          class: "admin-input",
                          "onUpdate:modelValue": ($event) => _ctx.info.title = $event,
                          disabled: !_ctx.owned
                        }, null, 8, ["onUpdate:modelValue", "disabled"]), [
                          [_vModelText, _ctx.info.title]
                        ]),
                        _createElementVNode("label", { class: "field-label" }, "商品分类"),
                        _withDirectives(_createElementVNode("select", {
                          class: "admin-input",
                          "onUpdate:modelValue": ($event) => _ctx.info.categoryCode = $event,
                          disabled: !_ctx.owned
                        }, [
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.store.categories, (c) => {
                              return _openBlock(), _createElementBlock("option", {
                                key: c.code,
                                value: c.code
                              }, _toDisplayString(c.name), 9, ["value"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 8, ["onUpdate:modelValue", "disabled"]), [
                          [_vModelSelect, _ctx.info.categoryCode]
                        ]),
                        _createElementVNode("label", { class: "field-label" }, "商品描述"),
                        _withDirectives(_createElementVNode("textarea", {
                          class: "admin-input",
                          rows: "4",
                          "onUpdate:modelValue": ($event) => _ctx.info.description = $event,
                          disabled: !_ctx.owned
                        }, null, 8, ["onUpdate:modelValue", "disabled"]), [
                          [_vModelText, _ctx.info.description]
                        ]),
                        _createElementVNode("label", { class: "field-label" }, "商品主图"),
                        (_openBlock(), _createBlock(_component_ProductImageField, {
                          key: "edit-" + _ctx.selected.productId,
                          modelValue: _ctx.info.imageUrl,
                          "onUpdate:modelValue": ($event) => _ctx.info.imageUrl = $event,
                          "merchant-id": _ctx.store.merchantId,
                          demo: _ctx.preview,
                          disabled: !_ctx.owned || _ctx.saving,
                          onBusy: ($event) => _ctx.editImageUploading = $event,
                          onInvalid: ($event) => _ctx.editImageInvalid = $event
                        }, null, 8, ["modelValue", "onUpdate:modelValue", "merchant-id", "demo", "disabled", "onBusy", "onInvalid"])),
                        _createElementVNode("button", {
                          class: "teal-button inspector-submit",
                          onClick: _ctx.saveInfo,
                          disabled: _ctx.preview || _ctx.saving || _ctx.editImageUploading || _ctx.editImageInvalid || !_ctx.owned
                        }, "保存修改", 8, ["onClick", "disabled"]),
                        _createElementVNode("button", {
                          class: "inspector-link",
                          onClick: ($event) => _ctx.publish(_ctx.selected),
                          disabled: _ctx.preview || _ctx.saving || !_ctx.owned
                        }, [
                          _createTextVNode(
                            _toDisplayString(_ctx.selected.status === "PUBLISHED" ? "下架商品" : "上架商品") + " ",
                            1
                            /* TEXT */
                          ),
                          _createVNode(_component_Icon, {
                            name: "chevronRight",
                            size: 16
                          })
                        ], 8, ["onClick", "disabled"])
                      ])) : (_openBlock(), _createElementBlock("div", {
                        key: 2,
                        class: "inspector-body"
                      }, [
                        (_openBlock(true), _createElementBlock(
                          _Fragment,
                          null,
                          _renderList(_ctx.selected.skus, (sku2) => {
                            return _openBlock(), _createElementBlock("div", {
                              class: "sku-item",
                              key: sku2.skuId
                            }, [
                              _createElementVNode("div", null, [
                                _createElementVNode(
                                  "strong",
                                  null,
                                  _toDisplayString(sku2.specKey),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "small",
                                  null,
                                  _toDisplayString(sku2.skuId),
                                  1
                                  /* TEXT */
                                )
                              ]),
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(_ctx.money(sku2.priceCent)),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("button", {
                                disabled: !_ctx.owned || _ctx.preview,
                                onClick: ($event) => _ctx.openPrice(sku2),
                                title: "修改售价"
                              }, [
                                _createVNode(_component_Icon, {
                                  name: "edit",
                                  size: 17
                                })
                              ], 8, ["disabled", "onClick"])
                            ]);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        )),
                        _createElementVNode("button", {
                          class: "outline-button small",
                          disabled: !_ctx.owned || _ctx.preview || _ctx.selected.skus.length >= 20,
                          onClick: _ctx.openAddSku
                        }, [
                          _createVNode(_component_Icon, {
                            name: "plus",
                            size: 16
                          }),
                          _createTextVNode("新增规格")
                        ], 8, ["disabled", "onClick"])
                      ]))
                    ])) : (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "product-inspector empty-inspector"
                    }, [
                      _createVNode(_component_Icon, {
                        name: "package",
                        size: 28
                      }),
                      _createTextVNode("选择商品以查看详情")
                    ]))
                  ])
                ],
                64
                /* STABLE_FRAGMENT */
              ))
            ])
          ]),
          _ctx.loginOpen ? (_openBlock(), _createBlock(_component_AuthDialog, {
            key: 0,
            onClose: ($event) => _ctx.loginOpen = false,
            onSuccess: _ctx.loadMerchant
          }, null, 8, ["onClose", "onSuccess"])) : _createCommentVNode("v-if", true),
          _ctx.modal ? (_openBlock(), _createElementBlock("div", {
            key: 1,
            class: "ui-overlay",
            onClick: _withModifiers(($event) => _ctx.modal = "", ["self"])
          }, [
            _ctx.modal === "create" ? (_openBlock(), _createElementBlock("form", {
              key: 0,
              class: "merchant-modal",
              onSubmit: _withModifiers(_ctx.create, ["prevent"])
            }, [
              _createElementVNode("div", { class: "merchant-modal-header" }, [
                _createElementVNode("div", null, [
                  _createElementVNode("h2", null, "新增商品")
                ]),
                _createElementVNode("button", {
                  type: "button",
                  onClick: ($event) => _ctx.modal = "",
                  "aria-label": "关闭"
                }, [
                  _createVNode(_component_Icon, {
                    name: "x",
                    size: 20
                  })
                ], 8, ["onClick"])
              ]),
              _createElementVNode("label", { class: "field-label" }, "商品名称"),
              _withDirectives(_createElementVNode("input", {
                class: "admin-input",
                maxlength: "100",
                "onUpdate:modelValue": ($event) => _ctx.form.title = $event,
                placeholder: "商品名称",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.form.title]
              ]),
              _createElementVNode("label", { class: "field-label" }, "分类"),
              _withDirectives(_createElementVNode("select", {
                "onUpdate:modelValue": ($event) => _ctx.form.categoryCode = $event,
                class: "admin-input"
              }, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.store.categories.filter((c) => c.active), (c) => {
                    return _openBlock(), _createElementBlock("option", {
                      value: c.code
                    }, _toDisplayString(c.name), 9, ["value"]);
                  }),
                  256
                  /* UNKEYED_FRAGMENT */
                ))
              ], 8, ["onUpdate:modelValue"]), [
                [_vModelSelect, _ctx.form.categoryCode]
              ]),
              _createElementVNode("label", { class: "field-label" }, "规格 / 售价（元）"),
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.form.skus, (item, index) => {
                  return _openBlock(), _createElementBlock("div", {
                    key: index,
                    class: "sku-create-row"
                  }, [
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      maxlength: "100",
                      "onUpdate:modelValue": ($event) => item.specKey = $event,
                      required: "",
                      placeholder: "例如 250ml"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, item.specKey]
                    ]),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => item.price = $event,
                      inputmode: "decimal",
                      placeholder: "0.00",
                      required: ""
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, item.price]
                    ]),
                    _createElementVNode("button", {
                      type: "button",
                      class: "outline-button small",
                      disabled: _ctx.form.skus.length === 1,
                      onClick: ($event) => _ctx.removeCreateSku(index),
                      "aria-label": "移除规格" + (index + 1)
                    }, [
                      _createVNode(_component_Icon, {
                        name: "x",
                        size: 15
                      })
                    ], 8, ["disabled", "onClick", "aria-label"])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              _createElementVNode("button", {
                type: "button",
                class: "outline-button small",
                disabled: _ctx.form.skus.length >= 20,
                onClick: _ctx.addCreateSku
              }, [
                _createVNode(_component_Icon, {
                  name: "plus",
                  size: 15
                }),
                _createTextVNode("添加规格")
              ], 8, ["disabled", "onClick"]),
              _createElementVNode("label", { class: "field-label" }, "描述"),
              _withDirectives(_createElementVNode("textarea", {
                class: "admin-input",
                rows: "3",
                "onUpdate:modelValue": ($event) => _ctx.form.description = $event,
                placeholder: "选填"
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.form.description]
              ]),
              _createElementVNode("label", { class: "field-label" }, "商品主图"),
              _createVNode(_component_ProductImageField, {
                modelValue: _ctx.form.imageUrl,
                "onUpdate:modelValue": ($event) => _ctx.form.imageUrl = $event,
                "merchant-id": _ctx.store.merchantId,
                demo: _ctx.preview,
                disabled: _ctx.saving || !_ctx.owned,
                onBusy: ($event) => _ctx.createImageUploading = $event,
                onInvalid: ($event) => _ctx.createImageInvalid = $event
              }, null, 8, ["modelValue", "onUpdate:modelValue", "merchant-id", "demo", "disabled", "onBusy", "onInvalid"]),
              _createElementVNode("div", { class: "form-buttons" }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "outline-button",
                  onClick: ($event) => _ctx.modal = ""
                }, "取消", 8, ["onClick"]),
                _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: _ctx.preview || _ctx.saving || _ctx.createImageUploading || _ctx.createImageInvalid || !_ctx.owned
                }, "保存商品", 8, ["disabled"])
              ])
            ], 40, ["onSubmit"])) : _ctx.modal === "addSku" ? (_openBlock(), _createElementBlock("form", {
              key: 1,
              class: "merchant-modal narrow",
              onSubmit: _withModifiers(_ctx.addSku, ["prevent"])
            }, [
              _createElementVNode("div", { class: "merchant-modal-header" }, [
                _createElementVNode("h2", null, "新增规格"),
                _createElementVNode("button", {
                  type: "button",
                  onClick: ($event) => _ctx.modal = "",
                  "aria-label": "关闭"
                }, [
                  _createVNode(_component_Icon, {
                    name: "x",
                    size: 18
                  })
                ], 8, ["onClick"])
              ]),
              _createElementVNode("label", { class: "field-label" }, "规格名称"),
              _withDirectives(_createElementVNode("input", {
                class: "admin-input",
                maxlength: "100",
                "onUpdate:modelValue": ($event) => _ctx.skuForm.specKey = $event,
                required: "",
                placeholder: "例如：500ml"
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.skuForm.specKey]
              ]),
              _createElementVNode("label", { class: "field-label" }, "售价（元）"),
              _withDirectives(_createElementVNode("input", {
                class: "admin-input",
                "onUpdate:modelValue": ($event) => _ctx.skuForm.price = $event,
                inputmode: "decimal",
                required: "",
                placeholder: "0.00"
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.skuForm.price]
              ]),
              _createElementVNode("div", { class: "form-buttons" }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "outline-button",
                  onClick: ($event) => _ctx.modal = ""
                }, "取消", 8, ["onClick"]),
                _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: _ctx.preview || _ctx.saving
                }, "保存规格", 8, ["disabled"])
              ])
            ], 40, ["onSubmit"])) : _ctx.modal === "price" ? (_openBlock(), _createElementBlock("form", {
              key: 2,
              class: "merchant-modal narrow",
              onSubmit: _withModifiers(_ctx.savePrice, ["prevent"])
            }, [
              _createElementVNode("div", { class: "merchant-modal-header" }, [
                _createElementVNode("div", null, [
                  _createElementVNode("h2", null, "修改售价")
                ]),
                _createElementVNode("button", {
                  type: "button",
                  onClick: ($event) => _ctx.modal = "",
                  "aria-label": "关闭"
                }, [
                  _createVNode(_component_Icon, {
                    name: "x",
                    size: 20
                  })
                ], 8, ["onClick"])
              ]),
              _createElementVNode(
                "div",
                { class: "field-muted" },
                _toDisplayString((_j = _ctx.selected) == null ? void 0 : _j.title) + " · " + _toDisplayString((_k = _ctx.activePriceSku) == null ? void 0 : _k.specKey),
                1
                /* TEXT */
              ),
              _createElementVNode("label", { class: "field-label" }, "售价（元）"),
              _withDirectives(_createElementVNode("input", {
                class: "admin-input",
                "onUpdate:modelValue": ($event) => _ctx.newPrice = $event,
                inputmode: "decimal",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.newPrice]
              ]),
              _createElementVNode("div", { class: "form-buttons" }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "outline-button",
                  onClick: ($event) => _ctx.modal = ""
                }, "取消", 8, ["onClick"]),
                _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: _ctx.preview || _ctx.saving
                }, "保存售价", 8, ["disabled"])
              ])
            ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
          ], 8, ["onClick"])) : _createCommentVNode("v-if", true)
        ]);
      };
    })()
  };
  const stateName = {
    PENDING_PAYMENT: "待付款",
    PAID: "已支付",
    COMPLETED: "已完成",
    CANCELED: "已取消",
    REFUNDED: "已退款",
    PENDING: "待审核",
    SUBMITTED: "待审核",
    APPROVED: "已通过",
    REJECTED: "已驳回",
    DISPUTED: "平台介入",
    REQUESTED: "待处理",
    PREPARING: "备货中",
    READY: "待自提",
    CREATED: "待备货",
    WAIT_PREP: "待备货",
    ACTIVE: "营业中",
    INACTIVE: "已停用",
    PUBLISHED: "已发布",
    UNPUBLISHED: "已下架",
    DRAFT: "草稿",
    INDEXING: "索引中",
    FAILED: "失败",
    MERCHANT_INTERNAL: "商户内部",
    PLATFORM_INTERNAL: "平台内部",
    PUBLIC: "公开"
  };
  function label(s) {
    return stateName[s] || s || "—";
  }
  function dateTime(v) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d) ? String(v) : d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function pathId(v) {
    return encodeURIComponent(String(v || ""));
  }
  function coverSku(skuId) {
    const p = store.products.find((p2) => {
      var _a;
      return (_a = p2.skus) == null ? void 0 : _a.some((s) => s.skuId === skuId);
    });
    return (p == null ? void 0 : p.imageUrl) || "";
  }
  function positiveInt(v, max = 99) {
    return Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max;
  }
  const { ref: ref$9, computed: computed$a, onMounted: onMounted$a, watch: watch$9 } = Vue;
  const ProductDetail = {
    name: "ProductDetail",
    components: { ConsumerShell, ProductImage },
    setup() {
      const product = ref$9(null), chosen = ref$9(""), count = ref$9(1), busy = ref$9(false), error = ref$9("");
      const id = computed$a(() => decodeURIComponent(store.route.split("/")[2] || ""));
      const sku2 = computed$a(
        () => {
          var _a, _b;
          return ((_b = (_a = product.value) == null ? void 0 : _a.skus) == null ? void 0 : _b.find((s) => s.skuId === chosen.value)) || skuOf(product.value);
        }
      );
      const merchant = computed$a(
        () => store.merchants.find((m) => {
          var _a;
          return m.merchantId === ((_a = product.value) == null ? void 0 : _a.merchantId);
        }) || {}
      );
      async function load() {
        const target = id.value;
        product.value = null;
        error.value = "";
        if (preview) {
          product.value = store.products.find((p) => p.productId === target) || null;
        } else {
          try {
            const p = await api("/products/" + pathId(target));
            if (target === id.value) product.value = p;
          } catch (e) {
            if (target === id.value) error.value = e.message;
          }
        }
        chosen.value = skuOf(product.value).skuId || "";
        count.value = 1;
      }
      onMounted$a(load);
      watch$9(id, load);
      async function add() {
        var _a;
        if (preview || busy.value || !((_a = sku2.value) == null ? void 0 : _a.skuId)) return;
        busy.value = true;
        try {
          const actual = await api("/products/" + pathId(product.value.productId));
          const real = actual.skus.find((s) => s.skuId === sku2.value.skuId);
          if (actual.status !== "PUBLISHED" || !real || real.status !== "ACTIVE" || Number(real.available) < count.value)
            throw Error("商品库存或状态已变化");
          const list = await api("/cart");
          const old = list.find((i) => i.skuId === real.skuId);
          const quantity = Number((old == null ? void 0 : old.quantity) || 0) + count.value;
          if (quantity > 99) throw Error("单个规格最多99件");
          await api("/cart", { method: "PUT", body: { skuId: real.skuId, quantity } });
          notify("已加入购物车");
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      return { product, sku: sku2, chosen, count, busy, error, preview, store, go, money, merchant, add };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
          default: _withCtx(() => [
            _createElementVNode("div", { class: "mobile-page-top" }, [
              _createElementVNode("button", {
                onClick: ($event) => _ctx.go("/"),
                "aria-label": "返回首页"
              }, [
                _createVNode(_component_Icon, { name: "arrowLeft" })
              ], 8, ["onClick"]),
              _createElementVNode("b", null, "商品详情"),
              _createElementVNode("button", {
                onClick: ($event) => _ctx.go("/cart"),
                "aria-label": "购物车"
              }, [
                _createVNode(_component_Icon, { name: "cart" })
              ], 8, ["onClick"])
            ]),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 0,
                class: "inline-error"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _ctx.product ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 1 },
              [
                _createElementVNode("div", { class: "detail-art" }, [
                  _createVNode(_component_ProductImage, {
                    src: _ctx.product.imageUrl,
                    alt: _ctx.product.title,
                    loading: "eager"
                  }, null, 8, ["src", "alt"]),
                  _ctx.product.status === "PUBLISHED" ? (_openBlock(), _createElementBlock("span", {
                    key: 0,
                    class: "corner-tag"
                  }, "校内自提")) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("div", { class: "detail-info" }, [
                  _createElementVNode("div", { class: "detail-price" }, [
                    _createTextVNode(
                      _toDisplayString(_ctx.money(_ctx.sku.priceCent)) + " ",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("small", null, "含税售价")
                  ]),
                  _createElementVNode(
                    "h1",
                    null,
                    _toDisplayString(_ctx.product.title),
                    1
                    /* TEXT */
                  ),
                  _ctx.product.description ? (_openBlock(), _createElementBlock(
                    "p",
                    {
                      key: 0,
                      class: "muted-short"
                    },
                    _toDisplayString(_ctx.product.description),
                    1
                    /* TEXT */
                  )) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("div", { class: "detail-card" }, [
                  _createElementVNode("button", {
                    class: "detail-merchant",
                    onClick: ($event) => _ctx.go("/shops/" + _ctx.product.merchantId)
                  }, [
                    _createElementVNode("span", { class: "merchant-logo" }, [
                      _createVNode(_component_Icon, { name: "store" })
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.merchant.name || "校园商户"),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(_ctx.merchant.storeName || _ctx.merchant.location || "校内自提门店"),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createVNode(_component_Icon, { name: "chevronRight" })
                  ], 8, ["onClick"])
                ]),
                _createElementVNode("div", { class: "detail-card" }, [
                  _createElementVNode("div", { class: "detail-subtitle" }, "选择规格"),
                  _createElementVNode("div", { class: "sku-picker" }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.product.skus, (s) => {
                        return _openBlock(), _createElementBlock("button", {
                          key: s.skuId,
                          class: _normalizeClass({ active: _ctx.sku.skuId === s.skuId }),
                          disabled: s.status !== "ACTIVE" || !s.available,
                          onClick: ($event) => {
                            _ctx.chosen = s.skuId;
                            _ctx.count = 1;
                          }
                        }, _toDisplayString(s.specKey), 11, ["disabled", "onClick"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]),
                  _createElementVNode("div", { class: "quantity-picker" }, [
                    _createElementVNode("span", null, [
                      _createTextVNode("数量 "),
                      _createElementVNode(
                        "small",
                        null,
                        "可售 " + _toDisplayString(_ctx.sku.available || 0),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("button", {
                        "aria-label": "减少",
                        onClick: ($event) => _ctx.count = Math.max(1, _ctx.count - 1)
                      }, [
                        _createVNode(_component_Icon, {
                          name: "minus",
                          size: 16
                        })
                      ], 8, ["onClick"]),
                      _createElementVNode(
                        "b",
                        null,
                        _toDisplayString(_ctx.count),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode("button", {
                        "aria-label": "增加",
                        disabled: _ctx.count >= Math.min(99, Number(_ctx.sku.available || 0)),
                        onClick: ($event) => _ctx.count++
                      }, [
                        _createVNode(_component_Icon, {
                          name: "plus",
                          size: 16
                        })
                      ], 8, ["disabled", "onClick"])
                    ])
                  ])
                ]),
                _createElementVNode("div", { class: "detail-fixed" }, [
                  _createElementVNode("button", {
                    class: "outline-button",
                    onClick: ($event) => _ctx.go("/cart")
                  }, [
                    _createVNode(_component_Icon, {
                      name: "cart",
                      size: 18
                    }),
                    _createTextVNode("购物车")
                  ], 8, ["onClick"]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    disabled: _ctx.preview || _ctx.busy || !_ctx.sku.available || _ctx.product.status !== "PUBLISHED",
                    onClick: _ctx.add
                  }, _toDisplayString(_ctx.busy ? "加入中…" : "加入购物车"), 9, ["disabled", "onClick"])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "mobile-empty"
            }, "正在加载商品…"))
          ]),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$8, computed: computed$9, onMounted: onMounted$9, onUnmounted: onUnmounted$7, watch: watch$8 } = Vue;
  const Shop = {
    name: "Shop",
    components: { ConsumerShell, ProductImage },
    setup() {
      const merchant = ref$8(null), products = ref$8([]), error = ref$8(""), loading = ref$8(false), page = ref$8(1), hasNext = ref$8(false);
      const id = computed$9(
        () => decodeURIComponent(store.route.slice("/shops/".length).split("/")[0] || "")
      );
      let loadVersion = 0;
      async function load() {
        const stamp = ++loadVersion, current = id.value, currentPage = page.value;
        const valid = () => stamp === loadVersion && current === id.value && currentPage === page.value;
        error.value = "";
        loading.value = true;
        merchant.value = null;
        products.value = [];
        hasNext.value = false;
        try {
          if (preview) {
            merchant.value = store.merchants.find((m) => m.merchantId === current) || null;
            const all = store.products.filter(
              (p) => p.merchantId === current && p.status === "PUBLISHED"
            );
            products.value = all.slice((currentPage - 1) * 12, currentPage * 12);
            hasNext.value = all.length > currentPage * 12;
          } else {
            const [m, p] = await Promise.all([
              api("/merchants/public/" + encodeURIComponent(current)),
              api("/products/page" + query({ merchantId: current, page: currentPage, size: 12 }))
            ]);
            if (!valid()) return;
            merchant.value = m;
            products.value = (p == null ? void 0 : p.items) || [];
            hasNext.value = !!(p == null ? void 0 : p.hasNext);
          }
        } catch (e) {
          if (valid()) error.value = e.message;
        } finally {
          if (valid()) loading.value = false;
        }
      }
      onMounted$9(load);
      onUnmounted$7(() => ++loadVersion);
      watch$8(id, () => {
        if (page.value !== 1) page.value = 1;
        else load();
      });
      watch$8(page, load);
      return { merchant, products, error, loading, page, hasNext, go, money, skuOf };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "home" }, {
          default: _withCtx(() => [
            _createElementVNode("div", { class: "mobile-page-top" }, [
              _createElementVNode("button", {
                onClick: ($event) => _ctx.go("/"),
                "aria-label": "返回"
              }, [
                _createVNode(_component_Icon, { name: "arrowLeft" })
              ], 8, ["onClick"]),
              _createElementVNode("b", null, "商户"),
              _createElementVNode("span")
            ]),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 0,
                class: "inline-error"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            _ctx.merchant ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 1 },
              [
                _createElementVNode("section", { class: "shop-hero" }, [
                  _createElementVNode("span", { class: "merchant-logo" }, [
                    _createVNode(_component_Icon, {
                      name: "store",
                      size: 28
                    })
                  ]),
                  _createElementVNode("div", null, [
                    _createElementVNode(
                      "h1",
                      null,
                      _toDisplayString(_ctx.merchant.name),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "p",
                      null,
                      _toDisplayString(_ctx.merchant.storeName) + " · " + _toDisplayString(_ctx.merchant.location),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                _createElementVNode("div", { class: "section-heading" }, [
                  _createElementVNode("h2", null, "在售商品")
                ]),
                _createElementVNode("div", { class: "shop-product-grid" }, [
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.products, (p) => {
                      return _openBlock(), _createElementBlock("button", {
                        key: p.productId,
                        class: "shop-product-card",
                        onClick: ($event) => _ctx.go("/product/" + encodeURIComponent(p.productId))
                      }, [
                        _createVNode(_component_ProductImage, {
                          src: p.imageUrl,
                          alt: p.title
                        }, null, 8, ["src", "alt"]),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(p.title),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "span",
                          null,
                          _toDisplayString(_ctx.money(_ctx.skuOf(p).priceCent)),
                          1
                          /* TEXT */
                        )
                      ], 8, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                !_ctx.products.length && !_ctx.loading ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "mobile-empty"
                }, "暂无在售商品")) : _createCommentVNode("v-if", true),
                _createElementVNode("div", { class: "shop-pagination" }, [
                  _createElementVNode("button", {
                    disabled: _ctx.page === 1 || _ctx.loading,
                    onClick: ($event) => _ctx.page--
                  }, "上一页", 8, ["disabled", "onClick"]),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.page),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("button", {
                    disabled: !_ctx.hasNext || _ctx.loading,
                    onClick: ($event) => _ctx.page++
                  }, "下一页", 8, ["disabled", "onClick"])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : _ctx.loading ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "mobile-empty"
            }, "正在加载商户…")) : _createCommentVNode("v-if", true)
          ]),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const t = "2026-10-27T11:40:00Z";
  const items = [
    {
      skuId: "preview-sku-1",
      title: "红烧牛肉面 · 经典桶",
      specKey: "109g",
      unitPriceCent: 450,
      quantity: 1
    },
    {
      skuId: "preview-sku-2",
      title: "纯牛奶 · 250ml",
      specKey: "250ml",
      unitPriceCent: 280,
      quantity: 2
    }
  ];
  const DEMO_CART = [
    {
      merchantId: "preview-m1",
      skuId: "preview-sku-1",
      title: items[0].title,
      specKey: "109g",
      quantity: 1,
      priceCent: 450,
      quoteVersion: 1,
      available: 320,
      sellable: true
    },
    {
      merchantId: "preview-m1",
      skuId: "preview-sku-2",
      title: items[1].title,
      specKey: "250ml",
      quantity: 2,
      priceCent: 280,
      quoteVersion: 1,
      available: 18,
      sellable: true
    },
    {
      merchantId: "preview-m2",
      skuId: "preview-sku-3",
      title: "苹果 · 清甜脆爽",
      specKey: "单个",
      quantity: 2,
      priceCent: 190,
      quoteVersion: 1,
      available: 46,
      sellable: true
    }
  ];
  const DEMO_ORDERS = [
    {
      orderId: "CS202610280001",
      buyerId: "preview-user",
      merchantId: "preview-m1",
      storeId: "preview-s1",
      status: "PAID",
      totalCent: 1010,
      createdAt: t,
      deadline: "2026-10-29T11:40:00Z",
      items,
      pickup: { status: "READY", expiresAt: null }
    },
    {
      orderId: "CS202610270016",
      buyerId: "preview-user",
      merchantId: "preview-m2",
      storeId: "preview-s2",
      status: "COMPLETED",
      totalCent: 570,
      createdAt: "2026-10-26T10:30:00Z",
      items: [
        {
          skuId: "preview-sku-3",
          title: "苹果 · 清甜脆爽",
          specKey: "单个",
          unitPriceCent: 190,
          quantity: 3
        }
      ],
      pickup: { status: "COMPLETED" }
    },
    {
      orderId: "CS202610280003",
      buyerId: "preview-user",
      merchantId: "preview-m1",
      storeId: "preview-s1",
      status: "PENDING_PAYMENT",
      totalCent: 450,
      createdAt: t,
      deadline: "2026-10-29T11:40:00Z",
      items: items.slice(0, 1),
      pickup: null
    }
  ];
  const DEMO_APPLICATIONS = [
    {
      applicationId: "AP-1025",
      merchantName: "东湖便利",
      category: "便利零售",
      contactName: "店主 A",
      contactPhone: "13800000000",
      storeName: "学一食堂店",
      location: "东湖校区 · 学一食堂",
      status: "SUBMITTED",
      rejectionReason: ""
    },
    {
      applicationId: "AP-1024",
      merchantName: "青果时间",
      category: "水果生鲜",
      contactName: "店主 B",
      contactPhone: "13900000000",
      storeName: "生活区店",
      location: "生活区 B 栋",
      status: "APPROVED",
      merchantId: "preview-m2"
    },
    {
      applicationId: "AP-1023",
      merchantName: "学伴文具",
      category: "文具用品",
      contactName: "店主 C",
      contactPhone: "13600000000",
      storeName: "图书馆店",
      location: "图书馆一层",
      status: "REJECTED",
      rejectionReason: "信息不完整"
    }
  ];
  const DEMO_MEMBERS = [
    { merchantId: "preview-m1", userId: "preview-user", role: "OWNER", status: "ACTIVE" },
    { merchantId: "preview-m1", userId: "preview-clerk", role: "CLERK", status: "ACTIVE" }
  ];
  const DEMO_BASES = [
    { id: "KB-01", name: "门店服务指南", merchantId: "preview-m1", visibility: "PUBLIC" },
    { id: "KB-02", name: "内部运营指引", merchantId: "preview-m1", visibility: "MERCHANT_INTERNAL" }
  ];
  const DEMO_DOCS = [
    {
      id: "D-11",
      baseId: "KB-01",
      rootId: "R-11",
      title: "门店营业信息",
      version: 2,
      status: "PUBLISHED",
      indexStatus: "READY",
      content: "营业时间与自提注意事项",
      createdAt: t
    },
    {
      id: "D-12",
      baseId: "KB-01",
      rootId: "R-12",
      title: "商品分类说明",
      version: 1,
      status: "DRAFT",
      indexStatus: "READY",
      content: "零食与饮品",
      createdAt: t
    }
  ];
  const DEMO_STATS = {
    totalOrders: 168,
    pendingCount: 12,
    paidCount: 28,
    completedCount: 128,
    refundedCount: 3,
    completedAmountCent: 286050
  };
  const DEMO_MERCHANT_ORDERS = DEMO_ORDERS.map((o, i) => ({
    ...o,
    orderId: "M" + String(i + 1).padStart(5, "0"),
    buyerId: "preview-buyer-" + i,
    merchantId: "preview-m1",
    status: ["PAID", "COMPLETED", "PENDING_PAYMENT"][i],
    pickup: i === 0 ? { status: "WAIT_PREP" } : o.pickup
  }));
  const DEMO_AFTERSALES = [
    {
      id: "AF-008",
      orderId: "M00002",
      merchantId: "preview-m1",
      status: "REQUESTED",
      reason: "商品临时不需要",
      createdAt: t
    },
    {
      id: "AF-007",
      orderId: "M00003",
      merchantId: "preview-m1",
      status: "DISPUTED",
      reason: "未提货申请退款",
      createdAt: t
    }
  ];
  const DEMO_STOCK_MOVES = [
    {
      id: "MV-11",
      skuId: DEMO_PRODUCTS[0].skus[0].skuId,
      type: "REPLENISH",
      quantity: 20,
      createdAt: t,
      bizKey: "DEMO-01"
    }
  ];
  const RBAC_LABELS = [
    ["dashboard.read", "经营统计"],
    ["product.read", "查看商品"],
    ["product.write", "管理商品及价格"],
    ["stock.read", "查看库存与流水"],
    ["stock.replenish", "补货"],
    ["order.read", "查看订单"],
    ["order.prepare", "备货"],
    ["pickup.verify", "自提核销"],
    ["aftersale.read", "查看售后"],
    ["aftersale.review", "审核售后"],
    ["knowledge.read", "读取知识库"],
    ["knowledge.manage", "管理知识库"],
    ["team.manage", "邀请和撤销成员"],
    ["store.manage", "修改门店资料"],
    ["role.manage", "角色与权限管理"]
  ];
  const DEMO_RBAC_PERMISSIONS = RBAC_LABELS.map(([code, label2]) => ({
    code,
    label: label2,
    grantable: !["team.manage", "store.manage", "role.manage"].includes(code)
  }));
  const DEMO_RBAC_ROLES = [
    { code: "OWNER", name: "经营者", builtin: true, permissions: RBAC_LABELS.map(([code]) => code) },
    {
      code: "CLERK",
      name: "店员",
      builtin: true,
      permissions: [
        "product.read",
        "stock.read",
        "stock.replenish",
        "order.read",
        "order.prepare",
        "pickup.verify"
      ]
    },
    {
      code: "preview-operator",
      name: "商品运营",
      builtin: false,
      permissions: ["product.read", "product.write", "stock.read"]
    }
  ];
  const { ref: ref$7, computed: computed$8, onMounted: onMounted$8 } = Vue;
  const Cart = {
    name: "Cart",
    components: { ConsumerShell, ProductImage },
    setup() {
      const items2 = ref$7([]), merchantId = ref$7(""), busy = ref$7(false), error = ref$7(""), orderKey = ref$7(""), fingerprint = ref$7("");
      const groups = computed$8(
        () => Object.entries(
          Object.groupBy ? Object.groupBy(items2.value, (i) => i.merchantId) : items2.value.reduce((a, i) => {
            var _a;
            (a[_a = i.merchantId] ?? (a[_a] = [])).push(i);
            return a;
          }, {})
        ).map(([id, rows]) => ({
          id,
          rows,
          total: rows.reduce((s, i) => s + Number(i.priceCent) * Number(i.quantity), 0)
        }))
      );
      const selected = computed$8(() => items2.value.filter((i) => i.merchantId === merchantId.value));
      const total = computed$8(
        () => selected.value.reduce((n, i) => n + Number(i.priceCent) * Number(i.quantity), 0)
      );
      const merchantName = (id) => {
        var _a, _b;
        return ((_a = items2.value.find((i) => i.merchantId === id)) == null ? void 0 : _a.merchantName) || ((_b = store.merchants.find((m) => m.merchantId === id)) == null ? void 0 : _b.name) || "校内商户";
      };
      async function load() {
        var _a;
        error.value = "";
        if (preview) {
          items2.value = DEMO_CART.map((i) => ({ ...i }));
        } else {
          try {
            items2.value = await api("/cart") || [];
          } catch (e) {
            error.value = e.message;
            items2.value = [];
          }
        }
        if (!items2.value.some((i) => i.merchantId === merchantId.value))
          merchantId.value = ((_a = items2.value[0]) == null ? void 0 : _a.merchantId) || "";
      }
      onMounted$8(load);
      async function quantity(i, d) {
        if (preview) return;
        const n = Number(i.quantity) + d;
        if (n > 99 || n < 0) return;
        busy.value = true;
        try {
          if (n) await api("/cart", { method: "PUT", body: { skuId: i.skuId, quantity: n } });
          else await api("/cart/" + pathId(i.skuId), { method: "DELETE" });
          orderKey.value = "";
          await load();
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      async function checkout() {
        if (preview || busy.value || !selected.value.length) return;
        if (selected.value.some((i) => !i.sellable || i.available < i.quantity)) {
          notify("请先调整失效或库存不足的商品");
          return;
        }
        const body = {
          merchantId: merchantId.value,
          items: selected.value.map((i) => ({
            skuId: i.skuId,
            quantity: Number(i.quantity),
            expectedPriceCent: Number(i.priceCent),
            expectedVersion: Number(i.quoteVersion)
          }))
        };
        const next = JSON.stringify(body);
        if (fingerprint.value !== next) {
          orderKey.value = idempotency();
          fingerprint.value = next;
        }
        busy.value = true;
        try {
          const created = await api("/orders", { method: "POST", body, key: orderKey.value });
          orderKey.value = "";
          fingerprint.value = "";
          notify("订单已创建");
          go("/orders/" + pathId(created.orderId));
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      return {
        items: items2,
        merchantId,
        busy,
        error,
        groups,
        selected,
        total,
        preview,
        go,
        money,
        merchantName,
        quantity,
        checkout,
        load
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, createTextVNode: _createTextVNode, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "cart" }, {
          default: _withCtx(() => [
            _createElementVNode("div", { class: "mobile-page-top" }, [
              _createElementVNode("button", {
                onClick: ($event) => _ctx.go("/"),
                "aria-label": "返回"
              }, [
                _createVNode(_component_Icon, { name: "arrowLeft" })
              ], 8, ["onClick"]),
              _createElementVNode("b", null, "购物车"),
              _createElementVNode("button", {
                onClick: _ctx.load,
                "aria-label": "刷新"
              }, [
                _createVNode(_component_Icon, { name: "refresh" })
              ], 8, ["onClick"])
            ]),
            _ctx.error ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 0,
                class: "inline-error"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            !_ctx.items.length && !_ctx.error ? (_openBlock(), _createElementBlock("div", {
              key: 1,
              class: "mobile-empty"
            }, [
              _createVNode(_component_Icon, {
                name: "cart",
                size: 36
              }),
              _createElementVNode("strong", null, "购物车空空的"),
              _createElementVNode("button", {
                class: "teal-button",
                onClick: ($event) => _ctx.go("/")
              }, "去逛逛", 8, ["onClick"])
            ])) : _createCommentVNode("v-if", true),
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList(_ctx.groups, (g) => {
                return _openBlock(), _createElementBlock(
                  "section",
                  {
                    key: g.id,
                    class: _normalizeClass(["cart-store", { selected: _ctx.merchantId === g.id }])
                  },
                  [
                    _createElementVNode("button", {
                      class: "cart-store-head",
                      onClick: ($event) => _ctx.merchantId = g.id
                    }, [
                      _createElementVNode(
                        "span",
                        {
                          class: _normalizeClass(["radio-circle", { active: _ctx.merchantId === g.id }])
                        },
                        [
                          _createVNode(_component_Icon, {
                            name: "check",
                            size: 12
                          })
                        ],
                        2
                        /* CLASS */
                      ),
                      _createVNode(_component_Icon, { name: "store" }),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.merchantName(g.id)),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "span",
                        { class: "cart-store-total" },
                        _toDisplayString(_ctx.money(g.total)),
                        1
                        /* TEXT */
                      )
                    ], 8, ["onClick"]),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(g.rows, (i) => {
                        return _openBlock(), _createElementBlock("div", {
                          class: "cart-line",
                          key: i.skuId
                        }, [
                          _createVNode(_component_ProductImage, {
                            src: i.imageUrl,
                            alt: i.title
                          }, null, 8, ["src", "alt"]),
                          _createElementVNode("div", { class: "cart-line-info" }, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(i.title),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode("small", null, [
                              _createTextVNode(
                                _toDisplayString(i.specKey) + " ",
                                1
                                /* TEXT */
                              ),
                              !i.sellable || i.available < i.quantity ? (_openBlock(), _createElementBlock("span", {
                                key: 0,
                                class: "red-text"
                              }, "库存不足/失效")) : _createCommentVNode("v-if", true)
                            ]),
                            _createElementVNode("div", { class: "cart-line-bottom" }, [
                              _createElementVNode(
                                "b",
                                null,
                                _toDisplayString(_ctx.money(i.priceCent)),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("div", { class: "mini-qty" }, [
                                _createElementVNode("button", {
                                  disabled: _ctx.busy || _ctx.preview,
                                  "aria-label": "减少" + i.title,
                                  onClick: ($event) => _ctx.quantity(i, -1)
                                }, [
                                  _createVNode(_component_Icon, {
                                    name: "minus",
                                    size: 15
                                  })
                                ], 8, ["disabled", "aria-label", "onClick"]),
                                _createElementVNode(
                                  "span",
                                  null,
                                  _toDisplayString(i.quantity),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode("button", {
                                  disabled: _ctx.busy || _ctx.preview || i.quantity >= 99 || i.quantity >= i.available,
                                  "aria-label": "增加" + i.title,
                                  onClick: ($event) => _ctx.quantity(i, 1)
                                }, [
                                  _createVNode(_component_Icon, {
                                    name: "plus",
                                    size: 15
                                  })
                                ], 8, ["disabled", "aria-label", "onClick"])
                              ])
                            ])
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ],
                  2
                  /* CLASS */
                );
              }),
              128
              /* KEYED_FRAGMENT */
            )),
            _ctx.groups.length > 1 ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "mobile-hint"
            }, "一次结算一家商户，请选择要下单的店铺。")) : _createCommentVNode("v-if", true),
            _ctx.items.length ? (_openBlock(), _createElementBlock("div", {
              key: 3,
              class: "mobile-summary"
            }, [
              _createElementVNode("div", null, [
                _createTextVNode("商品金额 "),
                _createElementVNode(
                  "strong",
                  null,
                  _toDisplayString(_ctx.money(_ctx.total)),
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("div", null, [
                _createTextVNode("自提方式 "),
                _createElementVNode("strong", null, "校内门店自提")
              ]),
              _createElementVNode("div", { class: "mobile-summary-total" }, [
                _createTextVNode("应付 "),
                _createElementVNode(
                  "b",
                  null,
                  _toDisplayString(_ctx.money(_ctx.total)),
                  1
                  /* TEXT */
                )
              ])
            ])) : _createCommentVNode("v-if", true),
            _ctx.items.length ? (_openBlock(), _createElementBlock("div", {
              key: 4,
              class: "mobile-checkout-bar"
            }, [
              _createElementVNode("div", null, [
                _createElementVNode("small", null, "本单合计"),
                _createElementVNode(
                  "b",
                  null,
                  _toDisplayString(_ctx.money(_ctx.total)),
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("button", {
                class: "teal-button",
                disabled: _ctx.preview || _ctx.busy || !_ctx.selected.length,
                onClick: _ctx.checkout
              }, _toDisplayString(_ctx.busy ? "提交中" : "提交订单"), 9, ["disabled", "onClick"])
            ])) : _createCommentVNode("v-if", true)
          ]),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$6, computed: computed$7, onMounted: onMounted$7, watch: watch$7 } = Vue;
  const Orders = {
    name: "Orders",
    components: { ConsumerShell, ProductImage },
    setup() {
      const orders = ref$6([]), detail = ref$6(null), token = ref$6(null), error = ref$6(""), busy = ref$6(false), tab = ref$6("ALL"), page = ref$6(1), pageInfo = ref$6({ total: 0, hasNext: false }), refundOpen = ref$6(false), reason = ref$6("");
      const id = computed$7(
        () => store.route.startsWith("/orders/") ? decodeURIComponent(store.route.slice("/orders/".length)) : null
      );
      const filtered = computed$7(
        () => orders.value.filter((o) => tab.value === "ALL" || o.status === tab.value)
      );
      const merchantName = (id2, record) => {
        var _a;
        return (record == null ? void 0 : record.merchantName) || ((_a = store.merchants.find((m) => m.merchantId === id2)) == null ? void 0 : _a.name) || "校内商户";
      };
      async function load() {
        error.value = "";
        token.value = null;
        refundOpen.value = false;
        if (preview) {
          orders.value = DEMO_ORDERS.map((x) => ({ ...x }));
          pageInfo.value = { total: orders.value.length, hasNext: false };
          detail.value = id.value ? orders.value.find((o) => o.orderId === id.value) || null : null;
          return;
        }
        try {
          if (id.value) {
            detail.value = await api("/orders/" + pathId(id.value));
          } else {
            detail.value = null;
            const result = await api(
              "/orders/page" + query({ page: page.value, size: 10, state: tab.value === "ALL" ? "" : tab.value })
            );
            orders.value = result.items || [];
            pageInfo.value = result;
          }
        } catch (e) {
          error.value = e.message;
        }
      }
      onMounted$7(load);
      watch$7(id, load);
      watch$7([page, tab], () => {
        if (!id.value) load();
      });
      async function action(endpoint, method = "POST", body) {
        if (preview || busy.value || !detail.value) return;
        busy.value = true;
        try {
          const result = await api("/orders/" + pathId(detail.value.orderId) + endpoint, {
            method,
            body
          });
          if (endpoint === "/pickup-token") {
            token.value = result;
          } else {
            notify("操作成功");
            await load();
          }
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      async function submitRefund() {
        if (!reason.value.trim()) {
          notify("请输入退款原因");
          return;
        }
        await action("/refunds", "POST", { reason: reason.value.trim() });
        refundOpen.value = false;
        reason.value = "";
      }
      function statusClass(s) {
        return ["PAID", "COMPLETED"].includes(s) ? "ok" : ["CANCELED", "REFUNDED"].includes(s) ? "muted" : "warn";
      }
      const allowToken = computed$7(
        () => {
          var _a, _b, _c, _d, _e;
          return ((_a = detail.value) == null ? void 0 : _a.status) === "PAID" && ((_c = (_b = detail.value) == null ? void 0 : _b.pickup) == null ? void 0 : _c.status) === "READY" && !["REQUESTED", "DISPUTED", "APPROVED"].includes((_e = (_d = detail.value) == null ? void 0 : _d.afterSale) == null ? void 0 : _e.status);
        }
      );
      return {
        store,
        orders,
        detail,
        filtered,
        token,
        error,
        busy,
        tab,
        page,
        pageInfo,
        refundOpen,
        reason,
        id,
        preview,
        go,
        money,
        label,
        dateTime,
        merchantName,
        action,
        submitRefund,
        statusClass,
        allowToken,
        load
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, createTextVNode: _createTextVNode, vModelText: _vModelText, withDirectives: _withDirectives, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "orders" }, {
          default: _withCtx(() => {
            var _a, _b, _c, _d, _e;
            return [
              _createElementVNode("div", { class: "mobile-page-top" }, [
                _createElementVNode("button", {
                  onClick: ($event) => _ctx.go(_ctx.id ? "/orders" : "/"),
                  "aria-label": "返回"
                }, [
                  _createVNode(_component_Icon, { name: "arrowLeft" })
                ], 8, ["onClick"]),
                _createElementVNode(
                  "b",
                  null,
                  _toDisplayString(_ctx.id ? "订单详情" : "我的订单"),
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  onClick: _ctx.load,
                  "aria-label": "刷新"
                }, [
                  _createVNode(_component_Icon, { name: "refresh" })
                ], 8, ["onClick"])
              ]),
              _ctx.error ? (_openBlock(), _createElementBlock(
                "div",
                {
                  key: 0,
                  class: "inline-error"
                },
                _toDisplayString(_ctx.error),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              !_ctx.id ? (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 1 },
                [
                  _createElementVNode("div", { class: "order-tabs" }, [
                    (_openBlock(), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList([["ALL", "全部"], ["PENDING_PAYMENT", "待付款"], ["PAID", "待自提"], ["COMPLETED", "已完成"]], (t2) => {
                        return _createElementVNode("button", {
                          class: _normalizeClass({ active: _ctx.tab === t2[0] }),
                          key: t2[0],
                          onClick: ($event) => {
                            _ctx.page = 1;
                            _ctx.tab = t2[0];
                          }
                        }, _toDisplayString(t2[1]), 11, ["onClick"]);
                      }),
                      64
                      /* STABLE_FRAGMENT */
                    ))
                  ]),
                  !_ctx.filtered.length && !_ctx.error ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "mobile-empty"
                  }, [
                    _createVNode(_component_Icon, {
                      name: "order",
                      size: 34
                    }),
                    _createElementVNode("strong", null, "暂无订单")
                  ])) : _createCommentVNode("v-if", true),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.filtered, (o) => {
                      var _a2, _b2, _c2, _d2, _e2, _f, _g;
                      return _openBlock(), _createElementBlock("button", {
                        class: "consumer-order-card",
                        key: o.orderId,
                        onClick: ($event) => _ctx.go("/orders/" + o.orderId)
                      }, [
                        _createElementVNode("div", { class: "order-card-head" }, [
                          _createElementVNode("span", null, [
                            _createVNode(_component_Icon, {
                              name: "store",
                              size: 17
                            }),
                            _createTextVNode(
                              _toDisplayString(_ctx.merchantName(o.merchantId, o)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "b",
                            {
                              class: _normalizeClass(_ctx.statusClass(o.status))
                            },
                            _toDisplayString(_ctx.label(o.status)),
                            3
                            /* TEXT, CLASS */
                          )
                        ]),
                        _createElementVNode("div", { class: "order-goods" }, [
                          _createElementVNode("div", { class: "order-item-placeholder" }, [
                            _createVNode(_component_ProductImage, {
                              src: (_b2 = (_a2 = o.items) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.imageUrl,
                              alt: ((_d2 = (_c2 = o.items) == null ? void 0 : _c2[0]) == null ? void 0 : _d2.title) || "商品"
                            }, null, 8, ["src", "alt"])
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(((_f = (_e2 = o.items) == null ? void 0 : _e2[0]) == null ? void 0 : _f.title) || "校园订单"),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(((_g = o.items) == null ? void 0 : _g.length) || 0) + " 种商品 · " + _toDisplayString(_ctx.dateTime(o.createdAt)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.money(o.totalCent)),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createElementVNode("div", { class: "order-card-foot" }, [
                          _createTextVNode(
                            "#" + _toDisplayString(o.orderId) + " ",
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("span", null, [
                            _createTextVNode("查看详情 "),
                            _createVNode(_component_Icon, {
                              name: "chevronRight",
                              size: 14
                            })
                          ])
                        ])
                      ], 8, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.preview && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "sdd-pager"
                  }, [
                    _createElementVNode(
                      "span",
                      null,
                      "共 " + _toDisplayString(_ctx.pageInfo.total) + " 单",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: _ctx.page <= 1,
                      onClick: ($event) => _ctx.page--
                    }, "上一页", 8, ["disabled", "onClick"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.page),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: !_ctx.pageInfo.hasNext,
                      onClick: ($event) => _ctx.page++
                    }, "下一页", 8, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true)
                ],
                64
                /* STABLE_FRAGMENT */
              )) : _ctx.detail ? (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 2 },
                [
                  _createElementVNode(
                    "section",
                    {
                      class: _normalizeClass(["pickup-hero", { complete: _ctx.detail.status === "COMPLETED" }])
                    },
                    [
                      _createElementVNode("div", { class: "pickup-status-icon" }, [
                        _createVNode(_component_Icon, {
                          name: _ctx.detail.status === "COMPLETED" ? "check" : "clock",
                          size: 28
                        }, null, 8, ["name"])
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "h1",
                          null,
                          _toDisplayString(((_a = _ctx.detail.pickup) == null ? void 0 : _a.status) === "READY" ? "待自提" : _ctx.label(_ctx.detail.status)),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "p",
                          null,
                          _toDisplayString(_ctx.detail.status === "COMPLETED" ? "感谢购买" : _ctx.detail.status === "PAID" ? "校内门店自提" : _ctx.detail.status === "PENDING_PAYMENT" ? "请在付款截止前完成模拟支付" : "查看订单记录"),
                          1
                          /* TEXT */
                        )
                      ])
                    ],
                    2
                    /* CLASS */
                  ),
                  _createElementVNode("section", { class: "detail-card" }, [
                    _createElementVNode("div", { class: "order-card-head" }, [
                      _createElementVNode("span", null, [
                        _createVNode(_component_Icon, {
                          name: "store",
                          size: 18
                        }),
                        _createTextVNode(
                          _toDisplayString(_ctx.merchantName(_ctx.detail.merchantId, _ctx.detail)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createVNode(_component_Icon, {
                        name: "chevronRight",
                        size: 17
                      })
                    ]),
                    _createElementVNode("div", { class: "pickup-location" }, [
                      _createVNode(_component_Icon, {
                        name: "pin",
                        size: 19
                      }),
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(((_b = _ctx.store.merchants.find((m) => m.merchantId === _ctx.detail.merchantId)) == null ? void 0 : _b.location) || "校内自提门店"),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  _ctx.detail.status === "PAID" ? (_openBlock(), _createElementBlock("section", {
                    key: 0,
                    class: "detail-card token-card"
                  }, [
                    _createElementVNode("h2", null, "自提凭证"),
                    _ctx.token ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "pickup-code"
                    }, [
                      _createVNode(_component_Icon, {
                        name: "shield",
                        size: 25
                      }),
                      _createElementVNode(
                        "code",
                        null,
                        _toDisplayString(_ctx.token.token),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "small",
                        null,
                        "有效期至 " + _toDisplayString(_ctx.dateTime(_ctx.token.expiresAt)) + "，再次签发旧凭证失效",
                        1
                        /* TEXT */
                      )
                    ])) : (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "pickup-code placeholder-code"
                    }, [
                      _createVNode(_component_Icon, {
                        name: "scan",
                        size: 30
                      }),
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(((_c = _ctx.detail.pickup) == null ? void 0 : _c.status) === "READY" ? "可领取自提令牌" : "等待商户备货完成"),
                        1
                        /* TEXT */
                      )
                    ])),
                    _createElementVNode("button", {
                      class: "teal-button",
                      disabled: _ctx.preview || _ctx.busy || !_ctx.allowToken,
                      onClick: ($event) => _ctx.action("/pickup-token")
                    }, _toDisplayString(_ctx.token ? "重新签发自提凭证" : "领取自提凭证"), 9, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true),
                  _createElementVNode("section", { class: "detail-card" }, [
                    _createElementVNode("h2", { class: "card-title-inline" }, [
                      _createTextVNode("商品清单 "),
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(((_d = _ctx.detail.items) == null ? void 0 : _d.length) || 0) + " 种",
                        1
                        /* TEXT */
                      )
                    ]),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.detail.items, (i) => {
                        return _openBlock(), _createElementBlock("div", {
                          class: "order-detail-line",
                          key: i.skuId
                        }, [
                          _createElementVNode("div", { class: "order-item-placeholder" }, [
                            _createVNode(_component_ProductImage, {
                              src: i.imageUrl,
                              alt: i.title
                            }, null, 8, ["src", "alt"])
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(i.title),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.money(Number(i.unitPriceCent) * Number(i.quantity))),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    _createElementVNode("div", { class: "price-row" }, [
                      _createElementVNode("span", null, "实付 / 应付"),
                      _createElementVNode(
                        "b",
                        null,
                        _toDisplayString(_ctx.money(_ctx.detail.totalCent)),
                        1
                        /* TEXT */
                      )
                    ])
                  ]),
                  _createElementVNode("section", { class: "detail-card order-metadata" }, [
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "订单编号"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.detail.orderId),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "下单时间"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.dateTime(_ctx.detail.createdAt)),
                        1
                        /* TEXT */
                      )
                    ]),
                    _ctx.detail.status === "PENDING_PAYMENT" ? (_openBlock(), _createElementBlock("div", { key: 0 }, [
                      _createElementVNode("span", null, "付款截止"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.dateTime(_ctx.detail.deadline)),
                        1
                        /* TEXT */
                      )
                    ])) : _createCommentVNode("v-if", true),
                    _ctx.detail.afterSale ? (_openBlock(), _createElementBlock("div", { key: 1 }, [
                      _createElementVNode("span", null, "售后状态"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.label(_ctx.detail.afterSale.status)),
                        1
                        /* TEXT */
                      )
                    ])) : _createCommentVNode("v-if", true)
                  ]),
                  !_ctx.preview ? (_openBlock(), _createElementBlock("section", {
                    key: 1,
                    class: "order-actions"
                  }, [
                    _ctx.detail.status === "PENDING_PAYMENT" ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "teal-button",
                      disabled: _ctx.busy,
                      onClick: ($event) => _ctx.action("/pay")
                    }, "模拟支付", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                    _ctx.detail.status === "PENDING_PAYMENT" ? (_openBlock(), _createElementBlock("button", {
                      key: 1,
                      class: "outline-button",
                      disabled: _ctx.busy,
                      onClick: ($event) => _ctx.action("/cancel")
                    }, "取消订单", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                    _ctx.detail.status === "PAID" && !_ctx.detail.afterSale ? (_openBlock(), _createElementBlock("button", {
                      key: 2,
                      class: "outline-button",
                      onClick: ($event) => _ctx.refundOpen = !_ctx.refundOpen
                    }, "申请退款", 8, ["onClick"])) : _createCommentVNode("v-if", true),
                    _ctx.detail.status === "PAID" && ((_e = _ctx.detail.afterSale) == null ? void 0 : _e.status) === "REJECTED" ? (_openBlock(), _createElementBlock("button", {
                      key: 3,
                      class: "outline-button",
                      disabled: _ctx.busy,
                      onClick: ($event) => _ctx.action("/appeal")
                    }, "申请平台介入", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true)
                  ])) : _createCommentVNode("v-if", true),
                  _ctx.refundOpen && !_ctx.preview ? (_openBlock(), _createElementBlock("form", {
                    key: 2,
                    class: "detail-card",
                    onSubmit: _withModifiers(_ctx.submitRefund, ["prevent"])
                  }, [
                    _createElementVNode("label", { class: "field-label" }, "退款原因"),
                    _withDirectives(_createElementVNode("textarea", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.reason = $event,
                      maxlength: "500",
                      rows: "3",
                      required: ""
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.reason]
                    ]),
                    _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: _ctx.busy
                    }, "提交退款申请", 8, ["disabled"])
                  ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
                ],
                64
                /* STABLE_FRAGMENT */
              )) : _ctx.id && !_ctx.error ? (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "mobile-empty"
              }, "加载订单中…")) : _createCommentVNode("v-if", true)
            ];
          }),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$5, computed: computed$6, onMounted: onMounted$6, onUnmounted: onUnmounted$6, watch: watch$6 } = Vue;
  const Account = {
    name: "Account",
    components: { ConsumerShell, AuthDialog },
    setup() {
      const page = ref$5(1), pageInfo = ref$5({ total: 0, hasNext: false });
      const login = ref$5(false), apps = ref$5([]), invitations = ref$5([]), invitePage = ref$5(1), error = ref$5(""), busy = ref$5(false), loading = ref$5(false), key = ref$5("");
      let loadEpoch = 0;
      const form = ref$5({
        merchantName: "",
        category: "便利零售",
        contactName: "",
        contactPhone: "",
        storeName: "",
        location: ""
      });
      const isApply = computed$6(() => store.route === "/apply");
      const isInvite = computed$6(() => store.route === "/invitations");
      async function load() {
        var _a, _b;
        const stamp = ++loadEpoch;
        error.value = "";
        if (preview) {
          apps.value = DEMO_APPLICATIONS;
          invitations.value = [
            {
              id: "INV-01",
              merchantId: "preview-m1",
              status: "PENDING",
              expiresAt: "2026-10-30T12:00:00Z"
            }
          ];
          return;
        }
        loading.value = true;
        try {
          await loadSession();
          if (stamp !== loadEpoch) return;
          const actor = (_a = store.user) == null ? void 0 : _a.userId;
          if (!store.user) {
            apps.value = [];
            invitations.value = [];
            return;
          }
          const [a, i] = await Promise.all([
            api("/merchant-applications/mine/page" + query({ page: page.value, size: 10 })),
            api("/invitations" + query({ page: invitePage.value, size: 20 }))
          ]);
          if (stamp !== loadEpoch || actor !== ((_b = store.user) == null ? void 0 : _b.userId)) return;
          apps.value = a.items || [];
          pageInfo.value = a;
          invitations.value = i || [];
        } catch (e) {
          if (stamp === loadEpoch) error.value = e.message;
        } finally {
          if (stamp === loadEpoch) loading.value = false;
        }
      }
      onMounted$6(load);
      watch$6(() => store.route, load);
      watch$6(page, load);
      watch$6(invitePage, load);
      onUnmounted$6(() => ++loadEpoch);
      async function submit() {
        if (preview || busy.value) return;
        const f = form.value;
        if (!Object.values(f).every((x) => String(x).trim())) {
          notify("请补全申请资料");
          return;
        }
        if (!key.value) key.value = idempotency();
        busy.value = true;
        try {
          await api("/merchant-applications", { method: "POST", body: { ...f }, key: key.value });
          key.value = "";
          notify("申请已提交");
          await load();
          go("/account");
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      async function accept(i) {
        if (preview || busy.value) return;
        busy.value = true;
        try {
          await api("/invitations/" + encodeURIComponent(i.id) + "/accept", { method: "POST" });
          notify("邀请已接受");
          await load();
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      return {
        store,
        go,
        preview,
        login,
        apps,
        page,
        pageInfo,
        invitations,
        invitePage,
        error,
        busy,
        loading,
        form,
        isApply,
        isInvite,
        submit,
        accept,
        label,
        load
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, createBlock: _createBlock, withCtx: _withCtx } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        const _component_ConsumerShell = _resolveComponent("ConsumerShell");
        return _openBlock(), _createBlock(_component_ConsumerShell, { active: "account" }, {
          default: _withCtx(() => {
            var _a, _b;
            return [
              _createElementVNode("div", { class: "mobile-page-top" }, [
                _createElementVNode("button", {
                  onClick: ($event) => _ctx.go("/account"),
                  "aria-label": "返回"
                }, [
                  _createVNode(_component_Icon, { name: "arrowLeft" })
                ], 8, ["onClick"]),
                _createElementVNode(
                  "b",
                  null,
                  _toDisplayString(_ctx.isApply ? "商户入驻" : _ctx.isInvite ? "收到的邀请" : "个人中心"),
                  1
                  /* TEXT */
                ),
                !_ctx.isApply && !_ctx.isInvite ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  onClick: _ctx.load,
                  "aria-label": "刷新"
                }, [
                  _createVNode(_component_Icon, { name: "refresh" })
                ], 8, ["onClick"])) : _createCommentVNode("v-if", true)
              ]),
              !_ctx.isApply && !_ctx.isInvite ? (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 0 },
                [
                  _createElementVNode("section", { class: "account-profile" }, [
                    _createElementVNode("div", { class: "profile-avatar" }, [
                      _createVNode(_component_Icon, {
                        name: "user",
                        size: 30
                      })
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode(
                        "h1",
                        null,
                        _toDisplayString(((_a = _ctx.store.user) == null ? void 0 : _a.displayName) || "校园同学"),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "p",
                        null,
                        _toDisplayString(((_b = _ctx.store.user) == null ? void 0 : _b.username) || "登录后查看订单与申请"),
                        1
                        /* TEXT */
                      )
                    ]),
                    !_ctx.store.user && !_ctx.preview ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "outline-button",
                      onClick: ($event) => _ctx.login = true
                    }, "登录 / 注册", 8, ["onClick"])) : _createCommentVNode("v-if", true),
                    _ctx.preview ? (_openBlock(), _createElementBlock("span", {
                      key: 1,
                      class: "demo-pill"
                    }, "设计预览")) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("div", { class: "account-quick" }, [
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/orders")
                    }, [
                      _createVNode(_component_Icon, { name: "order" }),
                      _createElementVNode("span", null, "我的订单")
                    ], 8, ["onClick"]),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/cart")
                    }, [
                      _createVNode(_component_Icon, { name: "cart" }),
                      _createElementVNode("span", null, "购物车")
                    ], 8, ["onClick"]),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/apply")
                    }, [
                      _createVNode(_component_Icon, { name: "store" }),
                      _createElementVNode("span", null, "商户入驻")
                    ], 8, ["onClick"]),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/invitations")
                    }, [
                      _createVNode(_component_Icon, { name: "users" }),
                      _createElementVNode("span", null, "邀请")
                    ], 8, ["onClick"])
                  ]),
                  _createElementVNode("div", { class: "account-section-head" }, [
                    _createElementVNode("h2", null, "入驻记录"),
                    _createElementVNode("button", {
                      onClick: ($event) => _ctx.go("/apply")
                    }, [
                      _createTextVNode("去申请 "),
                      _createVNode(_component_Icon, {
                        name: "chevronRight",
                        size: 15
                      })
                    ], 8, ["onClick"])
                  ]),
                  _ctx.error ? (_openBlock(), _createElementBlock(
                    "div",
                    {
                      key: 0,
                      class: "inline-error"
                    },
                    _toDisplayString(_ctx.error),
                    1
                    /* TEXT */
                  )) : _createCommentVNode("v-if", true),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.apps, (a) => {
                      return _openBlock(), _createElementBlock("div", {
                        class: "account-application",
                        key: a.applicationId
                      }, [
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(a.merchantName),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            null,
                            _toDisplayString(a.storeName) + " · " + _toDisplayString(a.location),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createElementVNode(
                          "b",
                          {
                            class: _normalizeClass(["status-tag", a.status === "APPROVED" ? "published" : "draft"])
                          },
                          _toDisplayString(_ctx.label(a.status)),
                          3
                          /* TEXT, CLASS */
                        ),
                        a.rejectionReason ? (_openBlock(), _createElementBlock(
                          "p",
                          { key: 0 },
                          _toDisplayString(a.rejectionReason),
                          1
                          /* TEXT */
                        )) : _createCommentVNode("v-if", true)
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.apps.length && !_ctx.error ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "mobile-empty"
                  }, "暂无入驻记录")) : _createCommentVNode("v-if", true),
                  !_ctx.preview && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                    key: 2,
                    class: "sdd-pager"
                  }, [
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.pageInfo.total) + " 条",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: _ctx.page <= 1,
                      onClick: ($event) => _ctx.page--
                    }, "上一页", 8, ["disabled", "onClick"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.page),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: !_ctx.pageInfo.hasNext,
                      onClick: ($event) => _ctx.page++
                    }, "下一页", 8, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true)
                ],
                64
                /* STABLE_FRAGMENT */
              )) : _ctx.isApply ? (_openBlock(), _createElementBlock("form", {
                key: 1,
                class: "account-form detail-card",
                onSubmit: _withModifiers(_ctx.submit, ["prevent"])
              }, [
                _createElementVNode("label", null, [
                  _createTextVNode("经营名称"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.merchantName = $event,
                    required: "",
                    maxlength: "100",
                    placeholder: "商户名称"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.merchantName,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("经营品类"),
                  _withDirectives(_createElementVNode("select", {
                    "onUpdate:modelValue": ($event) => _ctx.form.category = $event
                  }, [
                    _createElementVNode("option", null, "便利零售"),
                    _createElementVNode("option", null, "水果生鲜"),
                    _createElementVNode("option", null, "文具用品"),
                    _createElementVNode("option", null, "饮品"),
                    _createElementVNode("option", null, "其他")
                  ], 8, ["onUpdate:modelValue"]), [
                    [_vModelSelect, _ctx.form.category]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("联系人"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.contactName = $event,
                    required: "",
                    maxlength: "50"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.contactName,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("联系电话"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.contactPhone = $event,
                    required: "",
                    maxlength: "30"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.contactPhone,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("首个门店名称"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.storeName = $event,
                    required: "",
                    maxlength: "100"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.storeName,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("label", null, [
                  _createTextVNode("自提位置"),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.form.location = $event,
                    required: "",
                    maxlength: "200",
                    placeholder: "如：学一食堂一层"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [
                      _vModelText,
                      _ctx.form.location,
                      void 0,
                      { trim: true }
                    ]
                  ])
                ]),
                _createElementVNode("button", {
                  class: "teal-button",
                  type: "submit",
                  disabled: _ctx.preview || _ctx.busy || !_ctx.store.user
                }, _toDisplayString(!_ctx.store.user && !_ctx.preview ? "请先登录" : "提交入驻申请"), 9, ["disabled"])
              ], 40, ["onSubmit"])) : (_openBlock(), _createElementBlock("section", {
                key: 2,
                class: "detail-card"
              }, [
                _createElementVNode("h2", null, "收到的邀请"),
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.invitations, (i) => {
                    return _openBlock(), _createElementBlock("div", {
                      class: "invitation-line",
                      key: i.id
                    }, [
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(i.merchantId),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "small",
                          null,
                          _toDisplayString(_ctx.label(i.status)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("button", {
                        class: "outline-button",
                        disabled: _ctx.preview || _ctx.busy || _ctx.loading || i.status !== "PENDING",
                        onClick: ($event) => _ctx.accept(i)
                      }, "接受", 8, ["disabled", "onClick"])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !_ctx.invitations.length ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "mobile-empty"
                }, "暂无邀请")) : _createCommentVNode("v-if", true),
                !_ctx.preview && (_ctx.invitePage > 1 || _ctx.invitations.length === 20) ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "sdd-pager"
                }, [
                  _createElementVNode("button", {
                    disabled: _ctx.loading || _ctx.invitePage <= 1,
                    onClick: ($event) => _ctx.invitePage--
                  }, "上一页", 8, ["disabled", "onClick"]),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.invitePage),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("button", {
                    disabled: _ctx.loading || _ctx.invitations.length < 20,
                    onClick: ($event) => _ctx.invitePage++
                  }, "下一页", 8, ["disabled", "onClick"])
                ])) : _createCommentVNode("v-if", true)
              ])),
              _ctx.login ? (_openBlock(), _createBlock(_component_AuthDialog, {
                key: 3,
                onClose: ($event) => _ctx.login = false,
                onSuccess: _ctx.load
              }, null, 8, ["onClose", "onSuccess"])) : _createCommentVNode("v-if", true)
            ];
          }),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { ref: ref$4, computed: computed$5, watch: watch$5, nextTick, onMounted: onMounted$5, onUnmounted: onUnmounted$5 } = Vue;
  const merchantNav = [
    ["home", "工作台", "/merchant"],
    ["package", "商品管理", "/merchant/products"],
    ["box", "库存管理", "/merchant/inventory"],
    ["order", "订单管理", "/merchant/orders"],
    ["scan", "自提核销", "/merchant/pickup"],
    ["clipboard", "售后处理", "/merchant/aftersales"],
    ["users", "店员管理", "/merchant/team"],
    ["shield", "角色权限", "/merchant/roles"],
    ["book", "知识库", "/merchant/knowledge"],
    ["settings", "门店设置", "/merchant/settings"]
  ];
  const adminNav = [
    ["home", "平台总览", "/admin"],
    ["store", "商户审核", "/admin/applications"],
    ["users", "商户监管", "/admin/merchants"],
    ["package", "商品监管", "/admin/products"],
    ["order", "订单监管", "/admin/orders"],
    ["shield", "争议处理", "/admin/disputes"],
    ["book", "知识库", "/admin/knowledge"],
    ["grid", "分类管理", "/admin/categories"]
  ];
  const BackofficeShell = {
    name: "BackofficeShell",
    props: { role: { type: String, default: "merchant" }, title: String },
    components: { AuthDialog },
    setup() {
      const loginOpen = ref$4(false), mobileNav = ref$4(null);
      const required = {
        "/merchant": "order.read",
        "/merchant/products": "product.read",
        "/merchant/inventory": "stock.read",
        "/merchant/orders": "order.read",
        "/merchant/pickup": "pickup.verify",
        "/merchant/aftersales": "aftersale.read",
        "/merchant/team": "team.manage",
        "/merchant/roles": "role.manage",
        "/merchant/knowledge": "knowledge.read",
        "/merchant/settings": "store.manage"
      };
      const visibleMerchantNav = computed$5(
        () => merchantNav.filter(([, , path]) => hasPermission(required[path]))
      );
      const alignMobileNav = () => {
        var _a;
        const nav = mobileNav.value;
        if (nav == null ? void 0 : nav.clientWidth)
          (_a = nav.querySelector("button.active")) == null ? void 0 : _a.scrollIntoView({ inline: "center", block: "nearest" });
      };
      watch$5(
        [() => store.route, () => visibleMerchantNav.value.map((item) => item[2]).join("|")],
        async () => {
          await nextTick();
          alignMobileNav();
        },
        { immediate: true, flush: "post" }
      );
      onMounted$5(() => window.addEventListener("resize", alignMobileNav));
      onUnmounted$5(() => window.removeEventListener("resize", alignMobileNav));
      async function switchShop(e) {
        if (preview) {
          notify("演示模式不能切换真实商户");
          return;
        }
        switchMerchantContext(e.target.value);
        await loadMerchant();
      }
      return {
        store,
        go,
        preview,
        loginOpen,
        mobileNav,
        merchantNav,
        visibleMerchantNav,
        adminNav,
        switchShop
      };
    },
    render: (() => {
      const { createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, createTextVNode: _createTextVNode, renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, resolveComponent: _resolveComponent, createVNode: _createVNode, createCommentVNode: _createCommentVNode, normalizeClass: _normalizeClass, renderSlot: _renderSlot, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_AuthDialog = _resolveComponent("AuthDialog");
        return _openBlock(), _createElementBlock("div", { class: "merchant-shell" }, [
          _createElementVNode("aside", { class: "merchant-sidebar" }, [
            _createElementVNode("button", {
              class: "merchant-brand",
              onClick: ($event) => _ctx.go("/")
            }, [
              _createElementVNode("span", { class: "brand-pin" }, [
                _createElementVNode("span")
              ]),
              _createElementVNode("span", { class: "brand-word" }, [
                _createTextVNode("青柠校园 "),
                _createElementVNode(
                  "span",
                  { class: "brand-suffix" },
                  "/ " + _toDisplayString(_ctx.role === "admin" ? "平台端" : "商户端"),
                  1
                  /* TEXT */
                )
              ])
            ], 8, ["onClick"]),
            _createElementVNode("nav", { class: "merchant-nav" }, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.role === "admin" ? _ctx.adminNav : _ctx.visibleMerchantNav, ([ico, label2, path]) => {
                  return _openBlock(), _createElementBlock("button", {
                    key: path,
                    class: _normalizeClass({ active: _ctx.store.route === path }),
                    onClick: ($event) => _ctx.go(path)
                  }, [
                    _createVNode(_component_Icon, {
                      name: ico,
                      size: 19
                    }, null, 8, ["name"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(label2),
                      1
                      /* TEXT */
                    ),
                    _ctx.store.route === path ? (_openBlock(), _createElementBlock("span", {
                      key: 0,
                      class: "nav-left-bar"
                    })) : _createCommentVNode("v-if", true)
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]),
            _createElementVNode("div", { class: "merchant-sidebar-bottom" }, [
              _createElementVNode("button", {
                class: "sidebar-back",
                onClick: ($event) => _ctx.go("/")
              }, [
                _createVNode(_component_Icon, {
                  name: "arrowLeft",
                  size: 16
                }),
                _createTextVNode(" 返回购物端")
              ], 8, ["onClick"])
            ])
          ]),
          _createElementVNode("div", { class: "merchant-content-shell" }, [
            _createElementVNode("header", { class: "merchant-topbar" }, [
              _createElementVNode("div", { class: "topbar-crumb" }, [
                _createTextVNode(
                  _toDisplayString(_ctx.role === "admin" ? "平台运营" : "店铺运营") + " ",
                  1
                  /* TEXT */
                ),
                _createVNode(_component_Icon, {
                  name: "chevronRight",
                  size: 14
                }),
                _createElementVNode(
                  "strong",
                  null,
                  _toDisplayString(_ctx.title),
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("div", { class: "merchant-topbar-tools" }, [
                _ctx.preview ? (_openBlock(), _createElementBlock("span", {
                  key: 0,
                  class: "admin-preview-tag"
                }, "设计预览")) : _createCommentVNode("v-if", true),
                _ctx.role === "merchant" ? (_openBlock(), _createElementBlock("label", {
                  key: 1,
                  class: "topbar-merchant-select"
                }, [
                  _createVNode(_component_Icon, {
                    name: "store",
                    size: 16
                  }),
                  _createElementVNode("select", {
                    value: _ctx.store.merchantId,
                    onChange: _ctx.switchShop,
                    disabled: _ctx.preview || _ctx.store.loading
                  }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.store.merchants, (m) => {
                        return _openBlock(), _createElementBlock("option", {
                          key: m.merchantId,
                          value: m.merchantId
                        }, _toDisplayString(m.name), 9, ["value"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ], 40, ["value", "onChange", "disabled"])
                ])) : _createCommentVNode("v-if", true),
                _createElementVNode("button", {
                  class: "topbar-avatar",
                  onClick: ($event) => _ctx.loginOpen = true
                }, [
                  _createVNode(_component_Icon, {
                    name: "user",
                    size: 18
                  })
                ], 8, ["onClick"])
              ])
            ]),
            _createElementVNode(
              "nav",
              {
                ref: "mobileNav",
                class: "merchant-mobile-nav",
                "aria-label": "工作台导航"
              },
              [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.role === "admin" ? _ctx.adminNav : _ctx.visibleMerchantNav, ([ico, label2, path]) => {
                    return _openBlock(), _createElementBlock("button", {
                      key: path,
                      class: _normalizeClass({ active: _ctx.store.route === path }),
                      onClick: ($event) => _ctx.go(path)
                    }, [
                      _createVNode(_component_Icon, {
                        name: ico,
                        size: 16
                      }, null, 8, ["name"]),
                      _createTextVNode(
                        _toDisplayString(label2),
                        1
                        /* TEXT */
                      )
                    ], 10, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ],
              512
              /* NEED_PATCH */
            ),
            _createElementVNode("main", { class: "merchant-main" }, [
              _createElementVNode("div", { class: "merchant-page-heading" }, [
                _createElementVNode("div", null, [
                  _createElementVNode(
                    "h1",
                    null,
                    _toDisplayString(_ctx.title),
                    1
                    /* TEXT */
                  )
                ]),
                _renderSlot(_ctx.$slots, "actions")
              ]),
              _ctx.store.error ? (_openBlock(), _createElementBlock(
                "div",
                {
                  key: 0,
                  class: "inline-error merchant-error"
                },
                _toDisplayString(_ctx.store.error),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              _renderSlot(_ctx.$slots, "default")
            ])
          ]),
          _ctx.loginOpen ? (_openBlock(), _createBlock(_component_AuthDialog, {
            key: 0,
            onClose: ($event) => _ctx.loginOpen = false,
            onSuccess: ($event) => _ctx.role === "merchant" ? _ctx.loadMerchant() : null
          }, null, 8, ["onClose", "onSuccess"])) : _createCommentVNode("v-if", true)
        ]);
      };
    })()
  };
  const { ref: ref$3, computed: computed$4, onMounted: onMounted$4, onUnmounted: onUnmounted$4, watch: watch$4 } = Vue;
  const names = {
    "/merchant": "经营概览",
    "/merchant/inventory": "库存管理",
    "/merchant/orders": "订单管理",
    "/merchant/pickup": "自提核销",
    "/merchant/aftersales": "售后处理",
    "/merchant/team": "店员管理",
    "/merchant/settings": "门店设置"
  };
  const MerchantOps = {
    name: "MerchantOps",
    components: { BackofficeShell, ProductImage },
    setup() {
      const route = computed$4(() => store.route);
      const title = computed$4(() => names[route.value] || "经营概览");
      const filter = ref$3("");
      const q = ref$3("");
      const stats = ref$3(null), orders = ref$3([]), afterSales = ref$3([]), members = ref$3([]), moves = ref$3([]), stockRows = ref$3([]), error = ref$3(""), busy = ref$3(false), picked = ref$3(null), token = ref$3(""), decision = ref$3(""), reason = ref$3("");
      const page = ref$3(1), pageInfo = ref$3({ total: 0, hasNext: false }), amount = ref$3(1), sku2 = ref$3(""), inviteUser = ref$3(""), profile = ref$3({ name: "", storeName: "", location: "" });
      const replenishKey = ref$3(""), replenishFingerprint = ref$3("");
      const merchant = computed$4(
        () => store.merchants.find((m) => m.merchantId === store.merchantId) || {}
      );
      const skuRows = computed$4(
        () => !preview && route.value === "/merchant/inventory" ? stockRows.value.map((s) => ({
          product: { title: s.productTitle || s.skuId, imageUrl: s.imageUrl || "" },
          sku: { skuId: s.skuId, specKey: s.specKey || "规格" },
          stock: s
        })) : store.products.flatMap(
          (p) => (p.skus || []).map((s) => ({
            product: p,
            sku: s,
            stock: store.stocks.find((x) => x.skuId === s.skuId)
          }))
        )
      );
      const visibleOrders = computed$4(
        () => !preview ? orders.value : orders.value.filter(
          (o) => {
            var _a, _b;
            return (!filter.value || o.status === filter.value) && (!q.value || ((_a = o.orderId) == null ? void 0 : _a.toLowerCase().includes(q.value.toLowerCase())) || ((_b = o.items) == null ? void 0 : _b.some((i) => {
              var _a2;
              return (_a2 = i.title) == null ? void 0 : _a2.includes(q.value);
            })));
          }
        )
      );
      const selectedOrder = computed$4(
        () => orders.value.find((o) => o.orderId === picked.value) || visibleOrders.value[0] || null
      );
      const canOwner = computed$4(() => isOwner());
      const can = computed$4(() => (code) => hasPermission(code));
      const roles = ref$3([]);
      const routePermission = {
        "/merchant": "order.read",
        "/merchant/inventory": "stock.read",
        "/merchant/orders": "order.read",
        "/merchant/pickup": "pickup.verify",
        "/merchant/aftersales": "aftersale.read",
        "/merchant/team": "team.manage",
        "/merchant/settings": "store.manage"
      };
      const restricted = computed$4(
        () => !preview && !hasPermission(routePermission[route.value] || "order.read")
      );
      const canAct = computed$4(
        () => !preview && !busy.value && !!store.merchantId && !restricted.value
      );
      let loadVersion = 0;
      function clearPrivateViews() {
        stats.value = null;
        orders.value = [];
        afterSales.value = [];
        members.value = [];
        moves.value = [];
        stockRows.value = [];
        picked.value = null;
        decision.value = "";
        pageInfo.value = { total: 0, hasNext: false };
      }
      async function load() {
        var _a;
        const stamp = ++loadVersion;
        const section = route.value;
        error.value = "";
        if (!store.merchantId) await loadMerchant();
        if (stamp !== loadVersion) return;
        const mid = store.merchantId;
        if (!mid) {
          error.value = store.error || "尚未加入商户";
          return;
        }
        if (restricted.value) return;
        if (preview) {
          pageInfo.value = { total: DEMO_MERCHANT_ORDERS.length, hasNext: false };
          stats.value = { ...DEMO_STATS };
          orders.value = DEMO_MERCHANT_ORDERS.map((o) => ({ ...o }));
          members.value = DEMO_MEMBERS;
          afterSales.value = DEMO_AFTERSALES;
          moves.value = DEMO_STOCK_MOVES;
          profile.value = {
            name: merchant.value.name || "东湖便利",
            storeName: merchant.value.storeName || "学一食堂店",
            location: merchant.value.location || "东湖校区"
          };
          return;
        }
        const base = "/merchants/" + pathId(mid);
        const actor = (_a = store.user) == null ? void 0 : _a.userId;
        const current = () => {
          var _a2;
          return stamp === loadVersion && route.value === section && store.merchantId === mid && ((_a2 = store.user) == null ? void 0 : _a2.userId) === actor;
        };
        try {
          if (section === "/merchant") {
            const [s, o] = await Promise.all([
              hasPermission("dashboard.read") ? api(base + "/statistics") : Promise.resolve(null),
              api(base + "/orders/page" + query({ page: 1, size: 5 }))
            ]);
            if (!current()) return;
            stats.value = s;
            orders.value = o.items || [];
            pageInfo.value = o;
          }
          if (section === "/merchant/orders" || section === "/merchant/pickup") {
            const result = await api(
              base + "/orders/page" + query({ page: page.value, size: 10, state: filter.value, q: q.value })
            );
            if (!current()) return;
            orders.value = result.items || [];
            pageInfo.value = result;
          }
          if (section === "/merchant/aftersales") {
            const result = await api(
              base + "/aftersales/page" + query({ page: page.value, size: 10 })
            );
            if (!current()) return;
            afterSales.value = result.items || [];
            pageInfo.value = result;
          }
          if (section === "/merchant/inventory") {
            const [stockResult, movements] = await Promise.all([
              api(base + "/stocks/page" + query({ page: page.value, size: 10, q: q.value })),
              api(base + "/stock-movements/page" + query({ page: 1, size: 8 }))
            ]);
            if (!current()) return;
            stockRows.value = stockResult.items || [];
            moves.value = movements.items || [];
            pageInfo.value = stockResult;
          }
          if (section === "/merchant/team") {
            const [m, r] = await Promise.all([api(base + "/members"), api(base + "/rbac/roles")]);
            if (!current()) return;
            members.value = m || [];
            roles.value = r || [];
          }
          if (section === "/merchant/settings" && current())
            profile.value = {
              name: merchant.value.name || "",
              storeName: merchant.value.storeName || "",
              location: merchant.value.location || ""
            };
        } catch (e) {
          if (current()) error.value = e.message;
        }
      }
      onMounted$4(load);
      onUnmounted$4(() => {
        ++loadVersion;
        clearTimeout(searchDelay);
      });
      watch$4([route, () => store.merchantId, () => {
        var _a;
        return (_a = store.user) == null ? void 0 : _a.userId;
      }], () => {
        ++loadVersion;
        clearPrivateViews();
        page.value = 1;
        load();
      });
      watch$4(page, load);
      watch$4(filter, () => {
        page.value = 1;
        if (route.value === "/merchant/orders" || route.value === "/merchant/pickup") load();
      });
      let searchDelay;
      watch$4(q, () => {
        if (!preview && ["/merchant/orders", "/merchant/pickup", "/merchant/inventory"].includes(route.value)) {
          ++loadVersion;
          page.value = 1;
          clearTimeout(searchDelay);
          searchDelay = setTimeout(load, 280);
        }
      });
      async function perform(url, body, method = "POST", key) {
        if (!canAct.value) return;
        busy.value = true;
        try {
          await api(url, { method, body, key });
          notify("操作成功");
          token.value = "";
          await load();
          return true;
        } catch (e) {
          notify(e.message);
          return false;
        } finally {
          busy.value = false;
        }
      }
      function midPath() {
        return "/merchants/" + pathId(store.merchantId);
      }
      async function prepare(o, ready) {
        await perform(midPath() + "/orders/" + pathId(o.orderId) + (ready ? "/ready" : "/prepare"));
      }
      async function verify(o) {
        if (!token.value.trim()) {
          notify("请输入买家出示的自提令牌");
          return;
        }
        await perform(midPath() + "/orders/" + pathId(o.orderId) + "/verify", {
          token: token.value.trim()
        });
      }
      async function replenish() {
        if (!hasPermission("stock.replenish")) return;
        if (!positiveInt(amount.value, 1e6)) {
          notify("补货数量须为1~1000000");
          return;
        }
        if (!sku2.value) return;
        const f = store.merchantId + ":" + sku2.value + ":" + Number(amount.value);
        if (replenishFingerprint.value !== f) {
          replenishFingerprint.value = f;
          replenishKey.value = idempotency();
        }
        if (await perform(
          midPath() + "/stocks/" + pathId(sku2.value) + "/replenish",
          { quantity: Number(amount.value) },
          "POST",
          replenishKey.value
        )) {
          replenishKey.value = "";
          replenishFingerprint.value = "";
        }
      }
      async function invite() {
        if (!canOwner.value || !inviteUser.value.trim()) return;
        await perform(midPath() + "/invitations", { username: inviteUser.value.trim() });
        inviteUser.value = "";
      }
      async function revoke(m) {
        if (!canOwner.value || m.role === "OWNER") return;
        if (!window.confirm("确定撤销该成员的商户权限？")) return;
        await perform(midPath() + "/members/" + pathId(m.userId), void 0, "DELETE");
      }
      async function assignMember(m, code) {
        if (!canOwner.value || !code || code === m.role || m.role === "OWNER") return;
        await perform(
          midPath() + "/rbac/members/" + pathId(m.userId) + "/role",
          { roleCode: code },
          "PUT"
        );
      }
      async function saveProfile() {
        if (!canOwner.value) return;
        const v = profile.value;
        if (!v.name.trim() || !v.storeName.trim() || !v.location.trim()) {
          notify("请完善门店资料");
          return;
        }
        await perform(midPath() + "/profile", v, "PUT");
        await loadMerchant();
      }
      async function decisionAction(s, approved) {
        if (!hasPermission("aftersale.review") || !s) return;
        const comment = reason.value.trim();
        if (!comment) {
          notify("请填写退款审核说明");
          return;
        }
        if (await perform(midPath() + "/orders/" + pathId(s.orderId) + "/refund-decision", {
          approved,
          reason: comment
        }))
          reason.value = "";
      }
      const topOrders = computed$4(() => orders.value.slice(0, 5));
      const merchantName = computed$4(() => merchant.value.name || "校内商户");
      return {
        store,
        go,
        preview,
        route,
        title,
        filter,
        q,
        page,
        pageInfo,
        stats,
        orders,
        afterSales,
        members,
        moves,
        stockRows,
        error,
        busy,
        picked,
        selectedOrder,
        visibleOrders,
        token,
        decision,
        reason,
        amount,
        sku: sku2,
        skuRows,
        inviteUser,
        profile,
        merchantName,
        merchant,
        topOrders,
        canOwner,
        can,
        roles,
        assignMember,
        restricted,
        canAct,
        money,
        label,
        dateTime,
        coverSku,
        load,
        prepare,
        verify,
        replenish,
        invite,
        revoke,
        saveProfile,
        decisionAction
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: "merchant",
          title: _ctx.title
        }, {
          actions: _withCtx(() => [
            _createElementVNode("button", {
              class: "outline-button small",
              onClick: _ctx.load
            }, [
              _createVNode(_component_Icon, {
                name: "refresh",
                size: 16
              }),
              _createTextVNode("刷新")
            ], 8, ["onClick"])
          ]),
          default: _withCtx(() => {
            var _a, _b, _c, _d;
            return [
              _ctx.error ? (_openBlock(), _createElementBlock(
                "div",
                {
                  key: 0,
                  class: "inline-error"
                },
                _toDisplayString(_ctx.error),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              _ctx.restricted ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ops-card access-denied"
              }, [
                _createVNode(_component_Icon, {
                  name: "shield",
                  size: 32
                }),
                _createElementVNode("h2", null, "无权限访问")
              ])) : _ctx.route === "/merchant" ? (_openBlock(), _createElementBlock(
                _Fragment,
                { key: 2 },
                [
                  _ctx.stats ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "ops-kpis"
                  }, [
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "订单总数"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.stats.totalOrders || 0),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "待处理"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.stats.pendingCount || 0),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "已完成"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.stats.completedCount || 0),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode("span", null, "完成金额"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.money(_ctx.stats.completedAmountCent)),
                        1
                        /* TEXT */
                      )
                    ])
                  ])) : _createCommentVNode("v-if", true),
                  _createElementVNode("div", { class: "ops-grid" }, [
                    _createElementVNode("section", { class: "ops-card" }, [
                      _createElementVNode("div", { class: "ops-card-header" }, [
                        _createElementVNode("h2", null, "最近订单"),
                        _createElementVNode("button", {
                          onClick: ($event) => _ctx.go("/merchant/orders")
                        }, [
                          _createTextVNode("查看全部 "),
                          _createVNode(_component_Icon, {
                            name: "chevronRight",
                            size: 15
                          })
                        ], 8, ["onClick"])
                      ]),
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.topOrders, (o) => {
                          var _a2, _b2;
                          return _openBlock(), _createElementBlock("div", {
                            class: "ops-list-line",
                            key: o.orderId
                          }, [
                            _createElementVNode("span", { class: "mini-icon" }, [
                              _createVNode(_component_Icon, {
                                name: "order",
                                size: 19
                              })
                            ]),
                            _createElementVNode("div", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(((_b2 = (_a2 = o.items) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.title) || "校园订单"),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "small",
                                null,
                                _toDisplayString(o.orderId) + " · " + _toDisplayString(_ctx.dateTime(o.createdAt)),
                                1
                                /* TEXT */
                              )
                            ]),
                            _createElementVNode(
                              "b",
                              null,
                              _toDisplayString(_ctx.money(o.totalCent)),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "span",
                              {
                                class: _normalizeClass(["status-tag", o.status === "COMPLETED" ? "published" : "draft"])
                              },
                              _toDisplayString(_ctx.label(o.status)),
                              3
                              /* TEXT, CLASS */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      !_ctx.topOrders.length ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "admin-empty"
                      }, "暂无订单")) : _createCommentVNode("v-if", true)
                    ]),
                    _createElementVNode("section", { class: "ops-card" }, [
                      _createElementVNode("div", { class: "ops-card-header" }, [
                        _createElementVNode("h2", null, "快捷操作")
                      ]),
                      _createElementVNode("div", { class: "ops-quick" }, [
                        _ctx.can("product.read") ? (_openBlock(), _createElementBlock("button", {
                          key: 0,
                          onClick: ($event) => _ctx.go("/merchant/products")
                        }, [
                          _createVNode(_component_Icon, { name: "package" }),
                          _createTextVNode("商品管理")
                        ], 8, ["onClick"])) : _createCommentVNode("v-if", true),
                        _ctx.can("stock.read") ? (_openBlock(), _createElementBlock("button", {
                          key: 1,
                          onClick: ($event) => _ctx.go("/merchant/inventory")
                        }, [
                          _createVNode(_component_Icon, { name: "box" }),
                          _createTextVNode("库存管理")
                        ], 8, ["onClick"])) : _createCommentVNode("v-if", true),
                        _ctx.can("pickup.verify") ? (_openBlock(), _createElementBlock("button", {
                          key: 2,
                          onClick: ($event) => _ctx.go("/merchant/pickup")
                        }, [
                          _createVNode(_component_Icon, { name: "scan" }),
                          _createTextVNode("核销")
                        ], 8, ["onClick"])) : _createCommentVNode("v-if", true),
                        _ctx.can("knowledge.read") ? (_openBlock(), _createElementBlock("button", {
                          key: 3,
                          onClick: ($event) => _ctx.go("/merchant/knowledge")
                        }, [
                          _createVNode(_component_Icon, { name: "book" }),
                          _createTextVNode("知识库")
                        ], 8, ["onClick"])) : _createCommentVNode("v-if", true)
                      ])
                    ])
                  ])
                ],
                64
                /* STABLE_FRAGMENT */
              )) : _ctx.route === "/merchant/inventory" ? (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "ops-grid inventory-grid"
              }, [
                _createElementVNode("section", { class: "ops-card" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "库存清单"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.preview ? _ctx.skuRows.length : _ctx.pageInfo.total) + " SKU",
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("label", { class: "ops-search" }, [
                    _createVNode(_component_Icon, {
                      name: "search",
                      size: 17
                    }),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => _ctx.q = $event,
                      placeholder: "商品 / SKU"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.q]
                    ])
                  ]),
                  _createElementVNode("div", { class: "ops-table-wrap" }, [
                    _createElementVNode("table", { class: "ops-table" }, [
                      _createElementVNode("thead", null, [
                        _createElementVNode("tr", null, [
                          _createElementVNode("th", null, "商品 / 规格"),
                          _createElementVNode("th", null, "实物"),
                          _createElementVNode("th", null, "预占"),
                          _createElementVNode("th", null, "可售"),
                          _createElementVNode("th", null, "操作")
                        ])
                      ]),
                      _createElementVNode("tbody", null, [
                        (_openBlock(true), _createElementBlock(
                          _Fragment,
                          null,
                          _renderList(_ctx.preview ? _ctx.skuRows.filter((r) => !_ctx.q || r.product.title.includes(_ctx.q) || r.sku.specKey.includes(_ctx.q)) : _ctx.skuRows, (row) => {
                            var _a2, _b2, _c2, _d2;
                            return _openBlock(), _createElementBlock(
                              "tr",
                              {
                                key: row.sku.skuId,
                                class: _normalizeClass({ active: _ctx.sku === row.sku.skuId })
                              },
                              [
                                _createElementVNode("td", null, [
                                  _createElementVNode("div", { class: "table-product-cell" }, [
                                    _createVNode(_component_ProductImage, {
                                      src: row.product.imageUrl,
                                      alt: row.product.title
                                    }, null, 8, ["src", "alt"]),
                                    _createElementVNode("div", null, [
                                      _createElementVNode(
                                        "strong",
                                        null,
                                        _toDisplayString(row.product.title),
                                        1
                                        /* TEXT */
                                      ),
                                      _createElementVNode(
                                        "span",
                                        null,
                                        _toDisplayString(row.sku.specKey),
                                        1
                                        /* TEXT */
                                      )
                                    ])
                                  ])
                                ]),
                                _createElementVNode(
                                  "td",
                                  null,
                                  _toDisplayString(((_a2 = row.stock) == null ? void 0 : _a2.onHand) ?? "—"),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "td",
                                  null,
                                  _toDisplayString(((_b2 = row.stock) == null ? void 0 : _b2.reserved) ?? "—"),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "td",
                                  {
                                    class: _normalizeClass({ "red-text": Number(((_c2 = row.stock) == null ? void 0 : _c2.available) || 0) < 10 })
                                  },
                                  _toDisplayString(((_d2 = row.stock) == null ? void 0 : _d2.available) ?? "—"),
                                  3
                                  /* TEXT, CLASS */
                                ),
                                _createElementVNode("td", null, [
                                  _ctx.can("stock.replenish") ? (_openBlock(), _createElementBlock("button", {
                                    key: 0,
                                    class: "row-link",
                                    onClick: ($event) => _ctx.sku = row.sku.skuId
                                  }, "补货", 8, ["onClick"])) : _createCommentVNode("v-if", true)
                                ])
                              ],
                              2
                              /* CLASS */
                            );
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ])
                  ])
                ]),
                _createElementVNode("section", { class: "ops-card ops-sideform" }, [
                  _ctx.can("stock.replenish") ? (_openBlock(), _createElementBlock(
                    _Fragment,
                    { key: 0 },
                    [
                      _createElementVNode("h2", null, "库存补货"),
                      _createElementVNode("form", {
                        onSubmit: _withModifiers(_ctx.replenish, ["prevent"])
                      }, [
                        _createElementVNode("label", { class: "field-label" }, "SKU"),
                        _withDirectives(_createElementVNode("select", {
                          class: "admin-input",
                          "onUpdate:modelValue": ($event) => _ctx.sku = $event,
                          required: ""
                        }, [
                          _createElementVNode("option", {
                            disabled: "",
                            value: ""
                          }, "选择规格"),
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.skuRows, (row) => {
                              return _openBlock(), _createElementBlock("option", {
                                key: row.sku.skuId,
                                value: row.sku.skuId
                              }, _toDisplayString(row.product.title) + " · " + _toDisplayString(row.sku.specKey), 9, ["value"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 8, ["onUpdate:modelValue"]), [
                          [_vModelSelect, _ctx.sku]
                        ]),
                        _createElementVNode("label", { class: "field-label" }, "补货数量"),
                        _withDirectives(_createElementVNode("input", {
                          type: "number",
                          class: "admin-input",
                          "onUpdate:modelValue": ($event) => _ctx.amount = $event,
                          min: "1",
                          max: "1000000",
                          required: ""
                        }, null, 8, ["onUpdate:modelValue"]), [
                          [
                            _vModelText,
                            _ctx.amount,
                            void 0,
                            { number: true }
                          ]
                        ]),
                        _createElementVNode("button", {
                          class: "teal-button",
                          type: "submit",
                          disabled: !_ctx.canAct
                        }, "确认补货", 8, ["disabled"])
                      ], 40, ["onSubmit"])
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  )) : _createCommentVNode("v-if", true),
                  _createElementVNode("div", { class: "ops-card-header compact" }, [
                    _createElementVNode("h3", null, "库存流水")
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.moves.slice(0, 8), (m) => {
                      return _openBlock(), _createElementBlock("div", {
                        class: "ops-list-line",
                        key: m.id
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [
                          _createVNode(_component_Icon, {
                            name: "box",
                            size: 16
                          })
                        ]),
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(_ctx.label(m.type)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(_ctx.dateTime(m.createdAt)),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createElementVNode(
                          "b",
                          null,
                          "+" + _toDisplayString(m.quantity),
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ])) : _ctx.route === "/merchant/orders" || _ctx.route === "/merchant/pickup" ? (_openBlock(), _createElementBlock("div", {
                key: 4,
                class: "ops-card"
              }, [
                _createElementVNode("div", { class: "ops-card-header" }, [
                  _createElementVNode(
                    "h2",
                    null,
                    _toDisplayString(_ctx.route === "/merchant/pickup" ? "交付核销" : "订单列表"),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("div", { class: "filter-pills" }, [
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.filter === "" }),
                      onClick: ($event) => _ctx.filter = ""
                    }, "全部", 10, ["onClick"]),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.filter === "PAID" }),
                      onClick: ($event) => _ctx.filter = "PAID"
                    }, "已支付", 10, ["onClick"]),
                    _createElementVNode("button", {
                      class: _normalizeClass({ active: _ctx.filter === "COMPLETED" }),
                      onClick: ($event) => _ctx.filter = "COMPLETED"
                    }, "已完成", 10, ["onClick"])
                  ])
                ]),
                _createElementVNode("label", { class: "ops-search" }, [
                  _createVNode(_component_Icon, {
                    name: "search",
                    size: 17
                  }),
                  _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": ($event) => _ctx.q = $event,
                    placeholder: "搜索订单号 / 商品"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [_vModelText, _ctx.q]
                  ])
                ]),
                _createElementVNode("div", { class: "ops-grid orders-split" }, [
                  _createElementVNode("div", { class: "ops-table-wrap" }, [
                    _createElementVNode("table", { class: "ops-table" }, [
                      _createElementVNode("thead", null, [
                        _createElementVNode("tr", null, [
                          _createElementVNode("th", null, "订单"),
                          _createElementVNode("th", null, "商品"),
                          _createElementVNode("th", null, "金额"),
                          _createElementVNode("th", null, "状态"),
                          _createElementVNode("th")
                        ])
                      ]),
                      _createElementVNode("tbody", null, [
                        (_openBlock(true), _createElementBlock(
                          _Fragment,
                          null,
                          _renderList(_ctx.visibleOrders, (o) => {
                            var _a2, _b2, _c2;
                            return _openBlock(), _createElementBlock("tr", {
                              key: o.orderId,
                              class: _normalizeClass({ active: ((_a2 = _ctx.selectedOrder) == null ? void 0 : _a2.orderId) === o.orderId }),
                              onClick: ($event) => _ctx.picked = o.orderId
                            }, [
                              _createElementVNode("td", null, [
                                _createElementVNode(
                                  "strong",
                                  null,
                                  "#" + _toDisplayString(o.orderId),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "small",
                                  null,
                                  _toDisplayString(_ctx.dateTime(o.createdAt)),
                                  1
                                  /* TEXT */
                                )
                              ]),
                              _createElementVNode(
                                "td",
                                null,
                                _toDisplayString(((_c2 = (_b2 = o.items) == null ? void 0 : _b2[0]) == null ? void 0 : _c2.title) || "—"),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "td",
                                null,
                                _toDisplayString(_ctx.money(o.totalCent)),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode("td", null, [
                                _createElementVNode(
                                  "span",
                                  {
                                    class: _normalizeClass(["status-tag", o.status === "COMPLETED" ? "published" : "draft"])
                                  },
                                  _toDisplayString(_ctx.label(o.status)),
                                  3
                                  /* TEXT, CLASS */
                                )
                              ]),
                              _createElementVNode("td", null, [
                                _createVNode(_component_Icon, {
                                  name: "chevronRight",
                                  size: 16
                                })
                              ])
                            ], 10, ["onClick"]);
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ]),
                    !_ctx.visibleOrders.length ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "admin-empty"
                    }, "暂无订单")) : _createCommentVNode("v-if", true)
                  ]),
                  _ctx.selectedOrder ? (_openBlock(), _createElementBlock("aside", {
                    key: 0,
                    class: "order-inspector"
                  }, [
                    _createElementVNode("h2", null, "订单详情"),
                    _createElementVNode("div", { class: "inspector-row" }, [
                      _createElementVNode("span", null, "订单编号"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.selectedOrder.orderId),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", { class: "inspector-row" }, [
                      _createElementVNode("span", null, "订单状态"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.label(_ctx.selectedOrder.status)),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", { class: "inspector-row" }, [
                      _createElementVNode("span", null, "自提进度"),
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(_ctx.label((_a = _ctx.selectedOrder.pickup) == null ? void 0 : _a.status)),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode("div", { class: "inspector-row" }, [
                      _createElementVNode("span", null, "金额"),
                      _createElementVNode(
                        "b",
                        { class: "red-text" },
                        _toDisplayString(_ctx.money(_ctx.selectedOrder.totalCent)),
                        1
                        /* TEXT */
                      )
                    ]),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.selectedOrder.items, (i) => {
                        return _openBlock(), _createElementBlock("div", {
                          class: "order-detail-line",
                          key: i.skuId
                        }, [
                          _createElementVNode("span", { class: "mini-icon" }, [
                            _createVNode(_component_Icon, { name: "package" })
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(i.title),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity),
                              1
                              /* TEXT */
                            )
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    _createElementVNode("div", { class: "form-buttons" }, [
                      _ctx.can("order.prepare") && _ctx.selectedOrder.status === "PAID" && ((_b = _ctx.selectedOrder.pickup) == null ? void 0 : _b.status) === "WAIT_PREP" ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "outline-button",
                        disabled: !_ctx.canAct,
                        onClick: ($event) => _ctx.prepare(_ctx.selectedOrder, false)
                      }, "开始备货", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                      _ctx.can("order.prepare") && _ctx.selectedOrder.status === "PAID" && ((_c = _ctx.selectedOrder.pickup) == null ? void 0 : _c.status) === "PREPARING" ? (_openBlock(), _createElementBlock("button", {
                        key: 1,
                        class: "teal-button",
                        disabled: !_ctx.canAct,
                        onClick: ($event) => _ctx.prepare(_ctx.selectedOrder, true)
                      }, "备货完成", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true)
                    ]),
                    _ctx.can("pickup.verify") && _ctx.selectedOrder.status === "PAID" && ((_d = _ctx.selectedOrder.pickup) == null ? void 0 : _d.status) === "READY" ? (_openBlock(), _createElementBlock("form", {
                      key: 0,
                      class: "verify-form",
                      onSubmit: _withModifiers(($event) => _ctx.verify(_ctx.selectedOrder), ["prevent"])
                    }, [
                      _createElementVNode("label", { class: "field-label" }, "买家自提令牌"),
                      _withDirectives(_createElementVNode("textarea", {
                        class: "admin-input",
                        "onUpdate:modelValue": ($event) => _ctx.token = $event,
                        rows: "3",
                        required: "",
                        placeholder: "输入买家自提令牌"
                      }, null, 8, ["onUpdate:modelValue"]), [
                        [_vModelText, _ctx.token]
                      ]),
                      _createElementVNode("button", {
                        type: "submit",
                        class: "teal-button",
                        disabled: !_ctx.canAct
                      }, "核销自提", 8, ["disabled"])
                    ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
                  ])) : _createCommentVNode("v-if", true)
                ])
              ])) : _ctx.route === "/merchant/aftersales" ? (_openBlock(), _createElementBlock("section", {
                key: 5,
                class: "ops-card"
              }, [
                _createElementVNode("div", { class: "ops-card-header" }, [
                  _createElementVNode("h2", null, "售后申请"),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.afterSales.length) + " 条",
                    1
                    /* TEXT */
                  )
                ]),
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.afterSales, (s) => {
                    return _openBlock(), _createElementBlock("div", {
                      class: "ops-list-line",
                      key: s.id
                    }, [
                      _createElementVNode("span", { class: "mini-icon" }, [
                        _createVNode(_component_Icon, { name: "shield" })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(s.orderId),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "small",
                          null,
                          _toDisplayString(s.reason),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode(
                        "span",
                        { class: "status-tag" },
                        _toDisplayString(_ctx.label(s.status)),
                        1
                        /* TEXT */
                      ),
                      _ctx.can("aftersale.review") ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "outline-button small",
                        onClick: ($event) => {
                          _ctx.decision = s.orderId;
                          _ctx.reason = "";
                        }
                      }, "审核", 8, ["onClick"])) : _createCommentVNode("v-if", true)
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !_ctx.afterSales.length ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-empty"
                }, "暂无售后")) : _createCommentVNode("v-if", true),
                _ctx.decision && _ctx.can("aftersale.review") ? (_openBlock(), _createElementBlock("form", {
                  key: 1,
                  class: "review-inline",
                  onSubmit: _withModifiers(($event) => _ctx.decisionAction(_ctx.afterSales.find((s) => s.orderId === _ctx.decision), true), ["prevent"])
                }, [
                  _createElementVNode(
                    "h3",
                    null,
                    "售后审核 · " + _toDisplayString(_ctx.decision),
                    1
                    /* TEXT */
                  ),
                  _withDirectives(_createElementVNode("textarea", {
                    class: "admin-input",
                    rows: "3",
                    "onUpdate:modelValue": ($event) => _ctx.reason = $event,
                    maxlength: "500",
                    required: "",
                    placeholder: "审核说明（必填）"
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [_vModelText, _ctx.reason]
                  ]),
                  _createElementVNode("div", { class: "form-buttons" }, [
                    _createElementVNode("button", {
                      type: "button",
                      class: "outline-button",
                      disabled: !_ctx.canAct || !_ctx.reason.trim(),
                      onClick: ($event) => _ctx.decisionAction(_ctx.afterSales.find((s) => s.orderId === _ctx.decision), false)
                    }, "驳回", 8, ["disabled", "onClick"]),
                    _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: !_ctx.canAct || !_ctx.reason.trim()
                    }, "同意退款", 8, ["disabled"])
                  ])
                ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
              ])) : _ctx.route === "/merchant/team" ? (_openBlock(), _createElementBlock("div", {
                key: 6,
                class: "ops-grid"
              }, [
                _createElementVNode("section", { class: "ops-card" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "成员"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.members.length) + " 人",
                      1
                      /* TEXT */
                    )
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.members, (m) => {
                      var _a2;
                      return _openBlock(), _createElementBlock("div", {
                        class: "ops-list-line",
                        key: m.userId
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [
                          _createVNode(_component_Icon, { name: "user" })
                        ]),
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(m.userId),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(((_a2 = _ctx.roles.find((r) => r.code === m.role)) == null ? void 0 : _a2.name) || m.role) + " · " + _toDisplayString(_ctx.label(m.status)),
                            1
                            /* TEXT */
                          )
                        ]),
                        m.role !== "OWNER" && m.status === "ACTIVE" ? (_openBlock(), _createElementBlock("select", {
                          key: 0,
                          class: "admin-input compact-select",
                          value: m.role,
                          disabled: !_ctx.canAct,
                          onChange: ($event) => _ctx.assignMember(m, $event.target.value)
                        }, [
                          (_openBlock(true), _createElementBlock(
                            _Fragment,
                            null,
                            _renderList(_ctx.roles.filter((r) => r.code !== "OWNER"), (r) => {
                              return _openBlock(), _createElementBlock("option", {
                                value: r.code,
                                key: r.code
                              }, _toDisplayString(r.name), 9, ["value"]);
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ], 40, ["value", "disabled", "onChange"])) : _createCommentVNode("v-if", true),
                        m.role !== "OWNER" ? (_openBlock(), _createElementBlock("button", {
                          key: 1,
                          class: "outline-button small",
                          disabled: !_ctx.canAct || !_ctx.canOwner,
                          onClick: ($event) => _ctx.revoke(m)
                        }, "撤销", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true)
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                _createElementVNode("section", { class: "ops-card ops-sideform" }, [
                  _createElementVNode("h2", null, "邀请店员"),
                  _createElementVNode("form", {
                    onSubmit: _withModifiers(_ctx.invite, ["prevent"])
                  }, [
                    _createElementVNode("label", { class: "field-label" }, "已注册用户名"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.inviteUser = $event,
                      required: "",
                      maxlength: "32",
                      placeholder: "用户名"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.inviteUser]
                    ]),
                    _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: !_ctx.canAct || !_ctx.canOwner
                    }, "发送邀请", 8, ["disabled"])
                  ], 40, ["onSubmit"]),
                  _createElementVNode("button", {
                    class: "outline-button small",
                    onClick: ($event) => _ctx.go("/merchant/roles")
                  }, "管理角色和权限", 8, ["onClick"])
                ])
              ])) : _ctx.route === "/merchant/settings" ? (_openBlock(), _createElementBlock("section", {
                key: 7,
                class: "ops-card ops-settings"
              }, [
                _createElementVNode("h2", null, "门店资料"),
                _createElementVNode("form", {
                  onSubmit: _withModifiers(_ctx.saveProfile, ["prevent"])
                }, [
                  _createElementVNode("label", null, [
                    _createTextVNode("经营名称"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.profile.name = $event,
                      required: "",
                      maxlength: "100"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.profile.name]
                    ])
                  ]),
                  _createElementVNode("label", null, [
                    _createTextVNode("门店名称"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.profile.storeName = $event,
                      required: "",
                      maxlength: "100"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.profile.storeName]
                    ])
                  ]),
                  _createElementVNode("label", null, [
                    _createTextVNode("自提位置"),
                    _withDirectives(_createElementVNode("input", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.profile.location = $event,
                      required: "",
                      maxlength: "200"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.profile.location]
                    ])
                  ]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    disabled: !_ctx.canAct || !_ctx.canOwner,
                    type: "submit"
                  }, "保存设置", 8, ["disabled"])
                ], 40, ["onSubmit"])
              ])) : _createCommentVNode("v-if", true),
              !_ctx.preview && ["/merchant/orders", "/merchant/pickup", "/merchant/aftersales", "/merchant/inventory"].includes(_ctx.route) && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                key: 8,
                class: "sdd-pager"
              }, [
                _createElementVNode(
                  "span",
                  null,
                  "共 " + _toDisplayString(_ctx.pageInfo.total) + " 条",
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: _ctx.page <= 1,
                  onClick: ($event) => _ctx.page--
                }, "上一页", 8, ["disabled", "onClick"]),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.page),
                  1
                  /* TEXT */
                ),
                _createElementVNode("button", {
                  disabled: !_ctx.pageInfo.hasNext,
                  onClick: ($event) => _ctx.page++
                }, "下一页", 8, ["disabled", "onClick"])
              ])) : _createCommentVNode("v-if", true)
            ];
          }),
          _: 1
          /* STABLE */
        }, 8, ["title"]);
      };
    })()
  };
  const { ref: ref$2, computed: computed$3, onMounted: onMounted$3, onUnmounted: onUnmounted$3, watch: watch$3 } = Vue;
  const Knowledge = {
    name: "Knowledge",
    components: { BackofficeShell },
    setup() {
      const role = computed$3(() => store.route.startsWith("/admin") ? "admin" : "merchant");
      const bases = ref$2([]), docs = ref$2([]), active = ref$2(""), selected = ref$2(null), text = ref$2("");
      const error = ref$2(""), busy = ref$2(false), newBase = ref$2(false), uploading = ref$2(false), baseName = ref$2(""), visibility = ref$2("PUBLIC"), title = ref$2(""), file = ref$2(null);
      const docPage = ref$2(1), docInfo = ref$2({ total: 0, hasNext: false });
      const versionRoot = ref$2(null);
      const current = computed$3(() => bases.value.find((b) => b.id === active.value));
      let baseEpoch = 0, docEpoch = 0, readEpoch = 0;
      const canRead = computed$3(
        () => {
          var _a;
          return preview || (role.value === "admin" ? ((_a = store.workspace) == null ? void 0 : _a.platformAdmin) === true : hasPermission("knowledge.read"));
        }
      );
      const canManage = computed$3(
        () => {
          var _a;
          return preview || (role.value === "admin" ? ((_a = store.workspace) == null ? void 0 : _a.platformAdmin) === true : hasPermission("knowledge.manage"));
        }
      );
      const context = (targetRole, targetMid) => targetRole === role.value && targetMid === store.merchantId;
      async function load() {
        var _a, _b;
        const stamp = ++baseEpoch, currentRole = role.value, mid = store.merchantId;
        ++docEpoch;
        ++readEpoch;
        error.value = "";
        bases.value = [];
        docs.value = [];
        selected.value = null;
        text.value = "";
        if (currentRole === "admin" && !preview && !((_a = store.workspace) == null ? void 0 : _a.platformAdmin)) {
          try {
            const [user, workspace] = await Promise.all([api("/auth/me"), api("/workspace")]);
            if (stamp !== baseEpoch || !context(currentRole, mid)) return;
            store.user = user;
            store.workspace = workspace;
          } catch (e) {
            if (stamp === baseEpoch) error.value = e.message;
            return;
          }
        }
        if (!canRead.value) {
          active.value = "";
          return;
        }
        try {
          const result = preview ? DEMO_BASES : await api("/knowledge/bases");
          if (stamp !== baseEpoch || !context(currentRole, mid)) return;
          bases.value = (result || []).filter((b) => currentRole === "admin" || b.merchantId === mid);
          if (!bases.value.some((b) => b.id === active.value))
            active.value = ((_b = bases.value[0]) == null ? void 0 : _b.id) || "";
          docPage.value = 1;
          await loadDocs();
        } catch (e) {
          if (stamp === baseEpoch && context(currentRole, mid)) error.value = e.message;
        }
      }
      async function loadDocs() {
        const stamp = ++docEpoch, id = active.value, page = docPage.value, currentRole = role.value, mid = store.merchantId;
        ++readEpoch;
        selected.value = null;
        text.value = "";
        docs.value = [];
        if (!id) {
          docInfo.value = { total: 0, hasNext: false };
          return;
        }
        const valid = () => stamp === docEpoch && active.value === id && docPage.value === page && context(currentRole, mid);
        try {
          const result = preview ? {
            items: DEMO_DOCS.filter((d) => d.baseId === id),
            total: DEMO_DOCS.filter((d) => d.baseId === id).length,
            hasNext: false
          } : await api(
            "/knowledge/bases/" + pathId(id) + "/documents/page" + query({ page, size: 15 })
          );
          if (!valid()) return;
          docs.value = result.items || [];
          docInfo.value = result;
        } catch (e) {
          if (valid()) error.value = e.message;
        }
      }
      onMounted$3(load);
      onUnmounted$3(() => {
        ++baseEpoch;
        ++docEpoch;
        ++readEpoch;
      });
      watch$3([role, () => store.merchantId, canRead, canManage], load);
      watch$3(docPage, loadDocs);
      async function read(d) {
        var _a;
        const stamp = ++readEpoch, id = active.value, mid = store.merchantId, currentRole = role.value;
        selected.value = d;
        text.value = "";
        if (preview) {
          text.value = d.content || "演示文档内容";
          return;
        }
        try {
          const result = await api("/knowledge/documents/" + pathId(d.id));
          if (stamp === readEpoch && active.value === id && ((_a = selected.value) == null ? void 0 : _a.id) === d.id && context(currentRole, mid)) {
            text.value = result.content || "";
            selected.value = result;
          }
        } catch (e) {
          if (stamp === readEpoch) notify(e.message);
        }
      }
      async function create() {
        if (preview || busy.value || !canManage.value || !baseName.value.trim()) return;
        busy.value = true;
        try {
          await api("/knowledge/bases", {
            method: "POST",
            body: {
              merchantId: role.value === "admin" ? null : store.merchantId,
              name: baseName.value.trim(),
              visibility: visibility.value
            }
          });
          newBase.value = false;
          baseName.value = "";
          await load();
          notify("已创建知识库");
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      function chooseFile(e) {
        var _a;
        const selectedFile = (_a = e.target.files) == null ? void 0 : _a[0];
        file.value = null;
        if (!selectedFile) return;
        if (selectedFile.size > 2 * 1024 * 1024) {
          notify("文件不能超过2MB");
          e.target.value = "";
          return;
        }
        if (!/\.(txt|md|pdf)$/i.test(selectedFile.name)) {
          notify("仅支持 TXT、Markdown、文本 PDF");
          e.target.value = "";
          return;
        }
        file.value = selectedFile;
        title.value = title.value || selectedFile.name;
      }
      async function toBase64(f) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
      }
      async function upload() {
        if (preview || busy.value || !canManage.value || !active.value || !file.value) return;
        busy.value = true;
        try {
          await api("/knowledge/bases/" + pathId(active.value) + "/documents", {
            method: "POST",
            body: {
              rootId: versionRoot.value,
              title: title.value.trim() || file.value.name,
              filename: file.value.name,
              contentType: file.value.type || (file.value.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain"),
              base64: await toBase64(file.value)
            }
          });
          uploading.value = false;
          file.value = null;
          title.value = "";
          versionRoot.value = null;
          await loadDocs();
          notify("文档已上传");
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      function newVersion(d) {
        versionRoot.value = d.rootId;
        title.value = d.title;
        file.value = null;
        uploading.value = true;
      }
      function newDocument() {
        versionRoot.value = null;
        file.value = null;
        title.value = "";
        uploading.value = !uploading.value;
      }
      async function action(d, operation) {
        if (preview || busy.value || !canManage.value) return;
        busy.value = true;
        try {
          await api("/knowledge/documents/" + pathId(d.id) + "/" + operation, { method: "POST" });
          await loadDocs();
          notify("操作成功");
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      return {
        role,
        canRead,
        canManage,
        bases,
        docs,
        active,
        selected,
        text,
        error,
        busy,
        newBase,
        uploading,
        baseName,
        visibility,
        title,
        file,
        current,
        preview,
        label,
        dateTime,
        read,
        load,
        loadDocs,
        docPage,
        docInfo,
        create,
        chooseFile,
        upload,
        action,
        newVersion,
        newDocument,
        versionRoot
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, withModifiers: _withModifiers, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: _ctx.role,
          title: "知识库"
        }, {
          actions: _withCtx(() => [
            _ctx.canManage ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "head-actions"
            }, [
              _createElementVNode("button", {
                class: "outline-button small",
                onClick: ($event) => _ctx.newBase = !_ctx.newBase,
                disabled: !_ctx.canManage
              }, [
                _createVNode(_component_Icon, {
                  name: "plus",
                  size: 16
                }),
                _createTextVNode("新建知识库")
              ], 8, ["onClick", "disabled"]),
              _createElementVNode("button", {
                class: "teal-button",
                onClick: _ctx.newDocument,
                disabled: !_ctx.canManage || !_ctx.active
              }, [
                _createVNode(_component_Icon, {
                  name: "plus",
                  size: 17
                }),
                _createTextVNode("上传文档")
              ], 8, ["onClick", "disabled"])
            ])) : _createCommentVNode("v-if", true)
          ]),
          default: _withCtx(() => {
            var _a;
            return [
              _ctx.error ? (_openBlock(), _createElementBlock(
                "div",
                {
                  key: 0,
                  class: "inline-error"
                },
                _toDisplayString(_ctx.error),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              _ctx.canManage && (_ctx.newBase || _ctx.uploading) ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ops-grid kb-forms"
              }, [
                _ctx.newBase ? (_openBlock(), _createElementBlock("form", {
                  key: 0,
                  class: "ops-card ops-sideform",
                  onSubmit: _withModifiers(_ctx.create, ["prevent"])
                }, [
                  _createElementVNode("h2", null, "新建知识库"),
                  _createElementVNode("label", { class: "field-label" }, "名称"),
                  _withDirectives(_createElementVNode("input", {
                    class: "admin-input",
                    "onUpdate:modelValue": ($event) => _ctx.baseName = $event,
                    maxlength: "100",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [_vModelText, _ctx.baseName]
                  ]),
                  _createElementVNode("label", { class: "field-label" }, "可见范围"),
                  _withDirectives(_createElementVNode("select", {
                    class: "admin-input",
                    "onUpdate:modelValue": ($event) => _ctx.visibility = $event
                  }, [
                    _createElementVNode("option", { value: "PUBLIC" }, "公开"),
                    _createElementVNode("option", {
                      value: _ctx.role === "admin" ? "PLATFORM_INTERNAL" : "MERCHANT_INTERNAL"
                    }, "内部", 8, ["value"])
                  ], 8, ["onUpdate:modelValue"]), [
                    [_vModelSelect, _ctx.visibility]
                  ]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    type: "submit",
                    disabled: _ctx.busy || _ctx.preview
                  }, "创建", 8, ["disabled"])
                ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true),
                _ctx.uploading ? (_openBlock(), _createElementBlock("form", {
                  key: 1,
                  class: "ops-card ops-sideform",
                  onSubmit: _withModifiers(_ctx.upload, ["prevent"])
                }, [
                  _createElementVNode(
                    "h2",
                    null,
                    _toDisplayString(_ctx.versionRoot ? "上传新版本" : "上传文档"),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode("label", { class: "field-label" }, "文档标题"),
                  _withDirectives(_createElementVNode("input", {
                    class: "admin-input",
                    "onUpdate:modelValue": ($event) => _ctx.title = $event,
                    maxlength: "120",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue"]), [
                    [_vModelText, _ctx.title]
                  ]),
                  _createElementVNode("label", { class: "field-label" }, "TXT / MD / 文本 PDF · 2MB 内"),
                  _createElementVNode("input", {
                    class: "admin-input",
                    type: "file",
                    accept: ".txt,.md,.pdf",
                    onChange: _ctx.chooseFile,
                    required: ""
                  }, null, 40, ["onChange"]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    type: "submit",
                    disabled: _ctx.busy || _ctx.preview || !_ctx.file
                  }, "上传并索引", 8, ["disabled"])
                ], 40, ["onSubmit"])) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true),
              !_ctx.canRead ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "ops-card access-denied"
              }, "当前账号没有知识库查看权限。")) : (_openBlock(), _createElementBlock("div", {
                key: 3,
                class: "knowledge-layout"
              }, [
                _createElementVNode("section", { class: "ops-card kb-list" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "知识库"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.bases.length),
                      1
                      /* TEXT */
                    )
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.bases, (b) => {
                      return _openBlock(), _createElementBlock("button", {
                        key: b.id,
                        class: _normalizeClass(["kb-base", { active: _ctx.active === b.id }]),
                        onClick: ($event) => {
                          _ctx.active = b.id;
                          _ctx.docPage = 1;
                          _ctx.loadDocs();
                        }
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [
                          _createVNode(_component_Icon, { name: "book" })
                        ]),
                        _createElementVNode("div", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(b.name),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(_ctx.label(b.visibility)),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createVNode(_component_Icon, {
                          name: "chevronRight",
                          size: 16
                        })
                      ], 10, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.bases.length ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "admin-empty"
                  }, "暂无知识库")) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("section", { class: "ops-card kb-docs" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode(
                      "h2",
                      null,
                      _toDisplayString(((_a = _ctx.current) == null ? void 0 : _a.name) || "文档"),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.docs.length) + " 项",
                      1
                      /* TEXT */
                    )
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.docs, (d) => {
                      var _a2;
                      return _openBlock(), _createElementBlock(
                        "div",
                        {
                          class: _normalizeClass(["kb-doc", { active: ((_a2 = _ctx.selected) == null ? void 0 : _a2.id) === d.id }]),
                          key: d.id
                        },
                        [
                          _createElementVNode("button", {
                            onClick: ($event) => _ctx.read(d)
                          }, [
                            _createElementVNode("span", { class: "mini-icon" }, [
                              _createVNode(_component_Icon, { name: "clipboard" })
                            ]),
                            _createElementVNode("span", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(d.title),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "small",
                                null,
                                "v" + _toDisplayString(d.version) + " · " + _toDisplayString(_ctx.dateTime(d.createdAt)),
                                1
                                /* TEXT */
                              )
                            ])
                          ], 8, ["onClick"]),
                          _createElementVNode(
                            "span",
                            {
                              class: _normalizeClass(["status-tag", d.status === "PUBLISHED" ? "published" : "draft"])
                            },
                            _toDisplayString(_ctx.label(d.status)),
                            3
                            /* TEXT, CLASS */
                          ),
                          _ctx.canManage ? (_openBlock(), _createElementBlock("span", {
                            key: 0,
                            class: "kb-doc-actions"
                          }, [
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview,
                              onClick: ($event) => _ctx.newVersion(d),
                              title: "上传新版本",
                              "aria-label": "上传新版本"
                            }, [
                              _createVNode(_component_Icon, {
                                name: "plus",
                                size: 15
                              })
                            ], 8, ["disabled", "onClick"]),
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview,
                              onClick: ($event) => _ctx.action(d, "index"),
                              title: "重建索引",
                              "aria-label": "重建索引"
                            }, [
                              _createVNode(_component_Icon, {
                                name: "refresh",
                                size: 15
                              })
                            ], 8, ["disabled", "onClick"]),
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview || d.indexStatus !== "READY" || d.status === "PUBLISHED",
                              onClick: ($event) => _ctx.action(d, "publish"),
                              title: "发布",
                              "aria-label": "发布文档"
                            }, [
                              _createVNode(_component_Icon, {
                                name: "check",
                                size: 15
                              })
                            ], 8, ["disabled", "onClick"]),
                            _createElementVNode("button", {
                              disabled: _ctx.busy || _ctx.preview || d.status !== "PUBLISHED",
                              onClick: ($event) => _ctx.action(d, "withdraw"),
                              title: "撤回",
                              "aria-label": "撤回文档"
                            }, [
                              _createVNode(_component_Icon, {
                                name: "x",
                                size: 15
                              })
                            ], 8, ["disabled", "onClick"])
                          ])) : _createCommentVNode("v-if", true)
                        ],
                        2
                        /* CLASS */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.docs.length ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "admin-empty"
                  }, "暂无文档")) : _createCommentVNode("v-if", true),
                  !_ctx.preview && _ctx.docInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "sdd-pager"
                  }, [
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.docInfo.total) + " 项",
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: _ctx.docPage <= 1,
                      onClick: ($event) => _ctx.docPage--
                    }, "上一页", 8, ["disabled", "onClick"]),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.docPage),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      disabled: !_ctx.docInfo.hasNext,
                      onClick: ($event) => _ctx.docPage++
                    }, "下一页", 8, ["disabled", "onClick"])
                  ])) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("section", { class: "ops-card kb-preview" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "文档预览"),
                    _ctx.selected ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      onClick: ($event) => {
                        _ctx.selected = null;
                        _ctx.text = "";
                      },
                      "aria-label": "关闭"
                    }, [
                      _createVNode(_component_Icon, {
                        name: "x",
                        size: 18
                      })
                    ], 8, ["onClick"])) : _createCommentVNode("v-if", true)
                  ]),
                  _ctx.selected ? (_openBlock(), _createElementBlock(
                    _Fragment,
                    { key: 0 },
                    [
                      _createElementVNode("div", { class: "kb-title" }, [
                        _createVNode(_component_Icon, {
                          name: "book",
                          size: 22
                        }),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.selected.title),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "inspector-row" }, [
                        _createElementVNode("span", null, "版本"),
                        _createElementVNode(
                          "strong",
                          null,
                          "v" + _toDisplayString(_ctx.selected.version),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "inspector-row" }, [
                        _createElementVNode("span", null, "索引"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.label(_ctx.selected.indexStatus)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode("div", { class: "inspector-row" }, [
                        _createElementVNode("span", null, "状态"),
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(_ctx.label(_ctx.selected.status)),
                          1
                          /* TEXT */
                        )
                      ]),
                      _ctx.selected.error ? (_openBlock(), _createElementBlock(
                        "p",
                        {
                          key: 0,
                          class: "inline-error"
                        },
                        _toDisplayString(_ctx.selected.error),
                        1
                        /* TEXT */
                      )) : _createCommentVNode("v-if", true),
                      _createElementVNode(
                        "pre",
                        { class: "document-preview" },
                        _toDisplayString(_ctx.text || "该版本暂无可显示的正文"),
                        1
                        /* TEXT */
                      )
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  )) : (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "admin-empty"
                  }, "选择文档查看"))
                ])
              ]))
            ];
          }),
          _: 1
          /* STABLE */
        }, 8, ["role"]);
      };
    })()
  };
  const { ref: ref$1, computed: computed$2, onMounted: onMounted$2, onUnmounted: onUnmounted$2, watch: watch$2 } = Vue;
  const titles = {
    "/admin": "平台总览",
    "/admin/applications": "商户审核",
    "/admin/merchants": "商户监管",
    "/admin/products": "商品监管",
    "/admin/orders": "订单监管",
    "/admin/disputes": "争议处理",
    "/admin/categories": "分类管理"
  };
  const Platform = {
    name: "Platform",
    components: { BackofficeShell, ProductImage },
    setup() {
      const route = computed$2(() => store.route), title = computed$2(() => titles[route.value] || "平台总览");
      const stats = ref$1(null), applications = ref$1([]), merchants = ref$1([]), products = ref$1([]), orders = ref$1([]), aftersales = ref$1([]), categories = ref$1([]);
      const selectedId = ref$1(""), search = ref$1(""), state = ref$1(""), page = ref$1(1), pageInfo = ref$1({ total: 0, hasNext: false }), reason = ref$1(""), category = ref$1({ code: "", name: "", active: true }), busy = ref$1(false), error = ref$1(""), allowed = ref$1(preview);
      const pickedApplication = computed$2(
        () => applications.value.find((a) => a.applicationId === selectedId.value) || applications.value[0] || null
      );
      const filtered = computed$2(() => {
        const source = route.value === "/admin/applications" ? applications.value : route.value === "/admin/merchants" ? merchants.value : route.value === "/admin/products" ? products.value : route.value === "/admin/orders" ? orders.value : route.value === "/admin/disputes" ? aftersales.value : categories.value;
        if (!preview && ["/admin/applications", "/admin/merchants", "/admin/products", "/admin/orders"].includes(
          route.value
        ))
          return source;
        const q = search.value.trim().toLowerCase();
        return source.filter(
          (row) => (!q || route.value === "/admin/products" && !preview || Object.values(row).some((v) => typeof v === "string" && v.toLowerCase().includes(q))) && (!state.value || preview || ["/admin/merchants", "/admin/products"].includes(route.value) || row.status === state.value)
        );
      });
      let loadVersion = 0;
      function clearPrivateViews() {
        stats.value = null;
        applications.value = [];
        merchants.value = [];
        products.value = [];
        orders.value = [];
        aftersales.value = [];
        selectedId.value = "";
        pageInfo.value = { total: 0, hasNext: false };
      }
      async function load() {
        var _a;
        const stamp = ++loadVersion;
        const current = route.value;
        error.value = "";
        if (preview) {
          allowed.value = true;
          stats.value = { ...DEMO_STATS };
          applications.value = DEMO_APPLICATIONS;
          merchants.value = DEMO_MERCHANTS;
          products.value = DEMO_PRODUCTS;
          orders.value = DEMO_MERCHANT_ORDERS;
          aftersales.value = DEMO_AFTERSALES;
          categories.value = DEMO_CATEGORIES;
          return;
        }
        try {
          await loadSession();
          if (stamp !== loadVersion) return;
          const actor = (_a = store.user) == null ? void 0 : _a.userId;
          const valid = () => {
            var _a2;
            return stamp === loadVersion && route.value === current && ((_a2 = store.user) == null ? void 0 : _a2.userId) === actor;
          };
          const work = await api("/workspace");
          if (!valid()) return;
          store.workspace = work;
          allowed.value = !!(work == null ? void 0 : work.platformAdmin);
          if (!allowed.value) return;
          if (current === "/admin") {
            const [s, m, o] = await Promise.all([
              api("/admin/statistics"),
              api("/admin/merchants/page" + query({ page: 1, size: 6 })),
              api("/admin/orders/page" + query({ page: 1, size: 6 }))
            ]);
            if (!valid()) return;
            stats.value = s;
            merchants.value = m.items || [];
            orders.value = o.items || [];
          }
          if (current === "/admin/applications") {
            const result = await api(
              "/admin/merchant-applications/page" + query({ page: page.value, size: 12, state: state.value, q: search.value })
            );
            if (!valid()) return;
            applications.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/merchants") {
            const result = await api(
              "/admin/merchants/page" + query({ page: page.value, size: 12, q: search.value })
            );
            if (!valid()) return;
            merchants.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/products") {
            const result = await api(
              "/admin/products/page" + query({ page: page.value, size: 12, q: search.value })
            );
            if (!valid()) return;
            products.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/orders") {
            const result = await api(
              "/admin/orders/page" + query({ page: page.value, size: 12, state: state.value, q: search.value })
            );
            if (!valid()) return;
            orders.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/disputes") {
            const result = await api(
              "/admin/aftersales/page" + query({ page: page.value, size: 12, state: state.value })
            );
            if (!valid()) return;
            aftersales.value = result.items || [];
            pageInfo.value = result;
          }
          if (current === "/admin/categories") {
            const result = await api("/categories");
            if (!valid()) return;
            categories.value = result || [];
          }
        } catch (e) {
          if (stamp === loadVersion && route.value === current) error.value = e.message;
        }
      }
      onMounted$2(load);
      onUnmounted$2(() => {
        ++loadVersion;
        clearTimeout(searchDelay);
      });
      watch$2(
        () => {
          var _a;
          return (_a = store.user) == null ? void 0 : _a.userId;
        },
        () => {
          ++loadVersion;
          allowed.value = preview;
          clearPrivateViews();
          if (!preview && route.value.startsWith("/admin")) load();
        }
      );
      watch$2(route, () => {
        page.value = 1;
        search.value = "";
        state.value = "";
        selectedId.value = "";
        load();
      });
      watch$2(page, load);
      watch$2(state, () => {
        page.value = 1;
        if (route.value !== "/admin") load();
      });
      let searchDelay;
      watch$2(search, () => {
        page.value = 1;
        if (!preview && ["/admin/products", "/admin/merchants", "/admin/applications", "/admin/orders"].includes(
          route.value
        )) {
          clearTimeout(searchDelay);
          searchDelay = setTimeout(load, 280);
        }
      });
      async function perform(path, body) {
        if (preview || busy.value || !allowed.value) return;
        busy.value = true;
        try {
          await api(path, { method: "POST", body });
          notify("操作成功");
          reason.value = "";
          await load();
        } catch (e) {
          notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      function review(approved) {
        const a = pickedApplication.value;
        if (!a) return;
        if (!approved && !reason.value.trim()) {
          notify("请输入拒绝理由");
          return;
        }
        perform("/admin/merchant-applications/" + pathId(a.applicationId) + "/review", {
          approved,
          reason: reason.value
        });
      }
      function stateMerchant(m) {
        perform("/admin/merchants/" + pathId(m.merchantId) + "/state", {
          active: m.status !== "ACTIVE",
          reason: reason.value || "平台管理操作"
        });
      }
      function forceProduct(p) {
        perform("/admin/products/" + pathId(p.productId) + "/unpublish");
      }
      function decideRefund(a, approved) {
        const comment = reason.value.trim();
        if (!a || !comment) {
          notify("请填写退款审核说明");
          return;
        }
        perform("/admin/orders/" + pathId(a.orderId) + "/refund-decision", {
          approved,
          reason: comment
        });
      }
      function saveCategory() {
        if (!category.value.code.trim() || !category.value.name.trim()) {
          notify("请填写分类信息");
          return;
        }
        perform("/admin/categories", { ...category.value });
      }
      function selectApplication(a) {
        selectedId.value = a.applicationId;
        reason.value = "";
      }
      const merchantName = (id, row) => {
        var _a;
        return (row == null ? void 0 : row.merchantName) || ((_a = merchants.value.find((m) => m.merchantId === id)) == null ? void 0 : _a.name) || id || "—";
      };
      return {
        store,
        route,
        title,
        stats,
        applications,
        merchants,
        products,
        orders,
        aftersales,
        categories,
        selectedId,
        search,
        state,
        page,
        pageInfo,
        reason,
        category,
        busy,
        error,
        allowed,
        pickedApplication,
        filtered,
        preview,
        go,
        money,
        label,
        dateTime,
        merchantName,
        load,
        review,
        stateMerchant,
        forceProduct,
        decideRefund,
        saveCategory,
        selectApplication
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, createElementVNode: _createElementVNode, toDisplayString: _toDisplayString, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, renderList: _renderList, Fragment: _Fragment, vModelText: _vModelText, withDirectives: _withDirectives, vModelSelect: _vModelSelect, normalizeClass: _normalizeClass, withModifiers: _withModifiers, withCtx: _withCtx, createBlock: _createBlock } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_ProductImage = _resolveComponent("ProductImage");
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: "admin",
          title: _ctx.title
        }, {
          actions: _withCtx(() => [
            _createElementVNode("button", {
              class: "outline-button small",
              onClick: _ctx.load
            }, [
              _createVNode(_component_Icon, {
                name: "refresh",
                size: 16
              }),
              _createTextVNode("刷新")
            ], 8, ["onClick"])
          ]),
          default: _withCtx(() => [
            _ctx.error ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 0,
                class: "inline-error"
              },
              _toDisplayString(_ctx.error),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            !_ctx.allowed && !_ctx.preview ? (_openBlock(), _createElementBlock("div", {
              key: 1,
              class: "ops-card access-denied"
            }, [
              _createVNode(_component_Icon, {
                name: "shield",
                size: 38
              }),
              _createElementVNode("h2", null, "无权限访问")
            ])) : _ctx.route === "/admin" ? (_openBlock(), _createElementBlock(
              _Fragment,
              { key: 2 },
              [
                _ctx.stats ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "ops-kpis"
                }, [
                  _createElementVNode("div", null, [
                    _createElementVNode("span", null, "全部订单"),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.stats.totalOrders || 0),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", null, [
                    _createElementVNode("span", null, "待付款"),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.stats.pendingCount || 0),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", null, [
                    _createElementVNode("span", null, "已完成"),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.stats.completedCount || 0),
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", null, [
                    _createElementVNode("span", null, "模拟交易金额"),
                    _createElementVNode(
                      "strong",
                      null,
                      _toDisplayString(_ctx.money(_ctx.stats.completedAmountCent)),
                      1
                      /* TEXT */
                    )
                  ])
                ])) : _createCommentVNode("v-if", true),
                _createElementVNode("div", { class: "ops-grid" }, [
                  _createElementVNode("section", { class: "ops-card" }, [
                    _createElementVNode("div", { class: "ops-card-header" }, [
                      _createElementVNode("h2", null, "近期订单"),
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/orders")
                      }, [
                        _createTextVNode("全部 "),
                        _createVNode(_component_Icon, {
                          name: "chevronRight",
                          size: 16
                        })
                      ], 8, ["onClick"])
                    ]),
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.orders.slice(0, 6), (o) => {
                        return _openBlock(), _createElementBlock("div", {
                          class: "ops-list-line",
                          key: o.orderId
                        }, [
                          _createElementVNode("span", { class: "mini-icon" }, [
                            _createVNode(_component_Icon, { name: "order" })
                          ]),
                          _createElementVNode("div", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(o.orderId),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(_ctx.dateTime(o.createdAt)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "b",
                            null,
                            _toDisplayString(_ctx.money(o.totalCent)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "span",
                            { class: "status-tag" },
                            _toDisplayString(_ctx.label(o.status)),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    )),
                    !_ctx.orders.length ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "admin-empty"
                    }, "暂无订单")) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("section", { class: "ops-card" }, [
                    _createElementVNode("div", { class: "ops-card-header" }, [
                      _createElementVNode("h2", null, "运营入口")
                    ]),
                    _createElementVNode("div", { class: "ops-quick" }, [
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/applications")
                      }, [
                        _createVNode(_component_Icon, { name: "store" }),
                        _createTextVNode("商户审核")
                      ], 8, ["onClick"]),
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/merchants")
                      }, [
                        _createVNode(_component_Icon, { name: "users" }),
                        _createTextVNode("商户监管")
                      ], 8, ["onClick"]),
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/disputes")
                      }, [
                        _createVNode(_component_Icon, { name: "shield" }),
                        _createTextVNode("争议处理")
                      ], 8, ["onClick"]),
                      _createElementVNode("button", {
                        onClick: ($event) => _ctx.go("/admin/knowledge")
                      }, [
                        _createVNode(_component_Icon, { name: "book" }),
                        _createTextVNode("知识库")
                      ], 8, ["onClick"])
                    ])
                  ])
                ])
              ],
              64
              /* STABLE_FRAGMENT */
            )) : _ctx.route === "/admin/applications" ? (_openBlock(), _createElementBlock("div", {
              key: 3,
              class: "ops-grid admin-review-grid"
            }, [
              _createElementVNode("section", { class: "ops-card" }, [
                _createElementVNode("div", { class: "ops-card-header" }, [
                  _createElementVNode("h2", null, "入驻申请"),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.preview ? _ctx.applications.length : _ctx.pageInfo.total) + " 条",
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "ops-toolbar" }, [
                  _createElementVNode("label", { class: "ops-search" }, [
                    _createVNode(_component_Icon, {
                      name: "search",
                      size: 16
                    }),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": ($event) => _ctx.search = $event,
                      placeholder: "商户 / 申请人"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.search]
                    ])
                  ]),
                  _withDirectives(_createElementVNode("select", {
                    class: "admin-input compact-select",
                    "onUpdate:modelValue": ($event) => _ctx.state = $event
                  }, [
                    _createElementVNode("option", { value: "" }, "全部状态"),
                    _createElementVNode("option", { value: "SUBMITTED" }, "待审核"),
                    _createElementVNode("option", { value: "APPROVED" }, "已通过"),
                    _createElementVNode("option", { value: "REJECTED" }, "已拒绝")
                  ], 8, ["onUpdate:modelValue"]), [
                    [_vModelSelect, _ctx.state]
                  ])
                ]),
                _createElementVNode("div", { class: "ops-table-wrap" }, [
                  _createElementVNode("table", { class: "ops-table" }, [
                    _createElementVNode("thead", null, [
                      _createElementVNode("tr", null, [
                        _createElementVNode("th", null, "商户"),
                        _createElementVNode("th", null, "申请人"),
                        _createElementVNode("th", null, "门店"),
                        _createElementVNode("th", null, "状态"),
                        _createElementVNode("th")
                      ])
                    ]),
                    _createElementVNode("tbody", null, [
                      (_openBlock(true), _createElementBlock(
                        _Fragment,
                        null,
                        _renderList(_ctx.filtered, (a) => {
                          var _a;
                          return _openBlock(), _createElementBlock("tr", {
                            key: a.applicationId,
                            class: _normalizeClass({ active: ((_a = _ctx.pickedApplication) == null ? void 0 : _a.applicationId) === a.applicationId }),
                            onClick: ($event) => _ctx.selectApplication(a)
                          }, [
                            _createElementVNode("td", null, [
                              _createElementVNode(
                                "strong",
                                null,
                                _toDisplayString(a.merchantName),
                                1
                                /* TEXT */
                              ),
                              _createElementVNode(
                                "small",
                                null,
                                _toDisplayString(a.category),
                                1
                                /* TEXT */
                              )
                            ]),
                            _createElementVNode(
                              "td",
                              null,
                              _toDisplayString(a.contactName),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "td",
                              null,
                              _toDisplayString(a.storeName),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode("td", null, [
                              _createElementVNode(
                                "span",
                                {
                                  class: _normalizeClass(["status-tag", a.status === "APPROVED" ? "published" : "draft"])
                                },
                                _toDisplayString(_ctx.label(a.status)),
                                3
                                /* TEXT, CLASS */
                              )
                            ]),
                            _createElementVNode("td", null, [
                              _createVNode(_component_Icon, {
                                name: "chevronRight",
                                size: 16
                              })
                            ])
                          ], 10, ["onClick"]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])
                  ])
                ]),
                !_ctx.filtered.length ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "admin-empty"
                }, "无符合条件的申请")) : _createCommentVNode("v-if", true)
              ]),
              _ctx.pickedApplication ? (_openBlock(), _createElementBlock("aside", {
                key: 0,
                class: "ops-card ops-sideform"
              }, [
                _createElementVNode(
                  "h2",
                  null,
                  _toDisplayString(_ctx.pickedApplication.merchantName),
                  1
                  /* TEXT */
                ),
                _createElementVNode(
                  "span",
                  { class: "status-tag" },
                  _toDisplayString(_ctx.label(_ctx.pickedApplication.status)),
                  1
                  /* TEXT */
                ),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "申请编号"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.applicationId),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "联系人"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.contactName),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "联系电话"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.contactPhone),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "门店"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.storeName),
                    1
                    /* TEXT */
                  )
                ]),
                _createElementVNode("div", { class: "inspector-row" }, [
                  _createElementVNode("span", null, "位置"),
                  _createElementVNode(
                    "strong",
                    null,
                    _toDisplayString(_ctx.pickedApplication.location),
                    1
                    /* TEXT */
                  )
                ]),
                _ctx.pickedApplication.rejectionReason ? (_openBlock(), _createElementBlock(
                  "div",
                  {
                    key: 0,
                    class: "inline-error"
                  },
                  _toDisplayString(_ctx.pickedApplication.rejectionReason),
                  1
                  /* TEXT */
                )) : _createCommentVNode("v-if", true),
                _ctx.pickedApplication.status === "SUBMITTED" ? (_openBlock(), _createElementBlock(
                  _Fragment,
                  { key: 1 },
                  [
                    _createElementVNode("label", { class: "field-label" }, "审核意见"),
                    _withDirectives(_createElementVNode("textarea", {
                      class: "admin-input",
                      "onUpdate:modelValue": ($event) => _ctx.reason = $event,
                      rows: "3",
                      maxlength: "500",
                      placeholder: "拒绝时必须填写原因"
                    }, null, 8, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.reason]
                    ]),
                    _createElementVNode("div", { class: "form-buttons" }, [
                      _createElementVNode("button", {
                        class: "outline-button",
                        disabled: _ctx.preview || _ctx.busy || !_ctx.reason.trim(),
                        onClick: ($event) => _ctx.review(false)
                      }, "驳回", 8, ["disabled", "onClick"]),
                      _createElementVNode("button", {
                        class: "teal-button",
                        disabled: _ctx.preview || _ctx.busy,
                        onClick: ($event) => _ctx.review(true)
                      }, "通过审核", 8, ["disabled", "onClick"])
                    ])
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : _createCommentVNode("v-if", true)
              ])) : _createCommentVNode("v-if", true)
            ])) : _ctx.route === "/admin/merchants" ? (_openBlock(), _createElementBlock("section", {
              key: 4,
              class: "ops-card"
            }, [
              _createElementVNode("div", { class: "ops-card-header" }, [
                _createElementVNode("h2", null, "商户列表"),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.preview ? _ctx.merchants.length : _ctx.pageInfo.total) + " 家",
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("label", { class: "ops-search" }, [
                _createVNode(_component_Icon, {
                  name: "search",
                  size: 17
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.search = $event,
                  placeholder: "搜索经营名称"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.search]
                ])
              ]),
              _createElementVNode("div", { class: "ops-table-wrap" }, [
                _createElementVNode("table", { class: "ops-table" }, [
                  _createElementVNode("thead", null, [
                    _createElementVNode("tr", null, [
                      _createElementVNode("th", null, "商户"),
                      _createElementVNode("th", null, "品类"),
                      _createElementVNode("th", null, "首个门店"),
                      _createElementVNode("th", null, "自提位置"),
                      _createElementVNode("th", null, "状态"),
                      _createElementVNode("th", null, "操作")
                    ])
                  ]),
                  _createElementVNode("tbody", null, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.filtered, (m) => {
                        return _openBlock(), _createElementBlock("tr", {
                          key: m.merchantId
                        }, [
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(m.name),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(m.merchantId),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(m.category),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(m.storeName),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(m.location),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "span",
                              {
                                class: _normalizeClass(["status-tag", m.status === "ACTIVE" ? "published" : "draft"])
                              },
                              _toDisplayString(_ctx.label(m.status)),
                              3
                              /* TEXT, CLASS */
                            )
                          ]),
                          _createElementVNode("td", null, [
                            _createElementVNode("button", {
                              class: "row-link",
                              disabled: _ctx.preview || _ctx.busy,
                              onClick: ($event) => _ctx.stateMerchant(m)
                            }, _toDisplayString(m.status === "ACTIVE" ? "停用" : "恢复"), 9, ["disabled", "onClick"])
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])
              ])
            ])) : _ctx.route === "/admin/products" ? (_openBlock(), _createElementBlock("section", {
              key: 5,
              class: "ops-card"
            }, [
              _createElementVNode("div", { class: "ops-card-header" }, [
                _createElementVNode("h2", null, "商品监管"),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.preview ? _ctx.products.length : _ctx.pageInfo.total) + " 件",
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("label", { class: "ops-search" }, [
                _createVNode(_component_Icon, {
                  name: "search",
                  size: 17
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.search = $event,
                  placeholder: "搜索商品 / 商户"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.search]
                ])
              ]),
              _createElementVNode("div", { class: "ops-table-wrap" }, [
                _createElementVNode("table", { class: "ops-table" }, [
                  _createElementVNode("thead", null, [
                    _createElementVNode("tr", null, [
                      _createElementVNode("th", null, "商品"),
                      _createElementVNode("th", null, "商户"),
                      _createElementVNode("th", null, "分类"),
                      _createElementVNode("th", null, "售价"),
                      _createElementVNode("th", null, "状态"),
                      _createElementVNode("th", null, "操作")
                    ])
                  ]),
                  _createElementVNode("tbody", null, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.filtered, (p) => {
                        var _a, _b;
                        return _openBlock(), _createElementBlock("tr", {
                          key: p.productId
                        }, [
                          _createElementVNode("td", null, [
                            _createElementVNode("div", { class: "table-product-cell" }, [
                              _createVNode(_component_ProductImage, {
                                src: p.imageUrl,
                                alt: p.title
                              }, null, 8, ["src", "alt"]),
                              _createElementVNode("div", null, [
                                _createElementVNode(
                                  "strong",
                                  null,
                                  _toDisplayString(p.title),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "span",
                                  null,
                                  _toDisplayString(p.productId),
                                  1
                                  /* TEXT */
                                )
                              ])
                            ])
                          ]),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.merchantName(p.merchantId, p)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(p.categoryCode),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.money((_b = (_a = p.skus) == null ? void 0 : _a[0]) == null ? void 0 : _b.priceCent)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "span",
                              { class: "status-tag" },
                              _toDisplayString(_ctx.label(p.status)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode("td", null, [
                            _createElementVNode("button", {
                              class: "row-link",
                              disabled: _ctx.preview || _ctx.busy || p.status !== "PUBLISHED",
                              onClick: ($event) => _ctx.forceProduct(p)
                            }, "强制下架", 8, ["disabled", "onClick"])
                          ])
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])
              ])
            ])) : _ctx.route === "/admin/orders" ? (_openBlock(), _createElementBlock("section", {
              key: 6,
              class: "ops-card"
            }, [
              _createElementVNode("div", { class: "ops-card-header" }, [
                _createElementVNode("h2", null, "订单监管"),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.preview ? _ctx.orders.length : _ctx.pageInfo.total) + " 笔",
                  1
                  /* TEXT */
                )
              ]),
              _createElementVNode("label", { class: "ops-search" }, [
                _createVNode(_component_Icon, {
                  name: "search",
                  size: 17
                }),
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": ($event) => _ctx.search = $event,
                  placeholder: "订单号"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.search]
                ])
              ]),
              _createElementVNode("div", { class: "ops-table-wrap" }, [
                _createElementVNode("table", { class: "ops-table" }, [
                  _createElementVNode("thead", null, [
                    _createElementVNode("tr", null, [
                      _createElementVNode("th", null, "订单"),
                      _createElementVNode("th", null, "商户"),
                      _createElementVNode("th", null, "实付金额"),
                      _createElementVNode("th", null, "状态"),
                      _createElementVNode("th", null, "创建时间")
                    ])
                  ]),
                  _createElementVNode("tbody", null, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.filtered, (o) => {
                        var _a, _b;
                        return _openBlock(), _createElementBlock("tr", {
                          key: o.orderId
                        }, [
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(o.orderId),
                              1
                              /* TEXT */
                            ),
                            _createElementVNode(
                              "small",
                              null,
                              _toDisplayString(((_b = (_a = o.items) == null ? void 0 : _a[0]) == null ? void 0 : _b.title) || "—"),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.merchantName(o.merchantId, o)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.money(o.totalCent)),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode("td", null, [
                            _createElementVNode(
                              "span",
                              { class: "status-tag" },
                              _toDisplayString(_ctx.label(o.status)),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "td",
                            null,
                            _toDisplayString(_ctx.dateTime(o.createdAt)),
                            1
                            /* TEXT */
                          )
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ])
                ])
              ])
            ])) : _ctx.route === "/admin/disputes" ? (_openBlock(), _createElementBlock("section", {
              key: 7,
              class: "ops-card"
            }, [
              _createElementVNode("div", { class: "ops-card-header" }, [
                _createElementVNode("h2", null, "售后争议"),
                _createElementVNode(
                  "span",
                  null,
                  _toDisplayString(_ctx.aftersales.length) + " 条",
                  1
                  /* TEXT */
                )
              ]),
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(_ctx.aftersales, (a) => {
                  return _openBlock(), _createElementBlock("div", {
                    class: "ops-list-line dispute-line",
                    key: a.id
                  }, [
                    _createElementVNode("span", { class: "mini-icon" }, [
                      _createVNode(_component_Icon, { name: "shield" })
                    ]),
                    _createElementVNode("div", null, [
                      _createElementVNode(
                        "strong",
                        null,
                        _toDisplayString(a.orderId),
                        1
                        /* TEXT */
                      ),
                      _createElementVNode(
                        "small",
                        null,
                        _toDisplayString(a.reason),
                        1
                        /* TEXT */
                      )
                    ]),
                    _createElementVNode(
                      "span",
                      { class: "status-tag" },
                      _toDisplayString(_ctx.label(a.status)),
                      1
                      /* TEXT */
                    ),
                    _createElementVNode("button", {
                      class: "outline-button small",
                      onClick: ($event) => {
                        _ctx.selectedId = a.id;
                        _ctx.reason = "";
                      }
                    }, "查看处理", 8, ["onClick"])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              !_ctx.aftersales.length ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "admin-empty"
              }, "暂无争议")) : _createCommentVNode("v-if", true),
              _ctx.selectedId && _ctx.aftersales.find((a) => a.id === _ctx.selectedId) ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "review-inline"
              }, [
                _createElementVNode(
                  "h3",
                  null,
                  "裁决 · " + _toDisplayString(_ctx.aftersales.find((a) => a.id === _ctx.selectedId).orderId),
                  1
                  /* TEXT */
                ),
                _createElementVNode("label", { class: "field-label" }, "裁决说明"),
                _withDirectives(_createElementVNode("textarea", {
                  class: "admin-input",
                  "onUpdate:modelValue": ($event) => _ctx.reason = $event,
                  rows: "3",
                  maxlength: "500",
                  placeholder: "审核说明（必填）"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [_vModelText, _ctx.reason]
                ]),
                _createElementVNode("div", { class: "form-buttons" }, [
                  _createElementVNode("button", {
                    class: "outline-button",
                    disabled: _ctx.preview || _ctx.busy || !_ctx.reason.trim(),
                    onClick: ($event) => _ctx.decideRefund(_ctx.aftersales.find((a) => a.id === _ctx.selectedId), false)
                  }, "驳回", 8, ["disabled", "onClick"]),
                  _createElementVNode("button", {
                    class: "teal-button",
                    disabled: _ctx.preview || _ctx.busy || !_ctx.reason.trim(),
                    onClick: ($event) => _ctx.decideRefund(_ctx.aftersales.find((a) => a.id === _ctx.selectedId), true)
                  }, "批准退款", 8, ["disabled", "onClick"])
                ])
              ])) : _createCommentVNode("v-if", true)
            ])) : _ctx.route === "/admin/categories" ? (_openBlock(), _createElementBlock("div", {
              key: 8,
              class: "ops-grid"
            }, [
              _createElementVNode("section", { class: "ops-card" }, [
                _createElementVNode("div", { class: "ops-card-header" }, [
                  _createElementVNode("h2", null, "类目"),
                  _createElementVNode(
                    "span",
                    null,
                    _toDisplayString(_ctx.categories.length) + " 个",
                    1
                    /* TEXT */
                  )
                ]),
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(_ctx.categories, (c) => {
                    return _openBlock(), _createElementBlock("div", {
                      class: "ops-list-line",
                      key: c.code
                    }, [
                      _createElementVNode("span", { class: "mini-icon" }, [
                        _createVNode(_component_Icon, { name: "grid" })
                      ]),
                      _createElementVNode("div", null, [
                        _createElementVNode(
                          "strong",
                          null,
                          _toDisplayString(c.name),
                          1
                          /* TEXT */
                        ),
                        _createElementVNode(
                          "small",
                          null,
                          _toDisplayString(c.code),
                          1
                          /* TEXT */
                        )
                      ]),
                      _createElementVNode(
                        "span",
                        {
                          class: _normalizeClass(["status-tag", c.active ? "published" : "draft"])
                        },
                        _toDisplayString(c.active ? "启用" : "停用"),
                        3
                        /* TEXT, CLASS */
                      ),
                      _createElementVNode("button", {
                        class: "row-link",
                        onClick: ($event) => _ctx.category = { code: c.code, name: c.name, active: !c.active },
                        disabled: _ctx.preview
                      }, _toDisplayString(c.active ? "停用" : "恢复"), 9, ["onClick", "disabled"])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              _createElementVNode("form", {
                class: "ops-card ops-sideform",
                onSubmit: _withModifiers(_ctx.saveCategory, ["prevent"])
              }, [
                _createElementVNode("h2", null, "编辑分类"),
                _createElementVNode("label", { class: "field-label" }, "编码"),
                _withDirectives(_createElementVNode("input", {
                  class: "admin-input",
                  "onUpdate:modelValue": ($event) => _ctx.category.code = $event,
                  required: "",
                  maxlength: "32"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [
                    _vModelText,
                    _ctx.category.code,
                    void 0,
                    { trim: true }
                  ]
                ]),
                _createElementVNode("label", { class: "field-label" }, "名称"),
                _withDirectives(_createElementVNode("input", {
                  class: "admin-input",
                  "onUpdate:modelValue": ($event) => _ctx.category.name = $event,
                  required: "",
                  maxlength: "50"
                }, null, 8, ["onUpdate:modelValue"]), [
                  [
                    _vModelText,
                    _ctx.category.name,
                    void 0,
                    { trim: true }
                  ]
                ]),
                _createElementVNode("label", { class: "field-label" }, "状态"),
                _withDirectives(_createElementVNode("select", {
                  class: "admin-input",
                  "onUpdate:modelValue": ($event) => _ctx.category.active = $event
                }, [
                  _createElementVNode("option", { value: true }, "启用"),
                  _createElementVNode("option", { value: false }, "停用")
                ], 8, ["onUpdate:modelValue"]), [
                  [_vModelSelect, _ctx.category.active]
                ]),
                _createElementVNode("button", {
                  type: "submit",
                  class: "teal-button",
                  disabled: _ctx.preview || _ctx.busy
                }, _toDisplayString(_ctx.preview ? "设计预览" : "保存分类"), 9, ["disabled"])
              ], 40, ["onSubmit"])
            ])) : _createCommentVNode("v-if", true),
            !_ctx.preview && _ctx.route !== "/admin" && _ctx.route !== "/admin/categories" && _ctx.pageInfo.total > 0 ? (_openBlock(), _createElementBlock("div", {
              key: 9,
              class: "sdd-pager"
            }, [
              _createElementVNode(
                "span",
                null,
                "共 " + _toDisplayString(_ctx.pageInfo.total) + " 条",
                1
                /* TEXT */
              ),
              _createElementVNode("button", {
                disabled: _ctx.page <= 1,
                onClick: ($event) => _ctx.page--
              }, "上一页", 8, ["disabled", "onClick"]),
              _createElementVNode(
                "span",
                null,
                _toDisplayString(_ctx.page),
                1
                /* TEXT */
              ),
              _createElementVNode("button", {
                disabled: !_ctx.pageInfo.hasNext,
                onClick: ($event) => _ctx.page++
              }, "下一页", 8, ["disabled", "onClick"])
            ])) : _createCommentVNode("v-if", true)
          ]),
          _: 1
          /* STABLE */
        }, 8, ["title"]);
      };
    })()
  };
  const { ref, computed: computed$1, onMounted: onMounted$1, onUnmounted: onUnmounted$1, watch: watch$1 } = Vue;
  const RoleManager = {
    name: "RoleManager",
    components: { BackofficeShell },
    setup() {
      const roles = ref([]), permissions = ref([]), selected = ref(""), name = ref(""), grants = ref([]);
      const error = ref(""), busy = ref(false), loading = ref(false), count = ref(0);
      const canManage = computed$1(() => hasPermission("role.manage"));
      const current = computed$1(() => roles.value.find((r) => r.code === selected.value) || null);
      const assigned = computed$1(() => count.value);
      let epoch = 0;
      const prefix = () => "/merchants/" + pathId(store.merchantId) + "/rbac";
      function reset() {
        selected.value = "";
        name.value = "";
        grants.value = [];
        roles.value = [];
        permissions.value = [];
        count.value = 0;
      }
      function choose(role) {
        selected.value = role.code;
        name.value = role.name;
        grants.value = [...role.permissions || []];
      }
      function create() {
        selected.value = "";
        name.value = "";
        grants.value = ["product.read", "order.read"];
      }
      function checked(code) {
        return grants.value.includes(code);
      }
      function toggle(code, enabled) {
        const dependency = {
          "product.write": "product.read",
          "stock.replenish": "stock.read",
          "order.prepare": "order.read",
          "pickup.verify": "order.read",
          "aftersale.review": "aftersale.read",
          "knowledge.manage": "knowledge.read",
          "dashboard.read": "order.read"
        };
        let values = new Set(grants.value);
        if (enabled) {
          values.add(code);
          if (dependency[code]) values.add(dependency[code]);
        } else {
          values.delete(code);
          for (const [action, read] of Object.entries(dependency))
            if (read === code) values.delete(action);
        }
        grants.value = [...values];
      }
      async function load() {
        var _a, _b, _c;
        const stamp = ++epoch, mid = store.merchantId, actor = (_a = store.user) == null ? void 0 : _a.userId;
        reset();
        error.value = "";
        if (preview) {
          roles.value = DEMO_RBAC_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] }));
          permissions.value = DEMO_RBAC_PERMISSIONS;
          count.value = DEMO_MEMBERS.length;
          choose(roles.value[0]);
          return;
        }
        loading.value = true;
        try {
          if (!mid) await loadMerchant();
          const id = store.merchantId, uid = (_b = store.user) == null ? void 0 : _b.userId;
          if (stamp !== epoch || (!mid ? false : mid !== id) || !hasPermission("role.manage")) return;
          const [rs, ps, ms] = await Promise.all([
            api(prefix() + "/roles"),
            api(prefix() + "/permissions"),
            api("/merchants/" + pathId(id) + "/members")
          ]);
          if (stamp !== epoch || store.merchantId !== id || ((_c = store.user) == null ? void 0 : _c.userId) !== uid || (!mid ? false : actor !== uid))
            return;
          roles.value = rs || [];
          permissions.value = ps || [];
          count.value = (ms || []).filter((m) => m.status === "ACTIVE").length;
          if (roles.value.length) choose(roles.value[0]);
        } catch (e) {
          if (stamp === epoch) error.value = e.message;
        } finally {
          if (stamp === epoch) loading.value = false;
        }
      }
      async function save() {
        var _a, _b, _c;
        if (preview || busy.value || !canManage.value || ((_a = current.value) == null ? void 0 : _a.builtin)) return;
        if (!name.value.trim() || grants.value.length === 0) {
          notify("请输入角色名称并选择至少一项权限");
          return;
        }
        const id = store.merchantId, uid = (_b = store.user) == null ? void 0 : _b.userId, stamp = epoch;
        busy.value = true;
        try {
          const code = selected.value;
          const result = await api(prefix() + "/roles" + (code ? "/" + pathId(code) : ""), {
            method: code ? "PUT" : "POST",
            body: { name: name.value.trim(), permissions: grants.value }
          });
          if (stamp !== epoch || id !== store.merchantId || uid !== ((_c = store.user) == null ? void 0 : _c.userId)) return;
          notify(code ? "角色已更新" : "角色已创建");
          await load();
          if (id === store.merchantId) {
            const found = roles.value.find((r) => r.code === result.code);
            if (found) choose(found);
          }
        } catch (e) {
          if (stamp === epoch) notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      async function remove() {
        var _a, _b, _c, _d;
        if (preview || busy.value || !canManage.value || !selected.value || ((_a = current.value) == null ? void 0 : _a.builtin))
          return;
        if (!window.confirm("确定删除角色「" + ((_b = current.value) == null ? void 0 : _b.name) + "」？")) return;
        const id = store.merchantId, uid = (_c = store.user) == null ? void 0 : _c.userId, stamp = epoch;
        busy.value = true;
        try {
          await api(prefix() + "/roles/" + pathId(selected.value), { method: "DELETE" });
          if (stamp !== epoch || id !== store.merchantId || uid !== ((_d = store.user) == null ? void 0 : _d.userId)) return;
          notify("角色已删除");
          await load();
        } catch (e) {
          if (stamp === epoch) notify(e.message);
        } finally {
          busy.value = false;
        }
      }
      onMounted$1(load);
      onUnmounted$1(() => ++epoch);
      watch$1([() => store.merchantId, () => {
        var _a;
        return (_a = store.user) == null ? void 0 : _a.userId;
      }, canManage], load);
      return {
        store,
        roles,
        permissions,
        selected,
        name,
        grants,
        error,
        busy,
        loading,
        canManage,
        current,
        assigned,
        choose,
        create,
        checked,
        toggle,
        save,
        remove,
        preview
      };
    },
    render: (() => {
      const { resolveComponent: _resolveComponent, createVNode: _createVNode, createTextVNode: _createTextVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, createElementVNode: _createElementVNode, renderList: _renderList, Fragment: _Fragment, normalizeClass: _normalizeClass, vModelText: _vModelText, withDirectives: _withDirectives, createBlock: _createBlock, withModifiers: _withModifiers, withCtx: _withCtx } = Vue;
      return function render(_ctx, _cache) {
        const _component_Icon = _resolveComponent("Icon");
        const _component_BackofficeShell = _resolveComponent("BackofficeShell");
        return _openBlock(), _createBlock(_component_BackofficeShell, {
          role: "merchant",
          title: "角色权限"
        }, {
          actions: _withCtx(() => [
            _ctx.canManage ? (_openBlock(), _createElementBlock("button", {
              key: 0,
              class: "teal-button",
              onClick: _ctx.create,
              disabled: _ctx.preview || _ctx.busy
            }, [
              _createVNode(_component_Icon, {
                name: "plus",
                size: 16
              }),
              _createTextVNode("新增自定义角色")
            ], 8, ["onClick", "disabled"])) : _createCommentVNode("v-if", true)
          ]),
          default: _withCtx(() => {
            var _a, _b, _c;
            return [
              _ctx.error ? (_openBlock(), _createElementBlock(
                "div",
                {
                  key: 0,
                  class: "inline-error"
                },
                _toDisplayString(_ctx.error),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              !_ctx.canManage ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "ops-card access-denied"
              }, [
                _createVNode(_component_Icon, {
                  name: "shield",
                  size: 32
                }),
                _createElementVNode("h2", null, "无权管理角色")
              ])) : (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "ops-grid rbac-layout"
              }, [
                _createElementVNode("section", { class: "ops-card rbac-roles" }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode("h2", null, "商户角色"),
                    _createElementVNode(
                      "span",
                      null,
                      _toDisplayString(_ctx.roles.length) + " 个 · " + _toDisplayString(_ctx.assigned) + " 名成员",
                      1
                      /* TEXT */
                    )
                  ]),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(_ctx.roles, (r) => {
                      return _openBlock(), _createElementBlock("button", {
                        key: r.code,
                        class: _normalizeClass(["rbac-role", { active: _ctx.selected === r.code }]),
                        onClick: ($event) => _ctx.choose(r)
                      }, [
                        _createElementVNode("span", { class: "mini-icon" }, [
                          _createVNode(_component_Icon, {
                            name: r.builtin ? "shield" : "users",
                            size: 18
                          }, null, 8, ["name"])
                        ]),
                        _createElementVNode("span", null, [
                          _createElementVNode(
                            "strong",
                            null,
                            _toDisplayString(r.name),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "small",
                            null,
                            _toDisplayString(r.builtin ? "内置角色" : r.permissions.length + " 项权限"),
                            1
                            /* TEXT */
                          )
                        ]),
                        _createVNode(_component_Icon, {
                          name: "chevronRight",
                          size: 16
                        })
                      ], 10, ["onClick"]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  !_ctx.roles.length && !_ctx.loading ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "admin-empty"
                  }, "暂无角色")) : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("form", {
                  class: "ops-card rbac-editor",
                  onSubmit: _withModifiers(_ctx.save, ["prevent"])
                }, [
                  _createElementVNode("div", { class: "ops-card-header" }, [
                    _createElementVNode(
                      "h2",
                      null,
                      _toDisplayString(_ctx.selected ? "角色权限" : "创建新角色"),
                      1
                      /* TEXT */
                    ),
                    ((_a = _ctx.current) == null ? void 0 : _a.builtin) ? (_openBlock(), _createElementBlock("span", {
                      key: 0,
                      class: "status-tag"
                    }, "系统内置")) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("label", { class: "field-label" }, "角色名称"),
                  _withDirectives(_createElementVNode("input", {
                    class: "admin-input",
                    "onUpdate:modelValue": ($event) => _ctx.name = $event,
                    maxlength: "40",
                    required: "",
                    disabled: _ctx.preview || !!((_b = _ctx.current) == null ? void 0 : _b.builtin) || _ctx.busy,
                    placeholder: "例如：商品管理员"
                  }, null, 8, ["onUpdate:modelValue", "disabled"]), [
                    [
                      _vModelText,
                      _ctx.name,
                      void 0,
                      { trim: true }
                    ]
                  ]),
                  _createElementVNode("h3", { class: "field-heading" }, [
                    _createTextVNode("权限配置 "),
                    _createElementVNode(
                      "span",
                      { class: "rbac-grant-count" },
                      "已选 " + _toDisplayString(_ctx.grants.length) + " 项",
                      1
                      /* TEXT */
                    )
                  ]),
                  _createElementVNode("div", { class: "rbac-permissions" }, [
                    (_openBlock(true), _createElementBlock(
                      _Fragment,
                      null,
                      _renderList(_ctx.permissions, (p) => {
                        var _a2;
                        return _openBlock(), _createElementBlock("label", {
                          key: p.code,
                          "data-permission": p.code,
                          class: _normalizeClass(["rbac-permission", { protected: !p.grantable }])
                        }, [
                          _createElementVNode("input", {
                            type: "checkbox",
                            checked: _ctx.checked(p.code),
                            disabled: _ctx.preview || !!((_a2 = _ctx.current) == null ? void 0 : _a2.builtin) || !p.grantable || _ctx.busy,
                            onChange: ($event) => _ctx.toggle(p.code, $event.target.checked)
                          }, null, 40, ["checked", "disabled", "onChange"]),
                          _createElementVNode("span", null, [
                            _createElementVNode(
                              "strong",
                              null,
                              _toDisplayString(p.label),
                              1
                              /* TEXT */
                            )
                          ]),
                          !p.grantable ? (_openBlock(), _createBlock(_component_Icon, {
                            key: 0,
                            name: "lock",
                            size: 15,
                            title: "仅经营者"
                          })) : _createCommentVNode("v-if", true)
                        ], 10, ["data-permission"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]),
                  !((_c = _ctx.current) == null ? void 0 : _c.builtin) ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "form-buttons"
                  }, [
                    _ctx.selected ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      type: "button",
                      class: "outline-button",
                      disabled: _ctx.preview || _ctx.busy,
                      onClick: _ctx.remove
                    }, "删除角色", 8, ["disabled", "onClick"])) : _createCommentVNode("v-if", true),
                    _createElementVNode("button", {
                      type: "submit",
                      class: "teal-button",
                      disabled: _ctx.preview || _ctx.busy || !_ctx.grants.length || !_ctx.name.trim()
                    }, _toDisplayString(_ctx.busy ? "保存中" : "保存角色"), 9, ["disabled"])
                  ])) : _createCommentVNode("v-if", true)
                ], 40, ["onSubmit"])
              ]))
            ];
          }),
          _: 1
          /* STABLE */
        });
      };
    })()
  };
  const { createApp, onMounted, onUnmounted, watch, computed } = Vue;
  const App = {
    name: "CampusApp",
    components: {
      Home,
      Guide,
      Merchant,
      ProductDetail,
      Shop,
      Cart,
      Orders,
      Account,
      MerchantOps,
      Knowledge,
      Platform,
      RoleManager
    },
    setup() {
      const current = computed(() => {
        const r = store.route;
        if (r === "/merchant/products") return "Merchant";
        if (r === "/merchant/roles") return "RoleManager";
        if (r === "/merchant/knowledge" || r === "/admin/knowledge") return "Knowledge";
        if (r.startsWith("/merchant")) return "MerchantOps";
        if (r.startsWith("/admin")) return "Platform";
        if (r.startsWith("/product/")) return "ProductDetail";
        if (r.startsWith("/shops/")) return "Shop";
        if (r === "/cart") return "Cart";
        if (r === "/orders" || r.startsWith("/orders/")) return "Orders";
        if (["/account", "/apply", "/invitations"].includes(r)) return "Account";
        if (r === "/ai") return "Guide";
        return "Home";
      });
      async function refresh() {
        if (store.route.startsWith("/merchant")) await loadMerchant();
        else if (!store.route.startsWith("/admin")) await loadPublic();
      }
      onMounted(() => {
        window.addEventListener("hashchange", setRoute);
        refresh();
        if (!preview && !store.route.startsWith("/merchant")) loadSession();
      });
      onUnmounted(() => window.removeEventListener("hashchange", setRoute));
      watch(() => store.route, refresh);
      return { store, current };
    },
    render: (() => {
      const { resolveDynamicComponent: _resolveDynamicComponent, openBlock: _openBlock, createBlock: _createBlock, toDisplayString: _toDisplayString, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, normalizeClass: _normalizeClass } = Vue;
      return function render(_ctx, _cache) {
        return _openBlock(), _createElementBlock(
          "div",
          {
            class: _normalizeClass(["application", { "admin-mode": _ctx.current === "Merchant" || _ctx.current === "MerchantOps" || _ctx.current === "Platform" || _ctx.current === "Knowledge" || _ctx.current === "RoleManager" }])
          },
          [
            (_openBlock(), _createBlock(_resolveDynamicComponent(_ctx.current), {
              key: _ctx.store.route
            })),
            _ctx.store.toast ? (_openBlock(), _createElementBlock(
              "div",
              {
                key: 0,
                class: "toast",
                role: "status"
              },
              _toDisplayString(_ctx.store.toast),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true)
          ],
          2
          /* CLASS */
        );
      };
    })()
  };
  const app = createApp(App);
  app.component("Icon", Icon);
  app.mount("#app");
})();
