package cn.bugstack.ai.cases.trading;

import cn.bugstack.ai.cases.trading.model.CartItemReadModel;
import java.util.List;

/** 购物车读取的跨域编排，返回 HTTP 无关的完整快照。 */
public interface ICartQueryCase {
    List<CartItemReadModel> list(String actor);
}
