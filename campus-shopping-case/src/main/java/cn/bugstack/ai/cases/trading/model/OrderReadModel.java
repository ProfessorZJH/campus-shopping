package cn.bugstack.ai.cases.trading.model;

import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import java.util.Objects;

/** 用例层组合的订单读模型，不依赖 HTTP DTO。 */
public record OrderReadModel(OrderAggregate order, String merchantName, PickupVO pickup, AfterSaleVO afterSale) {
    public OrderReadModel {
        Objects.requireNonNull(order);
        Objects.requireNonNull(merchantName);
        if (merchantName.isBlank()) throw new IllegalArgumentException("订单商户名不能为空");
    }
}
