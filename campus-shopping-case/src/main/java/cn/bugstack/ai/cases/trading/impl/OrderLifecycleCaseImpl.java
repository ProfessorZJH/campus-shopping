package cn.bugstack.ai.cases.trading.impl;
import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.domain.trading.service.ITradingService;import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupTokenVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;import cn.bugstack.ai.domain.identity.service.IAccessService;import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.types.enums.ResponseCode;import static cn.bugstack.ai.types.common.Checks.*;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;import java.time.*;import java.util.*;
/** 跨域写入不吞异常；事务代理回滚后才由 Controller 转换失败响应。 */
@Service
public class OrderLifecycleCaseImpl implements IOrderLifecycleCase {
 private final ITradingService trading;private final IFulfillmentService fulfillment;private final IInventoryService inventory;private final IAccessService access;private final IUserAccountService accounts;private final IMerchantService merchants;private final Clock clock;
 public OrderLifecycleCaseImpl(ITradingService trading,IFulfillmentService fulfillment,IInventoryService inventory,IAccessService access,IUserAccountService accounts,IMerchantService merchants,Clock clock){this.trading=trading;this.fulfillment=fulfillment;this.inventory=inventory;this.access=access;this.accounts=accounts;this.merchants=merchants;this.clock=clock;}
 @Transactional(rollbackFor=Exception.class)
 public OrderAggregate pay(String buyer,String id){accounts.requireActive(buyer);OrderAggregate o=trading.order(id,true);o.requireBuyer(buyer);if(o.pay(clock.instant())){merchants.requireActiveForNewTrade(o.getMerchantId());trading.recordPayment(o);fulfillment.create(id,o.getMerchantId(),o.getStoreId(),buyer);trading.save(o);}return o;}
 @Transactional(rollbackFor=Exception.class)
 public OrderAggregate cancel(String buyer,String id){accounts.requireActive(buyer);OrderAggregate o=trading.order(id,true);o.requireBuyer(buyer);if(o.cancel()){inventory.release(id);trading.save(o);}return o;}
 @Transactional(rollbackFor=Exception.class)
 public void expire(String id){OrderAggregate o=trading.order(id,true);if(o.expire(clock.instant())){inventory.release(id);trading.save(o);}}
 @Transactional(rollbackFor=Exception.class)
 public void prepare(String actor,String merchant,String id,boolean ready){access.requirePermission(actor,merchant,"order.prepare");OrderAggregate o=trading.order(id,true);require(o.getMerchantId().equals(merchant),ResponseCode.AUTH_FORBIDDEN);require(o.getStatusEnum()==OrderStatusEnumVO.PAID,ResponseCode.ORDER_STATE_INVALID);fulfillment.prepare(id,ready);}
 @Transactional(rollbackFor=Exception.class)
 public PickupTokenVO token(String buyer,String id){accounts.requireActive(buyer);OrderAggregate o=trading.order(id,true);o.requireBuyer(buyer);require(o.getStatusEnum()==OrderStatusEnumVO.PAID,ResponseCode.ORDER_STATE_INVALID);requireNoPendingRefund(id);return fulfillment.issue(id);}
 @Transactional(rollbackFor=Exception.class)
 public OrderAggregate verify(String actor,String merchant,String id,String token){access.requirePermission(actor,merchant,"pickup.verify");OrderAggregate o=trading.order(id,true);require(o.getMerchantId().equals(merchant),ResponseCode.AUTH_FORBIDDEN);require(EnumSet.of(OrderStatusEnumVO.PAID,OrderStatusEnumVO.COMPLETED).contains(o.getStatusEnum()),ResponseCode.ORDER_STATE_INVALID);requireNoPendingRefund(id);
  if(fulfillment.verify(id,token,actor)){inventory.consume(id);o.complete();trading.save(o);access.audit(actor,"PICKUP_COMPLETED",id,merchant,"凭证核销成功");}return o;
 }
 private void requireNoPendingRefund(String order){AfterSaleVO a=trading.afterSale(order,true);require(a==null||!EnumSet.of(AfterSaleStatusEnumVO.REQUESTED,AfterSaleStatusEnumVO.DISPUTED,AfterSaleStatusEnumVO.APPROVED).contains(a.statusEnum()),ResponseCode.REFUND_STATE_INVALID);}
 @Transactional(rollbackFor=Exception.class)
 public AfterSaleVO requestRefund(String buyer,String id,String reason){accounts.requireActive(buyer);OrderAggregate o=trading.order(id,true);return trading.requestAfterSale(o,buyer,reason);}
 @Transactional(rollbackFor=Exception.class)
 public void appeal(String buyer,String id){accounts.requireActive(buyer);OrderAggregate o=trading.order(id,true);trading.appeal(o,buyer);}
 @Transactional(rollbackFor=Exception.class)
 public void decideRefund(String actor,String merchant,String id,boolean approved,String reason,boolean platform){
  if(platform)access.requireAdmin(actor);else access.requirePermission(actor,merchant,"aftersale.review");
  OrderAggregate o=trading.order(id,true);if(!platform)require(o.getMerchantId().equals(merchant),ResponseCode.AUTH_FORBIDDEN);
  AfterSaleVO a=trading.afterSale(id,true);require(a!=null,ResponseCode.NOT_FOUND);
  if(a.statusEnum()==AfterSaleStatusEnumVO.APPROVED&&o.getStatusEnum()==OrderStatusEnumVO.REFUNDED&&approved)return;
  require(o.getStatusEnum()==OrderStatusEnumVO.PAID,ResponseCode.REFUND_STATE_INVALID);
  if(!platform)require(a.statusEnum()!=AfterSaleStatusEnumVO.DISPUTED,ResponseCode.AUTH_FORBIDDEN);
  if(approved){trading.approveAfterSale(id,reason);fulfillment.cancel(id);inventory.release(id);trading.recordRefund(o);o.refund();trading.save(o);}else trading.rejectAfterSale(id,reason);
  access.audit(actor,approved?"REFUND_APPROVED":"REFUND_REJECTED",id,o.getMerchantId(),text(reason,"审核意见",500));
 }
}
