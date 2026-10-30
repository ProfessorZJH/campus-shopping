package cn.bugstack.ai.cases.trading;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.CheckoutItemEntity;
import java.util.*;

/** 单商户订单创建与全部库存预占的原子用例。 */
public interface ICheckoutCase {
    OrderAggregate checkout(String buyer, String merchant, List<CheckoutItemEntity> items, String requestKey);
}
