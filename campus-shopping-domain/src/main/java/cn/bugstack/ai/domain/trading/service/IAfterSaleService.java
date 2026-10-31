package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IAfterSaleService extends IAfterSaleQueryService {
    AfterSaleVO afterSaleForUpdate(String order);
    AfterSaleVO requestAfterSale(OrderAggregate order, String buyer, String reason);
    void requirePickupAllowed(String order);
    void rejectAfterSale(String order, String reason);
    void appeal(OrderAggregate order, String buyer);
    void approveAfterSale(String order, String reason);
}
