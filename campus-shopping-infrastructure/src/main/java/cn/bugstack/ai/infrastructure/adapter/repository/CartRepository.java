package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.trading.adapter.repository.ICartRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class CartRepository implements ICartRepository {

    @Resource
    private ITradingDao dao;

    public void lockCart(String user) {
        dao.ensureCart(user);
        dao.lockCart(user);
    }

    public List<CartItemVO> cart(String user) {
        return dao.cart(user).stream().map(this::cartItem).toList();
    }

    public int cartSizeForUpdate(String user) {
        return dao.cartSkuIdsForUpdate(user).size();
    }

    public CartItemVO cartItem(String user, String sku) {
        return cartItem(dao.cartItem(user, sku));
    }

    public void setCart(String user, String merchant, String sku, int quantity) {
        dao.setCart(user, merchant, sku, quantity);
    }

    public void deleteCart(String user, String sku) {
        dao.deleteCart(user, sku);
    }

    private CartItemVO cartItem(CartItemPO p) {
        return p == null ? null : new CartItemVO(p.getUserId(), p.getMerchantId(), p.getSkuId(), p.getQuantity());
    }
}
