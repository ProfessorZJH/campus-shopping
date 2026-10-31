package cn.bugstack.ai.domain.trading.adapter.repository;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IAfterSaleRepository {
  List<AfterSaleVO> afterSalesByOrders(List<String> orders);
  long countAfterSales(String buyer, String merchant, String status);
  AfterSaleVO afterSale(String order, boolean lock);
  void insertAfterSale(AfterSaleVO afterSale);
  void saveAfterSale(String id, String status, String reason);
  List<AfterSaleVO> afterSales(String buyer, String merchant, String status, int offset, int size);
}
