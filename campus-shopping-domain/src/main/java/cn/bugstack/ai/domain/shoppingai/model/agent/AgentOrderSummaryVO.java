package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Instant;
import java.util.List;

/** 不含取货、售后和事件时间线的本人订单摘要。 */
public record AgentOrderSummaryVO(String orderId, String status, long totalCent, Instant createdAt, String merchantName, List<AgentOrderItemSummaryVO> items) {
    public AgentOrderSummaryVO {
        orderId = text(orderId, "订单", 64);
        status = AgentOrderStateVO.filter(status);
        require(totalCent >= 0 && totalCent <= 2_000_000_000L, ResponseCode.ILLEGAL_PARAMETER);
        require(createdAt != null, ResponseCode.ILLEGAL_PARAMETER);
        merchantName = text(merchantName, "商户名称", 200);
        items = List.copyOf(items == null ? List.of() : items);
        require(!items.isEmpty() && items.size() <= 20, ResponseCode.ILLEGAL_PARAMETER);
    }
}
