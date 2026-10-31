package cn.bugstack.ai.domain.fulfillment.service;

import cn.bugstack.ai.domain.fulfillment.model.valobj.*;
import java.util.*;

/** 履约公开能力。跨订单/库存的原子协作交给用例层。 */
public interface IFulfillmentService {
  List<PickupVO> pickupsByOrders(List<String> orders);
  void create(String order, String merchant, String store, String buyer);
  PickupVO pickup(String order, boolean lock);
  void prepare(String order, boolean ready);
  PickupTokenVO issue(String order);
  boolean verify(String order, String token, String actor);
  void cancel(String order);
  List<PickupVO> list(String merchant, String status, int page, int size);
}
