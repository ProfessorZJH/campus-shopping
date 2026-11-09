package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

import cn.bugstack.ai.types.enums.ResponseCode;

/** 订单商品成交快照的最小只读投影。 */
public record AgentOrderItemSummaryVO(String skuId, String title, String specKey, long unitPriceCent, int quantity) {
    public AgentOrderItemSummaryVO {
        skuId = text(skuId, "规格", 64);
        title = text(title, "商品标题", 200);
        specKey = text(specKey, "规格描述", 200);
        require(unitPriceCent >= 0 && unitPriceCent <= 100_000_000L, ResponseCode.ILLEGAL_PARAMETER);
        require(quantity >= 1 && quantity <= 99, ResponseCode.ILLEGAL_PARAMETER);
    }
}
