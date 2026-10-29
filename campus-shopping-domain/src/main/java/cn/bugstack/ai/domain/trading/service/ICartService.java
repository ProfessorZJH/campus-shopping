package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import java.util.List;

/** 购物车能力：修改用户选购意向，不负责预占库存或创建订单。 */
public interface ICartService {
    /** 参与下单前需先获取购物车行锁；锁由外层事务持有。 */
    void lockCart(String user);
    List<CartItemVO> cart(String user);
    void setCart(String user, String merchant, String sku, int quantity);
    void addCart(String user, String merchant, String sku, int quantity);
    void deleteCart(String user, String sku);
    /** 仅扣减本次成交的购物车行；其他商品和商户不受影响。 */
    void consumeCart(String user, List<OrderItemEntity> items);
}
