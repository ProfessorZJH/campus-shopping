package cn.bugstack.ai.infrastructure.adapter.repository;
import cn.bugstack.ai.domain.inventory.adapter.repository.IInventoryRepository;
import cn.bugstack.ai.domain.inventory.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.IInventoryDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import static cn.bugstack.ai.types.common.Checks.require;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;
import java.util.*;
/** 库存仓储实现：对象映射、并发版本写入、审计落盘。 */
@Repository
public class InventoryRepository implements IInventoryRepository {
 @Resource private IInventoryDao dao;
 public long countStocks(String merchant){return countStocks(merchant,"");}
 public long countStocks(String merchant,String q){return dao.countStocks(merchant,q);}
 public long countMovements(String merchant){return dao.countMovements(merchant);}
 public void initialize(String merchant,String store,String sku){dao.initialize(merchant,store,sku);}
 public StockVO stock(String store,String sku,boolean lock){return convert(dao.stock(store,sku,lock));}
 public List<StockVO> stocks(List<String> skus){return skus.isEmpty()?List.of():dao.stocks(skus).stream().map(this::convert).toList();}
 public List<StockVO> list(String merchant,int offset,int size){return list(merchant,offset,size,"");}
 public List<StockVO> list(String merchant,int offset,int size,String q){return dao.list(merchant,offset,size,q).stream().map(this::convert).toList();}
 public void save(StockVO s){require(dao.save(StockPO.builder().merchantId(s.merchantId()).storeId(s.storeId()).skuId(s.skuId()).onHand(s.onHand()).reserved(s.reserved()).version(s.version()).build())==1,ResponseCode.STATE_CONFLICT);}
 public ReservationVO reservation(String order,String sku){return reservation(dao.reservation(order,sku));}
 public List<ReservationVO> reservations(String order){return dao.reservations(order).stream().map(this::reservation).toList();}
 public void reserve(ReservationVO r){dao.reserve(ReservationPO.builder().orderId(r.orderId()).storeId(r.storeId()).skuId(r.skuId()).quantity(r.quantity()).status(r.status()).build());}
 public void transition(String order,String sku,ReservationStatusEnumVO status){require(dao.transition(order,sku,status.name())==1,ResponseCode.STATE_CONFLICT);}
 public Integer movementQuantity(String store,String sku,StockMovementTypeEnumVO type,String key){StockMovementPO p=dao.movement(store,sku,type.name(),key);return p==null?null:p.getQuantity();}
 public void movement(StockVO s,StockMovementTypeEnumVO type,int q,String key){dao.recordMovement(StockMovementPO.builder().id(UUID.randomUUID().toString()).merchantId(s.merchantId()).storeId(s.storeId()).skuId(s.skuId()).type(type.name()).quantity(q).bizKey(key).build());}
 public List<StockMovementVO> movements(String merchant,int offset,int size){return dao.movements(merchant,offset,size).stream().map(p->new StockMovementVO(p.getId(),p.getSkuId(),p.getType(),p.getQuantity(),p.getBizKey(),p.getCreatedAt())).toList();}
 private StockVO convert(StockPO p){return p==null?null:new StockVO(p.getMerchantId(),p.getStoreId(),p.getSkuId(),p.getOnHand(),p.getReserved(),p.getVersion());}
 private ReservationVO reservation(ReservationPO p){return p==null?null:new ReservationVO(p.getOrderId(),p.getStoreId(),p.getSkuId(),p.getQuantity(),p.getStatus());}
}
