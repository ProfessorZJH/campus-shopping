package cn.bugstack.ai.cases.trading;

import cn.bugstack.ai.domain.trading.model.valobj.CartItemVO;
import java.util.*;

/** 购物车写入需要商品可售状态与商户资格校验。 */
public interface ICartCase {
  List<CartItemVO> list(String user);
  void set(String user, String sku, int quantity);
  void delete(String user, String sku);
}
