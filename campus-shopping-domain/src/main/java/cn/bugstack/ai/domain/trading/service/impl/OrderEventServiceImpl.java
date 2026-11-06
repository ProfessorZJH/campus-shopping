package cn.bugstack.ai.domain.trading.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.trading.adapter.repository.IOrderEventRepository;
import cn.bugstack.ai.domain.trading.model.valobj.OrderEventVO;
import cn.bugstack.ai.domain.trading.service.IOrderEventService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 事件随成功状态转换在同库事务内写入；重复调用由唯一键忽略，不制造重复成功记录。 */
@Service
public class OrderEventServiceImpl implements IOrderEventService {

    private final IOrderEventRepository repository;
    private final Clock clock;

    public OrderEventServiceImpl(IOrderEventRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String orderId, String afterSaleId, String type, String actorId, String actorRole, String reason) {
        String order = text(orderId, "订单编号", 64);
        String eventType = text(type, "事件类型", 32);
        require(eventType.matches("[A-Z_]{3,32}"), ResponseCode.ILLEGAL_PARAMETER);
        String sale = optional(afterSaleId, 64);
        String actor = optional(actorId, 64);
        String role = optional(actorRole, 24);
        String detail = optional(reason, 500);
        String dedupe = (sale.isBlank() ? "" : sale + ":") + eventType;
        repository.append(new OrderEventVO(UUID.randomUUID().toString(), order, sale.isBlank() ? null : sale, eventType, clock.instant(), actor, role, detail));
    }

    @Override
    public List<OrderEventVO> events(String orderId) {
        return repository.events(text(orderId, "订单编号", 64));
    }

    @Override
    public Map<String, List<OrderEventVO>> eventsByOrders(List<String> orderIds) {
        require(orderIds != null && orderIds.size() <= 100, ResponseCode.ILLEGAL_PARAMETER);
        List<String> ids = orderIds.stream().distinct().toList();
        return ids.isEmpty() ? Map.of() : repository.eventsByOrders(ids).stream().collect(Collectors.groupingBy(OrderEventVO::orderId));
    }
}
