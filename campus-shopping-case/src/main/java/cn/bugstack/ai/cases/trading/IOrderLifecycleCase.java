package cn.bugstack.ai.cases.trading;

import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupTokenVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderReviewVO;
import cn.bugstack.ai.domain.trading.service.IOrderExpiryHandler;
import java.util.List;

/** 支付、关闭、履约和售后均以订单行锁为竞争边界。 */
public interface IOrderLifecycleCase extends IOrderExpiryHandler {
    OrderReadModel pay(String buyer, String order);

    default OrderReadModel pay(String buyer, String order, String channel) {
        return pay(buyer, order);
    }

    OrderReadModel cancel(String buyer, String order);
    void expire(String order);
    void startPreparing(String actor, String merchant, String order);
    void markReady(String actor, String merchant, String order);
    PickupTokenVO issuePickupToken(String buyer, String order);
    OrderReadModel verifyPickup(String actor, String merchant, String order, String token);

    default OrderReadModel quickVerifyPickup(String actor, String merchant, String code) {
        throw new UnsupportedOperationException("quickVerifyPickup not supported");
    }

    AfterSaleVO requestRefund(String buyer, String order, String reason);

    default AfterSaleVO requestRefund(String buyer, String order, String reason, String evidenceImageUrl) {
        return requestRefund(buyer, order, reason);
    }

    default List<OrderReviewVO> submitOrderReview(String buyer, String orderId, int rating, String tags, String content) {
        return List.of();
    }

    void appeal(String buyer, String order);
    void merchantApproveRefund(String actor, String merchant, String order, String reason);
    void merchantRejectRefund(String actor, String merchant, String order, String reason);
    void platformApproveRefund(String actor, String order, String reason);
    void platformRejectRefund(String actor, String order, String reason);
}
