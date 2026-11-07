package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.trading.adapter.repository.IOrderEventRepository;
import cn.bugstack.ai.domain.trading.model.valobj.OrderEventVO;
import cn.bugstack.ai.infrastructure.dao.IOrderEventDao;
import cn.bugstack.ai.infrastructure.dao.po.OrderEventPO;
import jakarta.annotation.Resource;
import java.util.List;
import org.springframework.stereotype.Repository;

/** 事件插入使用 INSERT IGNORE，重复的业务阶段不追加第二条成功记录。 */
@Repository
public class OrderEventRepository implements IOrderEventRepository {

    @Resource
    private IOrderEventDao dao;

    @Override
    public void append(OrderEventVO event, String dedupeKey) {
        dao.insert(
            OrderEventPO.builder()
                .id(event.id())
                .orderId(event.orderId())
                .afterSaleId(event.afterSaleId())
                .eventType(event.type())
                .eventTime(event.occurredAt())
                .actorId(event.actorId())
                .actorRole(event.actorRole())
                .reason(event.reason())
                .dedupeKey(dedupeKey)
                .build()
        );
    }

    @Override
    public List<OrderEventVO> events(String orderId) {
        return dao.events(orderId).stream().map(this::vo).toList();
    }

    @Override
    public List<OrderEventVO> eventsByOrders(List<String> orderIds) {
        return orderIds.isEmpty() ? List.of() : dao.eventsByOrders(orderIds).stream().map(this::vo).toList();
    }

    private OrderEventVO vo(OrderEventPO p) {
        return new OrderEventVO(
            p.getId(),
            p.getOrderId(),
            p.getAfterSaleId(),
            p.getEventType(),
            p.getEventTime(),
            p.getActorId(),
            p.getActorRole(),
            p.getReason()
        );
    }
}
