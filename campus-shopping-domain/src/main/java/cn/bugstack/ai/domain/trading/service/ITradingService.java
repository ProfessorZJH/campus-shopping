package cn.bugstack.ai.domain.trading.service;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.util.*;import java.time.*;
/** 交易领域的公开能力；需跨库存/履约的行为由用例层组合。 */
public interface ITradingService {
 void lockCart(String user);
 String beginCheckout(String user,String key,String fingerprint);void finishCheckout(String user,String key,String orderId);
 OrderAggregate create(String id,String buyer,String merchant,String store,List<OrderItemEntity> items,Instant deadline);
 OrderAggregate order(String id,boolean lock);void save(OrderAggregate order);List<OrderAggregate> orders(String buyer,String merchant,String status,int page,int size);List<OrderAggregate> orders(String buyer,String merchant,String status,int page,int size,String q);
 long countOrders(String buyer,String merchant,String status);long countOrders(String buyer,String merchant,String status,String q);
 void recordPayment(OrderAggregate order);void recordRefund(OrderAggregate order);List<String> expired();
 List<CartItemVO> cart(String user);void setCart(String user,String merchant,String sku,int quantity);void addCart(String user,String merchant,String sku,int quantity);void deleteCart(String user,String sku);void consumeCart(String user,List<OrderItemEntity> items);
 long countAfterSales(String buyer,String merchant,String status);
 AfterSaleVO afterSale(String order,boolean lock);AfterSaleVO requestAfterSale(OrderAggregate order,String buyer,String reason);
 void rejectAfterSale(String order,String reason);void appeal(OrderAggregate order,String buyer);void approveAfterSale(String order,String reason);
 List<AfterSaleVO> afterSales(String buyer,String merchant,String status,int page,int size);TradingStatsVO statistics(String merchant);
}
