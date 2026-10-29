package cn.bugstack.ai.domain.trading.adapter.repository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.util.*;import java.time.*;
/** 交易表的数据访问抽象，不能绕行到库存或履约 DAO。 */
public interface ITradingRepository {
 void lockCart(String user);
 CheckoutRequestVO begin(String user,String key,String fingerprint);void finishRequest(String user,String key,String order);
 void insert(OrderAggregate order);OrderAggregate order(String id,boolean lock);void save(OrderAggregate order);
 long countOrders(String buyer,String merchant,String status);long countOrders(String buyer,String merchant,String status,String q); List<OrderAggregate> orders(String buyer,String merchant,String status,int offset,int size);List<OrderAggregate> orders(String buyer,String merchant,String status,int offset,int size,String q);List<String> expired(Instant now);
 void payment(String order,long amount);void refund(String order,long amount);
 List<CartItemVO> cart(String user);CartItemVO cartItem(String user,String sku);void setCart(String user,String merchant,String sku,int quantity);void deleteCart(String user,String sku);
 long countAfterSales(String buyer,String merchant,String status);
 AfterSaleVO afterSale(String order,boolean lock);void insertAfterSale(AfterSaleVO afterSale);void saveAfterSale(String id,String status,String reason);
 List<AfterSaleVO> afterSales(String buyer,String merchant,String status,int offset,int size);TradingStatsVO statistics(String merchant);
}
