package cn.bugstack.ai.domain.trading.adapter.repository;

import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import java.util.List;

/** 本地购物车持久化抽象；不暴露订单和售后数据访问。 */
public interface ICartRepository {
    void lockCart(String user);
    List<CartItemVO> cart(String user);
    CartItemVO cartItem(String user, String sku);
    void setCart(String user, String merchant, String sku, int quantity);
    void deleteCart(String user, String sku);
}
