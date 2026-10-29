package cn.bugstack.ai.domain.inventory.adapter.repository;
import cn.bugstack.ai.domain.inventory.model.valobj.*;
import java.util.*;
/** 仅抽象本地库存记录和流水，不接收外部可信度不明的库存结果。 */
public interface IInventoryRepository {
 long countStocks(String merchant);long countStocks(String merchant,String q);long countMovements(String merchant);
 void initialize(String merchant,String store,String sku);StockVO stock(String store,String sku,boolean lock);
 List<StockVO> stocks(List<String> skus);List<StockVO> list(String merchant,int offset,int size);List<StockVO> list(String merchant,int offset,int size,String q);void save(StockVO stock);
 ReservationVO reservation(String order,String sku);List<ReservationVO> reservations(String order);void reserve(ReservationVO reservation);void transition(String order,String sku,String status);
 Integer movementQuantity(String store,String sku,String type,String key);void movement(StockVO stock,String type,int quantity,String key);
 List<StockMovementVO> movements(String merchant,int offset,int size);
}
