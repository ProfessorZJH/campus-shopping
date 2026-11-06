package cn.bugstack.ai.domain.inventory.service;

import cn.bugstack.ai.domain.inventory.model.valobj.*;
import java.util.*;

/** 库存唯一修改入口；所有写方法要求外层同库事务。 */
public interface IInventoryService {
    long countStocks(String merchant);
    long countStocks(String merchant, String q);
    long countStocks(String merchant, String q, Integer availableBelow);
    long countMovements(String merchant);
    long countMovements(String merchant, String q);
    void initialize(String merchant, String store, String sku);
    void replenish(String merchant, String store, String sku, int quantity, String requestKey);
    void reserve(String order, String merchant, String store, List<SkuQuantityVO> items);
    void release(String order);
    void consume(String order);
    List<StockVO> stocks(List<String> skus);
    /** 商品写入响应使用锁定后的最新库存，不读取旧事务快照。 */
    List<StockVO> stocksForProductWrite(List<String> skus);
    List<StockVO> stocksForConfirmation(List<String> skus);
    List<StockVO> list(String merchant, int page, int size);
    List<StockVO> list(String merchant, int page, int size, String q);
    List<StockVO> list(String merchant, int page, int size, String q, Integer availableBelow);
    List<StockMovementVO> movements(String merchant, int page, int size);
    List<StockMovementVO> movements(String merchant, int page, int size, String q);
}
