package cn.bugstack.ai.domain.trading.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.trading.adapter.repository.ICartRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.AfterSaleAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Cart 领域能力；跨领域事务由 Case 编排。 */
@Service
public class CartServiceImpl implements ICartService {

  private final ICartRepository repository;
  private final Clock clock;

  public CartServiceImpl(ICartRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void lockCart(String user) {
    repository.lockCart(user);
  }

  public List<CartItemVO> cart(String user) {
    return repository.cart(user);
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void setCart(String user, String merchant, String sku, int quantity) {
    repository.lockCart(user);
    require(quantity > 0 && quantity <= 99, ResponseCode.ILLEGAL_PARAMETER);
    CartItemVO old = repository.cartItem(user, sku);
    require(old != null || repository.cart(user).size() < 100, ResponseCode.CART_LINE_LIMIT);
    repository.setCart(user, merchant, sku, quantity);
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void addCart(String user, String merchant, String sku, int quantity) {
    repository.lockCart(user);
    require(quantity > 0 && quantity <= 99, ResponseCode.ILLEGAL_PARAMETER);
    CartItemVO old = repository.cartItem(user, sku);
    int total = quantity + (old == null ? 0 : old.quantity());
    require(total <= 99, ResponseCode.CART_QUANTITY_LIMIT);
    require(old != null || repository.cart(user).size() < 100, ResponseCode.CART_LINE_LIMIT);
    repository.setCart(user, merchant, sku, total);
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void deleteCart(String user, String sku) {
    repository.lockCart(user);
    repository.deleteCart(user, text(sku, "SKU", 64));
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void consumeCart(String user, List<OrderItemEntity> items) {
    repository.lockCart(user);
    for (OrderItemEntity i : items
      .stream()
      .sorted(Comparator.comparing(OrderItemEntity::skuId))
      .toList()) {
      CartItemVO old = repository.cartItem(user, i.skuId());
      if (old == null) continue;
      if (old.quantity() <= i.quantity()) repository.deleteCart(user, i.skuId());
      else repository.setCart(user, old.merchantId(), i.skuId(), old.quantity() - i.quantity());
    }
  }
}
