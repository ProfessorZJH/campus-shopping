/* 由 scripts/build-frontend.py 从中文界面模板生成，请勿手动编辑。 */
var _Vue = Vue;
window.CampusRender = function render(_ctx, _cache) {
  with (_ctx) {
    const { createElementVNode: _createElementVNode, createTextVNode: _createTextVNode, normalizeClass: _normalizeClass, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, toDisplayString: _toDisplayString, renderList: _renderList, Fragment: _Fragment, vModelSelect: _vModelSelect, withDirectives: _withDirectives, vModelText: _vModelText, withKeys: _withKeys, withModifiers: _withModifiers, vModelCheckbox: _vModelCheckbox } = _Vue

    return (_openBlock(), _createElementBlock("div", { class: "shell" }, [
      _createElementVNode("header", { class: "topbar" }, [_createElementVNode("button", {
        class: "brand",
        onClick: $event => (navigate('home')),
        "aria-label": "返回校园集市首页"
      }, [_createElementVNode("span", { class: "brand-mark" }, "校"), _createElementVNode("span", null, [_createTextVNode("校园集市"), _createElementVNode("small", null, "好物就在身边")])], 8, ["onClick"]), _createElementVNode("div", {
        class: "role-tabs",
        "aria-label": "工作台选择"
      }, [_createElementVNode("button", {
        class: _normalizeClass({active:s.role==='consumer'}),
        onClick: $event => (switchRole('consumer'))
      }, "校园购物", 10, ["onClick"]), hasMerchant
        ? (_openBlock(), _createElementBlock("button", {
            key: 0,
            class: _normalizeClass({active:s.role==='merchant'}),
            onClick: $event => (switchRole('merchant'))
          }, "商户中心", 10, ["onClick"]))
        : _createCommentVNode("", true), (s.workspace.platformAdmin)
        ? (_openBlock(), _createElementBlock("button", {
            key: 1,
            class: _normalizeClass({active:s.role==='admin'}),
            onClick: $event => (switchRole('admin'))
          }, "平台运营", 10, ["onClick"]))
        : _createCommentVNode("", true)]), _createElementVNode("div", { class: "top-actions" }, [(s.user)
        ? (_openBlock(), _createElementBlock("button", {
            key: 0,
            class: "icon-button",
            onClick: $event => (navigate('cart')),
            "aria-label": "打开购物车"
          }, [_createTextVNode("购物车 "), (s.cart.length)
            ? (_openBlock(), _createElementBlock("b", { key: 0 }, _toDisplayString(s.cart.length), 1))
            : _createCommentVNode("", true)], 8, ["onClick"]))
        : _createCommentVNode("", true), (!s.user)
        ? (_openBlock(), _createElementBlock("button", {
            key: 1,
            class: "primary compact",
            onClick: $event => (openAuth('login'))
          }, "登录 / 注册", 8, ["onClick"]))
        : (_openBlock(), _createElementBlock("div", {
            key: 2,
            class: "user-menu"
          }, [_createElementVNode("span", { class: "avatar" }, _toDisplayString(s.user.displayName?.slice(0,1)||'我'), 1), _createElementVNode("span", { class: "user-name" }, _toDisplayString(s.user.displayName), 1), _createElementVNode("button", {
            class: "text-button",
            onClick: logout
          }, "退出", 8, ["onClick"])]))])]),
      _createElementVNode("div", { class: "layout" }, [_createElementVNode("aside", { class: "sidebar" }, [
        _createElementVNode("div", { class: "workspace-label" }, _toDisplayString(s.role==='consumer'?'我的校园生活':s.role==='merchant'?'商户工作台':'平台管理工作台'), 1),
        (s.role==='merchant')
          ? (_openBlock(), _createElementBlock("label", {
              key: 0,
              class: "merchant-select"
            }, [_createElementVNode("span", null, "当前经营商户"), _withDirectives(_createElementVNode("select", {
              "onUpdate:modelValue": $event => ((s.merchantId) = $event),
              onChange: reload
            }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.workspace.merchants, (m) => {
              return (_openBlock(), _createElementBlock("option", { value: m.merchantId }, _toDisplayString(m.name) + _toDisplayString(m.status==='SUSPENDED'?'（暂停经营）':''), 9, ["value"]))
            }), 256))], 40, ["onUpdate:modelValue", "onChange"]), [[_vModelSelect, s.merchantId]])]))
          : _createCommentVNode("", true),
        _createElementVNode("nav", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(navigation, (n) => {
          return (_openBlock(), _createElementBlock("button", {
            key: n.id,
            class: _normalizeClass({selected:s.page===n.id}),
            onClick: $event => (navigate(n.id))
          }, [_createElementVNode("span", { class: "nav-icon" }, _toDisplayString(n.icon), 1), _createTextVNode(_toDisplayString(n.label), 1), (n.id==='cart'&&s.cart.length)
            ? (_openBlock(), _createElementBlock("span", {
                key: 0,
                class: "nav-count"
              }, _toDisplayString(s.cart.length), 1))
            : _createCommentVNode("", true)], 10, ["onClick"]))
        }), 128))]),
        _createElementVNode("div", { class: "sidebar-note" }, [_createElementVNode("span", { class: "status-dot" }), _createElementVNode("div", null, [_createTextVNode("校园自提 · 模拟交易"), _createElementVNode("small", null, "不扣真实资金，不自动付款")])])
      ]), _createElementVNode("main", {
        id: "main",
        class: "main",
        inert: s.loading || undefined
      }, [
        (s.page!=='home'&&s.page!=='chat')
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "page-heading"
            }, [_createElementVNode("div", null, [_createElementVNode("span", { class: "eyebrow" }, _toDisplayString(s.role==='consumer'?'我的校园':s.role==='merchant'?currentMerchant?.name:'运营管理'), 1), _createElementVNode("h1", null, _toDisplayString(pageTitle), 1)]), _createElementVNode("button", {
              class: "secondary compact",
              onClick: reload,
              disabled: s.loading
            }, "刷新", 8, ["onClick", "disabled"])]))
          : _createCommentVNode("", true),
        (s.loading)
          ? (_openBlock(), _createElementBlock("div", {
              key: 1,
              class: "loading-line",
              role: "progressbar",
              "aria-label": "正在加载数据"
            }))
          : _createCommentVNode("", true),
        (s.page==='home')
          ? (_openBlock(), _createElementBlock("section", {
              key: 2,
              class: "marketplace"
            }, [
              _createElementVNode("div", { class: "hero" }, [_createElementVNode("div", null, [
                _createElementVNode("span", { class: "eyebrow" }, "发现校园里的日常好物"),
                _createElementVNode("h1", null, [_createTextVNode("买点需要的，"), _createElementVNode("br"), _createElementVNode("em", null, "离生活近一点。")]),
                _createElementVNode("p", null, [_createTextVNode("校内商户统一逛，分店下单，到店自提。"), _createElementVNode("br"), _createTextVNode("拿不定主意？让智能导购帮你挑一挑。")]),
                _createElementVNode("button", {
                  class: "primary",
                  onClick: $event => (navigate('chat'))
                }, [_createTextVNode("问问智能导购 "), _createElementVNode("span", null, "↗")], 8, ["onClick"])
              ]), _createElementVNode("div", {
                class: "hero-art",
                "aria-hidden": "true"
              }, [
                _createElementVNode("div", { class: "art-circle" }),
                _createElementVNode("div", { class: "art-bag" }, [_createTextVNode("校"), _createElementVNode("span", null, "你的校园生活清单")]),
                _createElementVNode("div", { class: "art-note" }, "今天，也要好好生活。"),
                _createElementVNode("div", { class: "art-leaf" }, "✳")
              ])]),
              _createElementVNode("div", { class: "search-panel" }, [_createElementVNode("label", { class: "searchbox" }, [_createElementVNode("span", null, "⌕"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((s.query) = $event),
                placeholder: "搜索商品名称或用途，例如：文具、水果",
                onKeyup: _withKeys(searchProducts, ["enter"]),
                "aria-label": "搜索商品"
              }, null, 40, ["onUpdate:modelValue", "onKeyup"]), [[_vModelText, s.query]]), _createElementVNode("button", {
                class: "primary compact",
                onClick: searchProducts
              }, "搜索", 8, ["onClick"])]), _withDirectives(_createElementVNode("select", {
                "onUpdate:modelValue": $event => ((s.filterMerchant) = $event),
                onChange: searchProducts,
                "aria-label": "筛选商户"
              }, [_createElementVNode("option", { value: "" }, "全部商户"), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.publicMerchants, (m) => {
                return (_openBlock(), _createElementBlock("option", { value: m.merchantId }, _toDisplayString(m.name), 9, ["value"]))
              }), 256))], 40, ["onUpdate:modelValue", "onChange"]), [[_vModelSelect, s.filterMerchant]])]),
              _createElementVNode("div", {
                class: "chips",
                "aria-label": "商品分类"
              }, [_createElementVNode("button", {
                class: _normalizeClass({active:!s.category}),
                onClick: $event => (selectCategory(''))
              }, "全部好物", 10, ["onClick"]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.categories.filter(c=>c.active), (c) => {
                return (_openBlock(), _createElementBlock("button", {
                  class: _normalizeClass({active:s.category===c.code}),
                  onClick: $event => (selectCategory(c.code))
                }, _toDisplayString(c.name), 11, ["onClick"]))
              }), 256))]),
              _createElementVNode("div", { class: "section-heading" }, [_createElementVNode("h2", null, "校园精选"), _createElementVNode("span", null, "价格与库存以结算时校验为准")]),
              (!s.products.length&&!s.loading)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "empty"
                  }, [_createElementVNode("span", null, "⌕"), _createElementVNode("h3", null, "暂时没有找到相关商品"), _createElementVNode("p", null, "换个关键词，或等商户完成上架。")]))
                : _createCommentVNode("", true),
              _createElementVNode("div", { class: "product-grid" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.products, (product) => {
                return (_openBlock(), _createElementBlock("article", {
                  key: product.productId,
                  class: "product-card"
                }, [_createElementVNode("button", {
                  class: "product-visual",
                  onClick: $event => (openProduct(product))
                }, [(product.imageUrl)
                  ? (_openBlock(), _createElementBlock("img", {
                      key: 0,
                      src: product.imageUrl,
                      alt: product.title,
                      loading: "lazy"
                    }, null, 8, ["src", "alt"]))
                  : (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "product-placeholder",
                      "data-kind": product.categoryCode
                    }, [_createElementVNode("span", null, _toDisplayString(categoryIcon(product.categoryCode)), 1), _createElementVNode("small", null, _toDisplayString(categoryName(product.categoryCode)), 1)], 8, ["data-kind"])), _createElementVNode("span", { class: "pickup-label" }, "到店自提")], 8, ["onClick"]), _createElementVNode("div", { class: "product-info" }, [
                  _createElementVNode("span", { class: "shop-name" }, _toDisplayString(merchantName(product.merchantId)), 1),
                  _createElementVNode("button", {
                    class: "product-title",
                    onClick: $event => (openProduct(product))
                  }, _toDisplayString(product.title), 9, ["onClick"]),
                  _createElementVNode("div", { class: "product-meta" }, _toDisplayString(product.skus.length) + " 种规格 · " + _toDisplayString(availableTotal(product)>0?'有货可购':'暂时缺货'), 1),
                  _createElementVNode("div", { class: "product-bottom" }, [_createElementVNode("span", { class: "price" }, [_createTextVNode(_toDisplayString(money(minPrice(product))), 1), (product.skus.length>1)
                    ? (_openBlock(), _createElementBlock("small", { key: 0 }, "起"))
                    : _createCommentVNode("", true)]), _createElementVNode("button", {
                    class: "round-button",
                    onClick: $event => (openProduct(product)),
                    "aria-label": '查看'+product.title
                  }, "＋", 8, ["onClick", "aria-label"])])
                ])]))
              }), 128))]),
              _createElementVNode("div", { class: "pager" }, [_createElementVNode("button", {
                class: "secondary compact",
                disabled: s.pageNo===1,
                onClick: $event => (homePage(-1))
              }, "上一页", 8, ["disabled", "onClick"]), _createElementVNode("span", null, "第 " + _toDisplayString(s.pageNo) + " 页", 1), _createElementVNode("button", {
                class: "secondary compact",
                disabled: s.products.length<12,
                onClick: $event => (homePage(1))
              }, "下一页", 8, ["disabled", "onClick"])])
            ]))
          : _createCommentVNode("", true),
        (s.page==='cart')
          ? (_openBlock(), _createElementBlock("section", { key: 3 }, [_createElementVNode("div", { class: "notice" }, "每次结算一个商户；加入购物车不会预占库存。"), (!cartGroups.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "empty"
                }, [
                  _createElementVNode("span", null, "◯"),
                  _createElementVNode("h3", null, "购物车还是空的"),
                  _createElementVNode("p", null, "先去发现一些喜欢的商品吧。"),
                  _createElementVNode("button", {
                    class: "primary",
                    onClick: $event => (navigate('home'))
                  }, "去逛校园", 8, ["onClick"])
                ]))
              : _createCommentVNode("", true), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(cartGroups, (group) => {
              return (_openBlock(), _createElementBlock("article", { class: "panel cart-group" }, [_createElementVNode("div", { class: "section-heading" }, [_createElementVNode("h2", null, _toDisplayString(merchantName(group.merchantId)), 1), _createElementVNode("span", null, "到店自提")]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(group.items, (item) => {
                return (_openBlock(), _createElementBlock("div", { class: "cart-row" }, [
                  _createElementVNode("div", { class: "mini-product" }, _toDisplayString(item.title?.slice(0,1)||'物'), 1),
                  _createElementVNode("div", { class: "grow" }, [_createElementVNode("strong", null, _toDisplayString(item.title), 1), _createElementVNode("small", null, _toDisplayString(item.specKey), 1), (!item.sellable||item.available<item.quantity)
                    ? (_openBlock(), _createElementBlock("span", {
                        key: 0,
                        class: "bad"
                      }, "当前不可售或库存不足，请调整"))
                    : _createCommentVNode("", true)]),
                  _createElementVNode("span", { class: "price small" }, _toDisplayString(money(item.priceCent)), 1),
                  _createElementVNode("input", {
                    type: "number",
                    min: "1",
                    max: "99",
                    class: "quantity",
                    value: item.quantity,
                    onChange: $event => (updateCart(item,$event.target.value)),
                    "aria-label": item.title+'数量'
                  }, null, 40, ["value", "onChange", "aria-label"]),
                  _createElementVNode("button", {
                    class: "text-button danger",
                    onClick: $event => (removeCart(item))
                  }, "移除", 8, ["onClick"])
                ]))
              }), 256)), _createElementVNode("div", { class: "cart-footer" }, [_createElementVNode("span", null, [_createTextVNode("商品合计 "), _createElementVNode("b", { class: "price" }, _toDisplayString(money(group.total)), 1)]), _createElementVNode("button", {
                class: "primary",
                disabled: s.busy||group.items.some(i=>!i.sellable||i.available<i.quantity),
                onClick: $event => (checkout(group))
              }, "确认报价并下单", 8, ["disabled", "onClick"])])]))
            }), 256))]))
          : _createCommentVNode("", true),
        (['orders','merchantOrders','adminOrders'].includes(s.page))
          ? (_openBlock(), _createElementBlock("section", { key: 4 }, [
              _createElementVNode("div", { class: "chips" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(orderStates, (st) => {
                return (_openBlock(), _createElementBlock("button", {
                  class: _normalizeClass({active:s.filterState===st.value}),
                  onClick: $event => (filterOrders(st.value))
                }, _toDisplayString(st.label), 11, ["onClick"]))
              }), 256))]),
              (!s.orders.length&&!s.loading)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "empty"
                  }, [_createElementVNode("h3", null, "这里暂时没有订单"), _createElementVNode("p", null, "下单后的付款、备货和自提状态都会显示在这里。")]))
                : _createCommentVNode("", true),
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.orders, (o) => {
                return (_openBlock(), _createElementBlock("article", {
                  key: o.orderId,
                  class: "panel order-card"
                }, [_createElementVNode("div", { class: "order-head" }, [_createElementVNode("span", null, [_createTextVNode(_toDisplayString(merchantName(o.merchantId)) + " ", 1), _createElementVNode("small", null, "订单 " + _toDisplayString(shortId(o.orderId)), 1)]), _createElementVNode("span", { class: _normalizeClass(["badge", statusClass(o.status)]) }, _toDisplayString(statusName(o.status)), 3)]), _createElementVNode("div", { class: "order-items" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(o.items, (i) => {
                  return (_openBlock(), _createElementBlock("div", null, [_createElementVNode("strong", null, _toDisplayString(i.title), 1), _createElementVNode("span", null, _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity), 1), _createElementVNode("span", null, _toDisplayString(money(i.unitPriceCent*i.quantity)), 1)]))
                }), 256))]), _createElementVNode("div", { class: "order-footer" }, [_createElementVNode("small", null, [_createTextVNode(_toDisplayString(time(o.createdAt)) + " ", 1), (o.pickup)
                  ? (_openBlock(), _createElementBlock("span", { key: 0 }, "· " + _toDisplayString(statusName(o.pickup.status)), 1))
                  : _createCommentVNode("", true)]), _createElementVNode("div", null, [
                  _createElementVNode("b", null, _toDisplayString(money(o.totalCent)), 1),
                  _createElementVNode("button", {
                    class: "secondary compact",
                    onClick: $event => (showOrder(o))
                  }, "查看详情", 8, ["onClick"]),
                  (s.page==='orders'&&o.status==='PENDING_PAYMENT')
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "primary compact",
                        disabled: s.busy,
                        onClick: $event => (pay(o))
                      }, "模拟付款", 8, ["disabled", "onClick"]))
                    : _createCommentVNode("", true),
                  (s.page==='merchantOrders'&&o.status==='PAID'&&o.pickup?.status==='WAIT_PREP')
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 1,
                        class: "primary compact",
                        onClick: $event => (prepare(o,false))
                      }, "开始备货", 8, ["onClick"]))
                    : _createCommentVNode("", true),
                  (s.page==='merchantOrders'&&o.status==='PAID'&&['WAIT_PREP','PREPARING'].includes(o.pickup?.status))
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 2,
                        class: "primary compact",
                        onClick: $event => (prepare(o,true))
                      }, "备货完成", 8, ["onClick"]))
                    : _createCommentVNode("", true),
                  (s.page==='merchantOrders'&&o.pickup?.status==='READY')
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 3,
                        class: "primary compact",
                        onClick: $event => (openVerify(o))
                      }, "核销自提", 8, ["onClick"]))
                    : _createCommentVNode("", true)
                ])])]))
              }), 128)),
              _createElementVNode("div", { class: "pager" }, [_createElementVNode("button", {
                class: "secondary compact",
                disabled: s.listPage===1,
                onClick: $event => (listPage(-1))
              }, "上一页", 8, ["disabled", "onClick"]), _createElementVNode("span", null, "第 " + _toDisplayString(s.listPage) + " 页", 1), _createElementVNode("button", {
                class: "secondary compact",
                disabled: s.orders.length<20,
                onClick: $event => (listPage(1))
              }, "下一页", 8, ["disabled", "onClick"])])
            ]))
          : _createCommentVNode("", true),
        (s.page==='apply')
          ? (_openBlock(), _createElementBlock("section", {
              key: 5,
              class: "two-column"
            }, [_createElementVNode("form", {
              class: "panel form-panel",
              onSubmit: _withModifiers(submitApplication, ["prevent"])
            }, [
              _createElementVNode("span", { class: "eyebrow" }, "成为校园经营者"),
              _createElementVNode("h2", null, "申请商户入驻"),
              _createElementVNode("p", { class: "muted" }, "平台审核通过后，为你开通商户、首个门店和经营者权限。"),
              _createElementVNode("label", null, [_createTextVNode("商户名称"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((s.application.merchantName) = $event),
                maxlength: "100",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.application.merchantName]])]),
              _createElementVNode("label", null, [_createTextVNode("经营品类"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((s.application.category) = $event),
                maxlength: "50",
                placeholder: "例如：校园文具、便利零售",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.application.category]])]),
              _createElementVNode("div", { class: "form-row" }, [_createElementVNode("label", null, [_createTextVNode("联系人"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((s.application.contactName) = $event),
                maxlength: "50",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.application.contactName]])]), _createElementVNode("label", null, [_createTextVNode("联系电话"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((s.application.contactPhone) = $event),
                maxlength: "30",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.application.contactPhone]])])]),
              _createElementVNode("label", null, [_createTextVNode("门店名称"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((s.application.storeName) = $event),
                maxlength: "100",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.application.storeName]])]),
              _createElementVNode("label", null, [_createTextVNode("自提地址"), _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((s.application.location) = $event),
                maxlength: "200",
                placeholder: "校区、楼栋与具体门店位置",
                required: ""
              }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.application.location]])]),
              _createElementVNode("button", {
                class: "primary",
                disabled: s.busy
              }, "提交入驻申请", 8, ["disabled"])
            ], 40, ["onSubmit"]), _createElementVNode("div", null, [
              _createElementVNode("h2", null, "我的申请"),
              (!s.applications.length)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "panel muted"
                  }, "提交后可在这里查看审核进度。"))
                : _createCommentVNode("", true),
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.applications, (a) => {
                return (_openBlock(), _createElementBlock("article", {
                  key: a.applicationId,
                  class: "panel admission-card"
                }, [
                  _createElementVNode("div", { class: "section-heading" }, [_createElementVNode("strong", null, _toDisplayString(a.merchantName), 1), _createElementVNode("span", { class: _normalizeClass(["badge", statusClass(a.status)]) }, _toDisplayString(statusName(a.status)), 3)]),
                  _createElementVNode("p", null, _toDisplayString(a.storeName) + " · " + _toDisplayString(a.location), 1),
                  (a.rejectionReason)
                    ? (_openBlock(), _createElementBlock("p", {
                        key: 0,
                        class: "bad"
                      }, "驳回原因：" + _toDisplayString(a.rejectionReason), 1))
                    : _createCommentVNode("", true),
                  (a.status==='APPROVED')
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 1,
                        class: "text-button",
                        onClick: refreshAccess
                      }, "刷新商户权限 →", 8, ["onClick"]))
                    : _createCommentVNode("", true)
                ]))
              }), 128)),
              (s.invitations.length)
                ? (_openBlock(), _createElementBlock("div", { key: 1 }, [_createElementVNode("h2", null, "收到的店员邀请"), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.invitations, (i) => {
                    return (_openBlock(), _createElementBlock("article", { class: "panel" }, [_createElementVNode("p", null, "商户 " + _toDisplayString(merchantName(i.merchantId)) + " 邀请你加入", 1), _createElementVNode("small", null, _toDisplayString(statusName(i.status)) + " · 截止 " + _toDisplayString(time(i.expiresAt)), 1), (i.status==='PENDING')
                      ? (_openBlock(), _createElementBlock("button", {
                          key: 0,
                          class: "primary compact",
                          onClick: $event => (acceptInvite(i))
                        }, "接受邀请", 8, ["onClick"]))
                      : _createCommentVNode("", true)]))
                  }), 256))]))
                : _createCommentVNode("", true)
            ])]))
          : _createCommentVNode("", true),
        (s.page==='overview')
          ? (_openBlock(), _createElementBlock("section", { key: 6 }, [_createElementVNode("div", { class: "stat-grid" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(statCards, (card) => {
              return (_openBlock(), _createElementBlock("article", { class: "stat-card" }, [_createElementVNode("span", null, _toDisplayString(card.label), 1), _createElementVNode("strong", null, _toDisplayString(card.value), 1), _createElementVNode("small", null, _toDisplayString(card.note), 1)]))
            }), 256))]), _createElementVNode("div", { class: "panel intro-panel" }, [
              _createElementVNode("h2", null, _toDisplayString(s.role==='admin'?'让每一笔校园交易有序进行':'欢迎回到商户中心'), 1),
              _createElementVNode("p", null, _toDisplayString(s.role==='admin'?'审核商户、维护类目、处理争议，所有关键操作都会留下审计记录。':'先上架商品并补货，然后在订单管理中备货与核销；平台停用商户时仍保留历史订单的受控履约。'), 1),
              (currentMerchant&&s.role==='merchant')
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "merchant-profile"
                  }, [_createElementVNode("strong", null, _toDisplayString(currentMerchant.name), 1), _createElementVNode("span", null, _toDisplayString(currentMerchant.storeName) + " · " + _toDisplayString(currentMerchant.location), 1), _createElementVNode("span", { class: _normalizeClass(["badge", statusClass(currentMerchant.status)]) }, _toDisplayString(statusName(currentMerchant.status)), 3)]))
                : _createCommentVNode("", true),
              _createElementVNode("div", { class: "notice" }, "本项目使用模拟支付和模拟退款，统计不是实际收入或清结算金额。")
            ])]))
          : _createCommentVNode("", true),
        (s.page==='products')
          ? (_openBlock(), _createElementBlock("section", { key: 7 }, [_createElementVNode("div", { class: "section-heading" }, [_createElementVNode("span", { class: "muted" }, "商品、售价和规格属于当前商户"), isOwner
              ? (_openBlock(), _createElementBlock("button", {
                  key: 0,
                  class: "primary compact",
                  onClick: $event => (openProductEditor())
                }, "＋ 新建商品", 8, ["onClick"]))
              : _createCommentVNode("", true)]), _createElementVNode("div", { class: "table-panel" }, [_createElementVNode("table", null, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
              _createElementVNode("th", null, "商品"),
              _createElementVNode("th", null, "状态"),
              _createElementVNode("th", null, "规格与售价"),
              _createElementVNode("th", null, "操作")
            ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.managedProducts, (product) => {
              return (_openBlock(), _createElementBlock("tr", { key: product.productId }, [
                _createElementVNode("td", null, [_createElementVNode("strong", null, _toDisplayString(product.title), 1), _createElementVNode("small", null, _toDisplayString(categoryName(product.categoryCode)), 1)]),
                _createElementVNode("td", null, [_createElementVNode("span", { class: _normalizeClass(["badge", statusClass(product.status)]) }, _toDisplayString(statusName(product.status)), 3)]),
                _createElementVNode("td", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(product.skus, (sku) => {
                  return (_openBlock(), _createElementBlock("div", {
                    key: sku.skuId,
                    class: "sku-line"
                  }, [_createElementVNode("span", null, _toDisplayString(sku.specKey), 1), _createElementVNode("b", null, _toDisplayString(money(sku.priceCent)), 1), isOwner
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "text-button",
                        onClick: $event => (openPrice(product,sku))
                      }, "改价", 8, ["onClick"]))
                    : _createCommentVNode("", true)]))
                }), 128))]),
                _createElementVNode("td", { class: "actions" }, [isOwner
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "text-button",
                      onClick: $event => (openProductEditor(product))
                    }, "编辑", 8, ["onClick"]))
                  : _createCommentVNode("", true), isOwner
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 1,
                      class: "text-button",
                      onClick: $event => (openSku(product))
                    }, "加规格", 8, ["onClick"]))
                  : _createCommentVNode("", true), isOwner
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 2,
                      class: "text-button",
                      onClick: $event => (publish(product))
                    }, _toDisplayString(product.status==='PUBLISHED'?'下架':'上架'), 9, ["onClick"]))
                  : _createCommentVNode("", true)])
              ]))
            }), 128)), (!s.managedProducts.length)
              ? (_openBlock(), _createElementBlock("tr", { key: 0 }, [_createElementVNode("td", {
                  colspan: "4",
                  class: "empty-cell"
                }, "还没有商品，先创建一个吧。")]))
              : _createCommentVNode("", true)])])])]))
          : _createCommentVNode("", true),
        (s.page==='stock')
          ? (_openBlock(), _createElementBlock("section", { key: 8 }, [_createElementVNode("div", { class: "section-heading" }, [_createElementVNode("p", { class: "muted" }, "可售 = 实物 − 预占；库存修改通过带幂等键的补货操作。"), _createElementVNode("button", {
              class: "secondary compact",
              onClick: loadMovements
            }, "查看库存流水", 8, ["onClick"])]), _createElementVNode("div", { class: "table-panel" }, [_createElementVNode("table", null, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
              _createElementVNode("th", null, "商品 / 规格"),
              _createElementVNode("th", null, "实物"),
              _createElementVNode("th", null, "预占"),
              _createElementVNode("th", null, "可售"),
              _createElementVNode("th", null, "操作")
            ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.stocks, (stock) => {
              return (_openBlock(), _createElementBlock("tr", { key: stock.skuId }, [
                _createElementVNode("td", null, [_createElementVNode("strong", null, _toDisplayString(skuTitle(stock.skuId)), 1), _createElementVNode("small", null, _toDisplayString(shortId(stock.skuId)), 1)]),
                _createElementVNode("td", null, _toDisplayString(stock.onHand), 1),
                _createElementVNode("td", null, _toDisplayString(stock.reserved), 1),
                _createElementVNode("td", null, [_createElementVNode("span", { class: _normalizeClass(stock.available<=5?'bad':'good') }, _toDisplayString(stock.available), 3)]),
                _createElementVNode("td", null, [_createElementVNode("button", {
                  class: "secondary compact",
                  onClick: $event => (openReplenish(stock))
                }, "补货", 8, ["onClick"])])
              ]))
            }), 128)), (!s.stocks.length)
              ? (_openBlock(), _createElementBlock("tr", { key: 0 }, [_createElementVNode("td", {
                  colspan: "5",
                  class: "empty-cell"
                }, "创建商品规格后会自动出现对应库存。")]))
              : _createCommentVNode("", true)])])])]))
          : _createCommentVNode("", true),
        (s.page==='staff')
          ? (_openBlock(), _createElementBlock("section", { key: 9 }, [_createElementVNode("div", { class: "section-heading" }, [_createElementVNode("span", null, "权限仅对当前商户生效"), _createElementVNode("button", {
              class: "primary compact",
              onClick: openInvite
            }, "邀请店员", 8, ["onClick"])]), _createElementVNode("div", { class: "table-panel" }, [_createElementVNode("table", null, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
              _createElementVNode("th", null, "用户编号"),
              _createElementVNode("th", null, "角色"),
              _createElementVNode("th", null, "状态"),
              _createElementVNode("th", null, "操作")
            ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.members, (member) => {
              return (_openBlock(), _createElementBlock("tr", { key: member.userId }, [
                _createElementVNode("td", null, _toDisplayString(member.userId), 1),
                _createElementVNode("td", null, _toDisplayString(member.role==='OWNER'?'经营者':'店员'), 1),
                _createElementVNode("td", null, _toDisplayString(statusName(member.status)), 1),
                _createElementVNode("td", null, [(member.role==='CLERK'&&member.status==='ACTIVE')
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "text-button danger",
                      onClick: $event => (revokeMember(member))
                    }, "撤销授权", 8, ["onClick"]))
                  : _createCommentVNode("", true)])
              ]))
            }), 128))])])])]))
          : _createCommentVNode("", true),
        (s.page==='adminApplications')
          ? (_openBlock(), _createElementBlock("section", { key: 10 }, [_createElementVNode("div", { class: "chips" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(['', 'SUBMITTED','APPROVED','REJECTED'], (st) => {
              return (_openBlock(), _createElementBlock("button", {
                class: _normalizeClass({active:s.filterState===st}),
                onClick: $event => (filterOrders(st))
              }, _toDisplayString(st?statusName(st):'全部申请'), 11, ["onClick"]))
            }), 256))]), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.applications, (a) => {
              return (_openBlock(), _createElementBlock("article", {
                key: a.applicationId,
                class: "panel admission-card"
              }, [
                _createElementVNode("div", { class: "section-heading" }, [_createElementVNode("h2", null, _toDisplayString(a.merchantName), 1), _createElementVNode("span", { class: _normalizeClass(["badge", statusClass(a.status)]) }, _toDisplayString(statusName(a.status)), 3)]),
                _createElementVNode("div", { class: "detail-grid" }, [
                  _createElementVNode("span", null, [_createTextVNode("经营品类"), _createElementVNode("b", null, _toDisplayString(a.category||'历史资料不完整'), 1)]),
                  _createElementVNode("span", null, [_createTextVNode("联系人"), _createElementVNode("b", null, _toDisplayString(a.contactName||'未填写') + " " + _toDisplayString(a.contactPhone), 1)]),
                  _createElementVNode("span", null, [_createTextVNode("门店"), _createElementVNode("b", null, _toDisplayString(a.storeName||'未填写'), 1)]),
                  _createElementVNode("span", null, [_createTextVNode("地址"), _createElementVNode("b", null, _toDisplayString(a.location||'未填写'), 1)])
                ]),
                (a.rejectionReason)
                  ? (_openBlock(), _createElementBlock("p", {
                      key: 0,
                      class: "bad"
                    }, _toDisplayString(a.rejectionReason), 1))
                  : _createCommentVNode("", true),
                (a.status==='SUBMITTED')
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "button-row"
                    }, [_createElementVNode("button", {
                      class: "primary compact",
                      disabled: s.busy,
                      onClick: $event => (reviewApplication(a,true))
                    }, "通过并开通", 8, ["disabled", "onClick"]), _createElementVNode("button", {
                      class: "secondary compact",
                      onClick: $event => (reviewApplication(a,false))
                    }, "驳回申请", 8, ["onClick"])]))
                  : _createCommentVNode("", true)
              ]))
            }), 128)), (!s.applications.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "empty"
                }, [_createElementVNode("h3", null, "暂无申请")]))
              : _createCommentVNode("", true)]))
          : _createCommentVNode("", true),
        (s.page==='adminMerchants')
          ? (_openBlock(), _createElementBlock("section", { key: 11 }, [_createElementVNode("div", { class: "table-panel" }, [_createElementVNode("table", null, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
              _createElementVNode("th", null, "商户 / 门店"),
              _createElementVNode("th", null, "位置"),
              _createElementVNode("th", null, "状态"),
              _createElementVNode("th", null, "操作")
            ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.allMerchants, (m) => {
              return (_openBlock(), _createElementBlock("tr", { key: m.merchantId }, [
                _createElementVNode("td", null, [_createElementVNode("strong", null, _toDisplayString(m.name), 1), _createElementVNode("small", null, _toDisplayString(m.storeName) + " · " + _toDisplayString(m.category), 1)]),
                _createElementVNode("td", null, _toDisplayString(m.location), 1),
                _createElementVNode("td", null, [_createElementVNode("span", { class: _normalizeClass(["badge", statusClass(m.status)]) }, _toDisplayString(statusName(m.status)), 3)]),
                _createElementVNode("td", null, [_createElementVNode("button", {
                  class: "secondary compact",
                  onClick: $event => (changeMerchantState(m))
                }, _toDisplayString(m.status==='ACTIVE'?'暂停经营':'恢复经营'), 9, ["onClick"])])
              ]))
            }), 128))])])])]))
          : _createCommentVNode("", true),
        (s.page==='merchantProfile')
          ? (_openBlock(), _createElementBlock("section", { key: 12 }, [_createElementVNode("form", {
              class: "panel form-panel",
              onSubmit: _withModifiers(saveMerchantProfile, ["prevent"])
            }, [
              _createElementVNode("p", { class: "muted" }, "只修改展示和自提地点，不影响商户身份、已有订单或经营状态。"),
              _createElementVNode("label", null, [_createTextVNode("商户名称"), _withDirectives(_createElementVNode("input", {
                disabled: s.loading||s.busy,
                "onUpdate:modelValue": $event => ((s.merchantProfile.name) = $event),
                maxlength: "100",
                required: ""
              }, null, 8, ["disabled", "onUpdate:modelValue"]), [[_vModelText, s.merchantProfile.name]])]),
              _createElementVNode("label", null, [_createTextVNode("门店名称"), _withDirectives(_createElementVNode("input", {
                disabled: s.loading||s.busy,
                "onUpdate:modelValue": $event => ((s.merchantProfile.storeName) = $event),
                maxlength: "100",
                required: ""
              }, null, 8, ["disabled", "onUpdate:modelValue"]), [[_vModelText, s.merchantProfile.storeName]])]),
              _createElementVNode("label", null, [_createTextVNode("校园自提位置"), _withDirectives(_createElementVNode("input", {
                disabled: s.loading||s.busy,
                "onUpdate:modelValue": $event => ((s.merchantProfile.location) = $event),
                maxlength: "200",
                required: ""
              }, null, 8, ["disabled", "onUpdate:modelValue"]), [[_vModelText, s.merchantProfile.location]])]),
              _createElementVNode("button", {
                class: "primary",
                disabled: s.loading||s.busy
              }, "保存经营资料", 8, ["disabled"])
            ], 40, ["onSubmit"])]))
          : _createCommentVNode("", true),
        (s.page==='adminProducts')
          ? (_openBlock(), _createElementBlock("section", { key: 13 }, [_createElementVNode("div", { class: "notice" }, "平台只能监管下架，不借用商户身份修改商品售价或库存。"), _createElementVNode("div", { class: "table-panel" }, [_createElementVNode("table", null, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
              _createElementVNode("th", null, "商品"),
              _createElementVNode("th", null, "所属商户"),
              _createElementVNode("th", null, "状态"),
              _createElementVNode("th", null, "操作")
            ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.managedProducts, (p) => {
              return (_openBlock(), _createElementBlock("tr", { key: p.productId }, [
                _createElementVNode("td", null, [_createElementVNode("strong", null, _toDisplayString(p.title), 1), _createElementVNode("small", null, _toDisplayString(shortId(p.productId)), 1)]),
                _createElementVNode("td", null, _toDisplayString(merchantName(p.merchantId)), 1),
                _createElementVNode("td", null, [_createElementVNode("span", { class: _normalizeClass(["badge", statusClass(p.status)]) }, _toDisplayString(statusName(p.status)), 3)]),
                _createElementVNode("td", null, [(p.status==='PUBLISHED')
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      class: "text-button danger",
                      onClick: $event => (forceUnpublish(p))
                    }, "监管下架", 8, ["onClick"]))
                  : (_openBlock(), _createElementBlock("span", {
                      key: 1,
                      class: "muted"
                    }, "无需下架"))])
              ]))
            }), 128))])])]), _createElementVNode("div", { class: "pager" }, [_createElementVNode("button", {
              disabled: s.listPage<=1,
              onClick: $event => (listPage(-1))
            }, "上一页", 8, ["disabled", "onClick"]), _createElementVNode("span", null, "第 " + _toDisplayString(s.listPage) + " 页", 1), _createElementVNode("button", {
              disabled: s.managedProducts.length<20,
              onClick: $event => (listPage(1))
            }, "下一页", 8, ["disabled", "onClick"])])]))
          : _createCommentVNode("", true),
        (s.page==='adminCategories')
          ? (_openBlock(), _createElementBlock("section", { key: 14 }, [_createElementVNode("form", {
              class: "panel inline-form",
              onSubmit: _withModifiers(saveCategory, ["prevent"])
            }, [_createElementVNode("label", null, [_createTextVNode("类目编码"), _withDirectives(_createElementVNode("input", {
              "onUpdate:modelValue": $event => ((s.categoryForm.code) = $event),
              pattern: "[a-z0-9_-]+",
              maxlength: "32",
              required: ""
            }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.categoryForm.code]])]), _createElementVNode("label", null, [_createTextVNode("类目名称"), _withDirectives(_createElementVNode("input", {
              "onUpdate:modelValue": $event => ((s.categoryForm.name) = $event),
              maxlength: "50",
              required: ""
            }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.categoryForm.name]])]), _createElementVNode("button", {
              class: "primary compact",
              disabled: s.busy
            }, "新增或更新", 8, ["disabled"])], 40, ["onSubmit"]), _createElementVNode("div", { class: "table-panel" }, [_createElementVNode("table", null, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
              _createElementVNode("th", null, "编码"),
              _createElementVNode("th", null, "名称"),
              _createElementVNode("th", null, "状态"),
              _createElementVNode("th", null, "操作")
            ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.categories, (c) => {
              return (_openBlock(), _createElementBlock("tr", { key: c.code }, [
                _createElementVNode("td", null, _toDisplayString(c.code), 1),
                _createElementVNode("td", null, _toDisplayString(c.name), 1),
                _createElementVNode("td", null, _toDisplayString(c.active?'启用':'停用'), 1),
                _createElementVNode("td", null, [_createElementVNode("button", {
                  class: "text-button",
                  onClick: $event => (toggleCategory(c))
                }, _toDisplayString(c.active?'停用':'启用'), 9, ["onClick"])])
              ]))
            }), 128))])])])]))
          : _createCommentVNode("", true),
        (['merchantRefunds','adminRefunds'].includes(s.page))
          ? (_openBlock(), _createElementBlock("section", { key: 15 }, [_createElementVNode("div", { class: "notice" }, "退款只适用于已支付、尚未核销的订单。申请处理中不能核销，所有操作使用订单行锁防止竞争。"), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.afterSales, (a) => {
              return (_openBlock(), _createElementBlock("article", { class: "panel" }, [
                _createElementVNode("div", { class: "section-heading" }, [_createElementVNode("strong", null, "订单 " + _toDisplayString(shortId(a.orderId)), 1), _createElementVNode("span", { class: _normalizeClass(["badge", statusClass(a.status)]) }, _toDisplayString(statusName(a.status)), 3)]),
                _createElementVNode("p", null, "申请原因：" + _toDisplayString(a.reason), 1),
                (a.decisionReason)
                  ? (_openBlock(), _createElementBlock("p", { key: 0 }, "审核意见：" + _toDisplayString(a.decisionReason), 1))
                  : _createCommentVNode("", true),
                _createElementVNode("div", { class: "button-row" }, [_createElementVNode("button", {
                  class: "secondary compact",
                  onClick: $event => (showOrderById(a.orderId))
                }, "查看订单", 8, ["onClick"]), (a.status==='REQUESTED'||a.status==='DISPUTED'&&s.role==='admin')
                  ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [_createElementVNode("button", {
                      class: "primary compact",
                      onClick: $event => (decideRefund(a,true))
                    }, "同意全额模拟退款", 8, ["onClick"]), _createElementVNode("button", {
                      class: "secondary compact",
                      onClick: $event => (decideRefund(a,false))
                    }, "驳回", 8, ["onClick"])], 64))
                  : _createCommentVNode("", true)])
              ]))
            }), 256)), (!s.afterSales.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "empty"
                }, [_createElementVNode("h3", null, "暂无售后申请")]))
              : _createCommentVNode("", true)]))
          : _createCommentVNode("", true),
        (s.page==='knowledge')
          ? (_openBlock(), _createElementBlock("section", { key: 16 }, [_createElementVNode("div", { class: "section-heading" }, [_createElementVNode("span", { class: "muted" }, "先构建索引，再发布生效；撤回后立即停止检索。"), _createElementVNode("button", {
              class: "primary compact",
              onClick: openBase
            }, "＋ 新建知识库", 8, ["onClick"])]), _createElementVNode("div", { class: "knowledge-layout" }, [_createElementVNode("aside", { class: "panel knowledge-bases" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.bases, (b) => {
              return (_openBlock(), _createElementBlock("button", {
                key: b.id,
                class: _normalizeClass({selected:s.baseId===b.id}),
                onClick: $event => (selectBase(b.id))
              }, [_createElementVNode("strong", null, _toDisplayString(b.name), 1), _createElementVNode("small", null, _toDisplayString(visibilityName(b.visibility)), 1)], 10, ["onClick"]))
            }), 128)), (!s.bases.length)
              ? (_openBlock(), _createElementBlock("p", {
                  key: 0,
                  class: "muted"
                }, "暂无可管理的知识库"))
              : _createCommentVNode("", true)]), _createElementVNode("div", null, [(s.baseId)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "section-heading"
                }, [_createElementVNode("h2", null, _toDisplayString(currentBase?.name), 1), _createElementVNode("button", {
                  class: "secondary compact",
                  onClick: $event => (openDocument())
                }, "上传文档", 8, ["onClick"])]))
              : _createCommentVNode("", true), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.documents, (d) => {
              return (_openBlock(), _createElementBlock("article", {
                key: d.id,
                class: "panel document-card"
              }, [
                _createElementVNode("div", { class: "section-heading" }, [_createElementVNode("strong", null, [_createTextVNode(_toDisplayString(d.title) + " ", 1), _createElementVNode("small", null, "v" + _toDisplayString(d.version), 1)]), _createElementVNode("span", { class: _normalizeClass(["badge", statusClass(d.status)]) }, _toDisplayString(statusName(d.status)), 3)]),
                _createElementVNode("p", { class: "muted" }, "索引：" + _toDisplayString(statusName(d.indexStatus)) + " · " + _toDisplayString(time(d.createdAt)), 1),
                (d.error)
                  ? (_openBlock(), _createElementBlock("p", {
                      key: 0,
                      class: "bad"
                    }, _toDisplayString(d.error), 1))
                  : _createCommentVNode("", true),
                _createElementVNode("div", { class: "button-row" }, [
                  _createElementVNode("button", {
                    class: "text-button",
                    onClick: $event => (viewDocument(d))
                  }, "查看正文", 8, ["onClick"]),
                  _createElementVNode("button", {
                    class: "text-button",
                    onClick: $event => (openDocument(d))
                  }, "上传新版本", 8, ["onClick"]),
                  _createElementVNode("button", {
                    class: "text-button",
                    disabled: s.busy,
                    onClick: $event => (indexDocument(d))
                  }, "重建索引", 8, ["disabled", "onClick"]),
                  (d.indexStatus==='READY'&&d.status!=='PUBLISHED')
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "primary compact",
                        onClick: $event => (publishDocument(d))
                      }, "发布", 8, ["onClick"]))
                    : _createCommentVNode("", true),
                  (d.status==='PUBLISHED')
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 1,
                        class: "secondary compact",
                        onClick: $event => (withdrawDocument(d))
                      }, "撤回", 8, ["onClick"]))
                    : _createCommentVNode("", true)
                ])
              ]))
            }), 128)), (s.baseId&&!s.documents.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "empty"
                }, [_createElementVNode("h3", null, "知识库还是空的"), _createElementVNode("p", null, "支持 UTF-8 TXT、Markdown 和文本 PDF。")]))
              : _createCommentVNode("", true)])])]))
          : _createCommentVNode("", true),
        (s.page==='chat')
          ? (_openBlock(), _createElementBlock("section", {
              key: 17,
              class: "chat-layout"
            }, [_createElementVNode("aside", { class: "panel conversation-list" }, [_createElementVNode("div", { class: "section-heading" }, [_createElementVNode("h2", null, "智能导购"), _createElementVNode("button", {
              class: "round-button",
              onClick: newChat,
              "aria-label": "新建对话"
            }, "＋", 8, ["onClick"])]), _createElementVNode("p", { class: "muted small-text" }, "只检索你能访问的资料，确认后才加购。"), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.conversations, (c) => {
              return (_openBlock(), _createElementBlock("button", {
                key: c.id,
                class: _normalizeClass({selected:s.conversationId===c.id}),
                onClick: $event => (loadConversation(c.id))
              }, _toDisplayString(c.title), 11, ["onClick"]))
            }), 128))]), _createElementVNode("div", { class: "panel chat-panel" }, [
              _createElementVNode("div", { class: "chat-header" }, [_createElementVNode("div", null, [_createElementVNode("strong", null, "校园购物助手"), _createElementVNode("small", null, "真实商品 · 有据可查 · 操作需确认")]), (s.aiMode)
                ? (_openBlock(), _createElementBlock("span", {
                    key: 0,
                    class: "badge"
                  }, _toDisplayString(s.aiMode==='LLM'?'大语言模型 + 检索增强':s.aiMode==='LOCAL_RETRIEVAL_DEMO'?'本地检索演示 · 未使用大模型':s.aiMode==='LOCAL_FALLBACK'?'模型异常 · 本地检索降级':s.aiMode), 1))
                : _createCommentVNode("", true)]),
              _createElementVNode("div", {
                id: "chat-log",
                class: "chat-log"
              }, [
                (!s.messages.length)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "chat-welcome"
                    }, [
                      _createElementVNode("span", { class: "assistant-icon" }, "✳"),
                      _createElementVNode("h2", null, "说说你想买什么"),
                      _createElementVNode("p", null, [_createTextVNode("可以描述预算、品类和用途，我会先查商品和资料，"), _createElementVNode("br"), _createTextVNode("不会替你下单或付款。")]),
                      _createElementVNode("div", { class: "suggestions" }, [_createElementVNode("button", { onClick: $event => (askSuggestion('预算30元，想买一些考试用的文具')) }, "30元以内的考试文具", 8, ["onClick"]), _createElementVNode("button", { onClick: $event => (askSuggestion('未提货的订单可以申请退款吗？')) }, "了解自提和退款规则", 8, ["onClick"])])
                    ]))
                  : _createCommentVNode("", true),
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.messages, (m) => {
                  return (_openBlock(), _createElementBlock("div", {
                    key: m.id,
                    class: _normalizeClass(['message',m.role])
                  }, [_createElementVNode("span", { class: "message-avatar" }, _toDisplayString(m.role==='user'?'我':'✳'), 1), _createElementVNode("div", { class: "message-content" }, [_createElementVNode("p", null, _toDisplayString(m.content), 1), (m.warning)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "mode-warning"
                      }, _toDisplayString(m.warning), 1))
                    : _createCommentVNode("", true), (m.citations?.length)
                    ? (_openBlock(), _createElementBlock("details", {
                        key: 1,
                        class: "citations"
                      }, [_createElementVNode("summary", null, "参考 " + _toDisplayString(m.citations.length) + " 条资料", 1), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(m.citations, (c) => {
                        return (_openBlock(), _createElementBlock("div", null, [_createElementVNode("strong", null, _toDisplayString(c.title), 1), _createElementVNode("p", null, _toDisplayString(c.snippet), 1)]))
                      }), 256))]))
                    : _createCommentVNode("", true)])], 2))
                }), 128)),
                (s.chatBusy)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "message assistant"
                    }, [_createElementVNode("span", { class: "message-avatar" }, "✳"), _createElementVNode("div", { class: "message-content typing" }, "正在查询商品与已授权资料…")]))
                  : _createCommentVNode("", true),
                (s.chatError)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 2,
                      class: "notice bad"
                    }, _toDisplayString(s.chatError), 1))
                  : _createCommentVNode("", true),
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.proposals, (proposal) => {
                  return (_openBlock(), _createElementBlock("article", {
                    key: proposal.id,
                    class: "proposal-card"
                  }, [
                    _createElementVNode("div", { class: "section-heading" }, [_createElementVNode("h3", null, "加购建议"), _createElementVNode("span", { class: "badge" }, _toDisplayString(statusName(proposal.status)), 1)]),
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(proposal.items, (i) => {
                      return (_openBlock(), _createElementBlock("label", { class: "proposal-item" }, [_withDirectives(_createElementVNode("input", {
                        type: "checkbox",
                        value: i.skuId,
                        "onUpdate:modelValue": $event => ((s.proposalSelection[proposal.id]) = $event),
                        disabled: proposal.status!=='PENDING'
                      }, null, 8, ["value", "onUpdate:modelValue", "disabled"]), [[_vModelCheckbox, s.proposalSelection[proposal.id]]]), _createElementVNode("div", null, [_createElementVNode("strong", null, _toDisplayString(i.title), 1), _createElementVNode("small", null, _toDisplayString(i.specKey) + " × " + _toDisplayString(i.quantity) + " · " + _toDisplayString(merchantName(i.merchantId)), 1)]), _createElementVNode("b", null, _toDisplayString(money(i.priceCent*i.quantity)), 1)]))
                    }), 256)),
                    _createElementVNode("small", null, "有效期至 " + _toDisplayString(time(proposal.expiresAt)) + "；确认时重新校验价格与商品状态。", 1),
                    (proposal.status==='PENDING')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "button-row"
                        }, [_createElementVNode("button", {
                          class: "primary compact",
                          disabled: s.busy||!s.proposalSelection[proposal.id]?.length,
                          onClick: $event => (confirmProposal(proposal))
                        }, "确认加入购物车", 8, ["disabled", "onClick"]), _createElementVNode("button", {
                          class: "text-button",
                          onClick: $event => (rejectProposal(proposal))
                        }, "暂时不要", 8, ["onClick"])]))
                      : _createCommentVNode("", true)
                  ]))
                }), 128))
              ]),
              _createElementVNode("form", {
                class: "chat-composer",
                onSubmit: _withModifiers(sendChat, ["prevent"])
              }, [_withDirectives(_createElementVNode("textarea", {
                "onUpdate:modelValue": $event => ((s.question) = $event),
                placeholder: "例如：预算30元，想买适合考试的文具…",
                maxlength: "2000",
                onKeydown: _withKeys(_withModifiers(sendChat, ["exact","prevent"]), ["enter"]),
                "aria-label": "输入购物需求"
              }, null, 40, ["onUpdate:modelValue", "onKeydown"]), [[_vModelText, s.question]]), _createElementVNode("button", {
                class: "primary compact",
                disabled: s.chatBusy||!s.question.trim()
              }, "发送 ↑", 8, ["disabled"])], 40, ["onSubmit"]),
              _createElementVNode("p", { class: "chat-footnote" }, "推荐不是成交承诺，价格和库存以结算时校验为准。")
            ])]))
          : _createCommentVNode("", true)
      ], 8, ["inert"])]),
      _createElementVNode("div", {
        class: "toast-stack",
        "aria-live": "polite"
      }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.toasts, (t) => {
        return (_openBlock(), _createElementBlock("div", { class: _normalizeClass(['toast',t.type]) }, _toDisplayString(t.text), 3))
      }), 256))]),
      (s.modal)
        ? (_openBlock(), _createElementBlock("div", {
            key: 0,
            class: "modal-backdrop",
            onClick: _withModifiers(closeModal, ["self"])
          }, [_createElementVNode("section", {
            class: _normalizeClass(["modal", {'wide':s.modal==='productEdit'||s.modal==='order'}]),
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "modal-title"
          }, [
            _createElementVNode("header", { class: "modal-header" }, [_createElementVNode("h2", { id: "modal-title" }, _toDisplayString(modalTitle), 1), _createElementVNode("button", {
              class: "close-button",
              onClick: closeModal,
              "aria-label": "关闭弹窗"
            }, "×", 8, ["onClick"])]),
            (s.modal==='auth')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 0,
                  class: "form-panel",
                  onSubmit: _withModifiers(submitAuth, ["prevent"])
                }, [
                  _createElementVNode("div", { class: "chips" }, [_createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass({active:s.authMode==='login'}),
                    onClick: $event => (s.authMode='login')
                  }, "登录", 10, ["onClick"]), _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass({active:s.authMode==='register'}),
                    onClick: $event => (s.authMode='register')
                  }, "注册", 10, ["onClick"])]),
                  _createElementVNode("label", null, [_createTextVNode("用户名"), _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": $event => ((s.auth.username) = $event),
                    autocomplete: "username",
                    maxlength: "32",
                    required: "",
                    placeholder: "4–32位，字母开头"
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.auth.username]])]),
                  _createElementVNode("label", null, [_createTextVNode("密码"), _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": $event => ((s.auth.password) = $event),
                    type: "password",
                    autocomplete: s.authMode==='register'?'new-password':'current-password',
                    maxlength: "64",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue", "autocomplete"]), [[_vModelText, s.auth.password]])]),
                  (s.authMode==='register')
                    ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [_createElementVNode("label", null, [_createTextVNode("确认密码"), _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": $event => ((s.auth.confirmPassword) = $event),
                        type: "password",
                        autocomplete: "new-password",
                        maxlength: "64",
                        required: ""
                      }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.auth.confirmPassword]])]), _createElementVNode("label", null, [_createTextVNode("显示名称"), _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": $event => ((s.auth.displayName) = $event),
                        maxlength: "50",
                        required: ""
                      }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.auth.displayName]])]), _createElementVNode("p", { class: "muted small-text" }, "密码至少8位。注册只创建普通账号，不会自动开通商户或管理员权限。")], 64))
                    : _createCommentVNode("", true),
                  _createElementVNode("button", {
                    class: "primary full",
                    disabled: s.busy
                  }, _toDisplayString(s.authMode==='register'?'创建账号':'登录校园集市'), 9, ["disabled"])
                ], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='product'&&s.selectedProduct)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "product-detail"
                }, [
                  (s.selectedProduct.imageUrl)
                    ? (_openBlock(), _createElementBlock("img", {
                        key: 0,
                        src: s.selectedProduct.imageUrl,
                        alt: s.selectedProduct.title
                      }, null, 8, ["src", "alt"]))
                    : _createCommentVNode("", true),
                  _createElementVNode("span", { class: "shop-name" }, _toDisplayString(merchantName(s.selectedProduct.merchantId)), 1),
                  _createElementVNode("h3", null, _toDisplayString(s.selectedProduct.title), 1),
                  _createElementVNode("p", { class: "pre-wrap" }, _toDisplayString(s.selectedProduct.description||'商户暂未补充商品说明。'), 1),
                  _createElementVNode("label", null, [_createTextVNode("选择规格"), _withDirectives(_createElementVNode("select", { "onUpdate:modelValue": $event => ((s.selectedSku) = $event) }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.selectedProduct.skus.filter(i=>i.status==='ACTIVE'), (sku) => {
                    return (_openBlock(), _createElementBlock("option", { value: sku.skuId }, _toDisplayString(sku.specKey) + " · " + _toDisplayString(money(sku.priceCent)) + " · 可售" + _toDisplayString(sku.available), 9, ["value"]))
                  }), 256))], 8, ["onUpdate:modelValue"]), [[_vModelSelect, s.selectedSku]])]),
                  _createElementVNode("label", null, [_createTextVNode("数量"), _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": $event => ((s.buyQuantity) = $event),
                    class: "quantity",
                    type: "number",
                    min: "1",
                    max: "99"
                  }, null, 8, ["onUpdate:modelValue"]), [[
                    _vModelText,
                    s.buyQuantity,
                    void 0,
                    { number: true }
                  ]])]),
                  _createElementVNode("button", {
                    class: "primary full",
                    disabled: s.busy||!s.selectedSku,
                    onClick: addProductToCart
                  }, "加入购物车", 8, ["disabled", "onClick"])
                ]))
              : _createCommentVNode("", true),
            (s.modal==='productEdit')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 2,
                  class: "form-panel",
                  onSubmit: _withModifiers(saveProduct, ["prevent"])
                }, [
                  _createElementVNode("label", null, [_createTextVNode("商品名称"), _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": $event => ((s.productForm.title) = $event),
                    maxlength: "100",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.productForm.title]])]),
                  _createElementVNode("div", { class: "form-row" }, [_createElementVNode("label", null, [_createTextVNode("商品类目"), _withDirectives(_createElementVNode("select", {
                    "onUpdate:modelValue": $event => ((s.productForm.categoryCode) = $event),
                    required: ""
                  }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.categories.filter(c=>c.active), (c) => {
                    return (_openBlock(), _createElementBlock("option", { value: c.code }, _toDisplayString(c.name), 9, ["value"]))
                  }), 256))], 8, ["onUpdate:modelValue"]), [[_vModelSelect, s.productForm.categoryCode]])]), _createElementVNode("label", null, [_createTextVNode("商品图片"), _createElementVNode("input", {
                    type: "file",
                    accept: "image/png,image/jpeg,image/webp",
                    onChange: uploadProductImage
                  }, null, 40, ["onChange"]), _createElementVNode("small", null, "PNG/JPEG/WebP，最大2MB；上传后转为PNG。")])]),
                  (s.productForm.imageUrl)
                    ? (_openBlock(), _createElementBlock("img", {
                        key: 0,
                        src: s.productForm.imageUrl,
                        class: "image-preview",
                        alt: "商品图片预览"
                      }, null, 8, ["src"]))
                    : _createCommentVNode("", true),
                  _createElementVNode("label", null, [_createTextVNode("商品说明"), _withDirectives(_createElementVNode("textarea", {
                    "onUpdate:modelValue": $event => ((s.productForm.description) = $event),
                    rows: "4",
                    maxlength: "5000"
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.productForm.description]])]),
                  (!s.editingProduct)
                    ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [_createElementVNode("h3", null, "销售规格"), (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.productForm.skus, (sku, index) => {
                        return (_openBlock(), _createElementBlock("div", { class: "form-row sku-editor" }, [_createElementVNode("label", null, [_createTextVNode("规格名称"), _withDirectives(_createElementVNode("input", {
                          "onUpdate:modelValue": $event => ((sku.specKey) = $event),
                          required: "",
                          maxlength: "100",
                          placeholder: "例如：黑色 / 一盒"
                        }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, sku.specKey]])]), _createElementVNode("label", null, [_createTextVNode("售价（元）"), _withDirectives(_createElementVNode("input", {
                          "onUpdate:modelValue": $event => ((sku.price) = $event),
                          inputmode: "decimal",
                          required: "",
                          placeholder: "例如：12.50"
                        }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, sku.price]])]), (s.productForm.skus.length>1)
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 0,
                              type: "button",
                              class: "text-button danger",
                              onClick: $event => (s.productForm.skus.splice(index,1))
                            }, "移除", 8, ["onClick"]))
                          : _createCommentVNode("", true)]))
                      }), 256)), (s.productForm.skus.length<20)
                        ? (_openBlock(), _createElementBlock("button", {
                            key: 0,
                            type: "button",
                            class: "secondary compact",
                            onClick: $event => (s.productForm.skus.push({specKey:'',price:''}))
                          }, "＋ 添加规格", 8, ["onClick"]))
                        : _createCommentVNode("", true)], 64))
                    : _createCommentVNode("", true),
                  _createElementVNode("button", {
                    class: "primary full",
                    disabled: s.busy
                  }, "保存商品", 8, ["disabled"])
                ], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='price'||s.modal==='sku')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 3,
                  class: "form-panel",
                  onSubmit: _withModifiers(saveSku, ["prevent"])
                }, [
                  _createElementVNode("p", null, _toDisplayString(s.focusProduct?.title), 1),
                  _createElementVNode("label", null, [_createTextVNode("规格名称"), _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": $event => ((s.skuForm.specKey) = $event),
                    disabled: s.modal==='price',
                    required: "",
                    maxlength: "100"
                  }, null, 8, ["onUpdate:modelValue", "disabled"]), [[_vModelText, s.skuForm.specKey]])]),
                  _createElementVNode("label", null, [_createTextVNode("售价（元）"), _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": $event => ((s.skuForm.price) = $event),
                    inputmode: "decimal",
                    required: ""
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.skuForm.price]])]),
                  _createElementVNode("button", {
                    class: "primary full",
                    disabled: s.busy
                  }, "保存", 8, ["disabled"])
                ], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='replenish')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 4,
                  class: "form-panel",
                  onSubmit: _withModifiers(replenish, ["prevent"])
                }, [_createElementVNode("p", null, _toDisplayString(skuTitle(s.focusStock?.skuId)), 1), _createElementVNode("label", null, [_createTextVNode("补货数量"), _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": $event => ((s.replenishQuantity) = $event),
                  type: "number",
                  min: "1",
                  max: "1000000",
                  required: ""
                }, null, 8, ["onUpdate:modelValue"]), [[
                  _vModelText,
                  s.replenishQuantity,
                  void 0,
                  { number: true }
                ]])]), _createElementVNode("button", {
                  class: "primary full",
                  disabled: s.busy
                }, "确认补货", 8, ["disabled"])], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='movements')
              ? (_openBlock(), _createElementBlock("div", {
                  key: 5,
                  class: "table-panel"
                }, [_createElementVNode("table", null, [_createElementVNode("thead", null, [_createElementVNode("tr", null, [
                  _createElementVNode("th", null, "规格"),
                  _createElementVNode("th", null, "操作"),
                  _createElementVNode("th", null, "数量"),
                  _createElementVNode("th", null, "时间")
                ])]), _createElementVNode("tbody", null, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.movements, (m) => {
                  return (_openBlock(), _createElementBlock("tr", null, [
                    _createElementVNode("td", null, _toDisplayString(skuTitle(m.skuId)), 1),
                    _createElementVNode("td", null, _toDisplayString(statusName(m.type)), 1),
                    _createElementVNode("td", null, _toDisplayString(m.quantity), 1),
                    _createElementVNode("td", null, _toDisplayString(time(m.createdAt)), 1)
                  ]))
                }), 256))])])]))
              : _createCommentVNode("", true),
            (s.modal==='invite')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 6,
                  class: "form-panel",
                  onSubmit: _withModifiers(invite, ["prevent"])
                }, [_createElementVNode("label", null, [_createTextVNode("已注册用户名"), _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": $event => ((s.inviteUsername) = $event),
                  required: "",
                  maxlength: "32"
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.inviteUsername]])]), _createElementVNode("p", { class: "muted" }, "对方登录后需在“入驻与邀请”中接受，邀请24小时有效。"), _createElementVNode("button", {
                  class: "primary full",
                  disabled: s.busy
                }, "发送邀请", 8, ["disabled"])], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='order'&&s.focusOrder)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 7,
                  class: "order-detail"
                }, [
                  _createElementVNode("div", { class: "section-heading" }, [_createElementVNode("span", { class: _normalizeClass(["badge", statusClass(s.focusOrder.status)]) }, _toDisplayString(statusName(s.focusOrder.status)), 3), _createElementVNode("small", null, _toDisplayString(s.focusOrder.orderId), 1)]),
                  _createElementVNode("div", { class: "order-items" }, [(_openBlock(true), _createElementBlock(_Fragment, null, _renderList(s.focusOrder.items, (i) => {
                    return (_openBlock(), _createElementBlock("div", null, [_createElementVNode("strong", null, _toDisplayString(i.title), 1), _createElementVNode("span", null, _toDisplayString(i.specKey) + " ×" + _toDisplayString(i.quantity), 1), _createElementVNode("b", null, _toDisplayString(money(i.unitPriceCent*i.quantity)), 1)]))
                  }), 256))]),
                  _createElementVNode("div", { class: "detail-grid" }, [
                    _createElementVNode("span", null, [_createTextVNode("订单金额"), _createElementVNode("b", null, _toDisplayString(money(s.focusOrder.totalCent)), 1)]),
                    _createElementVNode("span", null, [_createTextVNode("下单时间"), _createElementVNode("b", null, _toDisplayString(time(s.focusOrder.createdAt)), 1)]),
                    _createElementVNode("span", null, [_createTextVNode("付款截止"), _createElementVNode("b", null, _toDisplayString(time(s.focusOrder.deadline)), 1)]),
                    _createElementVNode("span", null, [_createTextVNode("自提进度"), _createElementVNode("b", null, _toDisplayString(s.focusOrder.pickup?statusName(s.focusOrder.pickup.status):'等待付款'), 1)])
                  ]),
                  _createElementVNode("p", null, _toDisplayString(merchantLocation(s.focusOrder.merchantId)), 1),
                  (s.focusOrder.afterSale)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "notice"
                      }, [_createTextVNode("售后：" + _toDisplayString(statusName(s.focusOrder.afterSale.status)), 1), _createElementVNode("br"), _createTextVNode(_toDisplayString(s.focusOrder.afterSale.decisionReason||s.focusOrder.afterSale.reason), 1)]))
                    : _createCommentVNode("", true),
                  (s.focusOrder.buyerId===s.user?.userId)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "button-row"
                      }, [
                        (s.focusOrder.status==='PENDING_PAYMENT')
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 0,
                              class: "primary compact",
                              onClick: $event => (pay(s.focusOrder))
                            }, "模拟付款", 8, ["onClick"]))
                          : _createCommentVNode("", true),
                        (s.focusOrder.status==='PENDING_PAYMENT')
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 1,
                              class: "secondary compact",
                              onClick: $event => (cancelOrder(s.focusOrder))
                            }, "取消订单", 8, ["onClick"]))
                          : _createCommentVNode("", true),
                        (s.focusOrder.status==='PAID'&&s.focusOrder.pickup?.status==='READY'&&!['REQUESTED','DISPUTED','APPROVED'].includes(s.focusOrder.afterSale?.status))
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 2,
                              class: "primary compact",
                              onClick: $event => (pickupToken(s.focusOrder))
                            }, "领取自提凭证", 8, ["onClick"]))
                          : _createCommentVNode("", true),
                        (s.focusOrder.status==='PAID'&&!s.focusOrder.afterSale)
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 3,
                              class: "secondary compact",
                              onClick: $event => (requestRefund(s.focusOrder))
                            }, "申请退款", 8, ["onClick"]))
                          : _createCommentVNode("", true),
                        (s.focusOrder.status==='PAID'&&s.focusOrder.afterSale?.status==='REJECTED')
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 4,
                              class: "secondary compact",
                              onClick: $event => (appeal(s.focusOrder))
                            }, "申请平台介入", 8, ["onClick"]))
                          : _createCommentVNode("", true)
                      ]))
                    : _createCommentVNode("", true),
                  (s.pickupToken)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 2,
                        class: "token-panel"
                      }, [
                        _createElementVNode("strong", null, "向店员出示订单号和自提令牌"),
                        _createElementVNode("p", null, "有效期至 " + _toDisplayString(time(s.pickupToken.expiresAt)) + "；再次领取会使旧令牌失效。", 1),
                        _createElementVNode("code", null, _toDisplayString(s.pickupToken.token), 1),
                        _createElementVNode("button", {
                          class: "secondary compact",
                          onClick: copyToken
                        }, "复制令牌", 8, ["onClick"])
                      ]))
                    : _createCommentVNode("", true)
                ]))
              : _createCommentVNode("", true),
            (s.modal==='verify')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 8,
                  class: "form-panel",
                  onSubmit: _withModifiers(verifyPickup, ["prevent"])
                }, [_createElementVNode("p", null, "订单 " + _toDisplayString(shortId(s.focusOrder?.orderId)) + " · 需先核对实物商品", 1), _createElementVNode("label", null, [_createTextVNode("买家出示的自提令牌"), _withDirectives(_createElementVNode("textarea", {
                  "onUpdate:modelValue": $event => ((s.verifyToken) = $event),
                  rows: "3",
                  required: "",
                  maxlength: "200",
                  autocomplete: "off"
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.verifyToken]])]), _createElementVNode("button", {
                  class: "primary full",
                  disabled: s.busy
                }, "确认交付并核销", 8, ["disabled"])], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='reason')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 9,
                  class: "form-panel",
                  onSubmit: _withModifiers(submitReason, ["prevent"])
                }, [_createElementVNode("p", null, _toDisplayString(s.reasonPrompt), 1), _createElementVNode("label", null, [_createTextVNode("原因 / 说明"), _withDirectives(_createElementVNode("textarea", {
                  "onUpdate:modelValue": $event => ((s.reason) = $event),
                  maxlength: "500",
                  rows: "4",
                  required: ""
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.reason]])]), _createElementVNode("button", {
                  class: "primary full",
                  disabled: s.busy
                }, "确认提交", 8, ["disabled"])], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='base')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 10,
                  class: "form-panel",
                  onSubmit: _withModifiers(createBase, ["prevent"])
                }, [_createElementVNode("label", null, [_createTextVNode("知识库名称"), _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": $event => ((s.baseForm.name) = $event),
                  required: "",
                  maxlength: "100"
                }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.baseForm.name]])]), _createElementVNode("label", null, [_createTextVNode("可见范围"), _withDirectives(_createElementVNode("select", { "onUpdate:modelValue": $event => ((s.baseForm.visibility) = $event) }, [_createElementVNode("option", { value: "PUBLIC" }, "公开资料，可供消费者导购使用"), (s.role==='admin')
                  ? (_openBlock(), _createElementBlock("option", {
                      key: 0,
                      value: "PLATFORM_INTERNAL"
                    }, "仅平台内部"))
                  : (_openBlock(), _createElementBlock("option", {
                      key: 1,
                      value: "MERCHANT_INTERNAL"
                    }, "仅本商户成员"))], 8, ["onUpdate:modelValue"]), [[_vModelSelect, s.baseForm.visibility]])]), _createElementVNode("button", {
                  class: "primary full",
                  disabled: s.busy
                }, "创建知识库", 8, ["disabled"])], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='document')
              ? (_openBlock(), _createElementBlock("form", {
                  key: 11,
                  class: "form-panel",
                  onSubmit: _withModifiers(uploadDocument, ["prevent"])
                }, [
                  (s.documentForm.rootId)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "notice"
                      }, "创建新版本，不会立即覆盖当前已发布的知识。"))
                    : _createCommentVNode("", true),
                  _createElementVNode("label", null, [_createTextVNode("文档标题"), _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": $event => ((s.documentForm.title) = $event),
                    required: "",
                    maxlength: "120"
                  }, null, 8, ["onUpdate:modelValue"]), [[_vModelText, s.documentForm.title]])]),
                  _createElementVNode("label", null, [_createTextVNode("上传文件"), _createElementVNode("input", {
                    type: "file",
                    accept: ".txt,.md,.pdf",
                    onChange: selectDocumentFile
                  }, null, 40, ["onChange"]), _createElementVNode("small", null, "UTF-8文本或文本PDF；最大2MB，扫描件不做OCR。")]),
                  _createElementVNode("label", null, [_createTextVNode("或直接输入 Markdown"), _withDirectives(_createElementVNode("textarea", {
                    "onUpdate:modelValue": $event => ((s.documentForm.text) = $event),
                    rows: "6",
                    maxlength: "100000",
                    disabled: !!s.documentFile
                  }, null, 8, ["onUpdate:modelValue", "disabled"]), [[_vModelText, s.documentForm.text]])]),
                  _createElementVNode("button", {
                    class: "primary full",
                    disabled: s.busy
                  }, "保存并构建索引", 8, ["disabled"])
                ], 40, ["onSubmit"]))
              : _createCommentVNode("", true),
            (s.modal==='documentView')
              ? (_openBlock(), _createElementBlock("pre", {
                  key: 12,
                  class: "document-body"
                }, _toDisplayString(s.documentText), 1))
              : _createCommentVNode("", true)
          ], 2)], 8, ["onClick"]))
        : _createCommentVNode("", true)
    ]))
  }
};
