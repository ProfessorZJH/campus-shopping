package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.OrderEventPO;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 订单事件只追加 DAO。 */
@Mapper
public interface IOrderEventDao {
    int insert(@Param("p") OrderEventPO event);

    List<OrderEventPO> events(@Param("orderId") String orderId);

    List<OrderEventPO> eventsByOrders(@Param("orderIds") List<String> orderIds);
}
