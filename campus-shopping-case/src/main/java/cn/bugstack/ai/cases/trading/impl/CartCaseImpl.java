package cn.bugstack.ai.cases.trading.impl;

import cn.bugstack.ai.cases.trading.ICartCase;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
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

  public CartCaseImpl(
    ICartService trading,
    ICatalogService catalog,
    IMerchantService merchants,
    IUserAccountService accounts
  ) {
    this.trading = trading;
    this.catalog = catalog;
    this.merchants = merchants;
    this.accounts = accounts;
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
    var hint = catalog.offers(List.of(checked), true, false).get(0);
    merchants.requireActiveForNewTrade(hint.merchantId());
    var offer = catalog.offers(List.of(checked), true, true).get(0);
    trading.setCart(user, offer.merchantId(), checked, quantity);
  }

  @Transactional(rollbackFor = Exception.class)
  public void delete(String user, String sku) {
    accounts.requireActive(user);
    trading.lockCart(user);
    trading.deleteCart(user, sku);
  }
}
