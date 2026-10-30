package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.*;
import java.time.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface IInventoryDao {
    long countMovements(@Param("merchantId") String merchant);
    int initialize(@Param("merchantId") String merchantId, @Param("storeId") String storeId, @Param("skuId") String skuId);
    StockPO stock(@Param("storeId") String storeId, @Param("skuId") String skuId, @Param("lock") boolean lock);
    List<StockPO> stocks(@Param("skuIds") List<String> skuIds);
    List<StockPO> stocksForUpdate(@Param("skuIds") List<String> skuIds);
    int save(@Param("p") StockPO p);
    ReservationPO reservation(@Param("orderId") String orderId, @Param("skuId") String skuId);
    List<ReservationPO> reservations(@Param("orderId") String orderId);
    int reserve(@Param("p") ReservationPO p);
    int transition(@Param("orderId") String orderId, @Param("skuId") String skuId, @Param("status") String status);
    StockMovementPO movement(@Param("storeId") String storeId, @Param("skuId") String skuId, @Param("type") String type, @Param("bizKey") String bizKey);
    int recordMovement(@Param("p") StockMovementPO p);
    List<StockMovementPO> movements(@Param("merchantId") String merchantId, @Param("offset") int offset, @Param("limit") int limit);
}
