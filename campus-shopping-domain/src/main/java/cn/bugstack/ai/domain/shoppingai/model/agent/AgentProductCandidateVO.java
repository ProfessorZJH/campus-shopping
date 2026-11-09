package cn.bugstack.ai.domain.shoppingai.model.agent;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.List;

public record AgentProductCandidateVO(
    String productId,
    String merchantId,
    String storeId,
    String title,
    String source,
    boolean factVerified,
    List<AgentSkuFactVO> offers
) {
    public AgentProductCandidateVO {
        require(productId != null && !productId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(merchantId != null && !merchantId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(storeId != null && !storeId.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(title != null && !title.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        require(source != null && !source.isBlank(), ResponseCode.ILLEGAL_PARAMETER);
        offers = List.copyOf(offers == null ? List.of() : offers);
        require(!offers.isEmpty(), ResponseCode.PRODUCT_UNAVAILABLE);
    }
}
