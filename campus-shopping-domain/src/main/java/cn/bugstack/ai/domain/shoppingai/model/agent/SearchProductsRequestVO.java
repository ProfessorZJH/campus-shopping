package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;

public record SearchProductsRequestVO(String query, int limit, String merchantId) {
    public SearchProductsRequestVO {
        require(query != null && !query.isBlank() && query.strip().length() <= 2000, ResponseCode.ILLEGAL_PARAMETER);
        require(limit >= 1 && limit <= 20, ResponseCode.ILLEGAL_PARAMETER);
        require(merchantId == null || (!merchantId.isBlank() && merchantId.length() <= 64), ResponseCode.ILLEGAL_PARAMETER);
        query = query.strip();
    }
}
