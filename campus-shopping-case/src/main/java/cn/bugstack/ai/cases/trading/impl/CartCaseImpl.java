package cn.bugstack.ai.cases.trading.impl;

import cn.bugstack.ai.cases.trading.ICartCase;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 加购物车不预占库存；下单才核价并原子预占。 */
@Service
public class CartCaseImpl implements ICartCase {

    private final ICartService trading;
    private final ICatalogService catalog;
    private final IMerchantService merchants;
    private final IUserAccountService accounts;
    private final IInventoryService inventory;

    public CartCaseImpl(ICartService trading, ICatalogService catalog, IMerchantService merchants, IUserAccountService accounts, IInventoryService inventory) {
        this.trading = trading;
        this.catalog = catalog;
        this.merchants = merchants;
        this.accounts = accounts;
        this.inventory = inventory;
    }

    public List<CartItemVO> list(String user) {
        accounts.requireActive(user);
        return trading.cart(user);
    }

    @Transactional(rollbackFor = Exception.class)
    public void set(String user, String sku, int quantity) {
        accounts.requireActive(user);
        String checked = Checks.text(sku, "SKU", 64);
        Checks.require(quantity > 0 && quantity <= 99, ResponseCode.ILLEGAL_PARAMETER);
        trading.lockCart(user);
        // 当前读复用购物车行锁；缺货、下架和停业后仍允许减少原数量。
        var old = trading.cartItemForUpdate(user, checked);
        if (old != null && quantity <= old.quantity()) {
            trading.setCart(user, old.merchantId(), checked, quantity);
            return;
        }
        var hint = catalog.saleOffers(List.of(checked)).get(0);
        merchants.requireActiveForNewTrade(hint.merchantId());
        var offer = catalog.saleOffersForUpdate(List.of(checked)).get(0);
        var stocks = inventory.stocksForConfirmation(List.of(checked));
        Checks.require(stocks.size() <= 1, ResponseCode.STOCK_STATE_INVALID);
        Checks.require(!stocks.isEmpty() && stocks.get(0).onHand() - stocks.get(0).reserved() >= quantity, ResponseCode.STOCK_NOT_ENOUGH);
        trading.setCart(user, offer.merchantId(), checked, quantity);
    }

    @Transactional(rollbackFor = Exception.class)
    public void add(String user, String sku, int quantity) {
        accounts.requireActive(user);
        String checked = Checks.text(sku, "SKU", 64);
        Checks.require(quantity > 0 && quantity <= 99, ResponseCode.ILLEGAL_PARAMETER);
        trading.lockCart(user);
        var hint = catalog.saleOffers(List.of(checked)).get(0);
        merchants.requireActiveForNewTrade(hint.merchantId());
        var offer = catalog.saleOffersForUpdate(List.of(checked)).get(0);
        var stocks = inventory.stocksForConfirmation(List.of(checked));
        // 与 AI 确认共用锁内累计能力；并发标签页不能用旧快照覆盖其他请求的增量。
        int total = trading.addCart(user, offer.merchantId(), checked, quantity);
        Checks.require(stocks.size() <= 1, ResponseCode.STOCK_STATE_INVALID);
        Checks.require(!stocks.isEmpty() && stocks.get(0).onHand() - stocks.get(0).reserved() >= total, ResponseCode.STOCK_NOT_ENOUGH);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(String user, String sku) {
        accounts.requireActive(user);
        trading.lockCart(user);
        trading.deleteCart(user, sku);
    }
}
