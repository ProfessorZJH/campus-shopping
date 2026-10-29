package cn.bugstack.ai.cases.trading.impl;

import cn.bugstack.ai.cases.trading.ICartCase;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import cn.bugstack.ai.domain.trading.service.ICartService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 购物车用例：先确认账号、商品与商户资格，再修改用户购物车。
 * 购物车并不锁定报价、不预占库存；结算时仍要重新校验。
 */
@Service
public class CartCaseImpl implements ICartCase {
    private final ICartService cart;
    private final ICatalogService catalog;
    private final IMerchantService merchants;
    private final IUserAccountService accounts;

    public CartCaseImpl(ICartService cart, ICatalogService catalog,
                        IMerchantService merchants, IUserAccountService accounts) {
        this.cart = cart;
        this.catalog = catalog;
        this.merchants = merchants;
        this.accounts = accounts;
    }

    @Override
    public List<CartItemVO> list(String user) {
        accounts.requireActive(user);
        return cart.cart(user);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void set(String user, String sku, int quantity) {
        accounts.requireActive(user);
        cart.lockCart(user);
        var hint = catalog.offers(List.of(sku), true, false).get(0);
        merchants.requireActiveForNewTrade(hint.merchantId());
        var offer = catalog.offers(List.of(sku), true, true).get(0);
        cart.setCart(user, offer.merchantId(), sku, quantity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(String user, String sku) {
        accounts.requireActive(user);
        cart.lockCart(user);
        cart.deleteCart(user, sku);
    }
}
