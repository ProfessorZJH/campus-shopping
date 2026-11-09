package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;

public record AgentSkuFactVO(String skuId, String specKey, long priceCent, long priceVersion, long availableQuantity) {
    public AgentSkuFactVO {
        require(skuId != null && !skuId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(specKey != null && !specKey.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(priceCent > 0 && priceVersion >= 0 && availableQuantity > 0, ResponseCode.PRODUCT_UNAVAILABLE);
    }
}
