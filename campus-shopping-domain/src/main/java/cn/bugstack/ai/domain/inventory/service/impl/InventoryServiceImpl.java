package cn.bugstack.ai.domain.inventory.service.impl;
import cn.bugstack.ai.domain.inventory.adapter.repository.IInventoryRepository;
import cn.bugstack.ai.domain.inventory.model.aggregate.StockBalanceAggregate;
import cn.bugstack.ai.domain.inventory.model.valobj.*;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.types.enums.ResponseCode;
import static cn.bugstack.ai.types.common.Checks.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
/** 按 SKU 固定顺序加锁，库存、预占和流水在外层用例同一事务提交。 */
@Service
public class InventoryServiceImpl implements IInventoryService {
 private final IInventoryRepository repository;
 public InventoryServiceImpl(IInventoryRepository repository){this.repository=repository;}
 @Transactional(propagation=Propagation.MANDATORY)
 public void initialize(String merchant,String store,String sku){repository.initialize(merchant,store,sku);require(merchant.equals(required(store,sku).merchantId()),ResponseCode.AUTH_FORBIDDEN);}
 @Transactional(propagation=Propagation.MANDATORY)
 public void replenish(String merchant,String store,String sku,int quantity,String requestKey){
  String key=text(requestKey,"补货请求标识",64);StockVO s=required(store,sku);require(merchant.equals(s.merchantId()),ResponseCode.AUTH_FORBIDDEN);
  Integer previous=repository.movementQuantity(store,sku,"REPLENISH",key);
  if(previous!=null){require(previous==quantity,ResponseCode.REQUEST_CONFLICT);return;}
  StockBalanceAggregate balance=new StockBalanceAggregate(s.onHand(),s.reserved());balance.replenish(quantity);
  save(s,balance);repository.movement(s,"REPLENISH",quantity,key);
 }
 @Transactional(propagation=Propagation.MANDATORY)
 public void reserve(String order,String merchant,String store,List<SkuQuantityVO> items){
  require(items!=null&&!items.isEmpty()&&items.size()<=20,ResponseCode.ILLEGAL_PARAMETER);
  Set<String> seen=new HashSet<>();for(SkuQuantityVO item:items)require(item!=null&&seen.add(item.skuId())&&item.quantity()>0&&item.quantity()<=99,ResponseCode.ILLEGAL_PARAMETER);
  for(SkuQuantityVO item:items.stream().sorted(Comparator.comparing(SkuQuantityVO::skuId)).toList())reserveOne(order,merchant,store,item);
 }
 private void reserveOne(String order,String merchant,String store,SkuQuantityVO item){
  StockVO s=required(store,item.skuId());require(merchant.equals(s.merchantId()),ResponseCode.AUTH_FORBIDDEN);
  ReservationVO old=repository.reservation(order,item.skuId());
  if(old!=null){require("RESERVED".equals(old.status())&&old.quantity()==item.quantity()&&store.equals(old.storeId()),ResponseCode.REQUEST_CONFLICT);return;}
  StockBalanceAggregate balance=new StockBalanceAggregate(s.onHand(),s.reserved());balance.reserve(item.quantity());save(s,balance);
  repository.reserve(new ReservationVO(order,store,item.skuId(),item.quantity(),"RESERVED"));repository.movement(s,"RESERVE",item.quantity(),order);
 }
 @Transactional(propagation=Propagation.MANDATORY) public void release(String order){finish(order,false);}
 @Transactional(propagation=Propagation.MANDATORY) public void consume(String order){finish(order,true);}
 private void finish(String order,boolean consumed){
  List<ReservationVO> reservations=repository.reservations(order);require(!reservations.isEmpty(),ResponseCode.STOCK_STATE_INVALID);
  String next=consumed?"CONSUMED":"RELEASED";
  for(ReservationVO r:reservations){
   if(next.equals(r.status()))continue;
   require("RESERVED".equals(r.status()),ResponseCode.STOCK_STATE_INVALID);StockVO s=required(r.storeId(),r.skuId());
   StockBalanceAggregate balance=new StockBalanceAggregate(s.onHand(),s.reserved());if(consumed)balance.consume(r.quantity());else balance.release(r.quantity());
   save(s,balance);repository.transition(order,r.skuId(),next);repository.movement(s,consumed?"CONSUME":"RELEASE",r.quantity(),order);
  }
 }
 private StockVO required(String store,String sku){StockVO s=repository.stock(store,sku,true);require(s!=null,ResponseCode.NOT_FOUND);return s;}
 private void save(StockVO s,StockBalanceAggregate balance){repository.save(new StockVO(s.merchantId(),s.storeId(),s.skuId(),balance.getOnHand(),balance.getReserved(),s.version()));}
 public long countStocks(String merchant){return countStocks(merchant,"");}
 public long countStocks(String merchant,String q){return repository.countStocks(merchant,optional(q,100));}
 public long countMovements(String merchant){return repository.countMovements(merchant);}
 public List<StockVO> stocks(List<String> ids){require(ids!=null&&ids.size()<=1000,ResponseCode.ILLEGAL_PARAMETER);return repository.stocks(ids);}
 public List<StockVO> list(String merchant,int page,int size){return list(merchant,page,size,"");}
 public List<StockVO> list(String merchant,int page,int size,String q){return repository.list(merchant,offset(page,size),size,optional(q,100));}
 public List<StockMovementVO> movements(String merchant,int page,int size){return repository.movements(merchant,offset(page,size),size);}
}
