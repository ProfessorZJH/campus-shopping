package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.*;
import java.time.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface ITradingDao {
    List<OrderItemPO> itemsByOrders(@Param("ids") List<String> ids);
    List<AfterSalePO> afterSalesByOrders(@Param("ids") List<String> ids);
    int ensureCart(@Param("user") String user);
    String lockCart(@Param("user") String user);
    int gate(@Param("user") String user, @Param("key") String key, @Param("fingerprint") String fingerprint);
    CheckoutRequestPO request(@Param("user") String user, @Param("key") String key);
    int finishRequest(@Param("user") String user, @Param("key") String key, @Param("order") String order);
    int insertOrder(@Param("p") OrderPO p);
    int insertItem(@Param("p") OrderItemPO p);
    OrderPO order(@Param("id") String id, @Param("lock") boolean lock);
    List<OrderItemPO> items(@Param("id") String id, @Param("lock") boolean lock);
    int saveOrder(@Param("id") String id, @Param("status") String status);
    List<OrderPO> orders(
        @Param("buyer") String buyer,
        @Param("merchant") String merchant,
        @Param("status") String status,
        @Param("offset") int offset,
        @Param("limit") int limit,
        @Param("q") String q
    );
    long countOrders(@Param("buyer") String buyer, @Param("merchant") String merchant, @Param("status") String status, @Param("q") String q);
    List<String> expired(@Param("now") Instant now);
    int payment(@Param("order") String order, @Param("amount") long amount);
    int refund(@Param("order") String order, @Param("amount") long amount);
    List<CartItemPO> cart(@Param("user") String user);
    List<String> cartSkuIdsForUpdate(@Param("user") String user);
    CartItemPO cartItem(@Param("user") String user, @Param("sku") String sku);
    int setCart(@Param("user") String user, @Param("merchant") String merchant, @Param("sku") String sku, @Param("quantity") int quantity);
    int deleteCart(@Param("user") String user, @Param("sku") String sku);
    long countAfterSales(@Param("buyer") String buyer, @Param("merchant") String merchant, @Param("status") String status);
    AfterSalePO afterSale(@Param("order") String order, @Param("lock") boolean lock);
    int insertAfterSale(@Param("p") AfterSalePO p);
    int saveAfterSale(@Param("id") String id, @Param("status") String status, @Param("reason") String reason);
    List<AfterSalePO> afterSales(
        @Param("buyer") String buyer,
        @Param("merchant") String merchant,
        @Param("status") String status,
        @Param("offset") int offset,
        @Param("limit") int limit
    );
    TradingStatsPO statistics(@Param("merchant") String merchant);
}
