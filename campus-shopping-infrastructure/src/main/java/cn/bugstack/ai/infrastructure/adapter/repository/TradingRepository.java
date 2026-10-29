package cn.bugstack.ai.infrastructure.adapter.repository;
import cn.bugstack.ai.domain.trading.adapter.repository.ITradingRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import static cn.bugstack.ai.types.common.Checks.require;
import jakarta.annotation.Resource;import org.springframework.stereotype.Repository;
import java.util.*;import java.time.*;
/** 订单、支付及售后均为本地模拟交易事实；外部支付未接入。 */
@Repository
public class TradingRepository implements ITradingRepository {
 @Resource private ITradingDao dao;
 public void lockCart(String user){dao.ensureCart(user);dao.lockCart(user);}
 public CheckoutRequestVO begin(String user,String key,String fingerprint){dao.gate(user,key,fingerprint);CheckoutRequestPO p=dao.request(user,key);return new CheckoutRequestVO(p.getUserId(),p.getRequestKey(),p.getFingerprint(),p.getOrderId());}
 public void finishRequest(String user,String key,String order){require(dao.finishRequest(user,key,order)==1,ResponseCode.REQUEST_CONFLICT);}
 public void insert(OrderAggregate o){
  dao.insertOrder(OrderPO.builder().id(o.getId()).buyerId(o.getBuyerId()).merchantId(o.getMerchantId()).storeId(o.getStoreId()).totalCent(o.getTotalCent()).status(o.getStatus()).deadline(o.getDeadline()).createdAt(o.getCreatedAt()).build());
  for(OrderItemEntity i:o.getItems())dao.insertItem(OrderItemPO.builder().orderId(o.getId()).skuId(i.skuId()).title(i.title()).specKey(i.specKey()).imageUrl(i.imageUrl()==null?"":i.imageUrl()).unitPriceCent(i.unitPriceCent()).quantity(i.quantity()).build());
 }
 public OrderAggregate order(String id,boolean lock){return convert(dao.order(id,lock),lock);}
 public void save(OrderAggregate o){require(dao.saveOrder(o.getId(),o.getStatus())==1,ResponseCode.NOT_FOUND);}
 public List<OrderAggregate> orders(String buyer,String merchant,String status,int offset,int size){return orders(buyer,merchant,status,offset,size,"");}
 public List<OrderAggregate> orders(String buyer,String merchant,String status,int offset,int size,String q){return dao.orders(buyer,merchant,status,offset,size,q).stream().map(this::convert).toList();}
 public long countOrders(String buyer,String merchant,String status){return countOrders(buyer,merchant,status,"");}
 public long countOrders(String buyer,String merchant,String status,String q){return dao.countOrders(buyer,merchant,status,q);}
 public List<String> expired(Instant now){return dao.expired(now);}
 public void payment(String order,long amount){dao.payment(order,amount);}public void refund(String order,long amount){dao.refund(order,amount);}
 public List<CartItemVO> cart(String user){return dao.cart(user).stream().map(this::cartItem).toList();}
 public CartItemVO cartItem(String user,String sku){return cartItem(dao.cartItem(user,sku));}
 public void setCart(String user,String merchant,String sku,int quantity){dao.setCart(user,merchant,sku,quantity);}public void deleteCart(String user,String sku){dao.deleteCart(user,sku);}
 public long countAfterSales(String buyer,String merchant,String status){return dao.countAfterSales(buyer,merchant,status);}
 public AfterSaleVO afterSale(String order,boolean lock){return afterSale(dao.afterSale(order,lock));}
 public void insertAfterSale(AfterSaleVO a){dao.insertAfterSale(AfterSalePO.builder().id(a.id()).orderId(a.orderId()).buyerId(a.buyerId()).merchantId(a.merchantId()).status(a.status()).reason(a.reason()).decisionReason(a.decisionReason()).createdAt(a.createdAt()).build());}
 public void saveAfterSale(String id,String status,String reason){require(dao.saveAfterSale(id,status,reason)==1,ResponseCode.NOT_FOUND);}
 public List<AfterSaleVO> afterSales(String buyer,String merchant,String status,int offset,int size){return dao.afterSales(buyer,merchant,status,offset,size).stream().map(this::afterSale).toList();}
 public TradingStatsVO statistics(String merchant){TradingStatsPO p=dao.statistics(merchant);return new TradingStatsVO(p.getTotalOrders(),p.getPendingCount(),p.getPaidCount(),p.getCompletedCount(),p.getRefundedCount(),p.getCompletedAmountCent());}
 private OrderAggregate convert(OrderPO p){return convert(p,false);}
 private OrderAggregate convert(OrderPO p,boolean lock){
  if(p==null)return null;
  List<OrderItemEntity> items=dao.items(p.getId(),lock).stream().map(i->new OrderItemEntity(i.getSkuId(),i.getTitle(),i.getSpecKey(),i.getUnitPriceCent(),i.getQuantity(),i.getImageUrl()==null?"":i.getImageUrl())).toList();
  OrderAggregate order=new OrderAggregate(p.getId(),p.getBuyerId(),p.getMerchantId(),p.getStoreId(),items,p.getStatus(),p.getDeadline(),p.getCreatedAt());
  require(order.getTotalCent()==p.getTotalCent(),ResponseCode.UN_ERROR);return order;
 }
 private CartItemVO cartItem(CartItemPO p){return p==null?null:new CartItemVO(p.getUserId(),p.getMerchantId(),p.getSkuId(),p.getQuantity());}
 private AfterSaleVO afterSale(AfterSalePO p){return p==null?null:new AfterSaleVO(p.getId(),p.getOrderId(),p.getBuyerId(),p.getMerchantId(),p.getStatus(),p.getReason(),p.getDecisionReason(),p.getCreatedAt());}
}
