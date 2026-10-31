package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface ICartService {
  void lockCart(String user);
  List<CartItemVO> cart(String user);
  void setCart(String user, String merchant, String sku, int quantity);
  void addCart(String user, String merchant, String sku, int quantity);
  void deleteCart(String user, String sku);
  void consumeCart(String user, List<OrderItemEntity> items);
}
