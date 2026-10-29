package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.trading.adapter.repository.ICartRepository;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.CartItemPO;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;

import java.util.List;

/** 购物车仓储只持久化选购意向；共用的 MyBatis DAO 不承担业务决策。 */
@Repository
public class CartRepository implements ICartRepository {
    @Resource
    private ITradingDao dao;

    @Override
    public void lockCart(String user) {
        dao.ensureCart(user);
        dao.lockCart(user);
    }

    @Override
    public List<CartItemVO> cart(String user) {
        return dao.cart(user).stream().map(this::convert).toList();
    }

    @Override
    public CartItemVO cartItem(String user, String sku) {
        return convert(dao.cartItem(user, sku));
    }

    @Override
    public void setCart(String user, String merchant, String sku, int quantity) {
        dao.setCart(user, merchant, sku, quantity);
    }

    @Override
    public void deleteCart(String user, String sku) {
        dao.deleteCart(user, sku);
    }

    private CartItemVO convert(CartItemPO po) {
        return po == null ? null : new CartItemVO(
                po.getUserId(), po.getMerchantId(), po.getSkuId(), po.getQuantity());
    }
}
