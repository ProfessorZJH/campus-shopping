package cn.bugstack.ai.domain.trading.service.impl;
import cn.bugstack.ai.domain.trading.adapter.repository.ITradingRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.domain.trading.service.ITradingService;
import cn.bugstack.ai.types.enums.ResponseCode;
import static cn.bugstack.ai.types.common.Checks.*;
import java.util.*;import java.time.*;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.*;
/** 订单状态、购物车和售后规则；不访问库存和履约内部对象。 */
@Service
public class TradingServiceImpl implements ITradingService {
 private final ITradingRepository repository;private final Clock clock;
 public TradingServiceImpl(ITradingRepository repository,Clock clock){this.repository=repository;this.clock=clock;}
 @Transactional(propagation=Propagation.MANDATORY)
 public String beginCheckout(String user,String key,String fingerprint){CheckoutRequestVO r=repository.begin(user,text(key,"幂等键",64),fingerprint);require(fingerprint.equals(r.fingerprint()),ResponseCode.REQUEST_CONFLICT);return r.orderId();}
 @Transactional(propagation=Propagation.MANDATORY) public void finishCheckout(String user,String key,String orderId){repository.finishRequest(user,key,orderId);}
 @Transactional(propagation=Propagation.MANDATORY)
 public OrderAggregate create(String id,String buyer,String merchant,String store,List<OrderItemEntity> items,Instant deadline){OrderAggregate o=new OrderAggregate(id,buyer,merchant,store,items,"PENDING_PAYMENT",deadline,clock.instant());repository.insert(o);return o;}
 public OrderAggregate order(String id,boolean lock){OrderAggregate o=repository.order(text(id,"订单编号",64),lock);require(o!=null,ResponseCode.NOT_FOUND);return o;}
 @Transactional(propagation=Propagation.MANDATORY) public void save(OrderAggregate order){repository.save(order);}
 public List<OrderAggregate> orders(String buyer,String merchant,String status,int page,int size){return orders(buyer,merchant,status,page,size,"");}
 public List<OrderAggregate> orders(String buyer,String merchant,String status,int page,int size,String q){return repository.orders(buyer,merchant,optional(status,24),offset(page,size),size,optional(q,100));}
 public long countOrders(String buyer,String merchant,String status){return countOrders(buyer,merchant,status,"");}
 public long countOrders(String buyer,String merchant,String status,String q){return repository.countOrders(buyer,merchant,optional(status,24),optional(q,100));}
 @Transactional(propagation=Propagation.MANDATORY) public void recordPayment(OrderAggregate o){repository.payment(o.getId(),o.getTotalCent());}
 @Transactional(propagation=Propagation.MANDATORY) public void recordRefund(OrderAggregate o){repository.refund(o.getId(),o.getTotalCent());}
 public List<String> expired(){return repository.expired(clock.instant());}
 @Transactional(propagation=Propagation.MANDATORY) public void lockCart(String user){repository.lockCart(user);}
 public List<CartItemVO> cart(String user){return repository.cart(user);}
 @Transactional(propagation=Propagation.MANDATORY)
 public void setCart(String user,String merchant,String sku,int quantity){repository.lockCart(user);require(quantity>0&&quantity<=99,ResponseCode.ILLEGAL_PARAMETER);CartItemVO old=repository.cartItem(user,sku);require(old!=null||repository.cart(user).size()<100,ResponseCode.ILLEGAL_PARAMETER);repository.setCart(user,merchant,sku,quantity);}
 @Transactional(propagation=Propagation.MANDATORY)
 public void addCart(String user,String merchant,String sku,int quantity){repository.lockCart(user);require(quantity>0&&quantity<=99,ResponseCode.ILLEGAL_PARAMETER);CartItemVO old=repository.cartItem(user,sku);int total=quantity+(old==null?0:old.quantity());require(total<=99,ResponseCode.ILLEGAL_PARAMETER);require(old!=null||repository.cart(user).size()<100,ResponseCode.ILLEGAL_PARAMETER);repository.setCart(user,merchant,sku,total);}
 @Transactional(propagation=Propagation.MANDATORY) public void deleteCart(String user,String sku){repository.lockCart(user);repository.deleteCart(user,text(sku,"SKU",64));}
 @Transactional(propagation=Propagation.MANDATORY)
 public void consumeCart(String user,List<OrderItemEntity> items){repository.lockCart(user);
  for(OrderItemEntity i:items.stream().sorted(Comparator.comparing(OrderItemEntity::skuId)).toList()){
   CartItemVO old=repository.cartItem(user,i.skuId());if(old==null)continue;
   if(old.quantity()<=i.quantity())repository.deleteCart(user,i.skuId());else repository.setCart(user,old.merchantId(),i.skuId(),old.quantity()-i.quantity());
  }
 }
 public long countAfterSales(String buyer,String merchant,String status){return repository.countAfterSales(buyer,merchant,optional(status,24));}
 public AfterSaleVO afterSale(String order,boolean lock){return repository.afterSale(order,lock);}
 @Transactional(propagation=Propagation.MANDATORY)
 public AfterSaleVO requestAfterSale(OrderAggregate order,String buyer,String reason){
  order.requireBuyer(buyer);require("PAID".equals(order.getStatus()),ResponseCode.REFUND_STATE_INVALID);String clean=text(reason,"退款原因",500);
  AfterSaleVO old=repository.afterSale(order.getId(),true);if(old!=null){require("REQUESTED".equals(old.status())&&old.reason().equals(clean),ResponseCode.REFUND_STATE_INVALID);return old;}
  AfterSaleVO a=new AfterSaleVO(UUID.randomUUID().toString(),order.getId(),buyer,order.getMerchantId(),"REQUESTED",clean,"",clock.instant());repository.insertAfterSale(a);return a;
 }
 @Transactional(propagation=Propagation.MANDATORY)
 public void rejectAfterSale(String order,String reason){AfterSaleVO a=repository.afterSale(order,true);require(a!=null,ResponseCode.NOT_FOUND);if("REJECTED".equals(a.status()))return;require(Set.of("REQUESTED","DISPUTED").contains(a.status()),ResponseCode.REFUND_STATE_INVALID);repository.saveAfterSale(a.id(),"REJECTED",text(reason,"驳回理由",500));}
 @Transactional(propagation=Propagation.MANDATORY)
 public void appeal(OrderAggregate order,String buyer){order.requireBuyer(buyer);require("PAID".equals(order.getStatus()),ResponseCode.REFUND_STATE_INVALID);AfterSaleVO a=repository.afterSale(order.getId(),true);require(a!=null,ResponseCode.NOT_FOUND);if("DISPUTED".equals(a.status()))return;require("REJECTED".equals(a.status()),ResponseCode.REFUND_STATE_INVALID);repository.saveAfterSale(a.id(),"DISPUTED",a.decisionReason());}
 @Transactional(propagation=Propagation.MANDATORY)
 public void approveAfterSale(String order,String reason){AfterSaleVO a=repository.afterSale(order,true);require(a!=null&&Set.of("REQUESTED","DISPUTED").contains(a.status()),ResponseCode.REFUND_STATE_INVALID);repository.saveAfterSale(a.id(),"APPROVED",text(reason,"退款审核说明",500));}
 public List<AfterSaleVO> afterSales(String buyer,String merchant,String status,int page,int size){return repository.afterSales(buyer,merchant,status,offset(page,size),size);}
 public TradingStatsVO statistics(String merchant){return repository.statistics(merchant);}
}
