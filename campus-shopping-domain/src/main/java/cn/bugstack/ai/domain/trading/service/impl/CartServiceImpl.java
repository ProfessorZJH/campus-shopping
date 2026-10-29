package cn.bugstack.ai.domain.trading.service.impl;

import cn.bugstack.ai.domain.trading.adapter.repository.ICartRepository;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/** 购物车领域服务：管理用户选购意向，不预占库存，也不修改订单。 */
@Service
public class CartServiceImpl implements ICartService {
    private final ICartRepository repository;

    public CartServiceImpl(ICartRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void lockCart(String user) {
        repository.lockCart(user);
    }

    @Override
    public List<CartItemVO> cart(String user) {
        return repository.cart(user);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void setCart(String user, String merchant, String sku, int quantity) {
        repository.lockCart(user);
        require(quantity > 0 && quantity <= 99, ResponseCode.ILLEGAL_PARAMETER);
        CartItemVO existing = repository.cartItem(user, sku);
        require(existing != null || repository.cart(user).size() < 100, ResponseCode.ILLEGAL_PARAMETER);
        repository.setCart(user, merchant, sku, quantity);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void addCart(String user, String merchant, String sku, int quantity) {
        repository.lockCart(user);
        require(quantity > 0 && quantity <= 99, ResponseCode.ILLEGAL_PARAMETER);
        CartItemVO existing = repository.cartItem(user, sku);
        int total = quantity + (existing == null ? 0 : existing.quantity());
        require(total <= 99, ResponseCode.ILLEGAL_PARAMETER);
        require(existing != null || repository.cart(user).size() < 100, ResponseCode.ILLEGAL_PARAMETER);
        repository.setCart(user, merchant, sku, total);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void deleteCart(String user, String sku) {
        repository.lockCart(user);
        repository.deleteCart(user, text(sku, "SKU", 64));
    }

    /** 下单成功后，按 SKU 稳定顺序清理已经购买的数量，不清空整个用户购物车。 */
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void consumeCart(String user, List<OrderItemEntity> items) {
        repository.lockCart(user);
        for (OrderItemEntity item : items.stream().sorted(Comparator.comparing(OrderItemEntity::skuId)).toList()) {
            CartItemVO existing = repository.cartItem(user, item.skuId());
            if (existing == null) {
                continue;
            }
            if (existing.quantity() <= item.quantity()) {
                repository.deleteCart(user, item.skuId());
            } else {
                repository.setCart(user, existing.merchantId(), item.skuId(),
                        existing.quantity() - item.quantity());
            }
        }
    }
}
